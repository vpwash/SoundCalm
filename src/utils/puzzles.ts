/**
 * Pure Logic, Progressive Level Generators & Hint Reducers for SoundCalm's 5 Spatial Puzzle Games
 * Progressively scales complexity as levels are completed while maintaining a timer-free,
 * non-punitive, flow-inducing environment.
 */

import { ConstellationPattern, ConstellationNode } from '../types.ts';

// ============================================================================
// MASTERY TIER & PROGRESSION METADATA
// ============================================================================

export interface MasteryTierInfo {
  level: number;
  tierNumber: number;
  tierName: string;
  tierBadge: string;
  complexityLabel: string;
  starsReward: number;
}

export function getMasteryTier(level: number): MasteryTierInfo {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel <= 2) {
    return {
      level: safeLevel,
      tierNumber: 1,
      tierName: 'Gentle Sprout',
      tierBadge: '🌱 Tier 1 • Gentle Sprout',
      complexityLabel: 'Foundational Symmetry',
      starsReward: 1,
    };
  }
  if (safeLevel <= 4) {
    return {
      level: safeLevel,
      tierNumber: 2,
      tierName: 'Flowing Stream',
      tierBadge: '🌊 Tier 2 • Flowing Stream',
      complexityLabel: 'Expanded Spatial Working Memory',
      starsReward: 2,
    };
  }
  if (safeLevel <= 6) {
    return {
      level: safeLevel,
      tierNumber: 3,
      tierName: 'Radiant Lotus',
      tierBadge: '🪷 Tier 3 • Radiant Lotus',
      complexityLabel: 'Multi-Layer Harmonic Patterns',
      starsReward: 3,
    };
  }
  return {
    level: safeLevel,
    tierNumber: 4,
    tierName: 'Celestial Sanctuary',
    tierBadge: '✨ Tier 4 • Celestial Master',
    complexityLabel: 'Deep Sacred Geometry Flow',
    starsReward: 4,
  };
}

// ============================================================================
// 0. CONSTELLATION CONNECT (Progressive Generator & Hint)
// ============================================================================

