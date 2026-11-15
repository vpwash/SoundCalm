/**
 * Client-Side IndexedDB & Local Storage Manager
 * Zero-telemetry, 100% offline-first persistent storage for:
 * - SUDS clinical session logs
 * - Custom user-recorded audio triggers (ArrayBuffer/Blob)
 * - Parent PIN & clinical configuration
 */

import { ParentSettings, SessionLog, AudioTrack } from '../types.ts';
import { hashPin } from './clinical.ts';

const DB_NAME = 'soundcalm_db';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_AUDIO_TRACKS = 'audio_tracks';
const SETTINGS_KEY = 'soundcalm_parent_settings';

const DEFAULT_SALT = 'soundcalm_salt_2026';
export const DEFAULT_PARENT_SETTINGS: ParentSettings = {
  pinHash: hashPin('1234', DEFAULT_SALT), // Default PIN is "1234"
  salt: DEFAULT_SALT,
  maxTriggerCeilingGain: 0.08, // -22 dB default ceiling
  maxSessionDurationMinutes: 15, // Default 15 minutes, progresses +1 min weekly
  weeklyProgressionEnabled: true,
  sessionDurationVersion: 2,
  filterCutoffHz: 1500, // 1.5 kHz high-cut
  allowedTriggerIds: ['chew_crunch', 'breath_sniff', 'pen_click', 'clock_tick', 'desk_tap'],
  autoFadeoutEnabled: true,
  exportFormat: 'json',
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO_TRACKS)) {
        db.createObjectStore(STORE_AUDIO_TRACKS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ================= Sessions Store =================

export async function saveSessionLog(session: SessionLog): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    store.put(session);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Fallback to localStorage for session:', err);
    const existing = getLocalSessions();
    existing.push(session);
    localStorage.setItem('soundcalm_fallback_sessions', JSON.stringify(existing));
  }
}

export async function getAllSessionLogs(): Promise<SessionLog[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = request.result || [];
        // Merge with fallback if any
        const fallback = getLocalSessions();
        const mergedMap = new Map<string, SessionLog>();
        [...results, ...fallback].forEach((s) => mergedMap.set(s.id, s));
        const sorted = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        resolve(sorted);
      };
      request.onerror = () => resolve(getLocalSessions());
    });
  } catch {
    return getLocalSessions();
  }
}

function getLocalSessions(): SessionLog[] {
  try {
    const raw = localStorage.getItem('soundcalm_fallback_sessions');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearAllSessionLogs(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).clear();
    localStorage.removeItem('soundcalm_fallback_sessions');
  } catch (e) {
    console.warn('Error clearing sessions:', e);
  }
}

// ================= Custom Audio Tracks Store =================

export interface StoredAudioRecord {
  id: string;
  name: string;
  createdAt: string;
  duration: number;
  sampleRate?: number;
  clipOffsetSec?: number;
  clipDurationSec?: number;
  sourceType?: 'mic' | 'upload';
  arrayBuffer: ArrayBuffer;
  lowpassCutoffHz: number;
  normalizedPeakDbfs: number;
}

export async function saveCustomAudioTrack(
  id: string,
  name: string,
  audioBuffer: AudioBuffer,
  lowpassCutoffHz: number = 1500,
  clipOffsetSec: number = 0,
  clipDurationSec: number = 0.5,
  sourceType: 'mic' | 'upload' = 'mic'
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_AUDIO_TRACKS, 'readwrite');
  const store = tx.objectStore(STORE_AUDIO_TRACKS);

  // Convert AudioBuffer channel data to mono Float32Array ArrayBuffer
  const channelData = audioBuffer.getChannelData(0);
  const copyArray = new Float32Array(channelData.length);
  copyArray.set(channelData);
  const bufferCopy = copyArray.buffer;

  const record: StoredAudioRecord = {
    id,
    name,
    createdAt: new Date().toISOString(),
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    clipOffsetSec,
    clipDurationSec,
    sourceType,
    arrayBuffer: bufferCopy,
    lowpassCutoffHz,
    normalizedPeakDbfs: -14,
  };

  store.put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllCustomAudioRecords(): Promise<StoredAudioRecord[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_AUDIO_TRACKS, 'readonly');
    const store = tx.objectStore(STORE_AUDIO_TRACKS);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteCustomAudioRecord(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_AUDIO_TRACKS, 'readwrite');
    tx.objectStore(STORE_AUDIO_TRACKS).delete(id);
  } catch (err) {
    console.warn('Error deleting custom audio track:', err);
  }
}

