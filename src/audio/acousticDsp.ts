/**
 * Pure Acoustic DSP Utilities for Physical-Modeling Instrument Synthesis
 * Generates Karplus-Strong plucked strings, natural studio/hall impulse responses,
 * analog tape warmth curves, singing bowl eigenmodes, and expressive human timing.
 */

export interface KarplusStrongOptions {
  frequencyHz: number;
  sampleRate: number;
  durationSec: number;
  damping?: number; // 0.985 - 0.9995 (higher = longer ring)
  brightness?: number; // 0.0 - 1.0 (0 = warm nylon/harp, 1 = brighter steel)
  pluckPosition?: number; // 0.08 - 0.45 fraction of string length
  bodyWarmth?: number; // 0.0 - 1.0 subtle low-frequency wooden resonance
}

/**
 * Generates physical Karplus-Strong plucked string audio samples using
 * fractional delay interpolation, pluck-position comb shaping, and
 * frequency-dependent damping.
 */
export function generateKarplusStrongSamples(opts: KarplusStrongOptions): Float32Array {
  const {
    frequencyHz,
    sampleRate,
    durationSec,
    damping = 0.996,
    brightness = 0.35,
    pluckPosition = 0.22,
    bodyWarmth = 0.45,
  } = opts;

  const safeFreq = Math.max(40, Math.min(3500, frequencyHz));
  const totalSamples = Math.max(256, Math.floor(sampleRate * durationSec));
  const out = new Float32Array(totalSamples);

  // Exact delay period in samples (compensating ~0.5 sample phase lag of averaging filter)
  const exactPeriod = sampleRate / safeFreq - 0.5;
  const intDelay = Math.max(2, Math.floor(exactPeriod));
  const frac = Math.max(0, Math.min(1, exactPeriod - intDelay));

  const ringBuffer = new Float32Array(intDelay + 2);

  // Deterministic pseudo-random excitation shaped for warm acoustic finger/pick pluck
  let seed = Math.round(safeFreq * 137) + 17;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  // Pre-filter noise burst for softer finger-pad pluck transient
  const burst = new Float32Array(ringBuffer.length);
  let lpNoise = 0;
  const burstAlpha = 0.22 + brightness * 0.45;
  for (let i = 0; i < burst.length; i++) {
    const raw = nextRand();
    lpNoise = lpNoise + burstAlpha * (raw - lpNoise);
    burst[i] = lpNoise;
  }

  // Pluck-position comb filter: subtracts delayed burst at pluck ratio to produce authentic string harmonics
  const pluckDelay = Math.max(1, Math.min(burst.length - 1, Math.round(intDelay * pluckPosition)));
  for (let i = 0; i < ringBuffer.length; i++) {
    const delayed = i >= pluckDelay ? burst[i - pluckDelay] : burst[i + burst.length - pluckDelay];
    ringBuffer[i] = (burst[i] - 0.65 * delayed) * 0.72;
  }

  // Frequency-compensated decay so high and low notes sustain naturally
  const freqScale = Math.pow(Math.min(1, 220 / safeFreq), 0.12);
  const effectiveDamping = Math.min(0.9994, Math.max(0.96, damping - (1 - freqScale) * 0.002));
  const blend = 0.35 + brightness * 0.25; // One-pole lowpass weighting

  let prevSample = 0;
  let allpassState = 0;
  const allpassCoeff = (1 - frac) / (1 + frac);

  // Simple 1-pole wooden body resonator (~115 Hz)
  let bodyLp1 = 0;
  let bodyLp2 = 0;
  const bodyAlpha = Math.min(0.4, (2 * Math.PI * 130) / sampleRate);

  let maxAbs = 0;
  for (let i = 0; i < totalSamples; i++) {
    const idx = i % ringBuffer.length;
    const nextIdx = (idx + 1) % ringBuffer.length;

    const cur = ringBuffer[idx];
    const nxt = ringBuffer[nextIdx];

    // Lossy averaging string damping filter
    const filtered = effectiveDamping * ((1 - blend) * cur + blend * prevSample);
    prevSample = cur;

    // First-order allpass for sub-sample pitch accuracy
    const allpassed = allpassCoeff * (filtered - allpassState) + nxt * 0.0 + filtered * (1 - allpassCoeff);
    // Stabilized linear + allpass mix
    const interpSample = filtered * (1 - frac) + allpassed * frac;
    allpassState = interpSample;

    ringBuffer[idx] = interpSample;

    // Gentle wooden soundboard resonance
    bodyLp1 += bodyAlpha * (interpSample - bodyLp1);
    bodyLp2 += bodyAlpha * 0.7 * (bodyLp1 - bodyLp2);
    const sampleOut = interpSample + bodyWarmth * 0.32 * (bodyLp1 - bodyLp2 * 0.5);

    // Smooth 120ms end fade-out to prevent tail truncation clicks
    const fadeSamples = Math.min(totalSamples, Math.floor(sampleRate * 0.12));
    const remaining = totalSamples - 1 - i;
    const env = remaining < fadeSamples ? remaining / Math.max(1, fadeSamples) : 1;

    const val = sampleOut * env;
    out[i] = val;
    const abs = Math.abs(val);
    if (abs > maxAbs) maxAbs = abs;
  }

  // Normalize peak gently to ~0.75 so instruments blend consistently
  if (maxAbs > 0.0001) {
    const gain = 0.75 / maxAbs;
    for (let i = 0; i < totalSamples; i++) {
      out[i] *= gain;
    }
  }

  return out;
}

/**
 * Generates a natural stereo wooden-studio / warm chamber impulse response
 * with early reflections and frequency-damped decay (free of metallic ringing).
 */
