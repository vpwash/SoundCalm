import { calculateNormalizationMultiplier } from './clinical.ts';

export interface PreloadedTriggerItem {
  id: string;
  name: string;
  url: string;
  defaultCutoffHz: number;
}

export const PRELOADED_TRIGGERS: PreloadedTriggerItem[] = [
  {
    id: 'preloaded_chewing',
    name: 'Chewing',
    url: '/triggers/Chewing.mp3',
    defaultCutoffHz: 2000,
  },
  {
    id: 'preloaded_cough',
    name: 'Cough',
    url: '/triggers/Cough.mp3',
    defaultCutoffHz: 2100,
  },
  {
    id: 'preloaded_hands_rubbing',
    name: 'Hands Rubbing',
    url: '/triggers/Hands%20Rubbing.mp3',
    defaultCutoffHz: 2400,
  },
  {
    id: 'preloaded_smacking',
    name: 'Smacking',
    url: '/triggers/Smacking.mp3',
    defaultCutoffHz: 2200,
  },
];

const decodedCache = new Map<
  string,
  { buffer: AudioBuffer; offsetSec: number; durationSec: number }
>();

/**
 * Fetches, decodes, normalizes (-14 dBFS), and locates the peak 0.5s window
 * for a preloaded MP3 trigger in /public/triggers/.
 */
export async function loadPreloadedTriggerBuffer(
  item: PreloadedTriggerItem,
  ctx: AudioContext
): Promise<{ buffer: AudioBuffer; offsetSec: number; durationSec: number }> {
  const cached = decodedCache.get(item.id);
  if (cached) {
    return cached;
  }

  const response = await fetch(item.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch preloaded trigger "${item.name}" (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const decoded = await ctx.decodeAudioData(arrayBuffer);

  const length = decoded.length;
  const sr = decoded.sampleRate;
  const normBuf = ctx.createBuffer(1, length, sr);
  const dst = normBuf.getChannelData(0);
  const ch0 = decoded.getChannelData(0);

  let maxPeak = 0;
  let peakIndex = 0;
  for (let i = 0; i < length; i++) {
    dst[i] = ch0[i];
    const abs = Math.abs(ch0[i]);
    if (abs > maxPeak) {
      maxPeak = abs;
      peakIndex = i;
    }
  }

  const mult = calculateNormalizationMultiplier(maxPeak, -14);
  for (let i = 0; i < length; i++) {
    dst[i] = Math.max(-0.98, Math.min(0.98, dst[i] * mult));
  }

  const durationSec = Math.min(0.5, Math.max(0.2, normBuf.duration));
  const peakSec = peakIndex / sr;
  const maxStart = Math.max(0, normBuf.duration - durationSec);
  const offsetSec = Math.max(0, Math.min(maxStart, peakSec - durationSec * 0.35));

  const result = { buffer: normBuf, offsetSec, durationSec };
  decodedCache.set(item.id, result);
  return result;
}