export async function renameCustomAudioRecord(
  id: string,
  newName: string
): Promise<boolean> {
  const trimmed = newName.trim();
  if (!id || !trimmed) return false;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_AUDIO_TRACKS, 'readwrite');
    const store = tx.objectStore(STORE_AUDIO_TRACKS);
    return await new Promise<boolean>((resolve) => {
      let updated = false;
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as StoredAudioRecord | undefined;
        if (!existing) {
          resolve(false);
          return;
        }
        existing.name = trimmed;
        store.put(existing);
        updated = true;
      };
      getReq.onerror = () => resolve(false);
      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('Error renaming custom audio track:', err);
    return false;
  }
}

/**
 * Safely reconstructs a Web Audio API AudioBuffer from a StoredAudioRecord.
 * Guards against legacy/corrupted ArrayBuffers whose byteLength is not a multiple of 4,
 * invalid sample rates, or empty buffers so IndexedDB restoration can never crash the app.
 */
export function reconstructAudioBufferFromRecord(
  record: StoredAudioRecord | null | undefined,
  ctx: AudioContext
): AudioBuffer | null {
  try {
    if (!record || !record.arrayBuffer || !(record.arrayBuffer instanceof ArrayBuffer)) {
      return null;
    }
    const validByteLen = record.arrayBuffer.byteLength - (record.arrayBuffer.byteLength % 4);
    if (validByteLen < 16) {
      return null;
    }
    const alignedBuffer =
      validByteLen === record.arrayBuffer.byteLength
        ? record.arrayBuffer
        : record.arrayBuffer.slice(0, validByteLen);

    const floatData = new Float32Array(alignedBuffer);
    if (floatData.length === 0) return null;

    const rawSr = Number(record.sampleRate) || ctx.sampleRate || 44100;
    const safeSampleRate = Math.max(8000, Math.min(96000, Math.round(rawSr)));

    const audioBuffer = ctx.createBuffer(1, floatData.length, safeSampleRate);
    const dst = audioBuffer.getChannelData(0);
    for (let i = 0; i < floatData.length; i++) {
      const sample = floatData[i];
      dst[i] = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
    }
    return audioBuffer;
  } catch (err) {
    console.warn('Skipping incompatible stored audio record:', err);
    if (record?.id) {
      deleteCustomAudioRecord(record.id).catch(() => {});
    }
    return null;
  }
}

// ================= Parent Settings =================

export function getParentSettings(): ParentSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const initial: ParentSettings = {
        ...DEFAULT_PARENT_SETTINGS,
        programStartDate: new Date().toISOString(),
      };
      saveParentSettings(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<ParentSettings>;
    const migratedDuration =
      parsed.sessionDurationVersion !== 2 && parsed.maxSessionDurationMinutes === 10
        ? 15
        : parsed.maxSessionDurationMinutes ?? DEFAULT_PARENT_SETTINGS.maxSessionDurationMinutes;
    const programStartDate = parsed.programStartDate || new Date().toISOString();

    const merged: ParentSettings = {
      ...DEFAULT_PARENT_SETTINGS,
      ...parsed,
      maxSessionDurationMinutes: migratedDuration,
      weeklyProgressionEnabled: parsed.weeklyProgressionEnabled ?? true,
      programStartDate,
      sessionDurationVersion: 2,
    };

    if (parsed.sessionDurationVersion !== 2 || !parsed.programStartDate) {
      saveParentSettings(merged);
    }
    return merged;
  } catch {
    return DEFAULT_PARENT_SETTINGS;
  }
}

export function saveParentSettings(settings: ParentSettings): void {
  try {
    const toSave: ParentSettings = {
      ...settings,
      programStartDate: settings.programStartDate || new Date().toISOString(),
      weeklyProgressionEnabled: settings.weeklyProgressionEnabled ?? true,
      sessionDurationVersion: 2,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

// Persistent Storage Quota
export async function requestStoragePersistence(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
  }
  return false;
}
