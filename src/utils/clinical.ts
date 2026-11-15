/**
 * Pure Clinical & Neuro-Acoustic Calculation Utilities
 * Designed for sub-threshold misophonia habituation, safe gain ceiling clamping,
 * and longitudinal SUDS (Subjective Units of Distress Scale) metrics.
 */

import { SessionLog, SudsAnchor } from '../types.ts';

/**
 * Standard SUDS (0-10) Visual & Child-Friendly Anchors
 */
export const SUDS_ANCHORS: SudsAnchor[] = [
  { score: 0, label: 'Totally Peaceful', emoji: '☁️', description: 'Completely relaxed, smiling cloud, zero tension', color: '#38BDF8' },
  { score: 2, label: 'Gentle & Calm', emoji: '🌱', description: 'Safe and at ease, slight awareness but comfy', color: '#34D399' },
  { score: 4, label: 'A Bit Annoyed', emoji: '⛅', description: 'Noticed the sound, mild annoyance, still managing fine', color: '#FBBF24' },
  { score: 6, label: 'Uncomfortable', emoji: '🌧️', description: 'Bothersome, starting to feel tense or irritable', color: '#FB923C' },
  { score: 8, label: 'Very Distressed', emoji: '🌩️', description: 'Strong urge to leave or block ears, high anxiety', color: '#F87171' },
  { score: 10, label: 'Severe Distress', emoji: '⚡', description: 'Full fight-or-flight overwhelm, panic trigger', color: '#EF4444' },
];

/**
 * Returns the nearest visual anchor for a given SUDS score
 */
export function getNearestSudsAnchor(score: number): SudsAnchor {
  const clamped = Math.max(0, Math.min(10, Math.round(score)));
  let closest = SUDS_ANCHORS[0];
  let minDiff = 999;
  for (const anchor of SUDS_ANCHORS) {
    const diff = Math.abs(anchor.score - clamped);
    if (diff < minDiff) {
      minDiff = diff;
      closest = anchor;
    }
  }
  return closest;
}

/**
 * Calculate change in distress (postSuds - preSuds).
 * Negative delta = improvement/reduction in distress during the session.
 * Positive delta = increased distress.
 */
export function calculateDeltaSuds(preSuds: number, postSuds: number): number {
  const pre = Math.max(0, Math.min(10, preSuds));
  const post = Math.max(0, Math.min(10, postSuds));
  return Number((post - pre).toFixed(2));
}

/**
 * Hard safety ceiling enforcement for Channel C (Trigger Audio).
 * Formula: Effective Gain = Child Gain * Parent Ceiling Gain.
 * Hardware lock: Clamped to never exceed maxHardwareCeiling (0.25 / -12dB).
 */
export function clampEffectiveGain(
  childGain: number,
  parentCeilingGain: number,
  maxHardwareCeiling: number = 0.25
): number {
  const safeChild = Math.max(0, Math.min(1, childGain));
  const safeParent = Math.max(0, Math.min(maxHardwareCeiling, parentCeilingGain));
  const effective = safeChild * safeParent;
  return Number(Math.min(effective, safeParent).toFixed(4));
}

/**
 * Converts linear gain (0.0 to 1.0) to decibels (dBFS)
 */
export function gainToDb(gain: number): number {
  if (gain <= 0.0001) return -80;
  return Number((20 * Math.log10(gain)).toFixed(1));
}

/**
 * Converts decibels (dBFS) to linear gain (0.0 to 1.0)
 */
export function dbToGain(db: number): number {
  return Number(Math.pow(10, db / 20).toFixed(4));
}

/**
 * Calculates audio normalization multiplier to safely bring peak amplitude
 * to the target dBFS (e.g. -14 dBFS = ~0.2 linear peak) to prevent startle responses.
 */
