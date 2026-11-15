/**
 * Pure Logic, Progressive Level Generators & Hint Reducers for SoundCalm's Spatial & Focus Puzzle Games
 * Progressively scales complexity as levels are completed while maintaining a timer-free,
 * non-punitive, flow-inducing environment.
 */

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
// 0. SERENE WORD SEARCH (Progressive Calming Word Grids)
// ============================================================================

export interface WordSearchPlacement {
  word: string;
  cells: [number, number][]; // [row, col]
  color: string;
}

export interface WordSearchLevelConfig {
  id: string;
  level: number;
  name: string;
  theme: string;
  gridSize: number;
  grid: string[][];
  words: WordSearchPlacement[];
}

interface WordSearchThemePool {
  title: string;
  subtitle: string;
  words: string[];
}

const WORD_SEARCH_THEMES: WordSearchThemePool[] = [
  {
    title: 'Botanical Sanctuary',
    subtitle: 'Find calming garden words hidden in the grid',
    words: ['LOTUS', 'MOSS', 'FERN', 'BLOOM', 'PETAL', 'SAGE', 'CEDAR', 'BAMBOO'],
  },
  {
    title: 'Ocean Horizon',
    subtitle: 'Trace gentle coastal words across the tide',
    words: ['OCEAN', 'WAVE', 'CORAL', 'SHELL', 'DRIFT', 'COVE', 'PEARL', 'TIDE'],
  },
  {
    title: 'Twilight Sky',
    subtitle: 'Spot peaceful evening sky words in any direction',
    words: ['STAR', 'MOON', 'CLOUD', 'DUSK', 'GLOW', 'AURORA', 'COMET', 'MIST'],
  },
  {
    title: 'Meadow Brook',
    subtitle: 'Uncover quiet woodland stream words at your own pace',
    words: ['BROOK', 'LEAF', 'REED', 'STONE', 'SHADE', 'BREEZE', 'PINE', 'DEW'],
  },
  {
    title: 'Tea & Hearth',
    subtitle: 'Relax with warm, cozy sanctuary words',
    words: ['WARMTH', 'TEA', 'HONEY', 'EMBER', 'QUILT', 'STEAM', 'LAMP', 'CALM'],
  },
];

const WORD_HIGHLIGHT_COLORS = [
  'rgba(45, 212, 191, 0.30)', // teal
  'rgba(56, 189, 248, 0.30)', // sky
  'rgba(167, 139, 250, 0.30)', // violet
  'rgba(52, 211, 153, 0.30)', // emerald
  'rgba(251, 191, 36, 0.28)', // amber
  'rgba(244, 114, 182, 0.28)', // rose
  'rgba(129, 140, 248, 0.30)', // indigo
  'rgba(94, 234, 212, 0.30)', // aqua
];

