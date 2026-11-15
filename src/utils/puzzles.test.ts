import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMasteryTier,
  generateWordSearchLevel,
  getWordSearchLineCells,
  matchWordSearchSelection,
  generateBlockSlideLevel,
  moveSlidingBlock,
  checkBlockSlideSolved,
  applyBlockSlideHint,
  generateChromaLevel,
  swapChromaTiles,
  checkChromaSolved,
  applyChromaHint,
  generateZenLoopLevel,
  getActivePorts,
  rotateZenTile,
  checkZenLoopsSolved,
  applyZenLoopHint,
  generateMandalaLevel,
  cycleMandalaPetal,
  checkMandalaSolved,
  applyMandalaHint,
} from './puzzles.ts';

describe('Mastery Tiers & Progressive Complexity', () => {
  it('scales Mastery Tiers from Tier 1 (Gentle Sprout) up to Tier 4 (Celestial Master)', () => {
    const t1 = getMasteryTier(1);
    assert.equal(t1.tierNumber, 1);
    assert.equal(t1.starsReward, 1);

    const t2 = getMasteryTier(3);
    assert.equal(t2.tierNumber, 2);
    assert.equal(t2.starsReward, 2);

    const t3 = getMasteryTier(5);
    assert.equal(t3.tierNumber, 3);
    assert.equal(t3.starsReward, 3);

    const t4 = getMasteryTier(7);
    assert.equal(t4.tierNumber, 4);
    assert.equal(t4.starsReward, 4);
  });
});

describe('Serene Word Search Progressive Logic', () => {
  it('scales grid size from 7x7 (Level 1) to 8x8 (Level 3) and 9x9 (Level 5+)', () => {
    const l1 = generateWordSearchLevel(1);
    const l3 = generateWordSearchLevel(3);
    const l5 = generateWordSearchLevel(5);

    assert.equal(l1.gridSize, 7);
    assert.equal(l1.words.length, 5);
    assert.equal(l3.gridSize, 8);
    assert.equal(l3.words.length, 6);
    assert.equal(l5.gridSize, 9);
    assert.equal(l5.words.length, 7);
  });

  it('places every word accurately on the grid and matches forward/reverse selections', () => {
    const lvl = generateWordSearchLevel(2);
    for (const placement of lvl.words) {
      const letters = placement.cells.map(([r, c]) => lvl.grid[r][c]).join('');
      assert.equal(letters, placement.word);

      const start = placement.cells[0];
      const end = placement.cells[placement.cells.length - 1];
      const line = getWordSearchLineCells(start, end);
      assert.deepEqual(line, placement.cells);

      // Forward and reverse selections both match
      assert.equal(matchWordSearchSelection(line, lvl.words, [])?.word, placement.word);
      assert.equal(
        matchWordSearchSelection([...line].reverse(), lvl.words, [])?.word,
        placement.word
      );
      // Already-found words are not matched again
      assert.equal(matchWordSearchSelection(line, lvl.words, [placement.word]), null);
    }
  });
});

describe('Jade Block Slide Progressive Logic', () => {
  it('generates valid non-overlapping 6x6 levels and solves all 5 templates via BFS hints', () => {
    for (let lvlNum = 1; lvlNum <= 5; lvlNum++) {
      const config = generateBlockSlideLevel(lvlNum);
      assert.equal(config.gridSize, 6);
      assert.equal(checkBlockSlideSolved(config.blocks, config.gridSize), false);

      // Verify no overlapping cells
      const occupied = new Set<string>();
      for (const b of config.blocks) {
        for (let i = 0; i < b.length; i++) {
          const r = b.orientation === 'v' ? b.row + i : b.row;
          const c = b.orientation === 'h' ? b.col + i : b.col;
          const key = `${r},${c}`;
          assert.equal(occupied.has(key), false, `Overlap at ${key} in level ${lvlNum}`);
          occupied.add(key);
        }
      }

      // Solve step-by-step using applyBlockSlideHint
      let blocks = config.blocks.map((b) => ({ ...b }));
      for (let step = 0; step < 30 && !checkBlockSlideSolved(blocks, config.gridSize); step++) {
        blocks = applyBlockSlideHint(blocks, config.gridSize);
      }
      assert.equal(
        checkBlockSlideSolved(blocks, config.gridSize),
        true,
        `Level ${lvlNum} should be solvable via BFS hints`
      );
    }
  });

  it('clamps block movement against walls and other blocks', () => {
    const config = generateBlockSlideLevel(1);
    const moved = moveSlidingBlock(config.blocks, 'key', 5, config.gridSize);
    const keyBlock = moved.find((b) => b.id === 'key')!;
    // Blocked by b1 at col 2, so key (length 2) cannot move past col 0
    assert.equal(keyBlock.col, 0);
  });
});

