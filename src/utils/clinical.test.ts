import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDeltaSuds,
  clampEffectiveGain,
  calculateNormalizationMultiplier,
  calculateHabituationIndex,
  hashPin,
  verifyPin,
  getNearestSudsAnchor,
  gainToDb,
  calculateTargetSessionMinutes,
  getRecentSudsImprovementSeries,
} from './clinical.ts';
import { SessionLog } from '../types.ts';

test('calculateDeltaSuds properly computes difference and clamps inputs', () => {
  // Reduction in distress
  assert.equal(calculateDeltaSuds(6, 3), -3);
  // Increase in distress
  assert.equal(calculateDeltaSuds(2, 5), 3);
  // Zero delta
  assert.equal(calculateDeltaSuds(4, 4), 0);
  // Clamping outside 0-10
  assert.equal(calculateDeltaSuds(-2, 12), 10);
});

test('clampEffectiveGain enforces parent ceiling and hardware cap', () => {
  // Child at 100%, Parent ceiling at 0.08 -> effective gain must be 0.08
  const eff1 = clampEffectiveGain(1.0, 0.08, 0.25);
  assert.equal(eff1, 0.08);

  // Child at 50%, Parent ceiling at 0.08 -> effective gain must be 0.04
  const eff2 = clampEffectiveGain(0.5, 0.08, 0.25);
  assert.equal(eff2, 0.04);

  // Child at 100%, Parent ceiling attempted above hardware max of 0.25
  const eff3 = clampEffectiveGain(1.0, 0.50, 0.25);
  assert.equal(eff3, 0.25);

  // Child at 0%
  const eff4 = clampEffectiveGain(0.0, 0.15, 0.25);
  assert.equal(eff4, 0);
});

test('gainToDb converts linear scale to accurate dBFS', () => {
  assert.equal(gainToDb(1.0), 0);
  assert.equal(gainToDb(0.1), -20);
  assert.equal(gainToDb(0.00001), -80);
});

test('calculateNormalizationMultiplier safely scales target amplitude', () => {
  // Peak of 0.5 normalized to -14 dBFS (~0.2 linear) should scale down (~0.4 multiplier)
  const mult = calculateNormalizationMultiplier(0.5, -14);
  assert.ok(mult < 0.5 && mult > 0.35);

  // Very quiet sound peak of 0.02 normalized to -14 dBFS should scale up (capped at 4x)
  const multQuiet = calculateNormalizationMultiplier(0.02, -14);
  assert.equal(multQuiet, 4.0);
});

test('calculateHabituationIndex provides correct clinical summary', () => {
  const dummySessions: SessionLog[] = [
    {
      id: '1',
      timestamp: '2026-11-10T10:00:00Z',
      preSuds: 6,
      postSuds: 4,
      deltaSuds: -2,
      sessionDurationSeconds: 600,
      triggerSoundId: 'chew',
      triggerSoundName: 'Soft Chewing',
      triggerExposureSeconds: 120,
      effectiveGainRatio: 0.04,
      filterCutoffHz: 1500,
      panicActivated: false,
      panicCount: 0,
    },
    {
      id: '2',
      timestamp: '2026-11-11T10:00:00Z',
      preSuds: 5,
      postSuds: 3,
      deltaSuds: -2,
      sessionDurationSeconds: 600,
      triggerSoundId: 'chew',
      triggerSoundName: 'Soft Chewing',
      triggerExposureSeconds: 150,
      effectiveGainRatio: 0.05,
      filterCutoffHz: 1500,
      panicActivated: false,
      panicCount: 0,
    },
  ];

  const index = calculateHabituationIndex(dummySessions);
  assert.equal(index.totalSessions, 2);
  assert.equal(index.averageDelta, -2);
  assert.equal(index.habituationStatus, 'optimal_desensitization');
  assert.equal(index.panicRatePercent, 0);
  assert.equal(index.totalExposureMinutes, 4.5);
});