const CURATED_CONSTELLATIONS: ConstellationPattern[] = [
  {
    id: 'serenity_lyra',
    name: 'Level 1: Serenity Lyra (5 Stars)',
    theme: 'Gentle 5-star harp • Connect the glowing dashed starlight paths',
    difficulty: 'gentle',
    starColor: '#38BDF8',
    nodes: [
      { id: 0, x: 50, y: 18, connectedTo: [1, 2] },
      { id: 1, x: 30, y: 45, connectedTo: [0, 3] },
      { id: 2, x: 70, y: 45, connectedTo: [0, 4] },
      { id: 3, x: 35, y: 80, connectedTo: [1, 4] },
      { id: 4, x: 65, y: 80, connectedTo: [2, 3] },
    ],
    edges: [
      [0, 1], [0, 2], [1, 3], [2, 4], [3, 4],
    ],
  },
  {
    id: 'harmonic_swan',
    name: 'Level 2: Harmonic Cygnus (6 Stars)',
    theme: 'Graceful cosmic swan with extended wingtips',
    difficulty: 'gentle',
    starColor: '#2DD4BF',
    nodes: [
      { id: 0, x: 50, y: 14, connectedTo: [1] },
      { id: 1, x: 50, y: 44, connectedTo: [0, 2, 3, 4] },
      { id: 2, x: 20, y: 38, connectedTo: [1, 5] },
      { id: 3, x: 80, y: 38, connectedTo: [1, 4] },
      { id: 4, x: 65, y: 80, connectedTo: [1, 3, 5] },
      { id: 5, x: 35, y: 80, connectedTo: [2, 4] },
    ],
    edges: [
      [0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [3, 4], [4, 5],
    ],
  },
  {
    id: 'tranquil_lotus',
    name: 'Level 3: Tranquil Lotus (7 Stars)',
    theme: '6-petal hexagonal star wheel radiating from a central core',
    difficulty: 'flowing',
    starColor: '#A78BFA',
    nodes: [
      { id: 0, x: 50, y: 50, connectedTo: [1, 2, 3, 4, 5, 6] },
      { id: 1, x: 50, y: 18, connectedTo: [0, 2, 6] },
      { id: 2, x: 78, y: 34, connectedTo: [0, 1, 3] },
      { id: 3, x: 78, y: 66, connectedTo: [0, 2, 4] },
      { id: 4, x: 50, y: 82, connectedTo: [0, 3, 5] },
      { id: 5, x: 22, y: 66, connectedTo: [0, 4, 6] },
      { id: 6, x: 22, y: 34, connectedTo: [0, 5, 1] },
    ],
    edges: [
      [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
      [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1],
    ],
  },
  {
    id: 'celestial_octagram',
    name: 'Level 4: Sacred Octagram (8 Stars)',
    theme: 'Twin overlapping star squares in 8-fold cosmic balance',
    difficulty: 'flowing',
    starColor: '#34D399',
    nodes: [
      { id: 0, x: 50, y: 14, connectedTo: [1, 7, 4] },
      { id: 1, x: 75, y: 25, connectedTo: [0, 2] },
      { id: 2, x: 86, y: 50, connectedTo: [1, 3, 6] },
      { id: 3, x: 75, y: 75, connectedTo: [2, 4] },
      { id: 4, x: 50, y: 86, connectedTo: [3, 5, 0] },
      { id: 5, x: 25, y: 75, connectedTo: [4, 6] },
      { id: 6, x: 14, y: 50, connectedTo: [5, 7, 2] },
      { id: 7, x: 25, y: 25, connectedTo: [6, 0] },
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
      [0, 4], [2, 6],
    ],
  },
  {
    id: 'aurora_crown',
    name: 'Level 5: Aurora Twin Crown (10 Stars)',
    theme: 'Inner diamond sanctuary linked to an outer 6-star celestial halo',
    difficulty: 'celestial',
    starColor: '#F472B6',
    nodes: [
      // Inner 4 diamond
      { id: 0, x: 50, y: 34, connectedTo: [1, 3, 4] },
      { id: 1, x: 66, y: 50, connectedTo: [0, 2, 6] },
      { id: 2, x: 50, y: 66, connectedTo: [1, 3, 7] },
      { id: 3, x: 34, y: 50, connectedTo: [2, 0, 9] },
      // Outer 6 ring
      { id: 4, x: 50, y: 14, connectedTo: [0, 5, 9] },
      { id: 5, x: 80, y: 28, connectedTo: [4, 6] },
      { id: 6, x: 84, y: 62, connectedTo: [5, 1, 7] },
      { id: 7, x: 50, y: 86, connectedTo: [6, 2, 8] },
      { id: 8, x: 16, y: 62, connectedTo: [7, 9] },
      { id: 9, x: 20, y: 28, connectedTo: [8, 3, 4] },
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 4],
      [0, 4], [1, 6], [2, 7], [3, 9],
    ],
  },
];

export function generateConstellationLevel(level: number): ConstellationPattern {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel <= CURATED_CONSTELLATIONS.length) {
    return CURATED_CONSTELLATIONS[safeLevel - 1];
  }

  // Procedural Multi-Ring Sacred Geometry for Levels 6+
  const outerCount = Math.min(8, 5 + (safeLevel % 4)); // 6 to 8 outer nodes
  const innerCount = Math.max(3, Math.floor(outerCount / 2)); // 3 to 4 inner nodes
  const nodes: ConstellationNode[] = [];
  const edges: [number, number][] = [];

  // Inner ring nodes: 0 .. innerCount-1
  for (let i = 0; i < innerCount; i++) {
    const angle = (i * 2 * Math.PI) / innerCount - Math.PI / 2;
    const x = Number((50 + 18 * Math.cos(angle)).toFixed(1));
    const y = Number((50 + 18 * Math.sin(angle)).toFixed(1));
    nodes.push({ id: i, x, y, connectedTo: [] });
  }

  // Outer ring nodes: innerCount .. innerCount+outerCount-1
  for (let j = 0; j < outerCount; j++) {
    const id = innerCount + j;
    const angle = (j * 2 * Math.PI) / outerCount - Math.PI / 2;
    const x = Number((50 + 36 * Math.cos(angle)).toFixed(1));
    const y = Number((50 + 36 * Math.sin(angle)).toFixed(1));
    nodes.push({ id, x, y, connectedTo: [] });
  }

  const addEdge = (a: number, b: number) => {
    const u = Math.min(a, b);
    const v = Math.max(a, b);
    if (!edges.some(([x, y]) => x === u && y === v)) {
      edges.push([u, v]);
      nodes[u].connectedTo.push(v);
      nodes[v].connectedTo.push(u);
    }
  };

  // Connect inner ring
  for (let i = 0; i < innerCount; i++) {
    addEdge(i, (i + 1) % innerCount);
  }
  // Connect outer ring
  for (let j = 0; j < outerCount; j++) {
    addEdge(innerCount + j, innerCount + ((j + 1) % outerCount));
  }
  // Radial spokes between inner and outer rings
  for (let j = 0; j < outerCount; j++) {
    addEdge(j % innerCount, innerCount + j);
  }

  const starColors = ['#38BDF8', '#2DD4BF', '#A78BFA', '#34D399', '#F472B6'];
  return {
    id: `procedural_constellation_${safeLevel}`,
    name: `Level ${safeLevel}: Cosmic Mandala (${nodes.length} Stars)`,
    theme: `Deep multi-ring sacred geometry • ${edges.length} harmonic starlight connections`,
    difficulty: 'celestial',
    starColor: starColors[safeLevel % starColors.length],
    nodes,
    edges,
  };
}

// ============================================================================
// 1. HARMONIC TANGRAM (Progressive Levels 1..N)
// ============================================================================

