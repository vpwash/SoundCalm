/**
 * Acoustic Foley Studio Generator for SoundCalm
 * Produces realistic multi-layered organic acoustic trigger waveforms (PCM Float32Array)
 * for live in-app studio recording when hardware WebRTC getUserMedia is restricted
 * by mobile preview containers (e.g., Android Custom Tabs / sandboxed iframes).
 */

export type AcousticFoleyProfileId =
  | 'crunch'
  | 'chew'
  | 'clink'
  | 'click'
  | 'sniffle'
  | 'typing';

export interface AcousticFoleyProfile {
  id: AcousticFoleyProfileId;
  name: string;
  shortLabel: string;
  category: string;
  description: string;
  defaultCutoffHz: number;
}

export const ACOUSTIC_FOLEY_PROFILES: AcousticFoleyProfile[] = [
  {
    id: 'crunch',
    name: 'Crisp Chip / Apple Crunch',
    shortLabel: 'Crisp Crunch',
    category: 'Dining',
    description: 'Multi-band fractured crisp transients with natural jaw-cavity resonance',
    defaultCutoffHz: 2400,
  },
  {
    id: 'chew',
    name: 'Soft Chewing & Lip Acoustic',
    shortLabel: 'Soft Chewing',
    category: 'Dining',
    description: 'Low-mid cavity formant shifts with brief wet micro-transients',
    defaultCutoffHz: 2000,
  },
  {
    id: 'clink',
    name: 'Ceramic Bowl & Spoon Clink',
    shortLabel: 'Spoon Clink',
    category: 'Tableware',
    description: 'Inharmonic ceramic-metallic impact with natural room decay',
    defaultCutoffHz: 2600,
  },
  {
    id: 'click',
    name: 'Pen Click & Desk Tap',
    shortLabel: 'Pen Click',
    category: 'Work / Study',
    description: 'Double-latch spring transient with wooden desk body resonance',
    defaultCutoffHz: 2500,
  },
  {
    id: 'sniffle',
    name: 'Quiet Nasal Sniffle / Breath',
    shortLabel: 'Sniffle',
    category: 'Respiratory',
    description: 'Turbulent formant-filtered airflow envelope with natural taper',
    defaultCutoffHz: 1900,
  },
  {
    id: 'typing',
    name: 'Mechanical Keycap Tactile',
    shortLabel: 'Keycap Tap',
    category: 'Work / Study',
    description: 'Tactile switch actuation, bottom-out transient, and upstroke release',
    defaultCutoffHz: 2800,
  },
];

// Deterministic PRNG for reproducible organic micro-texture when needed
function nextNoise(seedState: { s: number }): number {
  seedState.s = (seedState.s * 1664525 + 1013904223) >>> 0;
  return (seedState.s / 0xffffffff) * 2 - 1;
}

/**
 * Generates a single realistic acoustic trigger event (approx 0.42s) as a Float32Array
 * of mono PCM samples at the specified sampleRate.
 */
