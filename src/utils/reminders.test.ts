import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DAILY_REMINDER_SETTINGS,
  computeNextReminderDate,
  formatTimeHHMM12Hour,
  getDailyReminderCopy,
  getLocalDateKey,
  hasCompletedSessionOnDate,
  parseTimeHHMM,
  shouldTriggerDailyReminder,
} from './reminders.ts';
import { SessionLog } from '../types.ts';

test('parseTimeHHMM and formatTimeHHMM12Hour parse and format 24h strings safely', () => {
  assert.deepEqual(parseTimeHHMM('19:00'), { hours: 19, minutes: 0 });
  assert.deepEqual(parseTimeHHMM('08:30'), { hours: 8, minutes: 30 });
  assert.deepEqual(parseTimeHHMM('invalid'), { hours: 19, minutes: 0 });

  assert.equal(formatTimeHHMM12Hour('19:00'), '7:00 PM');
  assert.equal(formatTimeHHMM12Hour('00:15'), '12:15 AM');
  assert.equal(formatTimeHHMM12Hour('12:05'), '12:05 PM');
});

test('computeNextReminderDate picks today if future or tomorrow if already past', () => {
  const morning = new Date(2026, 10, 14, 9, 0, 0); // 9:00 AM Nov 14
  const nextEvening = computeNextReminderDate('19:00', morning);
  assert.equal(nextEvening.getDate(), 14);
  assert.equal(nextEvening.getHours(), 19);

  const lateNight = new Date(2026, 10, 14, 21, 30, 0); // 9:30 PM Nov 14
  const nextDay = computeNextReminderDate('19:00', lateNight);
  assert.equal(nextDay.getDate(), 15);
  assert.equal(nextDay.getHours(), 19);
});

test('shouldTriggerDailyReminder requires installed PWA, scheduled time reached, and no session/notification today', () => {
  const evening = new Date(2026, 10, 14, 19, 15, 0);
  const todayKey = getLocalDateKey(evening);

  // Not installed -> never triggers
  assert.equal(
    shouldTriggerDailyReminder({
      settings: { ...DEFAULT_DAILY_REMINDER_SETTINGS, enabled: true, pwaInstalled: false },
      hasCompletedSessionToday: false,
      isInstalled: false,
      now: evening,
    }),
    false
  );

  // Installed + past 19:00 + no session today -> triggers!
  assert.equal(
    shouldTriggerDailyReminder({
      settings: { ...DEFAULT_DAILY_REMINDER_SETTINGS, enabled: true, pwaInstalled: true },
      hasCompletedSessionToday: false,
      isInstalled: true,
      now: evening,
    }),
    true
  );

  // Already notified today -> does not repeat
  assert.equal(
    shouldTriggerDailyReminder({
      settings: {
        ...DEFAULT_DAILY_REMINDER_SETTINGS,
        enabled: true,
        pwaInstalled: true,
        lastNotifiedDate: todayKey,
      },
      hasCompletedSessionToday: false,
      isInstalled: true,
      now: evening,
    }),
    false
  );

  // Already completed a session today -> skips reminder
  assert.equal(
    shouldTriggerDailyReminder({
      settings: { ...DEFAULT_DAILY_REMINDER_SETTINGS, enabled: true, pwaInstalled: true },
      hasCompletedSessionToday: true,
      isInstalled: true,
      now: evening,
    }),
    false
  );

  // Before scheduled time -> waits
  const afternoon = new Date(2026, 10, 14, 15, 0, 0);
  assert.equal(
    shouldTriggerDailyReminder({
      settings: { ...DEFAULT_DAILY_REMINDER_SETTINGS, enabled: true, pwaInstalled: true },
      hasCompletedSessionToday: false,
      isInstalled: true,
      now: afternoon,
    }),
    false
  );
});

test('hasCompletedSessionOnDate & getDailyReminderCopy reflect daily progress and weekly target', () => {
  const now = new Date(2026, 10, 14, 14, 0, 0);
  const sessionToday: SessionLog = {
    id: 's1',
    timestamp: new Date(2026, 10, 14, 10, 30, 0).toISOString(),
    preSuds: 5,
    postSuds: 2,
    deltaSuds: -3,
    sessionDurationSeconds: 900,
    triggerExposureSeconds: 180,
    effectiveGainRatio: 0.12,
    filterCutoffHz: 1500,
    panicActivated: false,
    panicCount: 0,
    triggerSoundId: 't1',
    triggerSoundName: 'Clip',
  };

  assert.equal(hasCompletedSessionOnDate([sessionToday], now), true);
  assert.equal(hasCompletedSessionOnDate([], now), false);

  const copy = getDailyReminderCopy(16, 2);
  assert.match(copy.title, /SoundCalm/);
  assert.match(copy.body, /16-minute/);
  assert.match(copy.body, /Week 2/);
});