export interface TangramPiece {
  id: string;
  name: string;
  shape: 'triangle-lg' | 'triangle-md' | 'triangle-sm' | 'square' | 'rhombus';
  color: string;
  targetSlotId: string;
  targetRotation: number; // 0, 90, 180, 270
  rotationSymmetry: 90 | 180 | 360;
  currentSlotId: string | null;
  currentRotation: number;
}

export interface TangramPuzzle {
  id: string;
  level: number;
  name: string;
  theme: string;
  slots: { id: string; x: number; y: number; label: string }[];
  pieces: TangramPiece[];
}

export function generateTangramLevel(level: number): TangramPuzzle {
  const safeLevel = Math.max(1, Math.floor(level));

  if (safeLevel === 1) {
    return {
      id: 'paper_swan',
      level: 1,
      name: 'Level 1: Origami Swan Sanctuary (4 Crystals)',
      theme: 'Two crystals are already seated—rotate them and place the remaining two',
      slots: [
        { id: 'slot_head', x: 28, y: 25, label: 'Swan Crown' },
        { id: 'slot_neck', x: 36, y: 50, label: 'Graceful Neck' },
        { id: 'slot_body', x: 58, y: 60, label: 'Heart Wing' },
        { id: 'slot_tail', x: 78, y: 46, label: 'Tail Feather' },
      ],
      pieces: [
        {
          id: 'piece_head',
          name: 'Crown Prism',
          shape: 'triangle-sm',
          color: '#38BDF8',
          targetSlotId: 'slot_head',
          targetRotation: 0,
          rotationSymmetry: 360,
          currentSlotId: 'slot_head',
          currentRotation: 90,
        },
        {
          id: 'piece_neck',
          name: 'Neck Rhombus',
          shape: 'rhombus',
          color: '#2DD4BF',
          targetSlotId: 'slot_neck',
          targetRotation: 0,
          rotationSymmetry: 180,
          currentSlotId: 'slot_neck',
          currentRotation: 90,
        },
        {
          id: 'piece_body',
          name: 'Heart Wing',
          shape: 'triangle-lg',
          color: '#818CF8',
          targetSlotId: 'slot_body',
          targetRotation: 180,
          rotationSymmetry: 360,
          currentSlotId: null,
          currentRotation: 0,
        },
        {
          id: 'piece_tail',
          name: 'Tail Diamond',
          shape: 'square',
          color: '#34D399',
          targetSlotId: 'slot_tail',
          targetRotation: 0,
          rotationSymmetry: 90,
          currentSlotId: null,
          currentRotation: 0,
        },
      ],
    };
  }

  if (safeLevel === 2) {
    return {
      id: 'butterfly_harmony',
      level: 2,
      name: 'Level 2: Monarch of Serenity (5 Crystals)',
      theme: 'Assemble all five wing and body crystals into symmetric flight',
      slots: [
        { id: 'b_core', x: 50, y: 50, label: 'Thorax Core' },
        { id: 'b_ul', x: 30, y: 30, label: 'Upper Left Wing' },
        { id: 'b_ur', x: 70, y: 30, label: 'Upper Right Wing' },
        { id: 'b_ll', x: 34, y: 72, label: 'Lower Left Wing' },
        { id: 'b_lr', x: 66, y: 72, label: 'Lower Right Wing' },
      ],
      pieces: [
        {
          id: 'bp_core',
          name: 'Body Diamond',
          shape: 'square',
          color: '#FBBF24',
          targetSlotId: 'b_core',
          targetRotation: 0,
          rotationSymmetry: 90,
          currentSlotId: 'b_core',
          currentRotation: 0,
        },
        {
          id: 'bp_1',
          name: 'Left Forewing',
          shape: 'triangle-lg',
          color: '#38BDF8',
          targetSlotId: 'b_ul',
          targetRotation: 270,
          rotationSymmetry: 360,
          currentSlotId: null,
          currentRotation: 0,
        },
        {
          id: 'bp_2',
          name: 'Right Forewing',
          shape: 'triangle-lg',
          color: '#2DD4BF',
          targetSlotId: 'b_ur',
          targetRotation: 90,
          rotationSymmetry: 360,
          currentSlotId: null,
          currentRotation: 180,
        },
        {
          id: 'bp_3',
          name: 'Left Hindwing',
          shape: 'rhombus',
          color: '#A78BFA',
          targetSlotId: 'b_ll',
          targetRotation: 0,
          rotationSymmetry: 180,
          currentSlotId: null,
          currentRotation: 90,
        },
        {
          id: 'bp_4',
          name: 'Right Hindwing',
          shape: 'rhombus',
          color: '#34D399',
          targetSlotId: 'b_lr',
          targetRotation: 0,
          rotationSymmetry: 180,
          currentSlotId: null,
          currentRotation: 90,
        },
      ],
    };
  }

  if (safeLevel === 3) {
    return {
      id: 'sea_turtle',
      level: 3,
      name: 'Level 3: Ocean Sea Turtle (6 Crystals)',
      theme: 'Place and orient all 6 geometric shell and flipper crystals',
      slots: [
        { id: 't_head', x: 50, y: 18, label: 'Turtle Head' },
        { id: 't_shell_u', x: 50, y: 42, label: 'Upper Carapace' },
        { id: 't_shell_l', x: 50, y: 68, label: 'Lower Carapace' },
        { id: 't_flip_l', x: 24, y: 42, label: 'Left Flipper' },
        { id: 't_flip_r', x: 76, y: 42, label: 'Right Flipper' },
        { id: 't_tail', x: 50, y: 88, label: 'Tail Fin' },
      ],
      pieces: [
        {
          id: 'tp_1',
          name: 'Crown Gem',
          shape: 'rhombus',
          color: '#34D399',
          targetSlotId: 't_head',
          targetRotation: 0,
          rotationSymmetry: 180,
          currentSlotId: null,
          currentRotation: 90,
        },
        {
          id: 'tp_2',
          name: 'North Shell',
          shape: 'triangle-lg',
          color: '#2DD4BF',
          targetSlotId: 't_shell_u',
          targetRotation: 0,
          rotationSymmetry: 360,
          currentSlotId: null,
          currentRotation: 180,
        },
        {
          id: 'tp_3',
          name: 'South Shell',
          shape: 'square',
          color: '#0EA5E9',
          targetSlotId: 't_shell_l',
          targetRotation: 0,
          rotationSymmetry: 90,
          currentSlotId: null,
          currentRotation: 0,
        },
        {
          id: 'tp_4',
          name: 'West Flipper',
          shape: 'triangle-md',
          color: '#818CF8',
          targetSlotId: 't_flip_l',
          targetRotation: 270,
          rotationSymmetry: 360,
          currentSlotId: null,
          currentRotation: 90,
        },
        {
          id: 'tp_5',
          name: 'East Flipper',
          shape: 'triangle-md',
          color: '#A78BFA',
          targetSlotId: 't_flip_r',
          targetRotation: 90,
          rotationSymmetry: 360,
          currentSlotId: null,
          currentRotation: 270,
        },
        {
          id: 'tp_6',
          name: 'Tail Spire',
          shape: 'triangle-sm',
          color: '#38BDF8',
          targetSlotId: 't_tail',
          targetRotation: 180,
          rotationSymmetry: 360,
          currentSlotId: null,
          currentRotation: 0,
        },
      ],
    };
  }

  // Levels 4+: Full 7-Piece Grand Classical Tangram Mosaics with level-scaled rotations
  const shapes: TangramPiece['shape'][] = [
    'triangle-lg',
    'triangle-lg',
    'triangle-md',
    'triangle-sm',
    'triangle-sm',
    'square',
    'rhombus',
  ];
  const colors = ['#38BDF8', '#2DD4BF', '#818CF8', '#34D399', '#F472B6', '#FBBF24', '#A78BFA'];
  const slotCoords = [
    { id: 'g_0', x: 50, y: 18, label: 'Zenith Crown' },
    { id: 'g_1', x: 26, y: 36, label: 'West Wing' },
    { id: 'g_2', x: 74, y: 36, label: 'East Wing' },
    { id: 'g_3', x: 50, y: 48, label: 'Heart Sanctuary' },
    { id: 'g_4', x: 28, y: 68, label: 'West Pillar' },
    { id: 'g_5', x: 72, y: 68, label: 'East Pillar' },
    { id: 'g_6', x: 50, y: 84, label: 'Earth Keystone' },
  ];

  const pieces: TangramPiece[] = shapes.map((shape, idx) => {
    const targetRot = ((safeLevel + idx) * 90) % 360;
    const startRot = (targetRot + 90 * ((idx % 3) + 1)) % 360;
    const sym: 90 | 180 | 360 =
      shape === 'square' ? 90 : shape === 'rhombus' ? 180 : 360;
    return {
      id: `grand_p_${idx}`,
      name: `Crystal ${idx + 1}`,
      shape,
      color: colors[idx % colors.length],
      targetSlotId: slotCoords[idx].id,
      targetRotation: targetRot,
      rotationSymmetry: sym,
      currentSlotId: null,
      currentRotation: startRot,
    };
  });

  return {
    id: `grand_tangram_${safeLevel}`,
    level: safeLevel,
    name: `Level ${safeLevel}: Grand 7-Crystal Sanctuary`,
    theme: 'Full 7-piece classical tangram mosaic • Seat and orient every crystal into alignment',
    slots: slotCoords,
    pieces,
  };
}

