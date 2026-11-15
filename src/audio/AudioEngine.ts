/**
 * Web Audio API Triple-Channel Mixer & Micro-Clip Counterconditioning Engine
 *
 * Implements the DIY "Micro-Clip" Pairing Game protocol:
 * - Channel A: Calming Ambient Soundscapes & 432Hz/528Hz Spa Music
 * - Channel B: Soft Harmonic Puzzle Chimes
 * - Channel C: Recorded/Uploaded Micro-Clip Pairing Bus (0.5s real audio clip every 30-60s
 *   at a barely audible, user-controlled volume with instant stop and tension-relief controls)
 */

import { AudioTrack } from '../types.ts';
import { clampEffectiveGain } from '../utils/clinical.ts';
import {
  SpaMusicStyle,
  MUSIC_AUTO_ROTATE_INTERVAL_SEC,
  getNextSpaHarmonyStep,
  isMusicStyle,
  pickRandomMusicStyle,
} from '../utils/spaMusic.ts';
import { acousticEnsemble } from './AcousticInstruments.ts';
import { getHumanizedOffsetMs, generateSeamlessPinkNoiseSamples } from './acousticDsp.ts';

export type SoundscapeType =
  | 'spa_sanctuary'
  | 'tibetan_bowls'
  | 'bamboo_zen_garden'
  | 'warm_ambient_piano'
  | 'midnight_lounge_jazz'
  | 'bossa_nova_sunset'
  | 'celestial_harp_strings'
  | 'nordic_acoustic_guitar'
  | 'ocean_drone'
  | 'rain_drops'
  | 'forest_stream'
  | 'celestial_drone'
  | 'pink_noise';

export interface SoundscapeOption {
  id: SoundscapeType;
  name: string;
  category: 'spa_music' | 'nature_masking';
  description: string;
  subtitle: string;
  icon: string;
}

export const SOUNDSCAPE_OPTIONS: SoundscapeOption[] = [
  {
    id: 'spa_sanctuary',
    name: 'Lotus Spa Sanctuary',
    category: 'spa_music',
    subtitle: '432 Hz Pads & Harp',
    description: 'Warm evolving Major 9th synth pads with delicate pentatonic harp arpeggios',
    icon: '🪷',
  },
  {
    id: 'tibetan_bowls',
    name: 'Crystal Singing Bowls',
    category: 'spa_music',
    subtitle: '528 Hz Solfeggio Bowls',
    description: 'Deep resonant quartz & Tibetan singing bowls with theta binaural shimmer',
    icon: '🥣',
  },
  {
    id: 'bamboo_zen_garden',
    name: 'Bamboo Flute & Zen Harp',
    category: 'spa_music',
    subtitle: 'Kyoto Garden Melody',
    description: 'Breathy bamboo flute swells paired with tranquil koto plucks and water mist',
    icon: '🎍',
  },
  {
    id: 'warm_ambient_piano',
    name: 'Velvet Spa Piano',
    category: 'spa_music',
    subtitle: 'Felted Piano & Strings',
    description: 'Unhurried felted ambient piano chords floating over a warm string pad',
    icon: '🎹',
  },
  {
    id: 'midnight_lounge_jazz',
    name: 'Midnight Lounge Jazz',
    category: 'spa_music',
    subtitle: 'Warm Rhodes & Upright',
    description: 'Relaxing instrumental jazz ballad with soft Rhodes chords, upright bass, and mellow vibraphone',
    icon: '🎷',
  },
  {
    id: 'bossa_nova_sunset',
    name: 'Acoustic Bossa Café',
    category: 'spa_music',
    subtitle: 'Gentle Bossa Nova',
    description: 'Unhurried acoustic bossa nova guitar voicings, warm upright bass, and brushed percussion',
    icon: '🎸',
  },
  {
    id: 'celestial_harp_strings',
    name: 'Moonlit Chamber Strings',
    category: 'spa_music',
    subtitle: '432 Hz Harp & Cello',
    description: 'Warm bowed chamber strings interwoven with delicate acoustic harp arpeggios',
    icon: '🎻',
  },
  {
    id: 'nordic_acoustic_guitar',
    name: 'Fireside Acoustic',
    category: 'spa_music',
    subtitle: 'Fingerpicked Guitar',
    description: 'Gentle fingerpicked acoustic guitar harmonics floating over an evening breeze',
    icon: '🎶',
  },
  {
    id: 'ocean_drone',
    name: 'Oceanic Horizon',
    category: 'nature_masking',
    subtitle: 'Rhythmic Surf Swell',
    description: 'Deep calming ocean swell with rhythmic 12-second breath surf',
    icon: '🌊',
  },
  {
    id: 'rain_drops',
    name: 'Gentle Veranda Rain',
    category: 'nature_masking',
    subtitle: 'Warm Rainfall',
    description: 'Warm continuous rainfall masking sharp acoustic transients',
    icon: '🌧️',
  },
  {
    id: 'forest_stream',
    name: 'Meadow Brook',
    category: 'nature_masking',
    subtitle: 'Bubbling Stream',
    description: 'Peaceful bubbling stream with soft ambient breeze',
    icon: '🍃',
  },
  {
    id: 'celestial_drone',
    name: 'Celestial 432 Hz Drone',
    category: 'nature_masking',
    subtitle: 'Harmonic Drone',
    description: 'Continuous harmonic binaural drone tuned to natural resonance',
    icon: '✨',
  },
  {
    id: 'pink_noise',
    name: 'Soft Pink Noise',
    category: 'nature_masking',
    subtitle: '1/f Clinical Masking',
    description: 'Clinically balanced 1/f pink noise for steady auditory masking',
    icon: '🪶',
  },
];

// Synthetic triggers are intentionally excluded: triggers must be real recorded or uploaded clips.
export const BUILTIN_TRIGGERS: AudioTrack[] = [];

export interface MicroClipPairingStatus {
  isPairingActive: boolean;
  hasRecordedClip: boolean;
  isClipPlayingNow: boolean;
  secondsUntilNextClip: number;
  clipDurationSec: number;
  clipOffsetSec: number;
  minIntervalSec: number;
  maxIntervalSec: number;
  clipsPlayedCount: number;
  childVolumePercent: number;
}

export interface MusicRotationStatus {
  autoRotateEnabled: boolean;
  secondsUntilNextTrack: number;
  isRotatingMusicActive: boolean;
}

interface SoundscapeSourceHandle {
  stop: () => void;
  gainNode?: GainNode;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;

  // Master Nodes
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  public masterAnalyser: AnalyserNode | null = null;

  // Channel A: Calming Soundscape Bus
  private channelAGain: GainNode | null = null;
  private channelAPanner: AudioNode | null = null;
  private activeSoundscapeSource: SoundscapeSourceHandle | null = null;
  private fadingOutSources: Set<{ stop: () => void; timeoutId: number }> = new Set();
  private currentSoundscape: SoundscapeType = pickRandomMusicStyle();
  private channelAVolume: number = 0.75;
  private isStudioDucked: boolean = false;
  private isSoundscapePlayingState: boolean = false;
  private activeChordName: string = 'Harmonic Sanctuary';
  private autoRotateMusicEnabled: boolean = true;
  private secondsUntilNextMusic: number = MUSIC_AUTO_ROTATE_INTERVAL_SEC;
  private musicRotateTimerId: number | null = null;
  private chordListeners: ((chordName: string) => void)[] = [];
  private soundscapeListeners: ((playing: boolean) => void)[] = [];
  private soundscapeChangeListeners: ((type: SoundscapeType) => void)[] = [];
  private musicRotationListeners: ((status: MusicRotationStatus) => void)[] = [];

