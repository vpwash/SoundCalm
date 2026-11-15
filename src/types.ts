/**
 * Misophonia Sound Therapy PWA - Clinical & Audio Data Models
 */

export type AudioCategory = 'calm' | 'game' | 'trigger';

export interface AudioTrack {
  id: string;
  name: string;
  category: AudioCategory;
  isCustom?: boolean;
  blob?: Blob;
  audioBuffer?: AudioBuffer;
  duration: number;
  lowpassCutoffHz?: number;
  normalizedPeakDbfs: number;
  description?: string;
}

export interface ParentSettings {
  pinHash: string; // SHA-256 hash of 4-digit PIN
  salt: string;
  maxTriggerCeilingGain: number; // 0.0 to 0.25 (strict hardware ceiling)
  maxSessionDurationMinutes: number; // Base session limit in minutes (default: 15 min)
  weeklyProgressionEnabled?: boolean; // Auto-progress +1 min per week (default: true)
  programStartDate?: string; // ISO timestamp for weekly progression calculation
  sessionDurationVersion?: number; // Migration version for 15-min default
  filterCutoffHz: number; // default: 1500 Hz
  allowedTriggerIds: string[];
  autoFadeoutEnabled: boolean;
  exportFormat: 'json' | 'csv';
}

export interface SessionLog {
  id: string;
  timestamp: string; // ISO string
  preSuds: number; // 0 - 10
  postSuds: number; // 0 - 10
  deltaSuds: number; // postSuds - preSuds
  sessionDurationSeconds: number;
  triggerSoundId: string;
  triggerSoundName: string;
  triggerExposureSeconds: number;
  effectiveGainRatio: number; // childGain * parentCeiling
  filterCutoffHz: number;
  panicActivated: boolean;
  panicCount: number;
}

export type SudsAnchor = {
  score: number;
  label: string;
  emoji: string;
  description: string;
  color: string;
};

export interface ConstellationNode {
  id: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  label?: string;
  connectedTo: number[]; // node ids this connects to in solution
}

export interface ConstellationPattern {
  id: string;
  name: string;
  theme: string;
  difficulty: 'gentle' | 'flowing' | 'celestial';
  nodes: ConstellationNode[];
  edges: [number, number][]; // target connections
  starColor: string;
}