test('PIN hashing and verification are deterministic and secure', () => {
  const salt = 'clinic_test_salt';
  const pin = '4321';
  const hashed = hashPin(pin, salt);
  assert.ok(typeof hashed === 'string' && hashed.length > 0);

  // Positive verification
  assert.equal(verifyPin('4321', hashed, salt), true);
  // Negative verification
  assert.equal(verifyPin('1234', hashed, salt), false);
  assert.equal(verifyPin('0000', hashed, salt), false);
  assert.equal(verifyPin('432', hashed, salt), false);
});

test('getNearestSudsAnchor maps score to child-friendly anchors', () => {
  const anchor0 = getNearestSudsAnchor(0);
  assert.equal(anchor0.score, 0);
  assert.equal(anchor0.emoji, '☁️');

  const anchor8 = getNearestSudsAnchor(8);
  assert.equal(anchor8.score, 8);
  assert.equal(anchor8.emoji, '🌩️');
});

test('Zen Sudoku generates valid 6x6 and 9x9 solvable boards with conflict detection', async () => {
  const {
    generateSudokuLevel,
    getSudokuConflicts,
    getValidSudokuCandidates,
    isSudokuSolved,
  } = await import('./focusGames.ts');

  const lvl1 = generateSudokuLevel(1);
  assert.equal(lvl1.size, 6);
  assert.equal(isSudokuSolved(lvl1.solutionGrid, 6, 2, 3), true);
  assert.equal(isSudokuSolved(lvl1.initialGrid, 6, 2, 3), false);

  const lvl4 = generateSudokuLevel(4);
  assert.equal(lvl4.size, 9);
  assert.equal(isSudokuSolved(lvl4.solutionGrid, 9, 3, 3), true);

  // Verify candidate generator includes the true solution digit for every empty cell
  for (let r = 0; r < lvl1.size; r++) {
    for (let c = 0; c < lvl1.size; c++) {
      if (lvl1.initialGrid[r][c] === 0) {
        const cands = getValidSudokuCandidates(lvl1.initialGrid, r, c, 6, 2, 3);
        assert.ok(cands.includes(lvl1.solutionGrid[r][c]));
      }
    }
  }

  // Verify conflict detection catches duplicate in row
  const badGrid = lvl1.solutionGrid.map((r) => [...r]);
  badGrid[0][1] = badGrid[0][0];
  const conflicts = getSudokuConflicts(badGrid, 6, 2, 3);
  assert.equal(conflicts[0][0], true);
  assert.equal(conflicts[0][1], true);
});

test('Cozy Nonogram generates accurate row/col clues and detects solved state', async () => {
  const {
    generateNonogramLevel,
    computeLineClues,
    isNonogramSolved,
  } = await import('./focusGames.ts');

  assert.deepEqual(computeLineClues([1, 1, 0, 1, 0]), [2, 1]);
  assert.deepEqual(computeLineClues([0, 0, 0, 0, 0]), [0]);

  const nono1 = generateNonogramLevel(1);
  assert.equal(nono1.size, 5);
  assert.equal(isNonogramSolved(nono1.solution, nono1.solution), true);

  const nono6 = generateNonogramLevel(6);
  assert.equal(nono6.size, 8);
  assert.equal(isNonogramSolved(nono6.solution, nono6.solution), true);

  // Verify no crash if previous level's 5x5 grid is checked against an 8x8 solution
  assert.equal(isNonogramSolved(nono1.solution, nono6.solution), false);
});

test('Sudoku helpers safely handle grid size transitions (6x6 to 9x9) without crashing', async () => {
  const {
    generateSudokuLevel,
    getSudokuConflicts,
    getValidSudokuCandidates,
    isSudokuSolved,
  } = await import('./focusGames.ts');

  const lvl2_6x6 = generateSudokuLevel(2);
  // Passing a 6x6 grid with size=9 must never throw an out-of-bounds TypeError
  const conflicts = getSudokuConflicts(lvl2_6x6.initialGrid, 9, 3, 3);
  assert.equal(conflicts.length, 9);
  assert.equal(conflicts[8].length, 9);
  assert.equal(isSudokuSolved(lvl2_6x6.initialGrid, 9, 3, 3), false);
  assert.deepEqual(getValidSudokuCandidates(lvl2_6x6.initialGrid, 8, 8, 9, 3, 3), []);
});