export function calculateNormalizationMultiplier(
  peakSampleVal: number,
  targetDbfs: number = -14
): number {
  const safePeak = Math.max(0.001, Math.abs(peakSampleVal));
  const targetLinear = Math.pow(10, targetDbfs / 20); // -14 dBFS ~ 0.1995
  const multiplier = targetLinear / safePeak;
  // Limit max boost to 4x (12dB) to prevent noise amplification
  return Number(Math.min(4.0, Math.max(0.1, multiplier)).toFixed(3));
}

/**
 * Longitudinal Habituation Index calculation over clinical sessions.
 * Evaluates the 7-day or recent moving average of delta SUDS.
 */
export function calculateHabituationIndex(sessions: SessionLog[]): {
  averageDelta: number;
  averagePostSuds: number;
  habituationStatus: 'optimal_desensitization' | 'gradual_habituation' | 'steady' | 'needs_lower_exposure';
  totalSessions: number;
  totalExposureMinutes: number;
  panicRatePercent: number;
} {
  if (!sessions || sessions.length === 0) {
    return {
      averageDelta: 0,
      averagePostSuds: 0,
      habituationStatus: 'steady',
      totalSessions: 0,
      totalExposureMinutes: 0,
      panicRatePercent: 0,
    };
  }

  const totalSessions = sessions.length;
  const recent = sessions.slice(-10); // Last 10 sessions
  const sumDelta = recent.reduce((acc, s) => acc + s.deltaSuds, 0);
  const avgDelta = Number((sumDelta / recent.length).toFixed(2));

  const sumPost = recent.reduce((acc, s) => acc + s.postSuds, 0);
  const avgPost = Number((sumPost / recent.length).toFixed(1));

  const totalExposureSec = sessions.reduce((acc, s) => acc + (s.triggerExposureSeconds || 0), 0);
  const totalExposureMinutes = Number((totalExposureSec / 60).toFixed(1));

  const panicSessions = sessions.filter((s) => s.panicActivated || (s.panicCount && s.panicCount > 0)).length;
  const panicRatePercent = Number(((panicSessions / totalSessions) * 100).toFixed(1));

  let habituationStatus: 'optimal_desensitization' | 'gradual_habituation' | 'steady' | 'needs_lower_exposure' = 'steady';
  if (avgDelta <= -1.5) {
    habituationStatus = 'optimal_desensitization';
  } else if (avgDelta < 0) {
    habituationStatus = 'gradual_habituation';
  } else if (avgDelta > 1.0 || panicRatePercent > 30) {
    habituationStatus = 'needs_lower_exposure';
  }

  return {
    averageDelta: avgDelta,
    averagePostSuds: avgPost,
    habituationStatus,
    totalSessions,
    totalExposureMinutes,
    panicRatePercent,
  };
}

/**
 * Deterministic fast 32-bit FNV-1a hash algorithm for Parent PIN verification.
 * Client-side safe, no external server dependency required.
 */
