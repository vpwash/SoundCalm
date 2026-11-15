import { useCallback, useEffect, useRef, useState } from 'react';
import { SessionLog } from '../types.ts';
import {
  DailyReminderSettings,
  NotificationPermissionState,
  computeNextReminderDate,
  formatTimeHHMM12Hour,
  getDailyReminderCopy,
  getDailyReminderSettings,
  getLocalDateKey,
  getNotificationPermissionSafe,
  hasCompletedSessionOnDate,
  registerDailyPeriodicSync,
  requestNotificationPermission,
  saveDailyReminderSettings,
  shouldTriggerDailyReminder,
  showSoundCalmNotification,
} from '../utils/reminders.ts';
import { usePWAInstall } from './usePWAInstall.ts';

interface UseDailyReminderParams {
  sessionHistory: SessionLog[];
  targetMinutes: number;
  weekNumber: number;
}

export interface DailyReminderState {
  isInstalled: boolean;
  settings: DailyReminderSettings;
  permission: NotificationPermissionState;
  statusFeedback: string | null;
  shouldShowInstallReminderBanner: boolean;
  formattedTimeLabel: string;
  enableReminders: () => Promise<boolean>;
  disableReminders: () => void;
  updateReminderTime: (timeHHMM: string) => void;
  dismissInstallBanner: () => void;
  sendTestNotification: () => Promise<boolean>;
}

