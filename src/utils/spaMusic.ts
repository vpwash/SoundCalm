/**
 * Pure Harmonic & Generative Music Theory Utilities
 * Includes 432 Hz / 528 Hz Spa Sanctuaries, Relaxing Instrumental Jazz,
 * Acoustic Bossa Café, Moonlit Chamber Strings, and Fingerpicked Guitar.
 */

export type SpaMusicStyle =
  | 'spa_sanctuary'
  | 'tibetan_bowls'
  | 'bamboo_zen_garden'
  | 'warm_ambient_piano'
  | 'midnight_lounge_jazz'
  | 'bossa_nova_sunset'
  | 'celestial_harp_strings'
  | 'nordic_acoustic_guitar';

export const MUSIC_STYLE_IDS: SpaMusicStyle[] = [
  'spa_sanctuary',
  'tibetan_bowls',
  'bamboo_zen_garden',
  'warm_ambient_piano',
  'midnight_lounge_jazz',
  'bossa_nova_sunset',
  'celestial_harp_strings',
  'nordic_acoustic_guitar',
];

export const MUSIC_AUTO_ROTATE_INTERVAL_SEC = 180; // 3 minutes

export interface SpaChordVoicing {
  name: string;
  rootHz: number;
  padNotesHz: number[]; // Warm sustained pad / Rhodes / chord voicing
  melodyScaleHz: number[]; // Safe melodic scale notes over this chord
  bassLineHz?: number[]; // Optional upright/acoustic bass notes
}

/**
 * 432 Hz Reference Pitch Conversion
 * Standard A4 = 432 Hz (MIDI note 69)
 */
export function midiTo432Hz(midiNote: number): number {
  return Number((432 * Math.pow(2, (midiNote - 69) / 12)).toFixed(2));
}

export function isMusicStyle(id: string): id is SpaMusicStyle {
  return (MUSIC_STYLE_IDS as string[]).includes(id);
}

/**
 * Randomly chooses a calming music piece, optionally excluding the current one
 * so transitions always introduce a fresh piece.
 */
