/**
 * Pure Logic Engine for Focus-Heavy Counterconditioning Games:
 * 1. Zen Sudoku (6x6 & 9x9 Progressive Boards with Candidate Notes & Conflict Detection)
 * 2. Cozy Nonogram / Picross Picture Logic Grids (5x5, 6x6, 8x8 Cozy Pixel Art)
 */

export interface SudokuLevelData {
  level: number;
  title: string;
  subtitle: string;
  size: 6 | 9;
  boxRows: 2 | 3;
  boxCols: 3;
  initialGrid: number[][]; // 0 = empty, 1..size = locked clue
  solutionGrid: number[][];
}

const BASE_6X6_SOLUTION: number[][] = [
  [1, 2, 3, 4, 5, 6],
  [4, 5, 6, 1, 2, 3],
  [2, 3, 1, 5, 6, 4],
  [5, 6, 4, 2, 3, 1],
  [3, 1, 2, 6, 4, 5],
  [6, 4, 5, 3, 1, 2],
];

const BASE_9X9_SOLUTION: number[][] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

function seededHash(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/**
 * Generates a valid, deterministic 6x6 or 9x9 Sudoku puzzle for a given level
 */
export function generateSudokuLevel(level: number): SudokuLevelData {
  const safeLevel = Math.max(1, Math.floor(level));
  const is6x6 = safeLevel <= 2;
  const size: 6 | 9 = is6x6 ? 6 : 9;
  const boxRows: 2 | 3 = is6x6 ? 2 : 3;
  const boxCols = 3;

  const base = is6x6 ? BASE_6X6_SOLUTION : BASE_9X9_SOLUTION;

  // Create a deterministic digit permutation [1..size]
  const digits = Array.from({ length: size }, (_, i) => i + 1);
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(seededHash(safeLevel * 31 + i * 17) * (i + 1));
    const tmp = digits[i];
    digits[i] = digits[j];
    digits[j] = tmp;
  }

  // Permute rows within each horizontal band to keep validity
  const numBands = size / boxRows;
  const rowOrder: number[] = [];
  for (let b = 0; b < numBands; b++) {
    const bandRows = Array.from({ length: boxRows }, (_, r) => b * boxRows + r);
    if (seededHash(safeLevel * 73 + b * 19) > 0.5) {
      bandRows.reverse();
    }
    rowOrder.push(...bandRows);
  }

  const solutionGrid: number[][] = rowOrder.map((rIdx) =>
    base[rIdx].map((val) => digits[val - 1])
  );

  // Determine how many cells to leave blank based on progressive level
  const totalCells = size * size;
  let blanksCount: number;
  let title: string;
  let subtitle: string;

  if (safeLevel === 1) {
    blanksCount = 12; // 24 clues out of 36
    title = 'Level 1: 6×6 Gentle Awakening';
    subtitle = 'Fill each row, column, and 2×3 box with numbers 1–6';
  } else if (safeLevel === 2) {
    blanksCount = 18; // 18 clues out of 36
    title = 'Level 2: 6×6 Quiet Garden';
    subtitle = 'Deeper 6×6 logic—use Pencil Notes to track candidates';
  } else if (safeLevel <= 4) {
    blanksCount = 34 + (safeLevel - 3) * 4; // 47 or 43 clues out of 81
    title = `Level ${safeLevel}: 9×9 Mindful Breeze`;
    subtitle = 'Classic 9×9 Sudoku • Every row, column, and 3×3 box holds 1–9';
  } else if (safeLevel <= 6) {
    blanksCount = 44 + (safeLevel - 5) * 3;
    title = `Level ${safeLevel}: 9×9 Deep Focus Sanctuary`;
    subtitle = 'Absorbing mid-level 9×9 flow state for counterconditioning';
  } else {
    blanksCount = Math.min(52, 49 + (safeLevel - 7));
    title = `Level ${safeLevel}: 9×9 Celestial Master`;
    subtitle = 'Master-tier 9×9 deduction—use candidate notes and box scanning';
  }

  const initialGrid = solutionGrid.map((row) => [...row]);

  // Deterministically remove对称 cells while ensuring every row/col keeps at least 2 clues
  const positions: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      positions.push([r, c]);
    }
  }
  positions.sort(
    (a, b) =>
      seededHash(safeLevel * 101 + a[0] * 13 + a[1] * 29) -
      seededHash(safeLevel * 101 + b[0] * 13 + b[1] * 29)
  );

  let removed = 0;
  for (const [r, c] of positions) {
    if (removed >= blanksCount) break;
    if (initialGrid[r][c] === 0) continue;

    const rowRemaining = initialGrid[r].filter((v) => v !== 0).length;
    const colRemaining = initialGrid.filter((row) => row[c] !== 0).length;
    const minCluesPerLine = is6x6 ? 2 : 3;

    if (rowRemaining > minCluesPerLine && colRemaining > minCluesPerLine) {
      initialGrid[r][c] = 0;
      removed++;
    }
  }

  return {
    level: safeLevel,
    title,
    subtitle,
    size,
    boxRows,
    boxCols,
    initialGrid,
    solutionGrid,
  };
}