export function useDailyReminder({
  sessionHistory,
  targetMinutes,
  weekNumber,
}: UseDailyReminderParams): DailyReminderState {
  const { isInstalled } = usePWAInstall();
  const [settings, setSettings] = useState<DailyReminderSettings>(() =>
    getDailyReminderSettings()
  );
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermissionSafe()
  );
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // Sync PWA installed state, session completion today, and session targets into reminder config (for SW IDB + foreground)
  useEffect(() => {
    const todayKey = getLocalDateKey();
    const completedToday = hasCompletedSessionOnDate(sessionHistory);

    setSettings((prev) => {
      const nextPwaInstalled = prev.pwaInstalled || isInstalled;
      const nextCompletedDate = completedToday ? todayKey : prev.hasCompletedTodayDate;
      if (
        prev.pwaInstalled === nextPwaInstalled &&
        prev.hasCompletedTodayDate === nextCompletedDate &&
        prev.targetMinutes === targetMinutes &&
        prev.weekNumber === weekNumber
      ) {
        return prev;
      }
      const updated = saveDailyReminderSettings({
        ...prev,
        pwaInstalled: nextPwaInstalled,
        hasCompletedTodayDate: nextCompletedDate,
        targetMinutes,
        weekNumber,
      });
      return updated;
    });
  }, [isInstalled, sessionHistory, targetMinutes, weekNumber]);

  // Register Periodic Background Sync when PWA is installed and reminders are enabled + granted
  useEffect(() => {
    if ((isInstalled || settings.pwaInstalled) && settings.enabled && permission === 'granted') {
      void registerDailyPeriodicSync();
    }
  }, [isInstalled, settings.pwaInstalled, settings.enabled, permission]);

  const checkAndTriggerReminder = useCallback(async () => {
    const currentPermission = getNotificationPermissionSafe();
    setPermission(currentPermission);
    if (currentPermission !== 'granted') return;

    const latest = getDailyReminderSettings();
    const completedToday = hasCompletedSessionOnDate(sessionHistory);
    const shouldFire = shouldTriggerDailyReminder({
      settings: latest,
      hasCompletedSessionToday: completedToday,
      isInstalled,
    });

    if (!shouldFire) return;

    const copy = getDailyReminderCopy(targetMinutes, weekNumber);
    const shown = await showSoundCalmNotification(
      copy.title,
      copy.body,
      'soundcalm-daily-reminder'
    );
    if (shown) {
      const updated = saveDailyReminderSettings({
        ...latest,
        lastNotifiedDate: getLocalDateKey(),
      });
      setSettings(updated);
    }
  }, [isInstalled, sessionHistory, targetMinutes, weekNumber]);

  // Schedule foreground timer + re-check on window focus or visibility change
  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const activeInstall = isInstalled || settings.pwaInstalled;
    if (!activeInstall || !settings.enabled || permission !== 'granted') {
      return;
    }

    // Immediate catch-up check in case the scheduled minute passed while backgrounded
    void checkAndTriggerReminder();

    const nextDate = computeNextReminderDate(settings.timeHHMM);
    const delayMs = Math.max(1000, nextDate.getTime() - Date.now());
    // Cap setTimeout to max 24h (32-bit int safe)
    const clampedDelayMs = Math.min(delayMs, 24 * 60 * 60 * 1000);

    timerRef.current = window.setTimeout(() => {
      void checkAndTriggerReminder();
    }, clampedDelayMs);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void checkAndTriggerReminder();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [
    isInstalled,
    settings.pwaInstalled,
    settings.enabled,
    settings.timeHHMM,
    permission,
    checkAndTriggerReminder,
  ]);

  const enableReminders = useCallback(async (): Promise<boolean> => {
    setStatusFeedback(null);
    const currentPerm = getNotificationPermissionSafe();
    if (currentPerm === 'unsupported') {
      setPermission('unsupported');
      setStatusFeedback('Notifications are not supported in this browser.');
      return false;
    }

    let finalPerm: NotificationPermissionState = currentPerm;
    if (currentPerm !== 'granted') {
      finalPerm = await requestNotificationPermission();
      setPermission(finalPerm);
    }

    if (finalPerm !== 'granted') {
      setStatusFeedback(
        finalPerm === 'denied'
          ? 'Notifications are blocked in your browser settings. Allow notifications for SoundCalm to enable daily reminders.'
          : 'Notification permission was dismissed.'
      );
      return false;
    }

    const updated = saveDailyReminderSettings({
      ...getDailyReminderSettings(),
      enabled: true,
      promptDismissed: true,
      pwaInstalled: isInstalled || settings.pwaInstalled,
      targetMinutes,
      weekNumber,
    });
    setSettings(updated);
    await registerDailyPeriodicSync();
    setStatusFeedback(
      `Daily reminder active for ${formatTimeHHMM12Hour(updated.timeHHMM)}.`
    );
    return true;
  }, [isInstalled, settings.pwaInstalled, targetMinutes, weekNumber]);

  const disableReminders = useCallback(() => {
    const updated = saveDailyReminderSettings({
      ...getDailyReminderSettings(),
      enabled: false,
    });
    setSettings(updated);
    setStatusFeedback('Daily reminders paused.');
  }, []);

  const updateReminderTime = useCallback((timeHHMM: string) => {
    if (!timeHHMM) return;
    const updated = saveDailyReminderSettings({
      ...getDailyReminderSettings(),
      timeHHMM,
    });
    setSettings(updated);
    setStatusFeedback(`Reminder time updated to ${formatTimeHHMM12Hour(timeHHMM)}.`);
  }, []);

  const dismissInstallBanner = useCallback(() => {
    const updated = saveDailyReminderSettings({
      ...getDailyReminderSettings(),
      promptDismissed: true,
    });
    setSettings(updated);
  }, []);

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    setStatusFeedback(null);
    const currentPerm = getNotificationPermissionSafe();
    if (currentPerm === 'unsupported') {
      setPermission('unsupported');
      setStatusFeedback('Notifications are unavailable in this browser environment.');
      return false;
    }

    let finalPerm: NotificationPermissionState = currentPerm;
    if (finalPerm !== 'granted') {
      finalPerm = await requestNotificationPermission();
      setPermission(finalPerm);
    }

    if (finalPerm !== 'granted') {
      setStatusFeedback('Please grant notification permission to preview the daily reminder.');
      return false;
    }

    const copy = getDailyReminderCopy(targetMinutes, weekNumber);
    const sent = await showSoundCalmNotification(
      `${copy.title} (Preview)`,
      copy.body,
      'soundcalm-daily-reminder-test'
    );
    if (sent) {
      setStatusFeedback('Test reminder notification sent.');
    } else {
      setStatusFeedback('Unable to display notification on this device.');
    }
    return sent;
  }, [targetMinutes, weekNumber]);

  const shouldShowInstallReminderBanner =
    (isInstalled || settings.pwaInstalled) &&
    permission === 'default' &&
    !settings.promptDismissed;

  return {
    isInstalled: isInstalled || settings.pwaInstalled,
    settings,
    permission,
    statusFeedback,
    shouldShowInstallReminderBanner,
    formattedTimeLabel: formatTimeHHMM12Hour(settings.timeHHMM),
    enableReminders,
    disableReminders,
    updateReminderTime,
    dismissInstallBanner,
    sendTestNotification,
  };
}