function createSeededRng(seed: number): () => number {
  let state = (seed ^ 0x6d2b79f5) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function generateWordSearchLevel(level: number): WordSearchLevelConfig {
  const safeLevel = Math.max(1, Math.floor(level));
  const gridSize = safeLevel <= 2 ? 7 : safeLevel <= 4 ? 8 : 9;
  const targetWordCount = safeLevel <= 2 ? 5 : safeLevel <= 4 ? 6 : 7;
  const themePool = WORD_SEARCH_THEMES[(safeLevel - 1) % WORD_SEARCH_THEMES.length];

  const rng = createSeededRng(safeLevel * 7919 + 104729);
  const grid: string[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => '')
  );

  // Levels 1-2: horizontal & vertical only; Levels 3+: add diagonals
  const directions: [number, number][] =
    safeLevel <= 2
      ? [
          [0, 1],
          [1, 0],
        ]
      : [
          [0, 1],
          [1, 0],
          [1, 1],
          [-1, 1],
        ];

  const candidates = [...themePool.words]
    .filter((w) => w.length <= gridSize)
    .sort((a, b) => b.length - a.length);

  const placements: WordSearchPlacement[] = [];

  for (const word of candidates) {
    if (placements.length >= targetWordCount) break;

    let placed = false;
    for (let attempt = 0; attempt < 120 && !placed; attempt++) {
      const [dr, dc] = directions[Math.floor(rng() * directions.length)];
      const startRow = Math.floor(rng() * gridSize);
      const startCol = Math.floor(rng() * gridSize);

      const endRow = startRow + dr * (word.length - 1);
      const endCol = startCol + dc * (word.length - 1);

      if (endRow < 0 || endRow >= gridSize || endCol < 0 || endCol >= gridSize) {
        continue;
      }

      let fits = true;
      const cells: [number, number][] = [];
      for (let i = 0; i < word.length; i++) {
        const r = startRow + dr * i;
        const c = startCol + dc * i;
        const existing = grid[r][c];
        if (existing !== '' && existing !== word[i]) {
          fits = false;
          break;
        }
        cells.push([r, c]);
      }

      if (fits) {
        for (let i = 0; i < word.length; i++) {
          const [r, c] = cells[i];
          grid[r][c] = word[i];
        }
        placements.push({
          word,
          cells,
          color: WORD_HIGHLIGHT_COLORS[placements.length % WORD_HIGHLIGHT_COLORS.length],
        });
        placed = true;
      }
    }
  }

  // Fill remaining empty cells with calm balanced letters
  const fillerAlphabet = 'AEIOURSTLNMCDPFGHBWY';
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = fillerAlphabet[Math.floor(rng() * fillerAlphabet.length)];
      }
    }
  }

  return {
    id: `wordsearch_${safeLevel}`,
    level: safeLevel,
    name: `Level ${safeLevel}: ${themePool.title} (${gridSize}×${gridSize})`,
    theme: themePool.subtitle,
    gridSize,
    grid,
    words: placements,
  };
}

/**
 * Computes the straight-line grid cells between two coordinates (horizontal, vertical, or 45-deg diagonal).
 * Returns [] if the two points do not form a valid straight line.
 */
export function getWordSearchLineCells(
  start: [number, number],
  end: [number, number]
): [number, number][] {
  const dr = end[0] - start[0];
  const dc = end[1] - start[1];

  const absR = Math.abs(dr);
  const absC = Math.abs(dc);

  if (dr !== 0 && dc !== 0 && absR !== absC) {
    return [];
  }

  const steps = Math.max(absR, absC);
  const stepR = dr === 0 ? 0 : dr / absR;
  const stepC = dc === 0 ? 0 : dc / absC;

  const cells: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    cells.push([start[0] + stepR * i, start[1] + stepC * i]);
  }
  return cells;
}

/**
 * Checks whether a selected line of cells matches any unfound word (forward or reverse).
 */
export function matchWordSearchSelection(
  cells: [number, number][],
  words: WordSearchPlacement[],
  foundWords: string[]
): WordSearchPlacement | null {
  if (cells.length < 2) return null;
  const forwardKey = cells.map(([r, c]) => `${r},${c}`).join('|');
  const reverseKey = [...cells].reverse().map(([r, c]) => `${r},${c}`).join('|');

  for (const placement of words) {
    if (foundWords.includes(placement.word)) continue;
    const targetKey = placement.cells.map(([r, c]) => `${r},${c}`).join('|');
    if (forwardKey === targetKey || reverseKey === targetKey) {
      return placement;
    }
  }
  return null;
}

// ============================================================================
// 1. JADE BLOCK SLIDE (Progressive 6x6 Sliding Block Escape)
// ============================================================================

export interface SlidingBlock {
  id: string;
  row: number;
  col: number;
  length: number;
  orientation: 'h' | 'v';
  isKey?: boolean;
  color: string;
}

export interface BlockSlideLevelConfig {
  id: string;
  level: number;
  name: string;
  theme: string;
  gridSize: number;
  exitRow: number;
  blocks: SlidingBlock[];
}