export function rotateTangramPiece(piece: TangramPiece): TangramPiece {
  return {
    ...piece,
    currentRotation: (piece.currentRotation + 90) % 360,
  };
}

export function placeTangramPiece(
  pieces: TangramPiece[],
  pieceId: string,
  slotId: string | null
): TangramPiece[] {
  return pieces.map((p) => {
    if (p.id === pieceId) {
      return { ...p, currentSlotId: slotId };
    }
    if (slotId !== null && p.currentSlotId === slotId) {
      return { ...p, currentSlotId: null };
    }
    return p;
  });
}

export function isTangramPieceAligned(piece: TangramPiece): boolean {
  if (piece.currentSlotId !== piece.targetSlotId) return false;
  const normCurrent = ((piece.currentRotation % 360) + 360) % 360;
  const normTarget = ((piece.targetRotation % 360) + 360) % 360;
  return normCurrent % piece.rotationSymmetry === normTarget % piece.rotationSymmetry;
}

export function checkTangramSolved(pieces: TangramPiece[]): boolean {
  if (pieces.length === 0) return false;
  return pieces.every(isTangramPieceAligned);
}

/**
 * Gently aligns one unaligned Tangram piece into its target slot and rotation
 */
export function applyTangramHint(pieces: TangramPiece[]): TangramPiece[] {
  const unaligned = pieces.find((p) => !isTangramPieceAligned(p));
  if (!unaligned) return pieces;

  return pieces.map((p) => {
    if (p.id === unaligned.id) {
      return {
        ...p,
        currentSlotId: p.targetSlotId,
        currentRotation: p.targetRotation,
      };
    }
    // Unseat any piece that was sitting in unaligned.targetSlotId
    if (p.currentSlotId === unaligned.targetSlotId) {
      return { ...p, currentSlotId: null };
    }
    return p;
  });
}