  // Channel B: Game Audio Bus (Polyphonic SFX & Pentatonic Chimes)
  private channelBGain: GainNode | null = null;
  private channelBPanner: AudioNode | null = null;
  private channelBVolume: number = 0.8;

  // Channel C: Recorded Micro-Clip Pairing Bus
  private channelCPreGain: GainNode | null = null;
  private channelCFilter: BiquadFilterNode | null = null;
  private parentCeilingGainNode: GainNode | null = null;
  private childTriggerGainNode: GainNode | null = null;
  private panicGainNode: GainNode | null = null;

  // Active Micro-Clip & Scheduler State
  private currentCustomBuffer: AudioBuffer | undefined = undefined;
  private activeMicroClipStop: (() => void) | null = null;
  private schedulerIntervalId: number | null = null;
  private clipPlayingTimeoutId: number | null = null;

  private isExposureRunning: boolean = false;
  private isClipPlayingNow: boolean = false;
  private clipDurationSec: number = 0.5; // Default 0.5-second micro-clip
  private clipOffsetSec: number = 0.0;
  private minIntervalSec: number = 30; // Default 30-60 seconds
  private maxIntervalSec: number = 60;
  private secondsUntilNextClip: number = 35;
  private clipsPlayedCount: number = 0;

  private exposureListeners: ((running: boolean) => void)[] = [];
  private pairingStatusListeners: ((status: MicroClipPairingStatus) => void)[] = [];

  // Configuration parameters
  private parentCeilingVal: number = 0.12; // Safe sub-threshold ceiling
  private childGainVal: number = 0.20; // Barely audible default (20% of ceiling)
  private filterCutoffHz: number = 2200;
  private isMutedPanic: boolean = false;
  private isUnlocked: boolean = false;
  private audioSessionMode: 'playback' | 'ambient' = 'playback';
  private wakeLock: WakeLockSentinel | null = null;

  // Pentatonic scale frequencies tuned to 432Hz base (A4 = 432 Hz)
  private pentatonicFrequencies = [
    256.87, 288.33, 323.63, 384.87, 432.00,
    513.74, 576.65, 647.27, 769.74, 864.00,
  ];

  public onChordChange(listener: (chordName: string) => void): () => void {
    this.chordListeners.push(listener);
    listener(this.activeChordName);
    return () => {
      this.chordListeners = this.chordListeners.filter((l) => l !== listener);
    };
  }

  public onExposureStateChange(listener: (running: boolean) => void): () => void {
    this.exposureListeners.push(listener);
    listener(this.isExposureRunning);
    return () => {
      this.exposureListeners = this.exposureListeners.filter((l) => l !== listener);
    };
  }

  public onPairingStatusChange(listener: (status: MicroClipPairingStatus) => void): () => void {
    this.pairingStatusListeners.push(listener);
    listener(this.getPairingStatus());
    return () => {
      this.pairingStatusListeners = this.pairingStatusListeners.filter((l) => l !== listener);
    };
  }

  public getPairingStatus(): MicroClipPairingStatus {
    return {
      isPairingActive: this.isExposureRunning && !!this.currentCustomBuffer,
      hasRecordedClip: !!this.currentCustomBuffer,
      isClipPlayingNow: this.isClipPlayingNow,
      secondsUntilNextClip: this.secondsUntilNextClip,
      clipDurationSec: this.clipDurationSec,
      clipOffsetSec: this.clipOffsetSec,
      minIntervalSec: this.minIntervalSec,
      maxIntervalSec: this.maxIntervalSec,
      clipsPlayedCount: this.clipsPlayedCount,
      childVolumePercent: Math.round(this.childGainVal * 100),
    };
  }

  private notifyPairingStatus(): void {
    const status = this.getPairingStatus();
    this.exposureListeners.forEach((l) => l(status.isPairingActive));
    this.pairingStatusListeners.forEach((l) => l(status));
  }

  private notifyChordChange(chordName: string): void {
    this.activeChordName = chordName;
    this.chordListeners.forEach((l) => l(chordName));
  }

  public onSoundscapeStateChange(listener: (playing: boolean) => void): () => void {
    this.soundscapeListeners.push(listener);
    listener(this.isSoundscapePlayingState);
    return () => {
      this.soundscapeListeners = this.soundscapeListeners.filter((l) => l !== listener);
    };
  }

  public isSoundscapePlaying(): boolean {
    return this.isSoundscapePlayingState;
  }

  private notifySoundscapeState(): void {
    this.soundscapeListeners.forEach((l) => l(this.isSoundscapePlayingState));
  }

  public onSoundscapeChange(listener: (type: SoundscapeType) => void): () => void {
    this.soundscapeChangeListeners.push(listener);
    listener(this.currentSoundscape);
    return () => {
      this.soundscapeChangeListeners = this.soundscapeChangeListeners.filter((l) => l !== listener);
    };
  }

  public getCurrentSoundscape(): SoundscapeType {
    return this.currentSoundscape;
  }

  private notifySoundscapeChange(): void {
    this.soundscapeChangeListeners.forEach((l) => l(this.currentSoundscape));
  }

  public onMusicRotationChange(listener: (status: MusicRotationStatus) => void): () => void {
    this.musicRotationListeners.push(listener);
    listener(this.getMusicRotationStatus());
    return () => {
      this.musicRotationListeners = this.musicRotationListeners.filter((l) => l !== listener);
    };
  }

  public getMusicRotationStatus(): MusicRotationStatus {
    return {
      autoRotateEnabled: this.autoRotateMusicEnabled,
      secondsUntilNextTrack: this.secondsUntilNextMusic,
      isRotatingMusicActive:
        this.autoRotateMusicEnabled &&
        this.isSoundscapePlayingState &&
        isMusicStyle(this.currentSoundscape),
    };
  }

  private notifyMusicRotation(): void {
    const status = this.getMusicRotationStatus();
    this.musicRotationListeners.forEach((l) => l(status));
  }

  /**
   * Sets the OS AudioSession mode (Safari/iOS 16.4+ and supporting mobile browsers):
   * - 'playback': Plays built-in SoundCalm music/soundscapes even if the iPhone Silent switch is on.
   * - 'ambient': Mixes SoundCalm's Web Audio on top of external apps (Spotify, Amazon Music, etc.)
   *   without pausing them (requires iPhone Silent Mode to be off).
   */
  public setAudioSessionMode(mode: 'playback' | 'ambient'): void {
    this.audioSessionMode = mode;
    this.applyAudioSessionMode();
  }