test('Acoustic foley generator produces valid non-silent finite PCM recordings for all profiles', async () => {
  const {
    ACOUSTIC_FOLEY_PROFILES,
    synthesizeAcousticEventPcm,
    buildFullStudioFoleyRecordingPcm,
  } = await import('./acousticFoley.ts');

  assert.equal(ACOUSTIC_FOLEY_PROFILES.length, 6);
  for (const profile of ACOUSTIC_FOLEY_PROFILES) {
    const eventPcm = synthesizeAcousticEventPcm(profile.id, 44100, 42);
    assert.ok(eventPcm.length > 10000);
    let maxPeak = 0;
    for (let i = 0; i < eventPcm.length; i++) {
      assert.ok(Number.isFinite(eventPcm[i]));
      const abs = Math.abs(eventPcm[i]);
      if (abs > maxPeak) maxPeak = abs;
    }
    assert.ok(maxPeak > 0.1, `Expected audible peak for profile ${profile.id}`);
    assert.ok(maxPeak <= 0.99);
  }

  const fullTrack = buildFullStudioFoleyRecordingPcm('crunch', 2.4, 44100);
  assert.equal(fullTrack.length, Math.floor(44100 * 2.4));
});

test('calculateTargetSessionMinutes defaults to 15 minutes and progresses +1 minute weekly', () => {
  const startIso = '2026-11-01T10:00:00.000Z';
  const startMs = new Date(startIso).getTime();
  const DAY = 24 * 60 * 60 * 1000;

  // Week 1 (Day 0 & Day 6) -> 15 minutes (900 seconds)
  const week1 = calculateTargetSessionMinutes({ programStartIso: startIso, nowMs: startMs });
  assert.equal(week1.targetMinutes, 15);
  assert.equal(week1.targetSeconds, 900);
  assert.equal(week1.currentWeekNumber, 1);

  const day6 = calculateTargetSessionMinutes({ programStartIso: startIso, nowMs: startMs + 6 * DAY });
  assert.equal(day6.targetMinutes, 15);

  // Week 2 (Day 7) -> 16 minutes (960 seconds)
  const week2 = calculateTargetSessionMinutes({ programStartIso: startIso, nowMs: startMs + 7 * DAY });
  assert.equal(week2.targetMinutes, 16);
  assert.equal(week2.targetSeconds, 960);
  assert.equal(week2.currentWeekNumber, 2);

  // Week 4 (Day 21) -> 18 minutes
  const week4 = calculateTargetSessionMinutes({ programStartIso: startIso, nowMs: startMs + 21 * DAY });
  assert.equal(week4.targetMinutes, 18);

  // Disabled weekly progression stays fixed at base
  const fixed = calculateTargetSessionMinutes({
    programStartIso: startIso,
    nowMs: startMs + 28 * DAY,
    weeklyProgressionEnabled: false,
  });
  assert.equal(fixed.targetMinutes, 15);
});

test('getRecentSudsImprovementSeries keeps last 7 chronological sessions with accurate improvement values', () => {
  const sessions: SessionLog[] = Array.from({ length: 10 }, (_, idx) => ({
    id: `s_${idx + 1}`,
    timestamp: new Date(Date.UTC(2026, 10, idx + 1, 12, 0, 0)).toISOString(),
    preSuds: 7,
    postSuds: Math.max(1, 6 - (idx % 4)),
    deltaSuds: Math.max(1, 6 - (idx % 4)) - 7,
    sessionDurationSeconds: 900,
    triggerSoundId: 't1',
    triggerSoundName: 'Keyboard Typing',
    triggerExposureSeconds: 300,
    effectiveGainRatio: 0.04,
    filterCutoffHz: 1800,
    panicActivated: false,
    panicCount: 0,
  }));

  const series = getRecentSudsImprovementSeries(sessions, 7);
  assert.equal(series.length, 7);
  assert.equal(series[0].id, 's_4');
  assert.equal(series[6].id, 's_10');
  assert.equal(series[6].label, '#7');
  assert.equal(series[6].improvement, series[6].preSuds - series[6].postSuds);
});