// ============================================================================
// 2. CHROMA FLOW (Progressive 3x3 & 4x4 Color Gradient Grids)
// ============================================================================

export interface ChromaTile {
  id: number; // target index 0 .. N-1
  currentPos: number; // current index 0 .. N-1
  color: string;
  label: string;
  locked: boolean;
}

export interface ChromaLevelConfig {
  id: string;
  level: number;
  name: string;
  theme: string;
  gridSize: number; // 3 for 3x3, 4 for 4x4
  colors: string[];
  tiles: ChromaTile[];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Generates a 2D bilinear color gradient grid of size N x N from 4 corner hex colors
 */
export function interpolate2DColorGrid(
  gridSize: number,
  topLeft: string,
  topRight: string,
  bottomLeft: string,
  bottomRight: string
): string[] {
  const tl = hexToRgb(topLeft);
  const tr = hexToRgb(topRight);
  const bl = hexToRgb(bottomLeft);
  const br = hexToRgb(bottomRight);
  const result: string[] = [];

  for (let r = 0; r < gridSize; r++) {
    const v = gridSize === 1 ? 0 : r / (gridSize - 1);
    for (let c = 0; c < gridSize; c++) {
      const u = gridSize === 1 ? 0 : c / (gridSize - 1);
      const red = (1 - u) * (1 - v) * tl[0] + u * (1 - v) * tr[0] + (1 - u) * v * bl[0] + u * v * br[0];
      const green = (1 - u) * (1 - v) * tl[1] + u * (1 - v) * tr[1] + (1 - u) * v * bl[1] + u * v * br[1];
      const blue = (1 - u) * (1 - v) * tl[2] + u * (1 - v) * tr[2] + (1 - u) * v * bl[2] + u * v * br[2];
      result.push(rgbToHex(red, green, blue));
    }
  }
  return result;
}

const CORNER_THEMES: {
  name: string;
  corners: [string, string, string, string];
}[] = [
  { name: 'Oceanic Dawn', corners: ['#0284C7', '#38BDF8', '#059669', '#5EEAD4'] },
  { name: 'Twilight Nebula', corners: ['#4F46E5', '#A78BFA', '#DB2777', '#FBBF24'] },
  { name: 'Sunlit Meadow', corners: ['#D97706', '#FDE047', '#0D9488', '#6EE7B7'] },
  { name: 'Aurora Borealis', corners: ['#1E3A8A', '#2DD4BF', '#7C3AED', '#F472B6'] },
  { name: 'Lotus Horizon', corners: ['#0F766E', '#7DD3FC', '#9D174D', '#FDBA74'] },
];

export function generateChromaLevel(level: number): ChromaLevelConfig {
  const safeLevel = Math.max(1, Math.floor(level));
  // Levels 1-3 use 3x3 (9 tiles); Levels 4+ use 4x4 (16 tiles)
  const gridSize = safeLevel <= 3 ? 3 : 4;
  const totalTiles = gridSize * gridSize;
  const themeObj = CORNER_THEMES[(safeLevel - 1) % CORNER_THEMES.length];
  const colors = interpolate2DColorGrid(gridSize, ...themeObj.corners);

  // Progressive anchor reduction:
  // Level 1: 4 corners locked
  // Level 2: 3 corners locked
  // Level 3: 2 opposite corners locked
  // Level 4: 4x4 with 4 corners locked
  // Level 5+: 4x4 with 2 opposite corners locked
  const allCorners = [0, gridSize - 1, totalTiles - gridSize, totalTiles - 1];
  let lockedSet: Set<number>;
  if (safeLevel === 1 || safeLevel === 4) {
    lockedSet = new Set(allCorners);
  } else if (safeLevel === 2) {
    lockedSet = new Set([allCorners[0], allCorners[1], allCorners[2]]);
  } else {
    lockedSet = new Set([allCorners[0], allCorners[3]]);
  }

  // Deterministically derange unlocked indices so puzzle starts unsolved
  const unlockedIndices: number[] = [];
  for (let i = 0; i < totalTiles; i++) {
    if (!lockedSet.has(i)) unlockedIndices.push(i);
  }

  // Rotate unlocked positions by an offset coprime or shifted
  const shiftedUnlocked = unlockedIndices.map(
    (_, idx) => unlockedIndices[(idx + 2) % unlockedIndices.length]
  );

  const posMap = new Map<number, number>();
  allCorners.forEach((c) => {
    if (lockedSet.has(c)) posMap.set(c, c);
  });
  unlockedIndices.forEach((origIdx, i) => {
    posMap.set(origIdx, shiftedUnlocked[i]);
  });

  const tiles: ChromaTile[] = colors.map((color, targetIdx) => ({
    id: targetIdx,
    currentPos: posMap.get(targetIdx) ?? targetIdx,
    color,
    label: `Tone ${targetIdx + 1}`,
    locked: lockedSet.has(targetIdx),
  }));

  return {
    id: `chroma_lvl_${safeLevel}`,
    level: safeLevel,
    name: `Level ${safeLevel}: ${themeObj.name} (${gridSize}×${gridSize})`,
    theme: `Swap unlocked color stones to blend the ${gridSize}×${gridSize} gradient (${lockedSet.size} corner anchors locked)`,
    gridSize,
    colors,
    tiles,
  };
}

export function swapChromaTiles(
  tiles: ChromaTile[],
  posA: number,
  posB: number
): ChromaTile[] {
  if (posA === posB) return tiles;
  const tileA = tiles.find((t) => t.currentPos === posA);
  const tileB = tiles.find((t) => t.currentPos === posB);
  if (!tileA || !tileB || tileA.locked || tileB.locked) {
    return tiles;
  }
  return tiles.map((t) => {
    if (t.id === tileA.id) return { ...t, currentPos: posB };
    if (t.id === tileB.id) return { ...t, currentPos: posA };
    return t;
  });
}

export function checkChromaSolved(tiles: ChromaTile[]): boolean {
  if (tiles.length === 0) return false;
  return tiles.every((t) => t.id === t.currentPos);
}

/**
 * Gently swaps one misplaced Chroma tile directly into its true gradient position
 */
export function applyChromaHint(tiles: ChromaTile[]): ChromaTile[] {
  const misplaced = tiles.find((t) => !t.locked && t.id !== t.currentPos);
  if (!misplaced) return tiles;
  return swapChromaTiles(tiles, misplaced.currentPos, misplaced.id);
}

// ============================================================================
// 3. ZEN RIPPLE LOOPS (Progressive 3x3, 3x4, and 4x4 Solvable Circuits)
// ============================================================================

export type PortTuple = [boolean, boolean, boolean, boolean];

export interface ZenLoopTile {
  row: number;
  col: number;
  basePorts: PortTuple;
  targetRotation: number; // Known valid solution rotation (0..3)
  rotation: number; // Current rotation (0..3)
}

export interface ZenLoopLevel {
  id: string;
  level: number;
  name: string;
  theme: string;
  rows: number;
  cols: number;
  grid: ZenLoopTile[][];
}

export function getActivePorts(basePorts: PortTuple, rotation: number): PortTuple {
  const steps = ((rotation % 4) + 4) % 4;
  if (steps === 0) return [...basePorts] as PortTuple;
  const result: boolean[] = [false, false, false, false];
  for (let i = 0; i < 4; i++) {
    result[(i + steps) % 4] = basePorts[i];
  }
  return result as PortTuple;
}

/**
 * Builds a guaranteed-solvable closed-loop crystal grid of size rows x cols
 * for any progressive level!
 */
export function generateZenLoopLevel(level: number): ZenLoopLevel {
  const safeLevel = Math.max(1, Math.floor(level));

  // Scale grid dimensions with level:
  // Level 1-2: 3x3
  // Level 3: 3x4
  // Level 4+: 4x4
  const rows = safeLevel <= 3 ? 3 : 4;
  const cols = safeLevel <= 2 ? 3 : 4;

  // Build solved port connections [N, E, S, W] for each cell first
  const solvedPorts: PortTuple[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [false, false, false, false] as PortTuple)
  );

