// SoundCalm PWA Daily Reminder Notification Handler
// Imported by VitePWA/Workbox generated Service Worker

const REMINDER_DB_NAME = 'soundcalm_reminders_db';
const REMINDER_STORE = 'config';
const REMINDER_KEY = 'daily_reminder';

function openReminderDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(REMINDER_DB_NAME, 1);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(REMINDER_STORE)) {
        db.createObjectStore(REMINDER_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readReminderConfig() {
  try {
    const db = await openReminderDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(REMINDER_STORE, 'readonly');
      const req = tx.objectStore(REMINDER_STORE).get(REMINDER_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeReminderConfig(config) {
  try {
    const db = await openReminderDB();
    await new Promise((resolve) => {
      const tx = db.transaction(REMINDER_STORE, 'readwrite');
      tx.objectStore(REMINDER_STORE).put(config, REMINDER_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    // Best-effort persistence
  }
}

function getLocalDateKeySW(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hasReachedScheduledTime(timeHHMM, now) {
  const parts = String(timeHHMM || '19:00').split(':');
  const parsedH = Number(parts[0]);
  const parsedM = Number(parts[1]);
  const hours = Math.max(0, Math.min(23, Number.isFinite(parsedH) ? parsedH : 19));
  const minutes = Math.max(0, Math.min(59, Number.isFinite(parsedM) ? parsedM : 0));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = hours * 60 + minutes;
  return currentMinutes >= targetMinutes;
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'soundcalm-daily-reminder') return;
  event.waitUntil(
    (async () => {
      const cfg = await readReminderConfig();
      if (!cfg || !cfg.enabled || !cfg.pwaInstalled) return;
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;

      const now = new Date();
      const todayKey = getLocalDateKeySW(now);
      if (cfg.lastNotifiedDate === todayKey || cfg.hasCompletedTodayDate === todayKey) {
        return;
      }
      if (!hasReachedScheduledTime(cfg.timeHHMM, now)) {
        return;
      }

      const targetMins = cfg.targetMinutes || 15;
      const weekNum = cfg.weekNumber || 1;

      await self.registration.showNotification('SoundCalm Daily Session', {
        body: `Ready for your ${targetMins}-minute calming session (Week ${weekNum})? Tap to start gently.`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'soundcalm-daily-reminder',
        renotify: false,
        data: { url: '/' },
      });

      await writeReminderConfig({
        ...cfg,
        lastNotifiedDate: todayKey,
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })()
  );
});
