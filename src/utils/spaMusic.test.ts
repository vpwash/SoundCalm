import test from 'node:test';
import assert from 'node:assert/strict';
import {
  midiTo432Hz,
  SPA_CHORD_PROGRESSIONS,
  MUSIC_STYLE_IDS,
  MUSIC_AUTO_ROTATE_INTERVAL_SEC,
  getNextSpaHarmonyStep,
  pickRandomMusicStyle,
  isMusicStyle,
} from './spaMusic.ts';

test('midiTo432Hz accurately tunes A4 (MIDI 69) to 432 Hz and A3 (MIDI 57) to 216 Hz', () => {
  assert.equal(midiTo432Hz(69), 432);
  assert.equal(midiTo432Hz(57), 216);
  assert.equal(midiTo432Hz(81), 864);
});

test('getNextSpaHarmonyStep cycles through spa progressions with valid harmonic frequencies', () => {
  const step0 = getNextSpaHarmonyStep('spa_sanctuary', 0);
  assert.equal(step0.chord.name, 'Fmaj9 (Heart Calm)');
  assert.equal(step0.arpeggioNotesHz.length, 3);
  assert.ok(step0.arpeggioNotesHz.every((f) => f > 150 && f < 2000));

  const step1 = getNextSpaHarmonyStep('spa_sanctuary', 1);
  assert.equal(step1.chord.name, 'Cmaj9 (Oceanic Peace)');

  const bowls = getNextSpaHarmonyStep('tibetan_bowls', 1);
  assert.equal(bowls.chord.name, '528 Hz Solfeggio Restoration');
  assert.equal(bowls.binauralBeatHz, 4.32);

  const jazz = getNextSpaHarmonyStep('midnight_lounge_jazz', 0);
  assert.equal(jazz.chord.name, 'Dm9 (Blue Velvet Ballad)');
  assert.ok(Array.isArray(jazz.chord.bassLineHz) && jazz.chord.bassLineHz.length === 4);
});

test('All 8 music styles have non-empty chord progressions and melody scales', () => {
  assert.equal(MUSIC_STYLE_IDS.length, 8);
  for (const style of MUSIC_STYLE_IDS) {
    const prog = SPA_CHORD_PROGRESSIONS[style];
    assert.ok(prog.length >= 2, `Expected at least 2 voicings for ${style}`);
    for (const voicing of prog) {
      assert.ok(voicing.padNotesHz.length >= 3);
      assert.ok(voicing.melodyScaleHz.length >= 4);
    }
  }
});

test('pickRandomMusicStyle selects valid styles and excludes previous track when specified', () => {
  assert.equal(MUSIC_AUTO_ROTATE_INTERVAL_SEC, 180);
  assert.equal(isMusicStyle('midnight_lounge_jazz'), true);
  assert.equal(isMusicStyle('pink_noise'), false);

  for (let i = 0; i < 20; i++) {
    const picked = pickRandomMusicStyle('midnight_lounge_jazz');
    assert.equal(isMusicStyle(picked), true);
    assert.notEqual(picked, 'midnight_lounge_jazz');
  }
});