  const connectCells = (r1: number, c1: number, r2: number, c2: number) => {
    if (r2 === r1 - 1 && c2 === c1) {
      solvedPorts[r1][c1][0] = true;
      solvedPorts[r2][c2][2] = true;
    } else if (r2 === r1 && c2 === c1 + 1) {
      solvedPorts[r1][c1][1] = true;
      solvedPorts[r2][c2][3] = true;
    } else if (r2 === r1 + 1 && c2 === c1) {
      solvedPorts[r1][c1][2] = true;
      solvedPorts[r2][c2][0] = true;
    } else if (r2 === r1 && c2 === c1 - 1) {
      solvedPorts[r1][c1][3] = true;
      solvedPorts[r2][c2][1] = true;
    }
  };

  // 1. Always connect the outer perimeter ring so all border cells are part of a grand loop
  for (let c = 0; c < cols - 1; c++) {
    connectCells(0, c, 0, c + 1); // Top edge
    connectCells(rows - 1, c, rows - 1, c + 1); // Bottom edge
  }
  for (let r = 0; r < rows - 1; r++) {
    connectCells(r, 0, r + 1, 0); // Left edge
    connectCells(r, cols - 1, r + 1, cols - 1); // Right edge
  }

  // 2. Add internal harmonic bridges based on level complexity
  if (safeLevel === 2) {
    // Horizontal middle bridge across row 1
    for (let c = 0; c < cols - 1; c++) {
      connectCells(1, c, 1, c + 1);
    }
  } else if (safeLevel === 3) {
    // Vertical middle bridges in 3x4
    connectCells(0, 1, 1, 1);
    connectCells(1, 1, 2, 1);
    connectCells(0, 2, 1, 2);
    connectCells(1, 2, 2, 2);
    connectCells(1, 1, 1, 2);
  } else if (safeLevel >= 4) {
    // Inner 2x2 core loop inside the 4x4 grid + cross bridges
    connectCells(1, 1, 1, 2);
    connectCells(1, 2, 2, 2);
    connectCells(2, 2, 2, 1);
    connectCells(2, 1, 1, 1);
    if (safeLevel % 2 === 1) {
      connectCells(0, 1, 1, 1);
      connectCells(2, 2, 3, 2);
    }
  }