export function generateRoomImpulseSamples(
  sampleRate: number,
  durationSec: number = 2.4,
  decaySec: number = 1.65
): [Float32Array, Float32Array] {
  const length = Math.max(1024, Math.floor(sampleRate * durationSec));
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  let seedL = 1948371;
  let seedR = 8392017;
  const randL = () => {
    seedL = (seedL * 1664525 + 1013904223) >>> 0;
    return (seedL / 0xffffffff) * 2 - 1;
  };
  const randR = () => {
    seedR = (seedR * 1664525 + 1013904223) >>> 0;
    return (seedR / 0xffffffff) * 2 - 1;
  };

  // Early discrete studio reflections (11ms - 68ms)
  const earlyTapsMs = [11.5, 17.2, 24.8, 33.1, 45.6, 58.4, 67.9];
  earlyTapsMs.forEach((ms, idx) => {
    const sampleIdx = Math.floor((ms / 1000) * sampleRate);
    if (sampleIdx < length) {
      const amp = 0.38 * Math.pow(0.8, idx);
      left[sampleIdx] += amp * (idx % 2 === 0 ? 1 : 0.65);
      right[sampleIdx + 3 < length ? sampleIdx + 3 : sampleIdx] += amp * (idx % 2 === 0 ? 0.65 : 1);
    }
  });

  // Frequency-damped diffuse stereo tail (lowpass darkens gradually like real air/wood)
  let lpL = 0;
  let lpR = 0;
  const preDelaySamples = Math.floor(sampleRate * 0.014);

  for (let i = preDelaySamples; i < length; i++) {
    const t = (i - preDelaySamples) / sampleRate;
    const env = Math.exp(-t / decaySec) * Math.min(1, t / 0.03);
    // Air absorption: progressively soften high frequencies later in the tail
    const airAlpha = Math.max(0.06, 0.42 * Math.exp(-t * 0.9));

    lpL += airAlpha * (randL() - lpL);
    lpR += airAlpha * (randR() - lpR);

    left[i] += lpL * env * 0.34;
    right[i] += lpR * env * 0.34;
  }

  // Normalize peak cleanly so ConvolverNode never pushes room buses into clipping
  let maxPeak = 0;
  for (let i = 0; i < length; i++) {
    const aL = Math.abs(left[i]);
    const aR = Math.abs(right[i]);
    if (aL > maxPeak) maxPeak = aL;
    if (aR > maxPeak) maxPeak = aR;
  }
  if (maxPeak > 0.45) {
    const scale = 0.45 / maxPeak;
    for (let i = 0; i < length; i++) {
      left[i] *= scale;
      right[i] *= scale;
    }
  }

  return [left, right];
}

/**
 * Generates seamless loopable 1/f pink noise using an equal-power overlap crossfade
 * at the loop seam so AudioBufferSourceNode({ loop: true }) never clicks.
 */
export function generateSeamlessPinkNoiseSamples(
  sampleRate: number,
  durationSec: number = 4.0,
  amplitudeScale: number = 0.04
): Float32Array {
  const safeSr = Math.max(8000, Math.round(sampleRate));
  const length = Math.max(4096, Math.floor(safeSr * durationSec));
  const crossfadeLen = Math.min(Math.floor(length / 8), Math.floor(safeSr * 0.08));
  const rawLen = length + crossfadeLen;
  const raw = new Float32Array(rawLen);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < rawLen; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * amplitudeScale;
    b6 = white * 0.115926;
  }

  // Warm up filter state in the crossfade tail, then blend tail smoothly into start of loop
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = raw[i];
  }
  for (let i = 0; i < crossfadeLen; i++) {
    const t = i / Math.max(1, crossfadeLen - 1);
    const fadeIn = Math.sin(t * Math.PI * 0.5);
    const fadeOut = Math.cos(t * Math.PI * 0.5);
    out[i] = raw[i] * fadeIn + raw[length + i] * fadeOut;
  }

  return out;
}

/**
 * Generates an analog tape / warm tube saturation curve for WaveShaperNode.
 */
export function generateWarmSaturationCurve(
  drive: number = 0.25,
  samples: number = 1024
): Float32Array {
  const curve = new Float32Array(samples);
  const k = Math.max(0.01, drive * 4.5);
  const norm = Math.tanh(k);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

/**
 * Singing bowl / resonant bronze eigenmode partial ratios & relative gains.
 */
export function getBowlPartialSpecs(isCrystal: boolean): Array<{
  ratio: number;
  gain: number;
  decayFactor: number;
}> {
  if (isCrystal) {
    return [
      { ratio: 1.0, gain: 0.72, decayFactor: 1.0 },
      { ratio: 2.002, gain: 0.14, decayFactor: 0.7 },
      { ratio: 2.756, gain: 0.09, decayFactor: 0.45 },
    ];
  }
  return [
    { ratio: 1.0, gain: 0.65, decayFactor: 1.0 },
    { ratio: 2.756, gain: 0.22, decayFactor: 0.65 },
    { ratio: 5.404, gain: 0.08, decayFactor: 0.35 },
  ];
}

/**
 * Computes subtle expressive micro-timing offset (in ms) for human feel.
 */
export function getHumanizedOffsetMs(stepIndex: number, voiceIndex: number, spreadMs: number = 24): number {
  const hash = Math.sin((stepIndex + 1) * 12.9898 + (voiceIndex + 1) * 78.233) * 43758.5453;
  const frac = hash - Math.floor(hash); // [0, 1)
  return Math.round((frac - 0.5) * 2 * spreadMs);
}