/**
  * Returns a boolean matrix indicating which cells have a row, column, or box conflict
  */
export function getSudokuConflicts(
  grid: number[][],
  size: number,
  boxRows: number,
  boxCols: number
): boolean[][] {
  const conflicts: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  if (!grid || grid.length < size) return conflicts;

  for (let r = 0; r < size; r++) {
    const row = grid[r];
    if (!row || row.length < size) continue;
    for (let c = 0; c < size; c++) {
      const val = row[c];
      if (!val) continue;

      // Check row
      for (let cc = 0; cc < size; cc++) {
        if (cc !== c && row[cc] === val) {
          conflicts[r][c] = true;
          conflicts[r][cc] = true;
        }
      }

      // Check col
      for (let rr = 0; rr < size; rr++) {
        if (rr !== r && grid[rr]?.[c] === val) {
          conflicts[r][c] = true;
          conflicts[rr][c] = true;
        }
      }

      // Check box
      const br = Math.floor(r / boxRows) * boxRows;
      const bc = Math.floor(c / boxCols) * boxCols;
      for (let rr = br; rr < br + boxRows; rr++) {
        for (let cc = bc; cc < bc + boxCols; cc++) {
          if ((rr !== r || cc !== c) && grid[rr]?.[cc] === val) {
            conflicts[r][c] = true;
            if (conflicts[rr]) conflicts[rr][cc] = true;
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Computes valid candidate numbers for a given empty cell
 */
export function getValidSudokuCandidates(
  grid: number[][],
  row: number,
  col: number,
  size: number,
  boxRows: number,
  boxCols: number
): number[] {
  if (!grid || !grid[row] || grid[row][col] !== 0) return [];
  const used = new Set<number>();

  for (let i = 0; i < size; i++) {
    const rv = grid[row]?.[i];
    const cv = grid[i]?.[col];
    if (rv) used.add(rv);
    if (cv) used.add(cv);
  }

  const br = Math.floor(row / boxRows) * boxRows;
  const bc = Math.floor(col / boxCols) * boxCols;
  for (let r = br; r < br + boxRows; r++) {
    for (let c = bc; c < bc + boxCols; c++) {
      const bv = grid[r]?.[c];
      if (bv) used.add(bv);
    }
  }

  const candidates: number[] = [];
  for (let n = 1; n <= size; n++) {
    if (!used.has(n)) candidates.push(n);
  }
  return candidates;
}

export function isSudokuSolved(
  grid: number[][],
  size: number,
  boxRows: number,
  boxCols: number
): boolean {
  if (!grid || grid.length < size) return false;
  for (let r = 0; r < size; r++) {
    if (!grid[r] || grid[r].length < size) return false;
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) return false;
    }
  }
  const conflicts = getSudokuConflicts(grid, size, boxRows, boxCols);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (conflicts[r][c]) return false;
    }
  }
  return true;
}

// ============================================================================
// 2. Cozy Nonogram (Picross Picture Logic Grid) Engine
// ============================================================================

export interface NonogramLevelData {
  level: number;
  title: string;
  artName: string;
  artEmoji: string;
  size: number;
  solution: number[][]; // 1 = filled, 0 = empty
  rowClues: number[][];
  colClues: number[][];
  accentColor: string;
}

interface NonogramTemplate {
  artName: string;
  artEmoji: string;
  accentColor: string;
  bitmap: number[][];
}

const NONOGRAM_TEMPLATES: NonogramTemplate[] = [
  {
    artName: 'Steaming Cozy Teacup',
    artEmoji: '🍵',
    accentColor: '#2DD4BF',
    bitmap: [
      [0, 1, 0, 1, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0],
      [0, 1, 1, 0, 0],
    ],
  },
  {
    artName: 'Crescent Night Moon',
    artEmoji: '🌙',
    accentColor: '#38BDF8',
    bitmap: [
      [0, 1, 1, 1, 0],
      [1, 1, 0, 0, 0],
      [1, 1, 0, 0, 1],
      [1, 1, 0, 0, 0],
      [0, 1, 1, 1, 0],
    ],
  },
  {
    artName: 'Origami Harbor Sailboat',
    artEmoji: '⛵',
    accentColor: '#60A5FA',
    bitmap: [
      [0, 0, 1, 0, 0, 0],
      [0, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 1, 0],
      [0, 0, 1, 0, 0, 0],
      [1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 0],
    ],
  },
  {
    artName: 'Sleeping Sanctuary Cat',
    artEmoji: '🐱',
    accentColor: '#FBBF24',
    bitmap: [
      [1, 0, 0, 1, 0, 0],
      [1, 1, 1, 1, 0, 0],
      [1, 0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 0],
    ],
  },
  {
    artName: 'Lotus Blossom Sanctuary',
    artEmoji: '🪷',
    accentColor: '#F472B6',
    bitmap: [
      [0, 0, 1, 1, 0, 0],
      [1, 0, 1, 1, 0, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 0, 0],
    ],
  },
  {
    artName: 'Starlight Guardian Owl',
    artEmoji: '🦉',
    accentColor: '#A78BFA',
    bitmap: [
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1, 1, 0, 1],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
    ],
  },
  {
    artName: 'Kyoto Lantern Pavilion',
    artEmoji: '🏮',
    accentColor: '#34D399',
    bitmap: [
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
    ],
  },
];

export function computeLineClues(line: number[]): number[] {
  const clues: number[] = [];
  let run = 0;
  for (const cell of line) {
    if (cell === 1) {
      run++;
    } else if (run > 0) {
      clues.push(run);
      run = 0;
    }
  }
  if (run > 0) clues.push(run);
  return clues.length > 0 ? clues : [0];
}

export function generateNonogramLevel(level: number): NonogramLevelData {
  const safeLevel = Math.max(1, Math.floor(level));
  const template =
    NONOGRAM_TEMPLATES[(safeLevel - 1) % NONOGRAM_TEMPLATES.length];
  const size = template.bitmap.length;

  const rowClues = template.bitmap.map((row) => computeLineClues(row));
  const colClues: number[][] = [];
  for (let c = 0; c < size; c++) {
    const col = template.bitmap.map((row) => row[c]);
    colClues.push(computeLineClues(col));
  }

  return {
    level: safeLevel,
    title: `Level ${safeLevel}: ${template.artName} (${size}×${size})`,
    artName: template.artName,
    artEmoji: template.artEmoji,
    size,
    solution: template.bitmap.map((r) => [...r]),
    rowClues,
    colClues,
    accentColor: template.accentColor,
  };
}

export function isNonogramSolved(
  userGrid: number[][], // 1 = filled, 0 = empty, -1 = marked X
  solution: number[][]
): boolean {
  const size = solution.length;
  if (!userGrid || userGrid.length < size) return false;
  for (let r = 0; r < size; r++) {
    if (!userGrid[r] || userGrid[r].length < size) return false;
    for (let c = 0; c < size; c++) {
      const userFilled = userGrid[r][c] === 1 ? 1 : 0;
      if (userFilled !== solution[r][c]) return false;
    }
  }
  return true;
}