  // Convert solvedPorts into ZenLoopTile[][] with scrambled starting rotations
  const grid: ZenLoopTile[][] = solvedPorts.map((rowArr, rIdx) =>
    rowArr.map((ports, cIdx) => {
      const hasAny = ports.some(Boolean);
      const scrambleOffset = hasAny ? ((rIdx + cIdx + safeLevel) % 3) + 1 : 0;
      return {
        row: rIdx,
        col: cIdx,
        basePorts: ports,
        targetRotation: 0,
        rotation: scrambleOffset % 4,
      };
    })
  );

  return {
    id: `zen_loop_lvl_${safeLevel}`,
    level: safeLevel,
    name: `Level ${safeLevel}: Crystal Circuit (${rows}×${cols})`,
    theme: `Rotate the ${rows}×${cols} crystal conduits until every branch forms a closed loop of light`,
    rows,
    cols,
    grid,
  };
}

export function rotateZenTile(
  grid: ZenLoopTile[][],
  row: number,
  col: number
): ZenLoopTile[][] {
  return grid.map((r, rIdx) =>
    r.map((cell, cIdx) =>
      rIdx === row && cIdx === col
        ? { ...cell, rotation: (cell.rotation + 1) % 4 }
        : cell
    )
  );
}

export function checkZenLoopsSolved(grid: ZenLoopTile[][]): boolean {
  const rows = grid.length;
  if (rows === 0) return false;
  const cols = grid[0].length;
  if (cols === 0) return false;

  let hasAtLeastOnePort = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ports = getActivePorts(grid[r][c].basePorts, grid[r][c].rotation);
      const [north, east, south, west] = ports;

      if (north || east || south || west) {
        hasAtLeastOnePort = true;
      }

      if (north) {
        if (r === 0) return false;
        const neighborPorts = getActivePorts(grid[r - 1][c].basePorts, grid[r - 1][c].rotation);
        if (!neighborPorts[2]) return false;
      }

      if (east) {
        if (c === cols - 1) return false;
        const neighborPorts = getActivePorts(grid[r][c + 1].basePorts, grid[r][c + 1].rotation);
        if (!neighborPorts[3]) return false;
      }

      if (south) {
        if (r === rows - 1) return false;
        const neighborPorts = getActivePorts(grid[r + 1][c].basePorts, grid[r + 1][c].rotation);
        if (!neighborPorts[0]) return false;
      }

      if (west) {
        if (c === 0) return false;
        const neighborPorts = getActivePorts(grid[r][c - 1].basePorts, grid[r][c - 1].rotation);
        if (!neighborPorts[1]) return false;
      }
    }
  }

  return hasAtLeastOnePort;
}

/**
 * Gently aligns one unaligned tile in the Zen Loop grid to its target rotation
 */