const BLOCK_SLIDE_TEMPLATES: {
  name: string;
  theme: string;
  blocks: Omit<SlidingBlock, 'color'>[];
}[] = [
  {
    name: 'Gentle Jade Gate',
    theme: 'Slide the vertical stones aside to guide the glowing Jade Block to the right exit',
    blocks: [
      { id: 'key', row: 2, col: 0, length: 2, orientation: 'h', isKey: true },
      { id: 'b1', row: 1, col: 2, length: 3, orientation: 'v' },
      { id: 'b2', row: 4, col: 1, length: 2, orientation: 'h' },
      { id: 'b3', row: 2, col: 4, length: 3, orientation: 'v' },
      { id: 'b4', row: 0, col: 3, length: 2, orientation: 'h' },
    ],
  },
  {
    name: 'Bamboo Courtyard',
    theme: 'Clear a calm path through the courtyard blocks',
    blocks: [
      { id: 'key', row: 2, col: 1, length: 2, orientation: 'h', isKey: true },
      { id: 'b1', row: 0, col: 0, length: 2, orientation: 'h' },
      { id: 'b2', row: 1, col: 0, length: 3, orientation: 'v' },
      { id: 'b3', row: 0, col: 3, length: 3, orientation: 'v' },
      { id: 'b4', row: 3, col: 2, length: 2, orientation: 'h' },
      { id: 'b5', row: 1, col: 5, length: 3, orientation: 'v' },
      { id: 'b6', row: 4, col: 4, length: 2, orientation: 'h' },
    ],
  },
  {
    name: 'Lantern Corridor',
    theme: 'Unhurried spatial flow • Slide blocking tiles to open row 3',
    blocks: [
      { id: 'key', row: 2, col: 0, length: 2, orientation: 'h', isKey: true },
      { id: 'b1', row: 0, col: 2, length: 3, orientation: 'v' },
      { id: 'b2', row: 3, col: 0, length: 3, orientation: 'h' },
      { id: 'b3', row: 1, col: 3, length: 2, orientation: 'h' },
      { id: 'b4', row: 2, col: 4, length: 2, orientation: 'v' },
      { id: 'b5', row: 4, col: 3, length: 2, orientation: 'h' },
      { id: 'b6', row: 0, col: 5, length: 3, orientation: 'v' },
    ],
  },
  {
    name: 'Stillwater Lock',
    theme: 'Coordinate horizontal and vertical stones with zero rush',
    blocks: [
      { id: 'key', row: 2, col: 1, length: 2, orientation: 'h', isKey: true },
      { id: 'b1', row: 0, col: 0, length: 3, orientation: 'v' },
      { id: 'b2', row: 0, col: 1, length: 2, orientation: 'h' },
      { id: 'b3', row: 0, col: 3, length: 3, orientation: 'v' },
      { id: 'b4', row: 3, col: 1, length: 2, orientation: 'h' },
      { id: 'b5', row: 4, col: 0, length: 2, orientation: 'v' },
      { id: 'b6', row: 4, col: 2, length: 2, orientation: 'h' },
      { id: 'b7', row: 1, col: 5, length: 3, orientation: 'v' },
    ],
  },
  {
    name: 'Koi Pond Terrace',
    theme: 'Multi-step sanctuary puzzle • Every move is reversible',
    blocks: [
      { id: 'key', row: 2, col: 0, length: 2, orientation: 'h', isKey: true },
      { id: 'b1', row: 0, col: 2, length: 3, orientation: 'v' },
      { id: 'b2', row: 0, col: 3, length: 2, orientation: 'h' },
      { id: 'b3', row: 1, col: 4, length: 2, orientation: 'v' },
      { id: 'b4', row: 3, col: 1, length: 3, orientation: 'h' },
      { id: 'b5', row: 4, col: 1, length: 2, orientation: 'v' },
      { id: 'b6', row: 4, col: 3, length: 2, orientation: 'h' },
      { id: 'b7', row: 2, col: 5, length: 3, orientation: 'v' },
    ],
  },
];

const SLIDE_STONE_PALETTE = [
  '#38BDF8', // sky
  '#818CF8', // indigo
  '#A78BFA', // violet
  '#60A5FA', // blue
  '#2DD4BF', // teal
  '#FBBF24', // amber
  '#F472B6', // rose
  '#34D399', // emerald
];

export function generateBlockSlideLevel(level: number): BlockSlideLevelConfig {
  const safeLevel = Math.max(1, Math.floor(level));
  const template = BLOCK_SLIDE_TEMPLATES[(safeLevel - 1) % BLOCK_SLIDE_TEMPLATES.length];

  const blocks: SlidingBlock[] = template.blocks.map((b, idx) => ({
    ...b,
    color: b.isKey ? '#14B8A6' : SLIDE_STONE_PALETTE[idx % SLIDE_STONE_PALETTE.length],
  }));

  return {
    id: `blockslide_${safeLevel}`,
    level: safeLevel,
    name: `Level ${safeLevel}: ${template.name}`,
    theme: template.theme,
    gridSize: 6,
    exitRow: 2,
    blocks,
  };
}

