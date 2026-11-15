/**
 * Realistic Web Audio Acoustic Instrument Ensemble & Studio Reverb Engine
 * Uses Karplus-Strong physical string modeling, stereo convolution reverb,
 * analog warmth shaping, multi-partial inharmonic pianos, woody upright bass,
 * brushed jazz percussion, bowed chamber strings, and breathy bamboo flute.
 */

import {
  generateKarplusStrongSamples,
  generateRoomImpulseSamples,
  generateSeamlessPinkNoiseSamples,
  generateWarmSaturationCurve,
  getBowlPartialSpecs,
} from './acousticDsp.ts';

export type PluckedPreset = 'nylon_guitar' | 'steel_guitar' | 'concert_harp' | 'zen_koto';

export interface AcousticRoomBus {
  dryIn: GainNode;
  wetIn: GainNode;
  dispose: () => void;
}

export class AcousticEngineCache {
  private impulseBuffer: AudioBuffer | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private saturationCurve: Float32Array | null = null;
  private karplusCache = new Map<string, AudioBuffer>();

  public getImpulseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.impulseBuffer && this.impulseBuffer.sampleRate === ctx.sampleRate) {
      return this.impulseBuffer;
    }
    const [left, right] = generateRoomImpulseSamples(ctx.sampleRate, 1.8, 1.4);
    const buf = ctx.createBuffer(2, left.length, ctx.sampleRate);
    buf.getChannelData(0).set(left);
    buf.getChannelData(1).set(right);
    this.impulseBuffer = buf;
    return buf;
  }

  public getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const samples = generateSeamlessPinkNoiseSamples(ctx.sampleRate, 3.0, 0.08);
    const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buf.getChannelData(0).set(samples);
    this.noiseBuffer = buf;
    return buf;
  }

  public getSaturationCurve(): Float32Array {
    if (!this.saturationCurve) {
      this.saturationCurve = generateWarmSaturationCurve(0.14, 1024);
    }
    return this.saturationCurve;
  }

  public getKarplusBuffer(
    ctx: AudioContext,
    preset: PluckedPreset,
    freqHz: number
  ): AudioBuffer {
    const roundedCents = Math.round(freqHz * 20);
    const key = `${preset}:${roundedCents}:${ctx.sampleRate}`;
    const existing = this.karplusCache.get(key);
    if (existing) return existing;

    const specs: Record<
      PluckedPreset,
      { durationSec: number; damping: number; brightness: number; pluckPosition: number; bodyWarmth: number }
    > = {
      nylon_guitar: {
        durationSec: 2.6,
        damping: 0.9958,
        brightness: 0.24,
        pluckPosition: 0.26,
        bodyWarmth: 0.55,
      },
      steel_guitar: {
        durationSec: 2.9,
        damping: 0.9968,
        brightness: 0.42,
        pluckPosition: 0.21,
        bodyWarmth: 0.48,
      },
      concert_harp: {
        durationSec: 3.4,
        damping: 0.9978,
        brightness: 0.28,
        pluckPosition: 0.36,
        bodyWarmth: 0.38,
      },
      zen_koto: {
        durationSec: 2.4,
        damping: 0.9952,
        brightness: 0.46,
        pluckPosition: 0.16,
        bodyWarmth: 0.42,
      },
    };

    const p = specs[preset];
    const samples = generateKarplusStrongSamples({
      frequencyHz: freqHz,
      sampleRate: ctx.sampleRate,
      durationSec: p.durationSec,
      damping: p.damping,
      brightness: p.brightness,
      pluckPosition: p.pluckPosition,
      bodyWarmth: p.bodyWarmth,
    });

    const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buf.getChannelData(0).set(samples);

    if (this.karplusCache.size > 240) {
      this.karplusCache.clear();
    }
    this.karplusCache.set(key, buf);
    return buf;
  }

  /**
   * Creates an isolated lightweight stereo diffuse studio reverb bus feeding `destNode`.
   * Uses a 4-tap damped feedback delay network instead of heavy FFT ConvolverNode or WaveShaper
   * so mobile/Android browsers never suffer audio-thread buffer underruns or waveshaper clipping.
   */
  public createAcousticRoomBus(
    ctx: AudioContext,
    destNode: AudioNode,
    wetAmount: number = 0.36
  ): AcousticRoomBus {
    const t = ctx.currentTime;

    const dryIn = ctx.createGain();
    dryIn.gain.setValueAtTime(0.85, t);

    const wetIn = ctx.createGain();
    wetIn.gain.setValueAtTime(Math.min(0.45, wetAmount), t);

    // Subsonic highpass removes DC / <40Hz mud that rattles mobile speakers
    const roomHp = ctx.createBiquadFilter();
    roomHp.type = 'highpass';
    roomHp.frequency.setValueAtTime(40, t);
    roomHp.Q.setValueAtTime(0.707, t);

    const outMix = ctx.createGain();
    outMix.gain.setValueAtTime(1.15, t);

    // 4-tap stereo damped studio delay network (prime millisecond times prevent metallic ringing)
    const tapTimesSec = [0.029, 0.041, 0.059, 0.079];
    const merger = typeof ctx.createChannelMerger === 'function' ? ctx.createChannelMerger(2) : null;
    const tapNodes: AudioNode[] = [];

    const wetLp = ctx.createBiquadFilter();
    wetLp.type = 'lowpass';
    wetLp.frequency.setValueAtTime(2400, t);

    const wetOut = ctx.createGain();
    wetOut.gain.setValueAtTime(0.42, t);

    tapTimesSec.forEach((delaySec, idx) => {
      const delay = ctx.createDelay(0.2);
      delay.delayTime.setValueAtTime(delaySec, t);

      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.setValueAtTime(2100 - idx * 220, t);

      const fb = ctx.createGain();
      fb.gain.setValueAtTime(0.36, t);

      wetIn.connect(delay);
      delay.connect(damp);
      damp.connect(fb);
      fb.connect(delay);

      if (merger) {
        damp.connect(merger, 0, idx % 2);
      } else {
        damp.connect(wetLp);
      }

      tapNodes.push(delay, damp, fb);
    });

    if (merger) {
      merger.connect(wetLp);
    }
    wetLp.connect(wetOut);

    dryIn.connect(roomHp);
    wetOut.connect(roomHp);
    roomHp.connect(outMix);
    outMix.connect(destNode);

    return {
      dryIn,
      wetIn,
      dispose: () => {
        try {
          dryIn.disconnect();
          wetIn.disconnect();
          wetLp.disconnect();
          wetOut.disconnect();
          merger?.disconnect();
          roomHp.disconnect();
          outMix.disconnect();
          tapNodes.forEach((n) => {
            try {
              n.disconnect();
            } catch {}
          });
        } catch {}
      },
    };
  }

  /**
   * Route any voice node into stereo panner -> dry & reverb sends.
   */
  private routeToRoom(
    ctx: AudioContext,
    sourceNode: AudioNode,
    room: AcousticRoomBus,
    pan: number = 0,
    wetSend: number = 0.55
  ): () => void {
    const panner =
      typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    const sendGain = ctx.createGain();
    sendGain.gain.setValueAtTime(wetSend, ctx.currentTime);

    if (panner) {
      panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), ctx.currentTime);
      sourceNode.connect(panner);
      panner.connect(room.dryIn);
      panner.connect(sendGain);
      sendGain.connect(room.wetIn);
    } else {
      sourceNode.connect(room.dryIn);
      sourceNode.connect(sendGain);
      sendGain.connect(room.wetIn);
    }

    return () => {
      try {
        panner?.disconnect();
        sendGain.disconnect();
      } catch {}
    };
  }

  /**
   * 1. Karplus-Strong Plucked Acoustic String (Guitar, Concert Harp, Koto)
   */
  public playKarplusPluck(
    ctx: AudioContext,
    room: AcousticRoomBus,
    freqHz: number,
    opts: {
      preset: PluckedPreset;
      gain?: number;
      pan?: number;
      wetSend?: number;
      startTime?: number;
    }
  ): void {
    const t = opts.startTime ?? ctx.currentTime;
    const buf = this.getKarplusBuffer(ctx, opts.preset, freqHz);

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Wooden acoustic body resonance filter
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'peaking';
    bodyFilter.frequency.setValueAtTime(opts.preset === 'concert_harp' ? 190 : 125, t);
    bodyFilter.Q.setValueAtTime(1.4, t);
    bodyFilter.gain.setValueAtTime(2.0, t);

    const softenFilter = ctx.createBiquadFilter();
    softenFilter.type = 'lowpass';
    softenFilter.frequency.setValueAtTime(
      opts.preset === 'nylon_guitar' ? 2400 : opts.preset === 'concert_harp' ? 3000 : 2800,
      t
    );

    const outGain = ctx.createGain();
    const targetGain = opts.gain ?? 0.22;
    outGain.gain.setValueAtTime(0.0001, t);
    outGain.gain.linearRampToValueAtTime(targetGain, t + 0.012);

    src.connect(bodyFilter);
    bodyFilter.connect(softenFilter);
    softenFilter.connect(outGain);
    const cleanupRoom = this.routeToRoom(
      ctx,
      outGain,
      room,
      opts.pan ?? 0,
      opts.wetSend ?? 0.55
    );

    src.onended = () => {
      try {
        src.disconnect();
        bodyFilter.disconnect();
        softenFilter.disconnect();
        outGain.disconnect();
        cleanupRoom();
      } catch {}
    };

    src.start(t);
  }

  /**
   * Guitar / Harp rolled chord strum with natural finger-stagger
   */
  public playGuitarStrum(
    ctx: AudioContext,
    room: AcousticRoomBus,
    notesHz: number[],
    opts: {
      preset: PluckedPreset;
      gain?: number;
      pan?: number;
      staggerMs?: number;
      upstroke?: boolean;
    }
  ): void {
    const ordered = opts.upstroke ? [...notesHz].reverse() : notesHz;
    const stagger = (opts.staggerMs ?? 32) / 1000;
    const baseTime = ctx.currentTime;

    ordered.forEach((freq, idx) => {
      const slightVar = 0.88 + ((idx * 37) % 24) / 100;
      this.playKarplusPluck(ctx, room, freq, {
        preset: opts.preset,
        gain: (opts.gain ?? 0.14) * slightVar,
        pan: (opts.pan ?? 0) + (idx - ordered.length / 2) * 0.08,
        wetSend: 0.62,
        startTime: baseTime + idx * stagger,
      });
    });
  }

  /**
   * 2. Warm Felted Upright/Grand Piano (Felt hammer thump + inharmonic multi-partial strings)
   */
  public playFeltedPianoNote(
    ctx: AudioContext,
    room: AcousticRoomBus,
    freqHz: number,
    opts: {
      gain?: number;
      durationSec?: number;
      pan?: number;
      startTime?: number;
    } = {}
  ): void {
    const t = opts.startTime ?? ctx.currentTime;
    const dur = opts.durationSec ?? 3.8;
    const baseGain = opts.gain ?? 0.095;

    const noteOut = ctx.createGain();
    noteOut.gain.setValueAtTime(1.0, t);

    const warmthLp = ctx.createBiquadFilter();
    warmthLp.type = 'lowpass';
    warmthLp.frequency.setValueAtTime(Math.min(2600, freqHz * 4.5), t);
    warmthLp.frequency.exponentialRampToValueAtTime(Math.max(380, freqHz * 1.4), t + dur * 0.85);

    noteOut.connect(warmthLp);
    const cleanupRoom = this.routeToRoom(ctx, warmthLp, room, opts.pan ?? 0, 0.65);

    // Subtle soft felt hammer thump
    const hammerSrc = ctx.createBufferSource();
    hammerSrc.buffer = this.getNoiseBuffer(ctx);
    const hammerBp = ctx.createBiquadFilter();
    hammerBp.type = 'bandpass';
    hammerBp.frequency.setValueAtTime(Math.min(480, Math.max(110, freqHz * 0.75)), t);
    hammerBp.Q.setValueAtTime(1.2, t);
    const hammerGain = ctx.createGain();
    hammerGain.gain.setValueAtTime(0.0001, t);
    hammerGain.gain.linearRampToValueAtTime(baseGain * 0.55, t + 0.006);
    hammerGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

    hammerSrc.connect(hammerBp);
    hammerBp.connect(hammerGain);
    hammerGain.connect(noteOut);
    hammerSrc.start(t, Math.random() * 0.8, 0.06);

    // Multi-partial stretched piano harmonics (3 efficient partials for clean CPU on mobile)
    const partials = [
      { n: 1, amp: 0.72, decayMul: 1.0, type: 'sine' as OscillatorType, detuneHz: 0 },
      { n: 1, amp: 0.34, decayMul: 0.94, type: 'sine' as OscillatorType, detuneHz: 0.36 },
      { n: 2, amp: 0.22, decayMul: 0.56, type: 'sine' as OscillatorType, detuneHz: -0.18 },
    ];

    const B = 0.00024; // Realistic piano string inharmonicity coefficient
    let cleaned = false;

    partials.forEach((p, idx) => {
      const stretchedFreq = freqHz * p.n * Math.sqrt(1 + B * p.n * p.n) + p.detuneHz;
      const osc = ctx.createOscillator();
      const pGain = ctx.createGain();
      const pDur = Math.max(0.45, dur * p.decayMul);

      osc.type = p.type;
      osc.frequency.setValueAtTime(stretchedFreq, t);

      pGain.gain.setValueAtTime(0.0001, t);
      pGain.gain.linearRampToValueAtTime(baseGain * p.amp, t + 0.018);
      pGain.gain.exponentialRampToValueAtTime(0.0001, t + pDur);

      osc.connect(pGain);
      pGain.connect(noteOut);

      osc.onended = () => {
        try {
          osc.disconnect();
          pGain.disconnect();
          if (idx === 0 && !cleaned) {
            cleaned = true;
            hammerSrc.disconnect();
            hammerBp.disconnect();
            hammerGain.disconnect();
            noteOut.disconnect();
            warmthLp.disconnect();
            cleanupRoom();
          }
        } catch {}
      };

      osc.start(t);
      osc.stop(t + pDur + 0.06);
    });
  }

  /**
   * 3. Warm Fender Rhodes Suitcase Electric Piano Chord Comping
   */
  public playRhodesChord(
    ctx: AudioContext,
    room: AcousticRoomBus,
    notesHz: number[],
    opts: {
      gain?: number;
      durationSec?: number;
      rollMs?: number;
    } = {}
  ): void {
    const baseTime = ctx.currentTime;
    const dur = opts.durationSec ?? 3.2;
    const roll = (opts.rollMs ?? 24) / 1000;
    const gainPerVoice = opts.gain ?? 0.068;

    notesHz.forEach((freq, idx) => {
      const t = baseTime + idx * roll;
      const pan = (idx - (notesHz.length - 1) / 2) * 0.16;

      // Fundamental warm Rhodes tonebar
      const fundOsc = ctx.createOscillator();
      fundOsc.type = 'sine';
      fundOsc.frequency.setValueAtTime(freq, t);

      // Tuning-fork tine bell attack (7th harmonic)
      const tineOsc = ctx.createOscillator();
      tineOsc.type = 'sine';
      tineOsc.frequency.setValueAtTime(freq * 7.0, t);
      const tineGain = ctx.createGain();
      tineGain.gain.setValueAtTime(0.0001, t);
      tineGain.gain.linearRampToValueAtTime(gainPerVoice * 0.16, t + 0.01);
      tineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

      // Gentle 2nd harmonic warmth
      const harmOsc = ctx.createOscillator();
      harmOsc.type = 'sine';
      harmOsc.frequency.setValueAtTime(freq * 2.0, t);
      const harmGain = ctx.createGain();
      harmGain.gain.setValueAtTime(0.0001, t);
      harmGain.gain.linearRampToValueAtTime(gainPerVoice * 0.24, t + 0.02);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.65);

      const voiceFilter = ctx.createBiquadFilter();
      voiceFilter.type = 'lowpass';
      voiceFilter.frequency.setValueAtTime(1450, t);

      const envGain = ctx.createGain();
      envGain.gain.setValueAtTime(0.0001, t);
      envGain.gain.linearRampToValueAtTime(gainPerVoice, t + 0.022);
      envGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      fundOsc.connect(envGain);
      harmOsc.connect(harmGain);
      harmGain.connect(voiceFilter);
      tineOsc.connect(tineGain);
      tineGain.connect(voiceFilter);
      envGain.connect(voiceFilter);

      const cleanupRoom = this.routeToRoom(ctx, voiceFilter, room, pan, 0.48);

      fundOsc.onended = () => {
        try {
          fundOsc.disconnect();
          harmOsc.disconnect();
          tineOsc.disconnect();
          harmGain.disconnect();
          tineGain.disconnect();
          envGain.disconnect();
          voiceFilter.disconnect();
          cleanupRoom();
        } catch {}
      };

      fundOsc.start(t);
      harmOsc.start(t);
      tineOsc.start(t);
      fundOsc.stop(t + dur + 0.05);
      harmOsc.stop(t + dur + 0.05);
      tineOsc.stop(t + 0.18);
    });
  }

  /**
   * 4. Upright Double Bass (finger-pluck transient + pitch bloom + woody resonance)
   */
  public playUprightBassNote(
    ctx: AudioContext,
    room: AcousticRoomBus,
    freqHz: number,
    opts: {
      gain?: number;
      durationSec?: number;
      startTime?: number;
    } = {}
  ): void {
    const t = opts.startTime ?? ctx.currentTime;
    const dur = opts.durationSec ?? 1.45;
    const baseGain = opts.gain ?? 0.14;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';

    // Subtle acoustic fingerboard pitch bloom (+1.05 semitone down to pitch in 35ms)
    osc1.frequency.setValueAtTime(freqHz * 1.06, t);
    osc1.frequency.exponentialRampToValueAtTime(freqHz, t + 0.038);
    osc2.frequency.setValueAtTime(freqHz * 1.06, t);
    osc2.frequency.exponentialRampToValueAtTime(freqHz, t + 0.038);

    // Finger-string pluck noise
    const pluckSrc = ctx.createBufferSource();
    pluckSrc.buffer = this.getNoiseBuffer(ctx);
    const pluckFilter = ctx.createBiquadFilter();
    pluckFilter.type = 'bandpass';
    pluckFilter.frequency.setValueAtTime(320, t);
    pluckFilter.Q.setValueAtTime(1.5, t);
    const pluckGain = ctx.createGain();
    pluckGain.gain.setValueAtTime(0.0001, t);
    pluckGain.gain.linearRampToValueAtTime(baseGain * 0.45, t + 0.006);
    pluckGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

    const woodyBody = ctx.createBiquadFilter();
    woodyBody.type = 'peaking';
    woodyBody.frequency.setValueAtTime(115, t);
    woodyBody.Q.setValueAtTime(1.6, t);
    woodyBody.gain.setValueAtTime(2.2, t);

    const bassLp = ctx.createBiquadFilter();
    bassLp.type = 'lowpass';
    bassLp.frequency.setValueAtTime(520, t);
    bassLp.frequency.exponentialRampToValueAtTime(220, t + dur * 0.7);

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, t);
    envGain.gain.linearRampToValueAtTime(baseGain, t + 0.025);
    envGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc1.connect(woodyBody);
    osc2.connect(woodyBody);
    pluckSrc.connect(pluckFilter);
    pluckFilter.connect(pluckGain);
    pluckGain.connect(woodyBody);

    woodyBody.connect(bassLp);
    bassLp.connect(envGain);
    const cleanupRoom = this.routeToRoom(ctx, envGain, room, -0.08, 0.25);

    osc1.onended = () => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        pluckSrc.disconnect();
        pluckFilter.disconnect();
        pluckGain.disconnect();
        woodyBody.disconnect();
        bassLp.disconnect();
        envGain.disconnect();
        cleanupRoom();
      } catch {}
    };

    pluckSrc.start(t, Math.random() * 0.5, 0.06);
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  /**
   * 5. Chamber Bowed String Ensemble (Cello / Viola warmth + vibrato + bow whisper)
   */
  public playBowedStringsChord(
    ctx: AudioContext,
    room: AcousticRoomBus,
    notesHz: number[],
    opts: {
      gain?: number;
      durationSec?: number;
    } = {}
  ): void {
    const t = ctx.currentTime;
    const dur = opts.durationSec ?? 6.2;
    const voiceGain = opts.gain ?? 0.036;
    const chordVoices = notesHz.slice(0, 3);

    // Single shared vibrato LFO across ensemble keeps audio-thread node count light on mobile
    const vibLfo = ctx.createOscillator();
    vibLfo.frequency.setValueAtTime(5.0, t);
    const vibGain = ctx.createGain();
    vibGain.gain.setValueAtTime(0.01, t);
    vibGain.gain.linearRampToValueAtTime(0.85, t + 1.4);
    vibLfo.connect(vibGain);
    vibLfo.start(t);
    vibLfo.stop(t + dur + 0.1);

    chordVoices.forEach((freq, idx) => {
      const pan = (idx - (chordVoices.length - 1) / 2) * 0.28;
      [-0.4, 0.4].forEach((detuneHz, playerIdx) => {
        const osc = ctx.createOscillator();
        osc.type = playerIdx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq + detuneHz, t);
        vibGain.connect(osc.frequency);

        const stringLp = ctx.createBiquadFilter();
        stringLp.type = 'lowpass';
        stringLp.frequency.setValueAtTime(720, t);
        stringLp.frequency.linearRampToValueAtTime(980, t + 2.2);
        stringLp.frequency.linearRampToValueAtTime(620, t + dur);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(voiceGain, t + 1.5);
        env.gain.linearRampToValueAtTime(voiceGain * 0.95, t + dur * 0.58);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(stringLp);
        stringLp.connect(env);
        const cleanupRoom = this.routeToRoom(ctx, env, room, pan, 0.65);

        osc.onended = () => {
          try {
            osc.disconnect();
            stringLp.disconnect();
            env.disconnect();
            cleanupRoom();
            if (idx === 0 && playerIdx === 0) {
              vibLfo.disconnect();
              vibGain.disconnect();
            }
          } catch {}
        };

        osc.start(t);
        osc.stop(t + dur + 0.08);
      });
    });
  }

  /**
   * 6. Bamboo Shakuhachi Flute (breath chiff + pitch scoop + human vibrato)
   */
  public playBambooFluteNote(
    ctx: AudioContext,
    room: AcousticRoomBus,
    freqHz: number,
    opts: {
      gain?: number;
      durationSec?: number;
      pan?: number;
    } = {}
  ): void {
    const t = ctx.currentTime;
    const dur = opts.durationSec ?? 2.4;
    const baseGain = opts.gain ?? 0.068;

    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    osc.type = 'sine';
    overtone.type = 'sine';

    // Gentle upward embouchure pitch scoop into the note
    osc.frequency.setValueAtTime(freqHz * 0.984, t);
    osc.frequency.exponentialRampToValueAtTime(freqHz, t + 0.14);
    overtone.frequency.setValueAtTime(freqHz * 2 * 0.984, t);
    overtone.frequency.exponentialRampToValueAtTime(freqHz * 2, t + 0.14);

    const vibLfo = ctx.createOscillator();
    const vibDepth = ctx.createGain();
    vibLfo.frequency.setValueAtTime(4.9, t);
    vibDepth.gain.setValueAtTime(0.01, t);
    vibDepth.gain.linearRampToValueAtTime(freqHz * 0.0045, t + 0.65);
    vibLfo.connect(vibDepth);
    vibDepth.connect(osc.frequency);

    // Expressive bamboo breath noise tuned near the note
    const breathSrc = ctx.createBufferSource();
    breathSrc.buffer = this.getNoiseBuffer(ctx);
    const breathBp = ctx.createBiquadFilter();
    breathBp.type = 'bandpass';
    breathBp.frequency.setValueAtTime(Math.min(2400, freqHz * 1.4), t);
    breathBp.Q.setValueAtTime(3.2, t);
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.0001, t);
    breathGain.gain.linearRampToValueAtTime(baseGain * 0.38, t + 0.06);
    breathGain.gain.exponentialRampToValueAtTime(baseGain * 0.08, t + 0.35);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);

    const overGain = ctx.createGain();
    overGain.gain.setValueAtTime(0.14, t);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(baseGain, t + 0.16);
    env.gain.linearRampToValueAtTime(baseGain * 0.9, t + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(env);
    overtone.connect(overGain);
    overGain.connect(env);
    breathSrc.connect(breathBp);
    breathBp.connect(breathGain);
    breathGain.connect(env);

    const cleanupRoom = this.routeToRoom(ctx, env, room, opts.pan ?? 0.12, 0.68);

    osc.onended = () => {
      try {
        vibLfo.stop();
        vibLfo.disconnect();
        vibDepth.disconnect();
        osc.disconnect();
        overtone.disconnect();
        overGain.disconnect();
        breathSrc.disconnect();
        breathBp.disconnect();
        breathGain.disconnect();
        env.disconnect();
        cleanupRoom();
      } catch {}
    };

    breathSrc.start(t, Math.random() * 0.8, dur);
    vibLfo.start(t);
    osc.start(t);
    overtone.start(t);
    osc.stop(t + dur + 0.05);
    overtone.stop(t + dur + 0.05);
  }

  /**
   * 7. Mellow Jazz Vibraphone (felt mallet + motor tremolo + 4x bar harmonic)
   */
  public playVibraphoneNote(
    ctx: AudioContext,
    room: AcousticRoomBus,
    freqHz: number,
    opts: {
      gain?: number;
      durationSec?: number;
      pan?: number;
    } = {}
  ): void {
    const t = ctx.currentTime;
    const dur = opts.durationSec ?? 2.3;
    const baseGain = opts.gain ?? 0.058;

    const barOsc = ctx.createOscillator();
    barOsc.type = 'sine';
    barOsc.frequency.setValueAtTime(freqHz, t);

    const overOsc = ctx.createOscillator();
    overOsc.type = 'sine';
    overOsc.frequency.setValueAtTime(freqHz * 4.0, t);
    const overGain = ctx.createGain();
    overGain.gain.setValueAtTime(0.08, t);
    overGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

    // Classic vibraphone fan tremolo (4.4 Hz)
    const tremGain = ctx.createGain();
    tremGain.gain.setValueAtTime(0.86, t);
    const tremLfo = ctx.createOscillator();
    const tremDepth = ctx.createGain();
    tremLfo.frequency.setValueAtTime(4.4, t);
    tremDepth.gain.setValueAtTime(0.14, t);
    tremLfo.connect(tremDepth);
    tremDepth.connect(tremGain.gain);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(baseGain, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    barOsc.connect(tremGain);
    overOsc.connect(overGain);
    overGain.connect(tremGain);
    tremGain.connect(env);
    const cleanupRoom = this.routeToRoom(ctx, env, room, opts.pan ?? 0.15, 0.6);

    barOsc.onended = () => {
      try {
        tremLfo.stop();
        tremLfo.disconnect();
        tremDepth.disconnect();
        barOsc.disconnect();
        overOsc.disconnect();
        overGain.disconnect();
        tremGain.disconnect();
        env.disconnect();
        cleanupRoom();
      } catch {}
    };

    tremLfo.start(t);
    barOsc.start(t);
    overOsc.start(t);
    barOsc.stop(t + dur + 0.05);
    overOsc.stop(t + 0.3);
  }

  /**
   * 8. Resonant Crystal / Tibetan Singing Bowl (true modal partials + mallet strike + rotational shimmer)
   */
  public playSingingBowlNote(
    ctx: AudioContext,
    room: AcousticRoomBus,
    freqHz: number,
    opts: {
      isCrystal?: boolean;
      gain?: number;
      durationSec?: number;
      pan?: number;
    } = {}
  ): void {
    const t = ctx.currentTime;
    const dur = opts.durationSec ?? 5.6;
    const baseGain = opts.gain ?? 0.055;
    const partials = getBowlPartialSpecs(!!opts.isCrystal);

    const masterBowl = ctx.createGain();
    masterBowl.gain.setValueAtTime(1.0, t);
    const cleanupRoom = this.routeToRoom(ctx, masterBowl, room, opts.pan ?? 0, 0.72);

    let cleaned = false;
    partials.forEach((spec, idx) => {
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      oscA.type = 'sine';
      oscB.type = 'sine';
      const pFreq = freqHz * spec.ratio;
      // Subtle asymmetry produces realistic singing bowl gentle beating shimmer
      oscA.frequency.setValueAtTime(pFreq, t);
      oscB.frequency.setValueAtTime(pFreq + (idx === 0 ? 1.15 : 0.65), t);

      const pDur = Math.max(1.2, dur * spec.decayFactor);
      const pGain = ctx.createGain();
      pGain.gain.setValueAtTime(0.0001, t);
      pGain.gain.linearRampToValueAtTime(baseGain * spec.gain, t + 0.08);
      pGain.gain.exponentialRampToValueAtTime(0.0001, t + pDur);

      oscA.connect(pGain);
      oscB.connect(pGain);
      pGain.connect(masterBowl);

      oscA.onended = () => {
        try {
          oscA.disconnect();
          oscB.disconnect();
          pGain.disconnect();
          if (idx === 0 && !cleaned) {
            cleaned = true;
            masterBowl.disconnect();
            cleanupRoom();
          }
        } catch {}
      };

      oscA.start(t);
      oscB.start(t);
      oscA.stop(t + pDur + 0.05);
      oscB.stop(t + pDur + 0.05);
    });
  }

  /**
   * 9. Soft Brushed Jazz Snare / Ride Swell & Bossa Acoustic Shaker (gentle, misophonia-safe)
   */
  public playBrushSwish(
    ctx: AudioContext,
    room: AcousticRoomBus,
    opts: {
      accent?: boolean;
      gain?: number;
      pan?: number;
      startTime?: number;
    } = {}
  ): void {
    const t = opts.startTime ?? ctx.currentTime;
    const dur = opts.accent ? 0.16 : 0.28;
    const peak = opts.gain ?? (opts.accent ? 0.042 : 0.028);

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(opts.accent ? 2800 : 2100, t);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(opts.accent ? 5200 : 4100, t);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + (opts.accent ? 0.015 : 0.08));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(hp);
    hp.connect(lp);
    lp.connect(env);
    const cleanupRoom = this.routeToRoom(ctx, env, room, opts.pan ?? 0.22, 0.35);

    src.onended = () => {
      try {
        src.disconnect();
        hp.disconnect();
        lp.disconnect();
        env.disconnect();
        cleanupRoom();
      } catch {}
    };

    src.start(t, Math.random() * 1.1, dur + 0.02);
  }
}

export const acousticEnsemble = new AcousticEngineCache();
