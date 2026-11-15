/**
 * Sensory-Friendly UI Theme System for SoundCalm
 * Provides 6 curated neuro-acoustic & sensory-calibrated visual themes
 * including dark sanctuaries, zero-blue-light candlelight, and warm daylight paper modes.
 */

export type ThemeId =
  | 'midnight_sanctuary'
  | 'warm_parchment'
  | 'kyoto_moss'
  | 'lavender_dusk'
  | 'nordic_fjord'
  | 'amber_hearth';

export interface AppTheme {
  id: ThemeId;
  name: string;
  shortName: string;
  tagline: string;
  mode: 'dark' | 'light';
  emoji: string;
  previewSwatches: [string, string, string]; // [bg, surface, accent]
  canvasBg: [string, string, string]; // radial gradient stops for canvas games
  waveformBg: string;
  waveformActiveBar: string;
  waveformMutedBar: string;
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'midnight_sanctuary',
    name: 'Midnight Sanctuary',
    shortName: 'Midnight',
    tagline: 'Deep abyssal slate & bioluminescent teal',
    mode: 'dark',
    emoji: '🌌',
    previewSwatches: ['#020617', '#0f172a', '#2dd4bf'],
    canvasBg: ['#0c1322', '#080d19', '#030712'],
    waveformBg: '#0F172A',
    waveformActiveBar: '#2DD4BF',
    waveformMutedBar: '#334155',
  },
  {
    id: 'warm_parchment',
    name: 'Warm Washi Paper',
    shortName: 'Washi Paper',
    tagline: 'Cozy cream puzzle book & sage-jade ink',
    mode: 'light',
    emoji: '📜',
    previewSwatches: ['#F6F1E6', '#EAE2D0', '#1E7A68'],
    canvasBg: ['#EFE8D8', '#E5DCC8', '#D8CEB8'],
    waveformBg: '#EAE2D0',
    waveformActiveBar: '#1E7A68',
    waveformMutedBar: '#B8AE99',
  },
  {
    id: 'kyoto_moss',
    name: 'Kyoto Moss & Bamboo',
    shortName: 'Kyoto Moss',
    tagline: 'Grounding botanical forest & warm hinoki',
    mode: 'dark',
    emoji: '🎋',
    previewSwatches: ['#07130E', '#0F221A', '#34D399'],
    canvasBg: ['#0F241C', '#0A1913', '#050E0A'],
    waveformBg: '#0C1C15',
    waveformActiveBar: '#34D399',
    waveformMutedBar: '#264236',
  },
  {
    id: 'lavender_dusk',
    name: 'Lavender Twilight',
    shortName: 'Lavender',
    tagline: 'Velvet plum dusk & soothing amethyst glow',
    mode: 'dark',
    emoji: '🔮',
    previewSwatches: ['#0F0A1C', '#1A122E', '#C084FC'],
    canvasBg: ['#1E1535', '#140E24', '#0B0714'],
    waveformBg: '#160F29',
    waveformActiveBar: '#C084FC',
    waveformMutedBar: '#3B2D54',
  },
  {
    id: 'nordic_fjord',
    name: 'Nordic Mist Daylight',
    shortName: 'Nordic Mist',
    tagline: 'Soft overcast fjord blue & glare-free mist',
    mode: 'light',
    emoji: '🏔️',
    previewSwatches: ['#EBF1F6', '#DCE6F0', '#0284C7'],
    canvasBg: ['#E2ECF5', '#D5E2EE', '#C5D5E5'],
    waveformBg: '#DCE6F0',
    waveformActiveBar: '#0284C7',
    waveformMutedBar: '#94A8BE',
  },
  {
    id: 'amber_hearth',
    name: 'Candlelit Hearth',
    shortName: 'Hearth',
    tagline: 'Zero-blue-light warm espresso & honey amber',
    mode: 'dark',
    emoji: '🕯️',
    previewSwatches: ['#140D08', '#22160E', '#F59E0B'],
    canvasBg: ['#24170F', '#180F09', '#0F0905'],
    waveformBg: '#1E130C',
    waveformActiveBar: '#F59E0B',
    waveformMutedBar: '#4A3525',
  },
];

const THEME_STORAGE_KEY = 'soundcalm_ui_theme';

export function getThemeById(id: string | null | undefined): AppTheme {
  return APP_THEMES.find((t) => t.id === id) || APP_THEMES[0];
}

export function getStoredThemeId(): ThemeId {
  try {
    if (typeof localStorage === 'undefined') return 'midnight_sanctuary';
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return getThemeById(raw).id;
  } catch {
    return 'midnight_sanctuary';
  }
}

export function saveStoredThemeId(id: ThemeId): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    }
  } catch {
    // ignore storage errors
  }
}

export function applyThemeToDocument(themeId: ThemeId): AppTheme {
  const theme = getThemeById(themeId);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme.id);
    document.documentElement.setAttribute('data-theme-mode', theme.mode);
  }
  return theme;
}