export function pickRandomMusicStyle(exclude?: string): SpaMusicStyle {
  const candidates = exclude
    ? MUSIC_STYLE_IDS.filter((id) => id !== exclude)
    : MUSIC_STYLE_IDS;
  const pool = candidates.length > 0 ? candidates : MUSIC_STYLE_IDS;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

/**
 * Lush Major 9th, Lydian, Jazz ii-V-I-vi, Bossa, and Acoustic Chord Progressions
 * Designed to avoid harsh dissonance or abrupt startle cadences.
 */
export const SPA_CHORD_PROGRESSIONS: Record<SpaMusicStyle, SpaChordVoicing[]> = {
  spa_sanctuary: [
    {
      name: 'Fmaj9 (Heart Calm)',
      rootHz: midiTo432Hz(53), // F3
      padNotesHz: [midiTo432Hz(53), midiTo432Hz(60), midiTo432Hz(64), midiTo432Hz(67)],
      melodyScaleHz: [midiTo432Hz(69), midiTo432Hz(72), midiTo432Hz(76), midiTo432Hz(79), midiTo432Hz(81)],
    },
    {
      name: 'Cmaj9 (Oceanic Peace)',
      rootHz: midiTo432Hz(48), // C3
      padNotesHz: [midiTo432Hz(48), midiTo432Hz(55), midiTo432Hz(59), midiTo432Hz(62)],
      melodyScaleHz: [midiTo432Hz(67), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(76), midiTo432Hz(79)],
    },
    {
      name: 'G6/9 (Golden Horizon)',
      rootHz: midiTo432Hz(55), // G3
      padNotesHz: [midiTo432Hz(55), midiTo432Hz(59), midiTo432Hz(62), midiTo432Hz(64)],
      melodyScaleHz: [midiTo432Hz(67), midiTo432Hz(69), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(79)],
    },
    {
      name: 'Am9 (Stillness)',
      rootHz: midiTo432Hz(57), // A3 (216 Hz)
      padNotesHz: [midiTo432Hz(57), midiTo432Hz(60), midiTo432Hz(64), midiTo432Hz(67)],
      melodyScaleHz: [midiTo432Hz(69), midiTo432Hz(71), midiTo432Hz(72), midiTo432Hz(76), midiTo432Hz(79)],
    },
  ],
  tibetan_bowls: [
    {
      name: '432 Hz Om Resonance',
      rootHz: 108.0,
      padNotesHz: [216.0, 324.0, 432.0, 648.0],
      melodyScaleHz: [432.0, 528.0, 648.0, 864.0],
    },
    {
      name: '528 Hz Solfeggio Restoration',
      rootHz: 132.0,
      padNotesHz: [264.0, 396.0, 528.0, 792.0],
      melodyScaleHz: [396.0, 528.0, 639.0, 792.0],
    },
    {
      name: '639 Hz Harmonic Balance',
      rootHz: 159.75,
      padNotesHz: [213.0, 319.5, 426.0, 639.0],
      melodyScaleHz: [426.0, 528.0, 639.0, 852.0],
    },
  ],
  bamboo_zen_garden: [
    {
      name: 'Kyoto Mist (In-Sen Soft Pentatonic)',
      rootHz: midiTo432Hz(50), // D3
      padNotesHz: [midiTo432Hz(50), midiTo432Hz(57), midiTo432Hz(60), midiTo432Hz(65)],
      melodyScaleHz: [midiTo432Hz(62), midiTo432Hz(65), midiTo432Hz(67), midiTo432Hz(69), midiTo432Hz(72), midiTo432Hz(74)],
    },
    {
      name: 'Bamboo Sanctuary (G Major Pentatonic)',
      rootHz: midiTo432Hz(55), // G3
      padNotesHz: [midiTo432Hz(55), midiTo432Hz(62), midiTo432Hz(64), midiTo432Hz(67)],
      melodyScaleHz: [midiTo432Hz(67), midiTo432Hz(69), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(76), midiTo432Hz(79)],
    },
  ],
  warm_ambient_piano: [
    {
      name: 'Ebmaj9 (Velvet Dusk)',
      rootHz: midiTo432Hz(51), // Eb3
      padNotesHz: [midiTo432Hz(51), midiTo432Hz(58), midiTo432Hz(62), midiTo432Hz(65)],
      melodyScaleHz: [midiTo432Hz(67), midiTo432Hz(70), midiTo432Hz(74), midiTo432Hz(77), midiTo432Hz(79)],
    },
    {
      name: 'Abmaj9 (Starlit Water)',
      rootHz: midiTo432Hz(56), // Ab3
      padNotesHz: [midiTo432Hz(56), midiTo432Hz(60), midiTo432Hz(63), midiTo432Hz(67)],
      melodyScaleHz: [midiTo432Hz(68), midiTo432Hz(70), midiTo432Hz(72), midiTo432Hz(75), midiTo432Hz(79)],
    },
    {
      name: 'Bbmaj9 (Warm Embrace)',
      rootHz: midiTo432Hz(58), // Bb3
      padNotesHz: [midiTo432Hz(58), midiTo432Hz(62), midiTo432Hz(65), midiTo432Hz(69)],
      melodyScaleHz: [midiTo432Hz(70), midiTo432Hz(72), midiTo432Hz(74), midiTo432Hz(77), midiTo432Hz(81)],
    },
  ],
  midnight_lounge_jazz: [
    {
      name: 'Dm9 (Blue Velvet Ballad)',
      rootHz: midiTo432Hz(38), // D2 upright bass
      bassLineHz: [midiTo432Hz(38), midiTo432Hz(45), midiTo432Hz(41), midiTo432Hz(43)], // D2 - A2 - F2 - G2
      padNotesHz: [midiTo432Hz(53), midiTo432Hz(57), midiTo432Hz(60), midiTo432Hz(64)], // F3, A3, C4, E4 (Dm9)
      melodyScaleHz: [midiTo432Hz(64), midiTo432Hz(65), midiTo432Hz(69), midiTo432Hz(72), midiTo432Hz(74), midiTo432Hz(76)],
    },
    {
      name: 'G13 (Warm Rhodes Sway)',
      rootHz: midiTo432Hz(43), // G2
      bassLineHz: [midiTo432Hz(43), midiTo432Hz(38), midiTo432Hz(42), midiTo432Hz(43)], // G2 - D2 - F#2 - G2
      padNotesHz: [midiTo432Hz(53), midiTo432Hz(57), midiTo432Hz(59), midiTo432Hz(64)], // F3, A3, B3, E4 (G13)
      melodyScaleHz: [midiTo432Hz(64), midiTo432Hz(67), midiTo432Hz(69), midiTo432Hz(71), midiTo432Hz(74)],
    },
    {
      name: 'Cmaj9 (Midnight Lounge)',
      rootHz: midiTo432Hz(36), // C2
      bassLineHz: [midiTo432Hz(36), midiTo432Hz(43), midiTo432Hz(40), midiTo432Hz(43)], // C2 - G2 - E2 - G2
      padNotesHz: [midiTo432Hz(52), midiTo432Hz(55), midiTo432Hz(59), midiTo432Hz(62)], // E3, G3, B3, D4
      melodyScaleHz: [midiTo432Hz(64), midiTo432Hz(67), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(76)],
    },
    {
      name: 'Am11 (Smoky Upright Turn)',
      rootHz: midiTo432Hz(45), // A2
      bassLineHz: [midiTo432Hz(45), midiTo432Hz(40), midiTo432Hz(43), midiTo432Hz(40)], // A2 - E2 - G2 - E2
      padNotesHz: [midiTo432Hz(55), midiTo432Hz(60), midiTo432Hz(62), midiTo432Hz(64)], // G3, C4, D4, E4
      melodyScaleHz: [midiTo432Hz(67), midiTo432Hz(69), midiTo432Hz(72), midiTo432Hz(74), midiTo432Hz(76)],
    },
  ],
  bossa_nova_sunset: [
    {
      name: 'Fmaj7 (Ipanema Breeze)',
      rootHz: midiTo432Hz(41), // F2
      bassLineHz: [midiTo432Hz(41), midiTo432Hz(48), midiTo432Hz(41), midiTo432Hz(45)],
      padNotesHz: [midiTo432Hz(53), midiTo432Hz(57), midiTo432Hz(60), midiTo432Hz(64)],
      melodyScaleHz: [midiTo432Hz(67), midiTo432Hz(69), midiTo432Hz(72), midiTo432Hz(74), midiTo432Hz(76)],
    },
    {
      name: 'G13 (Warm Café Light)',
      rootHz: midiTo432Hz(43), // G2
      bassLineHz: [midiTo432Hz(43), midiTo432Hz(38), midiTo432Hz(43), midiTo432Hz(47)],
      padNotesHz: [midiTo432Hz(53), midiTo432Hz(57), midiTo432Hz(59), midiTo432Hz(62)],
      melodyScaleHz: [midiTo432Hz(67), midiTo432Hz(69), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(76)],
    },
    {
      name: 'Em7 (Quiet Rio Evening)',
      rootHz: midiTo432Hz(40), // E2
      bassLineHz: [midiTo432Hz(40), midiTo432Hz(47), midiTo432Hz(40), midiTo432Hz(43)],
      padNotesHz: [midiTo432Hz(52), midiTo432Hz(55), midiTo432Hz(59), midiTo432Hz(62)],
      melodyScaleHz: [midiTo432Hz(67), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(76), midiTo432Hz(79)],
    },
    {
      name: 'Am9 (Nylon Nylon Sway)',
      rootHz: midiTo432Hz(45), // A2
      bassLineHz: [midiTo432Hz(45), midiTo432Hz(40), midiTo432Hz(45), midiTo432Hz(43)],
      padNotesHz: [midiTo432Hz(55), midiTo432Hz(59), midiTo432Hz(60), midiTo432Hz(64)],
      melodyScaleHz: [midiTo432Hz(67), midiTo432Hz(69), midiTo432Hz(72), midiTo432Hz(74), midiTo432Hz(76)],
    },
  ],
  celestial_harp_strings: [
    {
      name: 'Dmaj9 (Moonlit Chamber)',
      rootHz: midiTo432Hz(50), // D3
      padNotesHz: [midiTo432Hz(50), midiTo432Hz(57), midiTo432Hz(61), midiTo432Hz(64)],
      melodyScaleHz: [midiTo432Hz(66), midiTo432Hz(69), midiTo432Hz(73), midiTo432Hz(76), midiTo432Hz(81)],
    },
    {
      name: 'Gmaj7#11 (Lydian Harp)',
      rootHz: midiTo432Hz(43), // G2
      padNotesHz: [midiTo432Hz(43), midiTo432Hz(55), midiTo432Hz(59), midiTo432Hz(61)],
      melodyScaleHz: [midiTo432Hz(66), midiTo432Hz(67), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(78)],
    },
    {
      name: 'Bm11 (Cello Reverie)',
      rootHz: midiTo432Hz(47), // B2
      padNotesHz: [midiTo432Hz(47), midiTo432Hz(54), midiTo432Hz(57), midiTo432Hz(64)],
      melodyScaleHz: [midiTo432Hz(66), midiTo432Hz(69), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(78)],
    },
  ],
  nordic_acoustic_guitar: [
    {
      name: 'Cadd9 (Fireside Strings)',
      rootHz: midiTo432Hz(48), // C3
      padNotesHz: [midiTo432Hz(48), midiTo432Hz(55), midiTo432Hz(60), midiTo432Hz(62)],
      melodyScaleHz: [midiTo432Hz(64), midiTo432Hz(67), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(76)],
    },
    {
      name: 'G6 (Morning Dew)',
      rootHz: midiTo432Hz(43), // G2
      padNotesHz: [midiTo432Hz(43), midiTo432Hz(50), midiTo432Hz(55), midiTo432Hz(59)],
      melodyScaleHz: [midiTo432Hz(64), midiTo432Hz(67), midiTo432Hz(69), midiTo432Hz(71), midiTo432Hz(74)],
    },
    {
      name: 'Em9 (Fjord Twilight)',
      rootHz: midiTo432Hz(40), // E2
      padNotesHz: [midiTo432Hz(40), midiTo432Hz(52), midiTo432Hz(55), midiTo432Hz(59)],
      melodyScaleHz: [midiTo432Hz(66), midiTo432Hz(67), midiTo432Hz(71), midiTo432Hz(74), midiTo432Hz(76)],
    },
  ],
};

/**
 * Deterministically selects the next chord and a gentle arpeggio sequence
 * for a given step counter, ensuring smooth voice-leading.
 */
export function getNextSpaHarmonyStep(
  style: SpaMusicStyle,
  stepIndex: number
): {
  chord: SpaChordVoicing;
  arpeggioNotesHz: number[];
  binauralBeatHz: number;
} {
  const progression = SPA_CHORD_PROGRESSIONS[style] || SPA_CHORD_PROGRESSIONS.spa_sanctuary;
  const safeStep = Math.abs(Math.floor(stepIndex));
  const chord = progression[safeStep % progression.length];

  const scale = chord.melodyScaleHz;
  const n1 = scale[safeStep % scale.length];
  const n2 = scale[(safeStep + 2) % scale.length];
  const n3 = scale[(safeStep + 4) % scale.length];

  const binauralBeatHz = style === 'tibetan_bowls' ? 4.32 : 5.5;

  return {
    chord,
    arpeggioNotesHz: [n1, n2, n3],
    binauralBeatHz,
  };
}