export function synthesizeAcousticEventPcm(
  profileId: AcousticFoleyProfileId,
  sampleRate: number = 44100,
  seed: number = 1337
): Float32Array {
  const safeSr = Math.max(8000, Math.min(96000, Math.floor(sampleRate || 44100)));
  const durationSec = 0.44;
  const length = Math.floor(safeSr * durationSec);
  const out = new Float32Array(length);
  const rng = { s: (seed ^ 0x9e3779b9) >>> 0 };

  // State variables for simple 1-pole / 2-pole resonators
  let lp1 = 0;
  let lp2 = 0;

  if (profileId === 'crunch') {
    // 6 fractured micro-cracks clustered within 0.03s..0.34s
    const crackTimes = [0.03, 0.065, 0.11, 0.155, 0.22, 0.28];
    const crackAmps = [0.65, 0.95, 0.82, 0.58, 0.76, 0.42];

    for (let i = 0; i < length; i++) {
      const t = i / safeSr;
      const white = nextNoise(rng);
      lp1 += 0.28 * (white - lp1);
      const hp = white - lp1;

      let env = 0;
      for (let k = 0; k < crackTimes.length; k++) {
        const dt = t - crackTimes[k];
        if (dt >= 0 && dt < 0.055) {
          const attack = Math.min(1, dt / 0.0025);
          const decay = Math.exp(-dt * 72);
          const resonance =
            0.55 * Math.sin(2 * Math.PI * (820 + k * 140) * dt) +
            0.45 * Math.sin(2 * Math.PI * (1950 + k * 210) * dt);
          env += crackAmps[k] * attack * decay * (0.65 * hp + 0.35 * resonance);
        }
      }
      out[i] = Math.max(-0.95, Math.min(0.95, env));
    }
  } else if (profileId === 'chew') {
    // Soft cavity resonance + 2 subtle wet micro-transients
    for (let i = 0; i < length; i++) {
      const t = i / safeSr;
      const white = nextNoise(rng);
      lp1 += 0.08 * (white - lp1);
      lp2 += 0.08 * (lp1 - lp2);

      const bodyEnv =
        t >= 0.04 && t <= 0.36
          ? Math.sin(((t - 0.04) / 0.32) * Math.PI) * 0.55
          : 0;
      const formantFreq = 420 + 260 * Math.sin(((t - 0.04) / 0.32) * Math.PI);
      const cavity = Math.sin(2 * Math.PI * formantFreq * t) * 0.4 + lp2 * 1.4;

      // Wet micro-snap at t=0.14s and t=0.25s
      let snap = 0;
      for (const st of [0.14, 0.25]) {
        const dt = t - st;
        if (dt >= 0 && dt < 0.022) {
          snap +=
            Math.exp(-dt * 180) *
            (0.6 * white + 0.4 * Math.sin(2 * Math.PI * 3100 * dt));
        }
      }
      out[i] = Math.max(-0.95, Math.min(0.95, bodyEnv * cavity + snap * 0.75));
    }
  } else if (profileId === 'clink') {
    // Ceramic-metallic modal impact + scrape pre-transient
    const modes = [1780, 2940, 4420, 6180];
    const modeAmps = [0.55, 0.38, 0.24, 0.14];
    const modeDecays = [24, 34, 48, 68];

    for (let i = 0; i < length; i++) {
      const t = i / safeSr;
      const white = nextNoise(rng);
      let sample = 0;
      const dt = t - 0.04;
      if (dt >= 0) {
        const attack = Math.min(1, dt / 0.0012);
        for (let m = 0; m < modes.length; m++) {
          sample +=
            modeAmps[m] *
            attack *
            Math.exp(-dt * modeDecays[m]) *
            Math.sin(2 * Math.PI * modes[m] * dt);
        }
        // Impact transient noise
        if (dt < 0.012) {
          sample += white * 0.5 * Math.exp(-dt * 260);
        }
      }
      // Subtle secondary bowl settle at t=0.18s
      const dt2 = t - 0.18;
      if (dt2 >= 0 && dt2 < 0.12) {
        sample +=
          0.25 *
          Math.exp(-dt2 * 40) *
          Math.sin(2 * Math.PI * 1820 * dt2);
      }
      out[i] = Math.max(-0.95, Math.min(0.95, sample));
    }
  } else if (profileId === 'click') {
    // Double spring latch pen click at t=0.05s and t=0.11s
    const latches = [
      { time: 0.05, freqA: 2150, freqB: 3850, amp: 0.9 },
      { time: 0.115, freqA: 1850, freqB: 3320, amp: 0.72 },
    ];
    for (let i = 0; i < length; i++) {
      const t = i / safeSr;
      const white = nextNoise(rng);
      let sample = 0;
      for (const l of latches) {
        const dt = t - l.time;
        if (dt >= 0 && dt < 0.06) {
          const body =
            0.45 * Math.sin(2 * Math.PI * 310 * dt) * Math.exp(-dt * 95);
          const spring =
            (0.5 * Math.sin(2 * Math.PI * l.freqA * dt) +
              0.35 * Math.sin(2 * Math.PI * l.freqB * dt) +
              0.45 * white) *
            Math.exp(-dt * 145);
          sample += l.amp * (body + spring);
        }
      }
      out[i] = Math.max(-0.95, Math.min(0.95, sample));
    }
  } else if (profileId === 'sniffle') {
    // Turbulent nasal airflow envelope over 0.04s..0.38s
    for (let i = 0; i < length; i++) {
      const t = i / safeSr;
      const white = nextNoise(rng);
      lp1 += 0.16 * (white - lp1);
      const bp = white - lp1;

      if (t >= 0.03 && t <= 0.39) {
        const norm = (t - 0.03) / 0.36;
        const env = Math.pow(Math.sin(norm * Math.PI), 1.4);
        const mod = 0.75 + 0.25 * Math.sin(2 * Math.PI * 19 * t);
        out[i] = Math.max(-0.95, Math.min(0.95, bp * env * mod * 0.78));
      }
    }
  } else {
    // typing: Mechanical keycap switch actuation + bottom-out + upstroke
    const strokes = [
      { time: 0.04, pitch: 1420, amp: 0.85 },
      { time: 0.12, pitch: 980, amp: 0.55 },
      { time: 0.24, pitch: 1560, amp: 0.78 },
    ];
    for (let i = 0; i < length; i++) {
      const t = i / safeSr;
      const white = nextNoise(rng);
      lp1 += 0.22 * (white - lp1);
      let sample = 0;
      for (const s of strokes) {
        const dt = t - s.time;
        if (dt >= 0 && dt < 0.055) {
          const thock =
            Math.sin(2 * Math.PI * 240 * dt) * Math.exp(-dt * 85) * 0.55;
          const click =
            (Math.sin(2 * Math.PI * s.pitch * dt) * 0.45 + lp1 * 0.65) *
            Math.exp(-dt * 135);
          sample += s.amp * (thock + click);
        }
      }
      out[i] = Math.max(-0.95, Math.min(0.95, sample));
    }
  }

  return out;
}