export function hashPin(pin: string, salt: string = 'soundcalm_secure_salt'): string {
  const str = `${salt}:${pin}:${salt}`;
  let h1 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Verify 4-digit PIN against stored hash
 */
export function verifyPin(enteredPin: string, storedHash: string, salt: string): boolean {
  if (!enteredPin || enteredPin.length !== 4) return false;
  return hashPin(enteredPin, salt) === storedHash;
}

export const DEFAULT_BASE_SESSION_MINUTES = 15;
export const WEEKLY_PROGRESSION_MINUTES = 1;
export const MAX_PROGRESSION_SESSION_MINUTES = 45;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface TargetSessionDurationInfo {
  baseMinutes: number;
  targetMinutes: number;
  targetSeconds: number;
  completedWeeks: number;
  currentWeekNumber: number;
  weeklyIncrementMinutes: number;
  daysUntilNextIncrease: number;
  nextMilestoneMinutes: number;
}

/**
 * Computes the automatic session duration limit.
 * Sessions default to 15 minutes in Week 1 and progress +1 minute every 7 days
 * from the earliest session or program start date (capped at 45 minutes).
 */
export function calculateTargetSessionMinutes(params: {
  baseMinutes?: number;
  programStartIso?: string;
  sessions?: SessionLog[];
  nowMs?: number;
  weeklyProgressionEnabled?: boolean;
  maxCapMinutes?: number;
}): TargetSessionDurationInfo {
  const baseMinutes = Math.max(
    3,
    Math.min(45, Math.round(params.baseMinutes ?? DEFAULT_BASE_SESSION_MINUTES))
  );
  const maxCapMinutes = params.maxCapMinutes ?? MAX_PROGRESSION_SESSION_MINUTES;
  const weeklyProgressionEnabled = params.weeklyProgressionEnabled ?? true;
  const nowMs = params.nowMs ?? Date.now();

  let startMs: number | null = null;
  if (params.programStartIso) {
    const parsed = new Date(params.programStartIso).getTime();
    if (Number.isFinite(parsed)) {
      startMs = parsed;
    }
  }

  if (params.sessions && params.sessions.length > 0) {
    for (const s of params.sessions) {
      const t = new Date(s.timestamp).getTime();
      if (Number.isFinite(t) && (startMs === null || t < startMs)) {
        startMs = t;
      }
    }
  }

  const effectiveStartMs = startMs ?? nowMs;
  const elapsedMs = Math.max(0, nowMs - effectiveStartMs);
  const completedWeeks = Math.floor(elapsedMs / MS_PER_WEEK);
  const weeklyIncrementMinutes = weeklyProgressionEnabled
    ? completedWeeks * WEEKLY_PROGRESSION_MINUTES
    : 0;
  const targetMinutes = Math.min(maxCapMinutes, baseMinutes + weeklyIncrementMinutes);
  const msIntoWeek = elapsedMs % MS_PER_WEEK;
  const daysUntilNextIncrease = Math.max(1, Math.ceil((MS_PER_WEEK - msIntoWeek) / MS_PER_DAY));

  return {
    baseMinutes,
    targetMinutes,
    targetSeconds: targetMinutes * 60,
    completedWeeks,
    currentWeekNumber: completedWeeks + 1,
    weeklyIncrementMinutes,
    daysUntilNextIncrease,
    nextMilestoneMinutes: weeklyProgressionEnabled
      ? Math.min(maxCapMinutes, targetMinutes + WEEKLY_PROGRESSION_MINUTES)
      : targetMinutes,
  };
}

export interface SudsImprovementPoint {
  index: number;
  label: string;
  id: string;
  timestamp: string;
  preSuds: number;
  postSuds: number;
  improvement: number; // preSuds - postSuds (positive = calmer / improved)
  deltaSuds: number;
  triggerName: string;
  durationMinutes: number;
}

/**
 * Prepares the last N (default 7) sessions sorted chronologically for the SUDS Improvement D3 chart.
 */
export function getRecentSudsImprovementSeries(
  sessions: SessionLog[],
  limit: number = 7
): SudsImprovementPoint[] {
  if (!sessions || sessions.length === 0) return [];
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const recent = sorted.slice(-Math.max(1, limit));

  return recent.map((s, idx) => {
    const pre = Math.max(0, Math.min(10, Number(s.preSuds) || 0));
    const post = Math.max(0, Math.min(10, Number(s.postSuds) || 0));
    return {
      index: idx + 1,
      label: `#${idx + 1}`,
      id: s.id,
      timestamp: s.timestamp,
      preSuds: pre,
      postSuds: post,
      improvement: Number((pre - post).toFixed(2)),
      deltaSuds: Number((post - pre).toFixed(2)),
      triggerName: s.triggerSoundName || s.triggerSoundId || 'Recorded Clip',
      durationMinutes: Number(((s.sessionDurationSeconds || 0) / 60).toFixed(1)),
    };
  });
}
