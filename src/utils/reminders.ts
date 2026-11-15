import { SessionLog } from '../types.ts';

export interface DailyReminderSettings {
  enabled: boolean;
  timeHHMM: string; // 24h "HH:MM", default "19:00"
  lastNotifiedDate: string; // Local "YYYY-MM-DD"
  hasCompletedTodayDate: string; // Local "YYYY-MM-DD"
  promptDismissed: boolean;
  pwaInstalled: boolean;
  targetMinutes: number;
  weekNumber: number;
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

const REMINDER_STORAGE_KEY = 'soundcalm_daily_reminder_settings';
const REMINDER_DB_NAME = 'soundcalm_reminders_db';
const REMINDER_STORE = 'config';
const REMINDER_IDB_KEY = 'daily_reminder';

export const DEFAULT_REMINDER_TIME = '19:00';

export const DEFAULT_DAILY_REMINDER_SETTINGS: DailyReminderSettings = {
  enabled: true,
  timeHHMM: DEFAULT_REMINDER_TIME,
  lastNotifiedDate: '',
  hasCompletedTodayDate: '',
  promptDismissed: false,
  pwaInstalled: false,
  targetMinutes: 15,
  weekNumber: 1,
};

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseTimeHHMM(timeHHMM: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec((timeHHMM || '').trim());
  if (!match) {
    return { hours: 19, minutes: 0 };
  }
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  return { hours, minutes };
}

export function formatTimeHHMM12Hour(timeHHMM: string): string {
  const { hours, minutes } = parseTimeHHMM(timeHHMM);
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function computeNextReminderDate(timeHHMM: string, now: Date = new Date()): Date {
  const { hours, minutes } = parseTimeHHMM(timeHHMM);
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  );
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export function hasCompletedSessionOnDate(
  sessions: SessionLog[],
  date: Date = new Date()
): boolean {
  const targetKey = getLocalDateKey(date);
  return sessions.some((s) => {
    const dt = new Date(s.timestamp);
    if (Number.isNaN(dt.getTime())) return false;
    return getLocalDateKey(dt) === targetKey;
  });
}

export function shouldTriggerDailyReminder(params: {
  settings: DailyReminderSettings;
  hasCompletedSessionToday: boolean;
  isInstalled: boolean;
  now?: Date;
}): boolean {
  const { settings, hasCompletedSessionToday, isInstalled, now = new Date() } = params;
  if (!isInstalled && !settings.pwaInstalled) return false;
  if (!settings.enabled) return false;

  const todayKey = getLocalDateKey(now);
  if (settings.lastNotifiedDate === todayKey) return false;
  if (hasCompletedSessionToday || settings.hasCompletedTodayDate === todayKey) return false;

  const { hours, minutes } = parseTimeHHMM(settings.timeHHMM);
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduledTotalMinutes = hours * 60 + minutes;
  return currentTotalMinutes >= scheduledTotalMinutes;
}

export function getDailyReminderCopy(
  targetMinutes: number,
  weekNumber: number
): { title: string; body: string } {
  const safeMinutes = Math.max(3, Math.round(targetMinutes || 15));
  const safeWeek = Math.max(1, Math.round(weekNumber || 1));
  return {
    title: 'SoundCalm Daily Session',
    body: `Ready for your ${safeMinutes}-minute calming session (Week ${safeWeek})? Tap to start gently.`,
  };
}

export function getNotificationPermissionSafe(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

export function getDailyReminderSettings(): DailyReminderSettings {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DAILY_REMINDER_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<DailyReminderSettings>;
    return {
      ...DEFAULT_DAILY_REMINDER_SETTINGS,
      ...parsed,
      timeHHMM: parsed.timeHHMM || DEFAULT_REMINDER_TIME,
    };
  } catch {
    return { ...DEFAULT_DAILY_REMINDER_SETTINGS };
  }
}

async function syncReminderConfigToIDB(settings: DailyReminderSettings): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(REMINDER_DB_NAME, 1);
      req.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(REMINDER_STORE)) {
          database.createObjectStore(REMINDER_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    await new Promise<void>((resolve) => {
      const tx = db.transaction(REMINDER_STORE, 'readwrite');
      tx.objectStore(REMINDER_STORE).put(settings, REMINDER_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // IDB sync is best-effort
  }
}

export function saveDailyReminderSettings(
  settings: DailyReminderSettings
): DailyReminderSettings {
  const normalized: DailyReminderSettings = {
    ...DEFAULT_DAILY_REMINDER_SETTINGS,
    ...settings,
  };
  try {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota warnings
  }
  void syncReminderConfigToIDB(normalized);
  return normalized;
}

export async function registerDailyPeriodicSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const periodicSync = (
      registration as ServiceWorkerRegistration & {
        periodicSync?: {
          register: (tag: string, options?: { minInterval: number }) => Promise<void>;
        };
      }
    ).periodicSync;

    if (periodicSync && typeof periodicSync.register === 'function') {
      await periodicSync.register('soundcalm-daily-reminder', {
        minInterval: 12 * 60 * 60 * 1000, // 12 hours
      });
      return true;
    }
  } catch {
    // Periodic Background Sync may require installed PWA permissions in Chromium
  }
  return false;
}

export async function showSoundCalmNotification(
  title: string,
  body: string,
  tag: string = 'soundcalm-daily-reminder'
): Promise<boolean> {
  const permission = getNotificationPermissionSafe();
  if (permission !== 'granted') return false;

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    data: { url: '/' },
  };

  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
      ]);
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // Fallback below if Service Worker registration isn't ready yet
  }

  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    return getNotificationPermissionSafe();
  }
}