  private applyAudioSessionMode(): void {
    try {
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
        const navWithAudioSession = navigator as Navigator & {
          audioSession?: { type?: string };
        };
        if (
          navWithAudioSession.audioSession &&
          navWithAudioSession.audioSession.type !== this.audioSessionMode
        ) {
          navWithAudioSession.audioSession.type = this.audioSessionMode;
        }
      }
    } catch {
      // Ignore if browser restricts audioSession mutation
    }
  }

  /**
   * Restores the active audio session mode and resumes the AudioContext after
   * microphone capture (getUserMedia) or switching back from another app.
   */
  public restoreAmbientAudioSession(): void {
    this.applyAudioSessionMode();
    if (this.ctx) {
      const state = this.ctx.state as string;
      if (state === 'suspended' || state === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }
    }
  }

  /**
   * Synchronously plays a 1-sample silent buffer inside a user gesture to unlock
   * iOS Safari / WebKit's hardware audio daemon.
   */
  private unlockWebKitAudio(): void {
    if (!this.ctx) return;
    try {
      const silentBuf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = silentBuf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      // Ignore if context is not ready
    }
  }

  public ensureContext(): AudioContext {
    this.applyAudioSessionMode();
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.ctx = new AudioCtxClass({ latencyHint: 'interactive' });
      } catch {
        this.ctx = new AudioCtxClass();
      }
      this.setupGraph();
      this.isUnlocked = true;

      const resumeAndUnlock = () => {
        this.applyAudioSessionMode();
        if (this.ctx) {
          const state = this.ctx.state as string;
          if (state === 'suspended' || state === 'interrupted') {
            this.ctx.resume().catch(() => {});
          }
          this.unlockWebKitAudio();
        }
      };
      window.addEventListener('touchend', resumeAndUnlock, { passive: true });
      window.addEventListener('pointerdown', resumeAndUnlock, { passive: true });
      window.addEventListener('keydown', resumeAndUnlock, { passive: true });
      window.addEventListener('focus', resumeAndUnlock, { passive: true });
      window.addEventListener('pageshow', resumeAndUnlock, { passive: true });
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            resumeAndUnlock();
          }
        });
      }
    }
    const currentState = this.ctx.state as string;
    if (currentState === 'suspended' || currentState === 'interrupted') {
      this.ctx.resume().catch(() => {});
    }
    this.unlockWebKitAudio();
    return this.ctx;
  }

  public getSafetyBusInput(): AudioNode | null {
    this.ensureContext();
    return this.masterCompressor || this.masterLimiter || this.ctx?.destination || null;
  }

  public initAudio(): boolean {
    try {
      this.ensureContext();
      this.requestWakeLock();
      return true;
    } catch {
      return false;
    }
  }

  private smoothParam(
    param: AudioParam,
    target: number,
    timeConstantSec: number = 0.025
  ): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.setTargetAtTime(target, now, Math.max(0.005, timeConstantSec));
    } catch {}
  }

  private getEffectiveChannelAVolume(): number {
    const base = this.isStudioDucked
      ? Math.min(this.channelAVolume, 0.08)
      : this.channelAVolume;
    // Gentle headroom curve (max 0.82 at 100%) prevents bus overload on laptops/phones
    return Math.max(0, Math.min(0.82, Math.pow(base, 1.1) * 0.82));
  }

  private setupGraph(): void {
    if (!this.ctx) return;

    // 1. Master Output Bus: Warm Glue Compressor -> Brickwall Safety Limiter -> Headroom Gain
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.setValueAtTime(-14.0, this.ctx.currentTime);
    this.masterCompressor.knee.setValueAtTime(18.0, this.ctx.currentTime);
    this.masterCompressor.ratio.setValueAtTime(4.5, this.ctx.currentTime);
    this.masterCompressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
    this.masterCompressor.release.setValueAtTime(0.22, this.ctx.currentTime);

    this.masterLimiter = this.ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.setValueAtTime(-2.0, this.ctx.currentTime);
    this.masterLimiter.knee.setValueAtTime(0.0, this.ctx.currentTime);
    this.masterLimiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
    this.masterLimiter.attack.setValueAtTime(0.0005, this.ctx.currentTime);
    this.masterLimiter.release.setValueAtTime(0.08, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.82, this.ctx.currentTime);

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.8;

    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterGain);
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    // 2. Channel A: Soundscape Bus
    this.channelAPanner =
      typeof this.ctx.createStereoPanner === 'function'
        ? this.ctx.createStereoPanner()
        : this.ctx.createGain();
    this.channelAGain = this.ctx.createGain();
    this.channelAGain.gain.setValueAtTime(this.getEffectiveChannelAVolume(), this.ctx.currentTime);
    this.channelAPanner.connect(this.channelAGain);
    this.channelAGain.connect(this.masterCompressor);

    // 3. Channel B: Game Audio Bus
    this.channelBPanner =
      typeof this.ctx.createStereoPanner === 'function'
        ? this.ctx.createStereoPanner()
        : this.ctx.createGain();
    this.channelBGain = this.ctx.createGain();
    this.channelBGain.gain.setValueAtTime(this.channelBVolume * 0.85, this.ctx.currentTime);
    this.channelBPanner.connect(this.channelBGain);
    this.channelBGain.connect(this.masterCompressor);

    // 4. Channel C: Target Exposure Bus (Recorded Micro-Clips)
    this.channelCPreGain = this.ctx.createGain();
    this.channelCPreGain.gain.setValueAtTime(2.6, this.ctx.currentTime);

    this.channelCFilter = this.ctx.createBiquadFilter();
    this.channelCFilter.type = 'lowpass';
    this.channelCFilter.frequency.setValueAtTime(this.filterCutoffHz, this.ctx.currentTime);
    this.channelCFilter.Q.setValueAtTime(0.707, this.ctx.currentTime);

    this.parentCeilingGainNode = this.ctx.createGain();
    this.parentCeilingGainNode.gain.setValueAtTime(this.parentCeilingVal, this.ctx.currentTime);

    this.childTriggerGainNode = this.ctx.createGain();
    this.childTriggerGainNode.gain.setValueAtTime(this.childGainVal, this.ctx.currentTime);

    this.panicGainNode = this.ctx.createGain();
    this.panicGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // Channel C Serial Routing:
    // MicroClipSource -> PreGain -> LowPassFilter -> ParentCeiling -> ChildGain -> PanicGain -> Master
    this.channelCPreGain.connect(this.channelCFilter);
    this.channelCFilter.connect(this.parentCeilingGainNode);
    this.parentCeilingGainNode.connect(this.childTriggerGainNode);
    this.childTriggerGainNode.connect(this.panicGainNode);
    this.panicGainNode.connect(this.masterCompressor);
  }

  // ================= Channel A: Calming Soundscapes & Spa Music =================

  public setAutoRotateMusic(enabled: boolean): void {
    this.autoRotateMusicEnabled = enabled;
    if (enabled && this.isSoundscapePlayingState && isMusicStyle(this.currentSoundscape)) {
      this.startMusicRotationTimer();
    } else {
      this.clearMusicRotationTimer();
      this.notifyMusicRotation();
    }
  }

  public skipToNextRandomMusic(fadeSec: number = 3.5): SoundscapeType {
    const nextMusic = pickRandomMusicStyle(this.currentSoundscape);
    this.startSoundscape(nextMusic, fadeSec);
    return nextMusic;
  }

  private clearMusicRotationTimer(): void {
    if (this.musicRotateTimerId !== null) {
      window.clearInterval(this.musicRotateTimerId);
      this.musicRotateTimerId = null;
    }
  }

  private startMusicRotationTimer(): void {
    this.clearMusicRotationTimer();
    this.secondsUntilNextMusic = MUSIC_AUTO_ROTATE_INTERVAL_SEC;
    this.notifyMusicRotation();

    if (!this.autoRotateMusicEnabled || !isMusicStyle(this.currentSoundscape)) {
      return;
    }

    this.musicRotateTimerId = window.setInterval(() => {
      if (
        !this.isSoundscapePlayingState ||
        !this.autoRotateMusicEnabled ||
        !isMusicStyle(this.currentSoundscape)
      ) {
        return;
      }
      if (this.secondsUntilNextMusic <= 1) {
        this.skipToNextRandomMusic(3.5);
      } else {
        this.secondsUntilNextMusic -= 1;
        this.notifyMusicRotation();
      }
    }, 1000);
  }

  public startSoundscape(type: SoundscapeType, fadeSec: number = 1.2): void {
    this.ensureContext();
    if (!this.ctx || !this.channelAPanner) return;
    this.currentSoundscape = type;

    const now = this.ctx.currentTime;
    const safeFade = Math.max(0.25, fadeSec);

    // Smoothly crossfade out any previously playing soundscape instead of cutting it off
    if (this.activeSoundscapeSource) {
      const prev = this.activeSoundscapeSource;
      this.activeSoundscapeSource = null;

      if (prev.gainNode && this.ctx) {
        const prevGain = prev.gainNode;
        try {
          prevGain.gain.cancelScheduledValues(now);
          prevGain.gain.setValueAtTime(Math.max(0.0001, prevGain.gain.value), now);
          prevGain.gain.linearRampToValueAtTime(0.0001, now + safeFade);
        } catch {}

        const cleanupEntry = {
          stop: () => {
            prev.stop();
          },
          timeoutId: 0,
        };
        cleanupEntry.timeoutId = window.setTimeout(() => {
          this.fadingOutSources.delete(cleanupEntry);
          cleanupEntry.stop();
        }, Math.ceil((safeFade + 0.15) * 1000));
        this.fadingOutSources.add(cleanupEntry);
      } else {
        prev.stop();
      }
    }

    if (this.channelAGain) {
      this.smoothParam(this.channelAGain.gain, this.getEffectiveChannelAVolume(), 0.08);
    }

    // Per-source gain node allows simultaneous fade-out of old track and fade-in of new track
    const sourceGain = this.ctx.createGain();
    sourceGain.gain.setValueAtTime(0.0001, now);
    sourceGain.gain.linearRampToValueAtTime(1.0, now + safeFade);
    sourceGain.connect(this.channelAPanner);

    let innerHandle: { stop: () => void };

    switch (type) {
      case 'midnight_lounge_jazz':
      case 'bossa_nova_sunset':
        innerHandle = this.createJazzMusicSource(type, sourceGain);
        break;
      case 'spa_sanctuary':
      case 'tibetan_bowls':
      case 'bamboo_zen_garden':
      case 'warm_ambient_piano':
      case 'celestial_harp_strings':
      case 'nordic_acoustic_guitar':
        innerHandle = this.createSpaMusicSource(type, sourceGain);
        break;
      case 'pink_noise':
        this.notifyChordChange('1/f Balanced Pink Noise');
        innerHandle = this.createPinkNoiseSource(sourceGain);
        break;
      case 'rain_drops':
        this.notifyChordChange('Veranda Rainfall Masking');
        innerHandle = this.createRainSource(sourceGain);
        break;
      case 'ocean_drone':
        this.notifyChordChange('12s Oceanic Surf Cycle');
        innerHandle = this.createOceanSource(sourceGain);
        break;
      case 'celestial_drone':
        this.notifyChordChange('432 Hz Harmonic Triad');
        innerHandle = this.createCelestialDroneSource(sourceGain);
        break;
      case 'forest_stream':
        this.notifyChordChange('Meadow Brook Flow');
        innerHandle = this.createStreamSource(sourceGain);
        break;
    }

    this.activeSoundscapeSource = {
      gainNode: sourceGain,
      stop: () => {
        innerHandle.stop();
        try {
          sourceGain.disconnect();
        } catch {}
      },
    };

    this.isSoundscapePlayingState = true;
    this.notifySoundscapeChange();
    this.notifySoundscapeState();

    if (isMusicStyle(type) && this.autoRotateMusicEnabled) {
      this.startMusicRotationTimer();
    } else {
      this.clearMusicRotationTimer();
      this.notifyMusicRotation();
    }
  }

  public setSoundscapeVolume(volume: number): void {
    this.channelAVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.channelAGain) {
      this.smoothParam(this.channelAGain.gain, this.getEffectiveChannelAVolume(), 0.025);
    }
  }

  public setStudioDucking(ducked: boolean): void {
    this.isStudioDucked = ducked;
    if (this.ctx && this.channelAGain) {
      this.smoothParam(this.channelAGain.gain, this.getEffectiveChannelAVolume(), 0.06);
    }
  }

  public stopSoundscape(): void {
    this.clearMusicRotationTimer();
    if (this.activeSoundscapeSource) {
      this.activeSoundscapeSource.stop();
      this.activeSoundscapeSource = null;
    }
    this.fadingOutSources.forEach((entry) => {
      window.clearTimeout(entry.timeoutId);
      entry.stop();
    });
    this.fadingOutSources.clear();

    if (this.ctx && this.channelAGain) {
      this.smoothParam(this.channelAGain.gain, 0.0, 0.04);
    }
    this.isSoundscapePlayingState = false;
    this.notifyChordChange('Audio Stopped (Silent)');
    this.notifySoundscapeState();
    this.notifyMusicRotation();
  }

  public toggleSoundscape(): boolean {
    if (this.isSoundscapePlayingState) {
      this.stopSoundscape();
      return false;
    } else {
      this.startSoundscape(this.currentSoundscape, 1.2);
      return true;
    }
  }

  private createJazzMusicSource(
    style: 'midnight_lounge_jazz' | 'bossa_nova_sunset',
    destNode: AudioNode
  ): { stop: () => void } {
    if (!this.ctx) return { stop: () => {} };
    let isRunning = true;
    let stepCounter = 0;
    const timeouts: number[] = [];

    // Shared warm wooden-studio convolution reverb & tape warmth
    const room = acousticEnsemble.createAcousticRoomBus(
      this.ctx,
      destNode,
      style === 'bossa_nova_sunset' ? 0.34 : 0.38
    );

    const playJazzBar = () => {
      if (!isRunning || !this.ctx) return;
      const step = stepCounter++;
      const harmony = getNextSpaHarmonyStep(style, step);
      this.notifyChordChange(harmony.chord.name);

      const barDuration = style === 'bossa_nova_sunset' ? 5.2 : 6.0;
      const beatDuration = barDuration / 4;

      if (style === 'bossa_nova_sunset') {
        // Acoustic Bossa Café: Nylon acoustic guitar comping + upright bass + subtle brushed shaker + felted/nylon melody
        const strumTimings = [
          { sec: 0, up: false, gain: 0.13 },
          { sec: beatDuration * 0.75, up: true, gain: 0.08 },
          { sec: beatDuration * 1.5, up: false, gain: 0.11 },
          { sec: beatDuration * 2.5, up: true, gain: 0.09 },
          { sec: beatDuration * 3.25, up: false, gain: 0.1 },
        ];
        strumTimings.forEach((hit, hitIdx) => {
          const jitter = getHumanizedOffsetMs(step, hitIdx, 18);
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playGuitarStrum(this.ctx, room, harmony.chord.padNotesHz, {
              preset: 'nylon_guitar',
              gain: hit.gain,
              pan: -0.22,
              staggerMs: hit.up ? 22 : 34,
              upstroke: hit.up,
            });
          }, Math.max(0, Math.round(hit.sec * 1000) + jitter));
          timeouts.push(tid);
        });

        // Warm bossa upright bass heartbeat (dotted-quarter feel)
        const bassNotes = harmony.chord.bassLineHz || [harmony.chord.rootHz];
        const bossaBassBeats = [0, 1.5, 2.0, 3.5];
        bossaBassBeats.forEach((beat, bIdx) => {
          const freq = bassNotes[bIdx % bassNotes.length];
          const jitter = getHumanizedOffsetMs(step + 2, bIdx, 14);
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playUprightBassNote(this.ctx, room, freq, {
              gain: bIdx % 2 === 0 ? 0.16 : 0.11,
              durationSec: bIdx % 2 === 0 ? beatDuration * 1.35 : beatDuration * 0.75,
            });
          }, Math.max(0, Math.round(beat * beatDuration * 1000) + jitter));
          timeouts.push(tid);
        });

        // Subtle brushed acoustic shaker whisper on eighth subdivisions
        for (let e = 0; e < 8; e++) {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playBrushSwish(this.ctx, room, {
              accent: e === 2 || e === 5,
              gain: e % 2 === 0 ? 0.016 : 0.01,
              pan: 0.3,
            });
          }, Math.round((e * beatDuration * 0.5) * 1000));
          timeouts.push(tid);
        }

        // Expressive alternating nylon guitar lead & gentle felted piano reply
        harmony.arpeggioNotesHz.forEach((melFreq, mIdx) => {
          const delayMs =
            Math.round((0.55 + mIdx * (beatDuration * 1.05)) * 1000) +
            getHumanizedOffsetMs(step + 5, mIdx, 26);
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            if (step % 2 === 0 || mIdx !== 1) {
              acousticEnsemble.playKarplusPluck(this.ctx, room, melFreq, {
                preset: 'nylon_guitar',
                gain: 0.17,
                pan: 0.25,
                wetSend: 0.65,
              });
            } else {
              acousticEnsemble.playFeltedPianoNote(this.ctx, room, melFreq, {
                gain: 0.085,
                durationSec: 2.6,
                pan: 0.2,
              });
            }
          }, Math.max(0, delayMs));
          timeouts.push(tid);
        });
      } else {
        // Midnight Lounge Jazz Trio: Fender Rhodes + Walking Upright Bass + Brushed Snare + Vibraphone / Piano
        const rhodesHits = [0, beatDuration * 2.25];
        rhodesHits.forEach((offsetSec, hitIdx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playRhodesChord(this.ctx, room, harmony.chord.padNotesHz, {
              gain: hitIdx === 0 ? 0.062 : 0.044,
              durationSec: hitIdx === 0 ? beatDuration * 2.2 : beatDuration * 1.65,
              rollMs: hitIdx === 0 ? 28 : 20,
            });
          }, Math.max(0, Math.round(offsetSec * 1000) + getHumanizedOffsetMs(step, hitIdx, 18)));
          timeouts.push(tid);
        });

        // Walking Upright Double Bass on 1, 2, 3, 4
        const bassNotes = harmony.chord.bassLineHz || [harmony.chord.rootHz];
        bassNotes.forEach((bassFreq, bIdx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playUprightBassNote(this.ctx, room, bassFreq, {
              gain: bIdx === 0 ? 0.16 : 0.13,
              durationSec: beatDuration * 0.96,
            });
          }, Math.max(0, Math.round(bIdx * beatDuration * 1000) + getHumanizedOffsetMs(step + 1, bIdx, 16)));
          timeouts.push(tid);
        });

        // Authentic swing jazz brush sweeps (swish on beats 1 & 3, subtle crisp tap on 2 & 4 + swing skip)
        const brushBeats = [
          { beat: 0, accent: false, gain: 0.02 },
          { beat: 1, accent: true, gain: 0.03 },
          { beat: 1.66, accent: false, gain: 0.014 },
          { beat: 2, accent: false, gain: 0.02 },
          { beat: 3, accent: true, gain: 0.03 },
          { beat: 3.66, accent: false, gain: 0.014 },
        ];
        brushBeats.forEach((b) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playBrushSwish(this.ctx, room, {
              accent: b.accent,
              gain: b.gain,
              pan: 0.24,
            });
          }, Math.round(b.beat * beatDuration * 1000));
          timeouts.push(tid);
        });

        // Mellow Vibraphone + occasional Felted Piano upper phrasing
        harmony.arpeggioNotesHz.forEach((melFreq, mIdx) => {
          const delayMs =
            Math.round((0.75 + mIdx * (beatDuration * 1.08)) * 1000) +
            getHumanizedOffsetMs(step + 4, mIdx, 30);
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            if (step % 3 === 1 && mIdx === 2) {
              acousticEnsemble.playFeltedPianoNote(this.ctx, room, melFreq, {
                gain: 0.08,
                durationSec: 2.8,
                pan: -0.25,
              });
            } else {
              acousticEnsemble.playVibraphoneNote(this.ctx, room, melFreq, {
                gain: 0.056,
                durationSec: 2.4,
                pan: (mIdx - 1) * 0.22,
              });
            }
          }, Math.max(0, delayMs));
          timeouts.push(tid);
        });
      }
    };

    const barIntervalMs = style === 'bossa_nova_sunset' ? 5200 : 6000;
    playJazzBar();
    const intervalId = window.setInterval(playJazzBar, barIntervalMs);

    return {
      stop: () => {
        isRunning = false;
        window.clearInterval(intervalId);
        timeouts.forEach((tid) => window.clearTimeout(tid));
        room.dispose();
      },
    };
  }

  private createSpaMusicSource(
    style: SpaMusicStyle,
    destNode: AudioNode
  ): { stop: () => void } {
    if (!this.ctx) return { stop: () => {} };
    let isRunning = true;
    let stepCounter = 0;
    const timeouts: number[] = [];

    const wetByStyle =
      style === 'tibetan_bowls' || style === 'celestial_harp_strings' ? 0.44 : 0.36;
    const room = acousticEnsemble.createAcousticRoomBus(this.ctx, destNode, wetByStyle);

    // Subtle natural room air only where appropriate (not overpowering)
    const breezeFilter = this.ctx.createBiquadFilter();
    breezeFilter.type = 'lowpass';
    breezeFilter.frequency.setValueAtTime(520, this.ctx.currentTime);
    const breezeGain = this.ctx.createGain();
    breezeGain.gain.setValueAtTime(
      style === 'bamboo_zen_garden' || style === 'spa_sanctuary' ? 0.07 : 0.03,
      this.ctx.currentTime
    );
    breezeFilter.connect(breezeGain);
    breezeGain.connect(destNode);
    const breezeSource = this.createPinkNoiseSource(breezeFilter);

    const playSpaCycle = () => {
      if (!isRunning || !this.ctx) return;
      const step = stepCounter++;
      const harmony = getNextSpaHarmonyStep(style, step);
      this.notifyChordChange(harmony.chord.name);

      if (style === 'tibetan_bowls') {
        // Resonant Crystal & Tibetan Singing Bowls with authentic modal overtones
        harmony.chord.padNotesHz.forEach((freq, idx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playSingingBowlNote(this.ctx, room, freq, {
              isCrystal: idx % 2 === 1,
              gain: 0.048,
              durationSec: 5.8,
              pan: (idx - 1.5) * 0.26,
            });
          }, idx * 420 + getHumanizedOffsetMs(step, idx, 35));
          timeouts.push(tid);
        });

        harmony.arpeggioNotesHz.forEach((melFreq, mIdx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playSingingBowlNote(this.ctx, room, melFreq, {
              isCrystal: true,
              gain: 0.036,
              durationSec: 4.2,
              pan: (mIdx - 1) * 0.35,
            });
          }, 1600 + mIdx * 1450);
          timeouts.push(tid);
        });
      } else if (style === 'bamboo_zen_garden') {
        // Kyoto Garden: Warm bowed low cello drone + Shakuhachi Flute + Karplus-Strong Zen Koto plucks
        acousticEnsemble.playBowedStringsChord(
          this.ctx,
          room,
          harmony.chord.padNotesHz.slice(0, 2),
          { gain: 0.022, durationSec: 6.2 }
        );

        // Koto gentle arpeggio
        acousticEnsemble.playGuitarStrum(this.ctx, room, harmony.chord.padNotesHz, {
          preset: 'zen_koto',
          gain: 0.13,
          pan: -0.28,
          staggerMs: 140,
        });

        // Expressive Bamboo Shakuhachi Flute melody phrases
        harmony.arpeggioNotesHz.forEach((melFreq, mIdx) => {
          const delayMs = 950 + mIdx * 1650 + getHumanizedOffsetMs(step, mIdx, 40);
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playBambooFluteNote(this.ctx, room, melFreq, {
              gain: 0.062,
              durationSec: 2.35,
              pan: 0.16,
            });
          }, Math.max(0, delayMs));
          timeouts.push(tid);
        });
      } else if (style === 'warm_ambient_piano') {
        // Velvet Felted Piano rolled chord voicings + intimate string cushion + lyrical top notes
        harmony.chord.padNotesHz.forEach((freq, idx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playFeltedPianoNote(this.ctx, room, freq, {
              gain: 0.088,
              durationSec: 5.4,
              pan: (idx - 1.5) * 0.18,
            });
          }, idx * 85 + getHumanizedOffsetMs(step, idx, 18));
          timeouts.push(tid);
        });

        acousticEnsemble.playBowedStringsChord(
          this.ctx,
          room,
          harmony.chord.padNotesHz.slice(0, 2),
          { gain: 0.018, durationSec: 6.1 }
        );

        harmony.arpeggioNotesHz.forEach((melFreq, mIdx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playFeltedPianoNote(this.ctx, room, melFreq, {
              gain: 0.082,
              durationSec: 3.4,
              pan: (mIdx - 1) * 0.24,
            });
          }, Math.max(0, 1300 + mIdx * 1550 + getHumanizedOffsetMs(step + 3, mIdx, 45)));
          timeouts.push(tid);
        });
      } else if (style === 'celestial_harp_strings') {
        // Moonlit Chamber Strings + Karplus-Strong Concert Harp Sweeps
        acousticEnsemble.playBowedStringsChord(this.ctx, room, harmony.chord.padNotesHz, {
          gain: 0.032,
          durationSec: 6.3,
        });

        acousticEnsemble.playGuitarStrum(this.ctx, room, harmony.chord.padNotesHz, {
          preset: 'concert_harp',
          gain: 0.14,
          pan: -0.2,
          staggerMs: 95,
        });

        harmony.arpeggioNotesHz.forEach((melFreq, mIdx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playKarplusPluck(this.ctx, room, melFreq, {
              preset: 'concert_harp',
              gain: 0.18,
              pan: (mIdx - 1) * 0.3,
              wetSend: 0.72,
            });
          }, Math.max(0, 1250 + mIdx * 1500 + getHumanizedOffsetMs(step, mIdx, 30)));
          timeouts.push(tid);
        });
      } else if (style === 'nordic_acoustic_guitar') {
        // Fireside Acoustic: True Karplus-Strong fingerpicked acoustic guitar pattern + warm cello undertone
        acousticEnsemble.playBowedStringsChord(
          this.ctx,
          room,
          [harmony.chord.rootHz],
          { gain: 0.018, durationSec: 6.0 }
        );

        // 6-note natural fingerpicking pattern across chord & melody scale
        const pickPattern = [
          harmony.chord.padNotesHz[0],
          harmony.chord.padNotesHz[2],
          harmony.chord.padNotesHz[1],
          harmony.chord.padNotesHz[3],
          harmony.arpeggioNotesHz[0],
          harmony.chord.padNotesHz[2],
          harmony.arpeggioNotesHz[1],
          harmony.arpeggioNotesHz[2],
        ];
        pickPattern.forEach((freq, pIdx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playKarplusPluck(this.ctx, room, freq, {
              preset: pIdx === 0 ? 'nylon_guitar' : 'steel_guitar',
              gain: pIdx === 0 || pIdx === 4 ? 0.19 : 0.145,
              pan: pIdx % 2 === 0 ? -0.15 : 0.18,
              wetSend: 0.58,
            });
          }, Math.max(0, pIdx * 720 + getHumanizedOffsetMs(step, pIdx, 22)));
          timeouts.push(tid);
        });
      } else {
        // Lotus Spa Sanctuary: Chamber Bowed Strings + Felted Piano + Concert Harp Plucks
        acousticEnsemble.playBowedStringsChord(this.ctx, room, harmony.chord.padNotesHz, {
          gain: 0.026,
          durationSec: 6.3,
        });

        harmony.chord.padNotesHz.slice(0, 3).forEach((freq, idx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playFeltedPianoNote(this.ctx, room, freq, {
              gain: 0.068,
              durationSec: 4.8,
              pan: (idx - 1) * 0.2,
            });
          }, idx * 140);
          timeouts.push(tid);
        });

        harmony.arpeggioNotesHz.forEach((melFreq, mIdx) => {
          const tid = window.setTimeout(() => {
            if (!isRunning || !this.ctx) return;
            acousticEnsemble.playKarplusPluck(this.ctx, room, melFreq, {
              preset: 'concert_harp',
              gain: 0.17,
              pan: (mIdx - 1) * 0.32,
              wetSend: 0.68,
            });
          }, Math.max(0, 1100 + mIdx * 1650 + getHumanizedOffsetMs(step, mIdx, 30)));
          timeouts.push(tid);
        });
      }
    };

    playSpaCycle();
    const intervalId = window.setInterval(playSpaCycle, 6100);

    return {
      stop: () => {
        isRunning = false;
        window.clearInterval(intervalId);
        timeouts.forEach((tid) => window.clearTimeout(tid));
        breezeSource.stop();
        try {
          breezeFilter.disconnect();
          breezeGain.disconnect();
          room.dispose();
        } catch {}
      },
    };
  }

  private createPinkNoiseSource(destinationNode?: AudioNode): { stop: () => void } {
    const target = destinationNode || this.channelAPanner;
    if (!this.ctx || !target) return { stop: () => {} };
    const buffer = this.ctx.createBuffer(2, this.ctx.sampleRate * 4, this.ctx.sampleRate);

    for (let c = 0; c < 2; c++) {
      const samples = generateSeamlessPinkNoiseSamples(this.ctx.sampleRate, 4.0, 0.04);
      buffer.getChannelData(c).set(samples);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(target);
    source.start();

    return {
      stop: () => {
        try {
          source.stop();
          source.disconnect();
        } catch {}
      },
    };
  }

  private createOceanSource(destinationNode?: AudioNode): { stop: () => void } {
    const target = destinationNode || this.channelAPanner;
    if (!this.ctx || !target) return { stop: () => {} };

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.4, this.ctx.currentTime);

    const pinkSource = this.createPinkNoiseSource(filter);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(220, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    filter.connect(target);
    lfo.start();

    return {
      stop: () => {
        pinkSource.stop();
        try {
          lfo.stop();
          lfo.disconnect();
          filter.disconnect();
        } catch {}
      },
    };
  }

  private createRainSource(destinationNode?: AudioNode): { stop: () => void } {
    const target = destinationNode || this.channelAPanner;
    if (!this.ctx || !target) return { stop: () => {} };

    const highPass = this.ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.setValueAtTime(600, this.ctx.currentTime);

    const lowPass = this.ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(3600, this.ctx.currentTime);

    const pink = this.createPinkNoiseSource(highPass);

    highPass.connect(lowPass);
    lowPass.connect(target);

    return {
      stop: () => {
        pink.stop();
        try {
          highPass.disconnect();
          lowPass.disconnect();
        } catch {}
      },
    };
  }

  private createCelestialDroneSource(destinationNode?: AudioNode): { stop: () => void } {
    const target = destinationNode || this.channelAPanner;
    if (!this.ctx || !target) return { stop: () => {} };
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(216, this.ctx.currentTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(432, this.ctx.currentTime);

    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(648, this.ctx.currentTime);

    droneGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    osc1.connect(droneGain);
    osc2.connect(droneGain);
    osc3.connect(droneGain);
    droneGain.connect(target);

    osc1.start();
    osc2.start();
    osc3.start();

    return {
      stop: () => {
        try {
          osc1.stop();
          osc2.stop();
          osc3.stop();
          droneGain.disconnect();
        } catch {}
      },
    };
  }

  private createStreamSource(destinationNode?: AudioNode): { stop: () => void } {
    const target = destinationNode || this.channelAPanner;
    if (!this.ctx || !target) return { stop: () => {} };

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1100, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(0.9, this.ctx.currentTime);

    const pink = this.createPinkNoiseSource(bandpass);

    bandpass.connect(target);

    return {
      stop: () => {
        pink.stop();
        try {
          bandpass.disconnect();
        } catch {}
      },
    };
  }

  // ================= Channel B: Interactive Game Audio & Chimes =================

  public playHarmonicChime(index: number = 0, pitchOffset: number = 0): void {
    this.ensureContext();
    if (!this.ctx || !this.channelBPanner) return;
    const now = this.ctx.currentTime;

    const safeIndex = Math.abs(index) % this.pentatonicFrequencies.length;
    const baseFreq = this.pentatonicFrequencies[safeIndex] * Math.pow(2, pitchOffset / 12);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.channelBPanner);

    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(now);
    osc.stop(now + 0.7);
  }

  public playCompletionChord(): void {
    this.ensureContext();
    if (!this.ctx || !this.channelBPanner) return;
    const triad = [432.0, 544.29, 647.27, 864.0];
    triad.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.channelBPanner) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2800, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.channelBPanner);

        osc.onended = () => {
          try {
            osc.disconnect();
            filter.disconnect();
            gain.disconnect();
          } catch {}
        };

        osc.start(now);
        osc.stop(now + 1.9);
      }, idx * 120);
    });
  }

  // ================= Channel C: Micro-Clip Counterconditioning Engine =================

  public setChildTriggerGain(gain0to1: number): void {
    this.childGainVal = Math.max(0, Math.min(1, gain0to1));
    if (this.ctx && this.childTriggerGainNode) {
      this.smoothParam(this.childTriggerGainNode.gain, this.childGainVal, 0.02);
    }
    this.notifyPairingStatus();
  }

  /**
   * "If you feel tension, lower the volume immediately."
   * Drops child volume by step (default 5%), stops any playing micro-clip,
   * and resets the next interval timer so the user gets immediate relief.
   */
  public lowerVolumeImmediately(step: number = 0.05): number {
    this.stopCurrentMicroClipInstance();
    const nextGain = Math.max(0.02, Number((this.childGainVal - step).toFixed(2)));
    this.setChildTriggerGain(nextGain);
    this.secondsUntilNextClip = this.pickNextRandomInterval();
    this.notifyPairingStatus();
    return Math.round(nextGain * 100);
  }

  public setParentCeilingGain(gain0to25: number): void {
    this.parentCeilingVal = Math.max(0, Math.min(0.25, gain0to25));
    if (this.ctx && this.parentCeilingGainNode) {
      this.smoothParam(this.parentCeilingGainNode.gain, this.parentCeilingVal, 0.02);
    }
  }

  public setLowpassCutoff(freqHz: number): void {
    this.filterCutoffHz = Math.max(500, Math.min(8000, freqHz));
    if (this.ctx && this.channelCFilter) {
      this.smoothParam(this.channelCFilter.frequency, this.filterCutoffHz, 0.02);
    }
  }

  public setMicroClipDuration(durationSec: number): void {
    this.clipDurationSec = Math.max(0.2, Math.min(3.0, Number(durationSec.toFixed(2))));
    this.notifyPairingStatus();
  }

  public getMicroClipDuration(): number {
    return this.clipDurationSec;
  }

  public setMicroClipOffset(offsetSec: number): void {
    this.clipOffsetSec = Math.max(0, Number(offsetSec.toFixed(2)));
    this.notifyPairingStatus();
  }

  public getMicroClipOffset(): number {
    return this.clipOffsetSec;
  }

  public setMicroClipIntervalRange(minSec: number, maxSec: number): void {
    this.minIntervalSec = Math.max(5, Math.min(120, Math.floor(minSec)));
    this.maxIntervalSec = Math.max(this.minIntervalSec, Math.min(180, Math.floor(maxSec)));
    this.secondsUntilNextClip = this.pickNextRandomInterval();
    this.notifyPairingStatus();
  }

  private pickNextRandomInterval(): number {
    if (this.maxIntervalSec <= this.minIntervalSec) return this.minIntervalSec;
    return (
      this.minIntervalSec +
      Math.floor(Math.random() * (this.maxIntervalSec - this.minIntervalSec + 1))
    );
  }

  public getEffectiveGain(): number {
    return clampEffectiveGain(this.childGainVal, this.parentCeilingVal, 0.25);
  }

  public getChildGain(): number {
    return this.childGainVal;
  }

  public getParentCeiling(): number {
    return this.parentCeilingVal;
  }

  public getFilterCutoff(): number {
    return this.filterCutoffHz;
  }

  public getIsExposureRunning(): boolean {
    return this.isExposureRunning && !!this.currentCustomBuffer;
  }

  public hasRecordedTriggerClip(): boolean {
    return !!this.currentCustomBuffer;
  }

  /**
   * Plays a single 0.5-second (or user-configured duration) micro-clip from the user's
   * recorded/uploaded AudioBuffer through Channel C with smooth anti-click fade edges.
   */
  public playMicroClipNow(): boolean {
    this.ensureContext();
    if (!this.ctx || !this.channelCPreGain || !this.currentCustomBuffer) {
      return false;
    }

    if (this.isMutedPanic && this.panicGainNode) {
      this.panicGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.isMutedPanic = false;
    }

    this.stopCurrentMicroClipInstance();

    const buffer = this.currentCustomBuffer;
    if (!buffer || !(buffer.duration > 0.02)) {
      return false;
    }

    try {
      const now = this.ctx.currentTime;
      const rawOff = Number.isFinite(this.clipOffsetSec) ? this.clipOffsetSec : 0;
      const rawDur = Number.isFinite(this.clipDurationSec) ? this.clipDurationSec : 0.5;
      const safeOffset = Math.min(
        Math.max(0, rawOff),
        Math.max(0, buffer.duration - 0.05)
      );
      const playDur = Math.min(
        rawDur,
        Math.max(0.05, buffer.duration - safeOffset)
      );

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      // Smooth anti-startle micro-clip envelope (35ms fade-in, 45ms fade-out)
      const envGain = this.ctx.createGain();
      const fadeIn = Math.min(0.035, playDur * 0.25);
      const fadeOut = Math.min(0.045, playDur * 0.3);

      envGain.gain.setValueAtTime(0.0001, now);
      envGain.gain.linearRampToValueAtTime(1.0, now + fadeIn);
      envGain.gain.setValueAtTime(1.0, Math.max(now + fadeIn, now + playDur - fadeOut));
      envGain.gain.linearRampToValueAtTime(0.0001, now + playDur);

      source.connect(envGain);
      envGain.connect(this.channelCPreGain);
      source.start(now, safeOffset, playDur + 0.01);

      this.isClipPlayingNow = true;
      this.clipsPlayedCount += 1;
      this.notifyPairingStatus();

      this.clipPlayingTimeoutId = window.setTimeout(() => {
        this.isClipPlayingNow = false;
        this.notifyPairingStatus();
      }, Math.ceil(playDur * 1000));

      this.activeMicroClipStop = () => {
        if (this.clipPlayingTimeoutId !== null) {
          clearTimeout(this.clipPlayingTimeoutId);
          this.clipPlayingTimeoutId = null;
        }
        this.isClipPlayingNow = false;
        try {
          source.stop();
          source.disconnect();
          envGain.disconnect();
        } catch {}
      };

      return true;
    } catch {
      return false;
    }
  }

  private stopCurrentMicroClipInstance(): void {
    if (this.activeMicroClipStop) {
      this.activeMicroClipStop();
      this.activeMicroClipStop = null;
    }
    this.isClipPlayingNow = false;
  }

  /**
   * Loads a recorded/uploaded trigger AudioBuffer without starting the periodic exposure scheduler.
   */
  public loadTriggerClip(
    customAudioBuffer?: AudioBuffer,
    clipOffsetSec?: number,
    clipDurationSec?: number
  ): void {
    if (customAudioBuffer !== undefined) {
      this.currentCustomBuffer = customAudioBuffer;
    }
    if (clipOffsetSec !== undefined) {
      this.clipOffsetSec = Math.max(0, clipOffsetSec);
    }
    if (clipDurationSec !== undefined) {
      this.clipDurationSec = Math.max(0.2, Math.min(3.0, clipDurationSec));
    }
    this.notifyPairingStatus();
  }

  /**
   * Starts the periodic Micro-Clip Pairing Scheduler (plays a 0.5s recorded clip every 30-60s)
   */
  public startTriggerExposure(
    _triggerId?: string,
    customAudioBuffer?: AudioBuffer,
    clipOffsetSec?: number,
    clipDurationSec?: number
  ): void {
    this.ensureContext();

    if (customAudioBuffer !== undefined) {
      this.currentCustomBuffer = customAudioBuffer;
    }
    if (clipOffsetSec !== undefined) {
      this.clipOffsetSec = Math.max(0, clipOffsetSec);
    }
    if (clipDurationSec !== undefined) {
      this.clipDurationSec = Math.max(0.2, Math.min(3.0, clipDurationSec));
    }

    if (this.isMutedPanic && this.panicGainNode && this.ctx) {
      this.panicGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.isMutedPanic = false;
    }

    // Restore barely-audible default gain if it was zeroed by an earlier Panic Mute
    if (this.childGainVal <= 0.001) {
      this.childGainVal = 0.2;
      if (this.ctx && this.childTriggerGainNode) {
        this.childTriggerGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.childTriggerGainNode.gain.setValueAtTime(this.childGainVal, this.ctx.currentTime);
      }
    }

    if (this.schedulerIntervalId !== null) {
      window.clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }

    if (!this.currentCustomBuffer) {
      this.isExposureRunning = false;
      this.notifyPairingStatus();
      return;
    }

    this.isExposureRunning = true;
    this.secondsUntilNextClip = this.pickNextRandomInterval();
    this.notifyPairingStatus();

    this.schedulerIntervalId = window.setInterval(() => {
      if (!this.isExposureRunning || !this.currentCustomBuffer || this.isStudioDucked) {
        return;
      }
      if (this.secondsUntilNextClip <= 1) {
        if (this.childGainVal > 0.001) {
          this.playMicroClipNow();
        }
        this.secondsUntilNextClip = this.pickNextRandomInterval();
      } else {
        this.secondsUntilNextClip -= 1;
      }
      this.notifyPairingStatus();
    }, 1000);
  }

  public stopTriggerExposure(): void {
    if (this.schedulerIntervalId !== null) {
      window.clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
    this.stopCurrentMicroClipInstance();
    this.isExposureRunning = false;
    this.notifyPairingStatus();
  }

  public toggleTriggerExposure(): boolean {
    if (this.isExposureRunning) {
      this.stopTriggerExposure();
      return false;
    } else {
      this.startTriggerExposure();
      return this.isExposureRunning;
    }
  }

  // ================= Safety System: Panic Button (<10ms) =================

  public triggerPanicMute(): void {
    if (!this.ctx || !this.panicGainNode) return;
    const now = this.ctx.currentTime;

    this.panicGainNode.gain.cancelScheduledValues(now);
    this.panicGainNode.gain.setValueAtTime(this.panicGainNode.gain.value, now);
    this.panicGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.005);
    this.panicGainNode.gain.setValueAtTime(0.0, now + 0.006);

    this.stopTriggerExposure();
    this.isMutedPanic = true;
    this.childGainVal = 0.0;

    if (this.childTriggerGainNode) {
      this.childTriggerGainNode.gain.cancelScheduledValues(now);
      this.childTriggerGainNode.gain.setValueAtTime(0.0, now + 0.006);
    }

    if (this.isSoundscapePlayingState && this.channelAGain) {
      this.smoothParam(this.channelAGain.gain, this.getEffectiveChannelAVolume(), 0.12);
    }
  }

  public resetPanicMute(): void {
    if (!this.ctx || !this.panicGainNode) return;
    this.smoothParam(this.panicGainNode.gain, 1.0, 0.02);
    this.isMutedPanic = false;
    this.notifyPairingStatus();
  }

  private async requestWakeLock(): Promise<void> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch {
        // Wake Lock is optional
      }
    }
  }

  public releaseWakeLock(): void {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }
}

export const audioEngine = new AudioEngine();