describe('Chroma Flow Progressive Logic', () => {
  it('scales from 3x3 (9 tiles) in Levels 1-3 to 4x4 (16 tiles) in Levels 4+ and reduces locked anchors', () => {
    const l1 = generateChromaLevel(1);
    const l2 = generateChromaLevel(2);
    const l3 = generateChromaLevel(3);
    const l4 = generateChromaLevel(4);
    const l5 = generateChromaLevel(5);

    assert.equal(l1.gridSize, 3);
    assert.equal(l1.tiles.length, 9);
    assert.equal(l1.tiles.filter((t) => t.locked).length, 4);

    assert.equal(l2.tiles.filter((t) => t.locked).length, 3);
    assert.equal(l3.tiles.filter((t) => t.locked).length, 2);

    assert.equal(l4.gridSize, 4);
    assert.equal(l4.tiles.length, 16);
    assert.equal(l4.tiles.filter((t) => t.locked).length, 4);

    assert.equal(l5.gridSize, 4);
    assert.equal(l5.tiles.filter((t) => t.locked).length, 2);
  });

  it('starts unsolved and reaches solved state via applyChromaHint or swapChromaTiles', () => {
    let tiles = generateChromaLevel(4).tiles.map((t) => ({ ...t }));
    assert.equal(checkChromaSolved(tiles), false);

    // Apply hints until solved
    for (let step = 0; step < 20; step++) {
      if (checkChromaSolved(tiles)) break;
      tiles = applyChromaHint(tiles);
    }
    assert.equal(checkChromaSolved(tiles), true);

    // Swapping two unlocked tiles un-solves it
    tiles = swapChromaTiles(tiles, 1, 2);
    assert.equal(checkChromaSolved(tiles), false);
  });
});

describe('Zen Ripple Loops Progressive Logic', () => {
  it('scales grid dimensions from 3x3 (Levels 1-2) to 3x4 (Level 3) and 4x4 (Levels 4+)', () => {
    const l1 = generateZenLoopLevel(1);
    const l3 = generateZenLoopLevel(3);
    const l4 = generateZenLoopLevel(4);

    assert.equal(l1.rows, 3);
    assert.equal(l1.cols, 3);
    assert.equal(l3.rows, 3);
    assert.equal(l3.cols, 4);
    assert.equal(l4.rows, 4);
    assert.equal(l4.cols, 4);
  });

  it('starts scrambled and reaches a verified closed-loop solution via applyZenLoopHint', () => {
    for (const lvl of [1, 2, 3, 4, 5]) {
      let grid = generateZenLoopLevel(lvl).grid;
      assert.equal(checkZenLoopsSolved(grid), false);

      for (let i = 0; i < 20; i++) {
        if (checkZenLoopsSolved(grid)) break;
        grid = applyZenLoopHint(grid);
      }
      assert.equal(checkZenLoopsSolved(grid), true);
    }
  });

  it('rotates port tuples clockwise', () => {
    assert.deepEqual(getActivePorts([true, true, false, false], 1), [false, true, true, false]);
    const g = generateZenLoopLevel(1).grid;
    const rotated = rotateZenTile(g, 0, 0);
    assert.equal(rotated[0][0].rotation, (g[0][0].rotation + 1) % 4);
  });
});

describe('Mandala Symmetry Progressive Logic', () => {
  it('scales from 2 rings x 8 petals (Level 1) to 3 rings x 8 petals (Level 3), 3x10 (Level 4), and 3x12 (Level 5+)', () => {
    const m1 = generateMandalaLevel(1);
    const m3 = generateMandalaLevel(3);
    const m4 = generateMandalaLevel(4);
    const m5 = generateMandalaLevel(5);

    assert.equal(m1.rings, 2);
    assert.equal(m1.sectors, 8);
    assert.equal(m3.rings, 3);
    assert.equal(m3.sectors, 8);
    assert.equal(m4.rings, 3);
    assert.equal(m4.sectors, 10);
    assert.equal(m5.rings, 3);
    assert.equal(m5.sectors, 12);
    assert.equal(m5.palette.length, 5);
  });

  it('mirrors petals across opposite sectors and solves cleanly via applyMandalaHint', () => {
    const pattern = generateMandalaLevel(4);
    let grid = pattern.initialGrid.map((r) => [...r]);
    assert.equal(checkMandalaSolved(grid, pattern.targetGrid), false);

    grid = cycleMandalaPetal(grid, 0, 0, pattern.palette.length, true);
    assert.equal(grid[0][0], grid[0][5]); // 10 sectors -> mirror of 0 is 5

    for (let step = 0; step < 30; step++) {
      if (checkMandalaSolved(grid, pattern.targetGrid)) break;
      grid = applyMandalaHint(grid, pattern.targetGrid);
    }
    assert.equal(checkMandalaSolved(grid, pattern.targetGrid), true);
  });
});