/**
 * Returns the valid [minOffset, maxOffset] steps a block can slide along its axis.
 */
export function getBlockSlideBounds(
  blocks: SlidingBlock[],
  blockId: string,
  gridSize: number = 6
): { minDelta: number; maxDelta: number } {
  const target = blocks.find((b) => b.id === blockId);
  if (!target) return { minDelta: 0, maxDelta: 0 };

  const occupied = new Set<string>();
  for (const b of blocks) {
    if (b.id === blockId) continue;
    for (let i = 0; i < b.length; i++) {
      const r = b.orientation === 'v' ? b.row + i : b.row;
      const c = b.orientation === 'h' ? b.col + i : b.col;
      occupied.add(`${r},${c}`);
    }
  }

  let minDelta = 0;
  let maxDelta = 0;

  if (target.orientation === 'h') {
    while (target.col + minDelta - 1 >= 0 && !occupied.has(`${target.row},${target.col + minDelta - 1}`)) {
      minDelta--;
    }
    while (
      target.col + target.length + maxDelta < gridSize &&
      !occupied.has(`${target.row},${target.col + target.length + maxDelta}`)
    ) {
      maxDelta++;
    }
  } else {
    while (target.row + minDelta - 1 >= 0 && !occupied.has(`${target.row + minDelta - 1},${target.col}`)) {
      minDelta--;
    }
    while (
      target.row + target.length + maxDelta < gridSize &&
      !occupied.has(`${target.row + target.length + maxDelta},${target.col}`)
    ) {
      maxDelta++;
    }
  }

  return { minDelta, maxDelta };
}

/**
 * Slides a block by `delta` steps along its orientation, clamped to valid unobstructed bounds.
 */
export function moveSlidingBlock(
  blocks: SlidingBlock[],
  blockId: string,
  delta: number,
  gridSize: number = 6
): SlidingBlock[] {
  if (delta === 0) return blocks;
  const { minDelta, maxDelta } = getBlockSlideBounds(blocks, blockId, gridSize);
  const clamped = Math.max(minDelta, Math.min(maxDelta, delta));
  if (clamped === 0) return blocks;

  return blocks.map((b) => {
    if (b.id !== blockId) return b;
    return b.orientation === 'h'
      ? { ...b, col: b.col + clamped }
      : { ...b, row: b.row + clamped };
  });
}

export function checkBlockSlideSolved(
  blocks: SlidingBlock[],
  gridSize: number = 6
): boolean {
  const key = blocks.find((b) => b.isKey);
  if (!key) return false;
  return key.col + key.length >= gridSize;
}

/**
 * Uses Breadth-First Search (BFS) to find the optimal next single-block slide toward solving the puzzle.
 */
export function applyBlockSlideHint(
  blocks: SlidingBlock[],
  gridSize: number = 6
): SlidingBlock[] {
  if (checkBlockSlideSolved(blocks, gridSize)) return blocks;

  const encode = (state: SlidingBlock[]) =>
    state.map((b) => (b.orientation === 'h' ? b.col : b.row)).join(',');

  const visited = new Set<string>([encode(blocks)]);
  const queue: { state: SlidingBlock[]; firstStep: SlidingBlock[] | null }[] = [
    { state: blocks, firstStep: null },
  ];

  let iterations = 0;
  while (queue.length > 0 && iterations < 4000) {
    iterations++;
    const current = queue.shift()!;

    for (const b of current.state) {
      const { minDelta, maxDelta } = getBlockSlideBounds(current.state, b.id, gridSize);
      for (let d = minDelta; d <= maxDelta; d++) {
        if (d === 0) continue;
        const nextState = moveSlidingBlock(current.state, b.id, d, gridSize);
        const key = encode(nextState);
        if (visited.has(key)) continue;
        visited.add(key);

        const firstStep = current.firstStep ?? nextState;
        if (checkBlockSlideSolved(nextState, gridSize)) {
          return firstStep;
        }
        queue.push({ state: nextState, firstStep });
      }
    }
  }

  return blocks;
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