/**
 * Generates a full multi-second studio recording PCM track (e.g., 2.4s) containing
 * natural room tone and realistic acoustic trigger bursts so the user can inspect
 * the full waveform and position the 0.5-second Micro-Clip window over any burst.
 */
export function buildFullStudioFoleyRecordingPcm(
  profileId: AcousticFoleyProfileId,
  durationSec: number = 2.4,
  sampleRate: number = 44100
): Float32Array {
  const safeSr = Math.max(8000, Math.min(96000, Math.floor(sampleRate || 44100)));
  const clampedDur = Math.max(1.2, Math.min(15, durationSec));
  const totalSamples = Math.floor(safeSr * clampedDur);
  const fullPcm = new Float32Array(totalSamples);
  const rng = { s: 0x51f15e };

  // Subtle organic room air floor (-52dB)
  let roomLp = 0;
  for (let i = 0; i < totalSamples; i++) {
    const n = nextNoise(rng);
    roomLp += 0.05 * (n - roomLp);
    fullPcm[i] = roomLp * 0.004;
  }

  // Place natural acoustic events every ~0.75s, with the primary clear peak around 0.55s
  const eventStartsSec: number[] = [];
  let cursor = 0.35;
  while (cursor + 0.45 < clampedDur) {
    eventStartsSec.push(cursor);
    cursor += 0.78;
  }
  if (eventStartsSec.length === 0) {
    eventStartsSec.push(Math.max(0.1, (clampedDur - 0.44) / 2));
  }

  eventStartsSec.forEach((startSec, idx) => {
    const eventPcm = synthesizeAcousticEventPcm(profileId, safeSr, 1000 + idx * 97);
    // Make the first/second burst slightly stronger so auto-peak centering locks cleanly
    const gainScale = idx === 0 ? 1.0 : idx === 1 ? 0.88 : 0.76;
    const startSample = Math.floor(startSec * safeSr);
    for (let j = 0; j < eventPcm.length && startSample + j < totalSamples; j++) {
      fullPcm[startSample + j] = Math.max(
        -0.98,
        Math.min(0.98, fullPcm[startSample + j] + eventPcm[j] * gainScale)
      );
    }
  });

  return fullPcm;
}
