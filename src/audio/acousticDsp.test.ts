import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateKarplusStrongSamples,
  generateRoomImpulseSamples,
  generateSeamlessPinkNoiseSamples,
  generateWarmSaturationCurve,
  getBowlPartialSpecs,
  getHumanizedOffsetMs,
} from './acousticDsp.ts';

test('generateKarplusStrongSamples creates non-silent finite physical string waveform with decaying tail', () => {
  const sr = 44100;
  const samples = generateKarplusStrongSamples({
    frequencyHz: 216,
    sampleRate: sr,
    durationSec: 1.8,
    damping: 0.996,
    brightness: 0.35,
    pluckPosition: 0.22,
  });

  assert.equal(samples.length, Math.floor(sr * 1.8));

  let peak = 0;
  let headRms = 0;
  let tailRms = 0;
  const headLen = Math.floor(sr * 0.25);
  const tailStart = samples.length - headLen;

  for (let i = 0; i < samples.length; i++) {
    assert.ok(Number.isFinite(samples[i]), `Sample ${i} is finite`);
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
    if (i < headLen) headRms += samples[i] * samples[i];
    if (i >= tailStart) tailRms += samples[i] * samples[i];
  }

  assert.ok(peak > 0.4 && peak <= 0.8, `Expected normalized peak around 0.75, got ${peak}`);
  assert.ok(headRms > tailRms * 2, 'Plucked string should naturally decay from onset to tail');
});

test('generateRoomImpulseSamples builds stereo decaying room IR with bounded peak', () => {
  const sr = 44100;
  const [left, right] = generateRoomImpulseSamples(sr, 1.8, 1.4);
  assert.equal(left.length, Math.floor(sr * 1.8));
  assert.equal(right.length, Math.floor(sr * 1.8));

  let diffCount = 0;
  let energyEarly = 0;
  let energyLate = 0;
  let maxPeak = 0;
  for (let i = 0; i < left.length; i++) {
    assert.ok(Number.isFinite(left[i]) && Number.isFinite(right[i]));
    maxPeak = Math.max(maxPeak, Math.abs(left[i]), Math.abs(right[i]));
    if (Math.abs(left[i] - right[i]) > 1e-6) diffCount++;
    if (i < sr * 0.25) energyEarly += left[i] * left[i];
    if (i > sr * 1.3) energyLate += left[i] * left[i];
  }

  assert.ok(maxPeak <= 0.451, `IR peak should stay bounded <= 0.45, got ${maxPeak}`);
  assert.ok(diffCount > 1000, 'Stereo impulse response should be decorrelated between L and R');
  assert.ok(energyEarly > energyLate * 3, 'Reverb IR should decay smoothly over time');
});

test('generateSeamlessPinkNoiseSamples produces finite seamless loopable pink noise', () => {
  const sr = 44100;
  const noise = generateSeamlessPinkNoiseSamples(sr, 2.0, 0.04);
  assert.equal(noise.length, sr * 2);

  let peak = 0;
  for (let i = 0; i < noise.length; i++) {
    assert.ok(Number.isFinite(noise[i]));
    const a = Math.abs(noise[i]);
    if (a > peak) peak = a;
  }
  assert.ok(peak > 0.01 && peak < 0.5, `Expected bounded non-silent noise peak, got ${peak}`);
  // Boundary discontinuity should remain tiny (crossfaded tail into start)
  const seamJump = Math.abs(noise[0] - noise[noise.length - 1]);
  assert.ok(seamJump < 0.15, `Loop seam jump too large: ${seamJump}`);
});

test('generateWarmSaturationCurve, bowl eigenmodes, and humanization produce valid values', () => {
  const curve = generateWarmSaturationCurve(0.25, 257);
  assert.equal(curve.length, 257);
  assert.ok(Math.abs(curve[128]) < 1e-5);
  assert.ok(curve[0] < -0.9 && curve[256] > 0.9);

  const bowl = getBowlPartialSpecs(false);
  assert.equal(bowl.length, 3);
  assert.equal(bowl[0].ratio, 1.0);

  const offset = getHumanizedOffsetMs(3, 1, 20);
  assert.ok(offset >= -20 && offset <= 20);
});