export function applyZenLoopHint(grid: ZenLoopTile[][]): ZenLoopTile[][] {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      const currentPorts = getActivePorts(cell.basePorts, cell.rotation);
      const targetPorts = getActivePorts(cell.basePorts, cell.targetRotation);
      const matches = currentPorts.every((val, idx) => val === targetPorts[idx]);
      if (!matches) {
        return grid.map((rowArr, rIdx) =>
          rowArr.map((item, cIdx) =>
            rIdx === r && cIdx === c
              ? { ...item, rotation: item.targetRotation }
              : item
          )
        );
      }
    }
  }
  return grid;
}

// ============================================================================
// 4. MANDALA SYMMETRY PAINTER (Progressive Rings, Petals & Palettes)
// ============================================================================

export interface MandalaPattern {
  id: string;
  level: number;
  name: string;
  theme: string;
  rings: number; // 2 or 3 concentric rings
  sectors: number; // 8, 10, or 12 radial petals per ring
  palette: string[];
  targetGrid: number[][];
  initialGrid: number[][];
}

export function generateMandalaLevel(level: number): MandalaPattern {
  const safeLevel = Math.max(1, Math.floor(level));

  // Progressive scaling:
  // Level 1-2: 2 rings x 8 sectors (16 petals), 4 colors
  // Level 3: 3 rings x 8 sectors (24 petals), 4 colors
  // Level 4: 3 rings x 10 sectors (30 petals), 5 colors
  // Level 5+: 3 rings x 12 sectors (36 petals), 5 colors
  const rings = safeLevel <= 2 ? 2 : 3;
  const sectors = safeLevel <= 3 ? 8 : safeLevel === 4 ? 10 : 12;
  const palette =
    safeLevel <= 3
      ? ['#1E293B', '#2DD4BF', '#38BDF8', '#A78BFA']
      : ['#1E293B', '#2DD4BF', '#38BDF8', '#A78BFA', '#F472B6'];

  const targetGrid: number[][] = [];
  const initialGrid: number[][] = [];

  for (let r = 0; r < rings; r++) {
    const targetRow: number[] = [];
    const initRow: number[] = [];
    for (let s = 0; s < sectors; s++) {
      // Symmetric harmonic target color index (1 .. palette.length - 1)
      const symIndex = s % (sectors / 2);
      const targetColor = ((r + symIndex + safeLevel) % (palette.length - 1)) + 1;
      targetRow.push(targetColor);

      // Unalign a subset of symmetric pairs so the player has an engaging number of moves
      const shouldUnalign = (r + symIndex) % 2 === 0;
      initRow.push(shouldUnalign ? 0 : targetColor);
    }
    targetGrid.push(targetRow);
    initialGrid.push(initRow);
  }

  return {
    id: `mandala_lvl_${safeLevel}`,
    level: safeLevel,
    name: `Level ${safeLevel}: Sacred Rosette (${rings} Rings × ${sectors} Petals)`,
    theme: `Harmonize ${rings * sectors} radial petals across ${rings} concentric rings`,
    rings,
    sectors,
    palette,
    targetGrid,
    initialGrid,
  };
}

export function cycleMandalaPetal(
  currentGrid: number[][],
  ring: number,
  sector: number,
  paletteLength: number,
  autoMirror: boolean = true
): number[][] {
  const sectors = currentGrid[0]?.length || 8;
  const currentVal = currentGrid[ring]?.[sector] ?? 0;
  const nextVal = (currentVal + 1) % paletteLength;
  const mirrorSector = (sector + sectors / 2) % sectors;

  return currentGrid.map((rArr, rIdx) => {
    if (rIdx !== ring) return rArr;
    return rArr.map((val, sIdx) => {
      if (sIdx === sector || (autoMirror && sIdx === mirrorSector)) {
        return nextVal;
      }
      return val;
    });
  });
}

export function checkMandalaSolved(
  currentGrid: number[][],
  targetGrid: number[][]
): boolean {
  if (currentGrid.length === 0 || currentGrid.length !== targetGrid.length) return false;
  for (let r = 0; r < currentGrid.length; r++) {
    for (let s = 0; s < currentGrid[r].length; s++) {
      if (currentGrid[r][s] !== targetGrid[r][s]) return false;
    }
  }
  return true;
}

/**
 * Gently harmonizes one mismatched symmetric pair of petals in the Mandala
 */
export function applyMandalaHint(
  currentGrid: number[][],
  targetGrid: number[][]
): number[][] {
  const sectors = currentGrid[0]?.length || 8;
  for (let r = 0; r < currentGrid.length; r++) {
    for (let s = 0; s < currentGrid[r].length; s++) {
      if (currentGrid[r][s] !== targetGrid[r][s]) {
        const mirrorS = (s + sectors / 2) % sectors;
        const targetVal = targetGrid[r][s];
        return currentGrid.map((rowArr, rIdx) =>
          rIdx !== r
            ? rowArr
            : rowArr.map((v, sIdx) =>
                sIdx === s || sIdx === mirrorS ? targetVal : v
              )
        );
      }
    }
  }
  return currentGrid;
}
