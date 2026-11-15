import React, { useState, useEffect, useCallback } from 'react';
import { audioEngine } from '../../audio/AudioEngine.ts';
import {
  generateSudokuLevel,
  getSudokuConflicts,
  getValidSudokuCandidates,
  isSudokuSolved,
} from '../../utils/focusGames.ts';
import { getMasteryTier } from '../../utils/puzzles.ts';
import {
  ChevronLeft,
  ChevronRight,
  Wand2,
  Star,
  Pencil,
  Eraser,
  Sparkles,
} from 'lucide-react';

interface ZenSudokuGameProps {
  level: number;
  onLevelComplete: (starsEarned: number) => void;
  onLevelChange: (newLevel: number) => void;
  resetSignal: number;
  onHeaderUpdate: (title: string, subtitle: string) => void;
}

export const ZenSudokuGame: React.FC<ZenSudokuGameProps> = ({
  level,
  onLevelComplete,
  onLevelChange,
  resetSignal,
  onHeaderUpdate,
}) => {
  const levelData = generateSudokuLevel(level);
  const tier = getMasteryTier(level);
  const nextTier = getMasteryTier(level + 1);

  const [grid, setGrid] = useState<number[][]>(() =>
    levelData.initialGrid.map((r) => [...r])
  );
  // Notes map: key "r-c" -> array of candidate numbers
  const [notes, setNotes] = useState<Record<string, number[]>>({});
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [isNotesMode, setIsNotesMode] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Sync board when level or resetSignal changes
  useEffect(() => {
    const fresh = generateSudokuLevel(level);
    setGrid(fresh.initialGrid.map((r) => [...r]));
    setNotes({});
    setIsCompleted(false);
    // Select first empty cell by default
    let firstEmpty: [number, number] | null = null;
    for (let r = 0; r < fresh.size && !firstEmpty; r++) {
      for (let c = 0; c < fresh.size; c++) {
        if (fresh.initialGrid[r][c] === 0) {
          firstEmpty = [r, c];
          break;
        }
      }
    }
    setSelectedCell(firstEmpty);
    onHeaderUpdate(fresh.title, fresh.subtitle);
  }, [level, resetSignal, onHeaderUpdate]);

  const activeGrid =
    grid.length === levelData.size && grid[0]?.length === levelData.size
      ? grid
      : levelData.initialGrid;

  const conflicts = getSudokuConflicts(
    activeGrid,
    levelData.size,
    levelData.boxRows,
    levelData.boxCols
  );

  const checkCompletion = useCallback(
    (nextGrid: number[][]) => {
      if (
        !isCompleted &&
        isSudokuSolved(nextGrid, levelData.size, levelData.boxRows, levelData.boxCols)
      ) {
        setIsCompleted(true);
        audioEngine.playCompletionChord();
        onLevelComplete(tier.starsReward);
      }
    },
    [isCompleted, levelData.size, levelData.boxRows, levelData.boxCols, onLevelComplete, tier.starsReward]
  );

  const handlePlaceNumber = useCallback(
    (num: number) => {
      if (isCompleted || !selectedCell) return;
      const [r, c] = selectedCell;
      if (levelData.initialGrid[r][c] !== 0) return; // Locked clue

      const key = `${r}-${c}`;
      if (isNotesMode) {
        if (grid[r][c] !== 0) return;
        setNotes((prev) => {
          const existing = prev[key] || [];
          const updated = existing.includes(num)
            ? existing.filter((n) => n !== num)
            : [...existing, num].sort((a, b) => a - b);
          return { ...prev, [key]: updated };
        });
        audioEngine.playHarmonicChime(num, 2);
        return;
      }

      const nextGrid = grid.map((row, rIdx) =>
        row.map((val, cIdx) => (rIdx === r && cIdx === c ? (val === num ? 0 : num) : val))
      );
      setGrid(nextGrid);

      // Clear notes on placed cell
      if (nextGrid[r][c] !== 0) {
        setNotes((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }

      audioEngine.playHarmonicChime(num);
      checkCompletion(nextGrid);
    },
    [isCompleted, selectedCell, levelData.initialGrid, isNotesMode, grid, checkCompletion]
  );

  const handleEraseCell = useCallback(() => {
    if (isCompleted || !selectedCell) return;
    const [r, c] = selectedCell;
    if (levelData.initialGrid[r][c] !== 0) return;

    const nextGrid = grid.map((row, rIdx) =>
      row.map((val, cIdx) => (rIdx === r && cIdx === c ? 0 : val))
    );
    setGrid(nextGrid);
    setNotes((prev) => {
      const copy = { ...prev };
      delete copy[`${r}-${c}`];
      return copy;
    });
    audioEngine.playHarmonicChime(0);
  }, [isCompleted, selectedCell, levelData.initialGrid, grid]);

  // Keyboard support for numbers 1..9, Backspace/Delete, Arrow keys, and 'n' for Notes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;
      if (e.key >= '1' && e.key <= String(levelData.size)) {
        e.preventDefault();
        handlePlaceNumber(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        handleEraseCell();
      } else if (e.key.toLowerCase() === 'n') {
        setIsNotesMode((prev) => !prev);
      } else if (selectedCell && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const [r, c] = selectedCell;
        const s = levelData.size;
        if (e.key === 'ArrowUp') setSelectedCell([(r - 1 + s) % s, c]);
        if (e.key === 'ArrowDown') setSelectedCell([(r + 1) % s, c]);
        if (e.key === 'ArrowLeft') setSelectedCell([r, (c - 1 + s) % s]);
        if (e.key === 'ArrowRight') setSelectedCell([r, (c + 1) % s]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompleted, levelData.size, handlePlaceNumber, handleEraseCell, selectedCell]);

  // Smart Auto-Notes: Fill valid pencil candidates for all empty cells
  const handleAutoNotes = () => {
    if (isCompleted) return;
    const newNotes: Record<string, number[]> = {};
    for (let r = 0; r < levelData.size; r++) {
      for (let c = 0; c < levelData.size; c++) {
        if (grid[r][c] === 0) {
          newNotes[`${r}-${c}`] = getValidSudokuCandidates(
            grid,
            r,
            c,
            levelData.size,
            levelData.boxRows,
            levelData.boxCols
          );
        }
      }
    }
    setNotes(newNotes);
    audioEngine.playHarmonicChime(4);
  };

  // Smart Hint: Fill selected cell (or first empty/incorrect cell) with true solution
  const handleHint = () => {
    if (isCompleted) return;
    let target: [number, number] | null = null;
    if (
      selectedCell &&
      grid[selectedCell[0]][selectedCell[1]] !==
        levelData.solutionGrid[selectedCell[0]][selectedCell[1]]
    ) {
      target = selectedCell;
    } else {
      for (let r = 0; r < levelData.size && !target; r++) {
        for (let c = 0; c < levelData.size; c++) {
          if (grid[r][c] !== levelData.solutionGrid[r][c]) {
            target = [r, c];
            break;
          }
        }
      }
    }

    if (!target) return;
    const [tr, tc] = target;
    const correctVal = levelData.solutionGrid[tr][tc];
    const nextGrid = grid.map((row, rIdx) =>
      row.map((v, cIdx) => (rIdx === tr && cIdx === tc ? correctVal : v))
    );
    setGrid(nextGrid);
    setSelectedCell([tr, tc]);
    audioEngine.playHarmonicChime(6);
    checkCompletion(nextGrid);
  };

  // Count how many times each digit is placed so completed digits dim on the keypad
  const digitCounts: Record<number, number> = {};
  let filledCells = 0;
  const totalCells = levelData.size * levelData.size;
  for (let r = 0; r < levelData.size; r++) {
    for (let c = 0; c < levelData.size; c++) {
      const v = activeGrid[r]?.[c] || 0;
      if (v > 0) {
        digitCounts[v] = (digitCounts[v] || 0) + 1;
        filledCells++;
      }
    }
  }

  const selectedValue =
    selectedCell &&
    selectedCell[0] < levelData.size &&
    selectedCell[1] < levelData.size &&
    (activeGrid[selectedCell[0]]?.[selectedCell[1]] || 0) > 0
      ? activeGrid[selectedCell[0]][selectedCell[1]]
      : null;

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-3 sm:p-5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 select-none">
      {/* Top Level & Tools Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/85 border border-slate-800 px-3 py-2 rounded-xl mb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => level > 1 && onLevelChange(level - 1)}
            disabled={level <= 1}
            aria-label="Previous Sudoku Level"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-teal-300">
            {tier.tierBadge} • Lvl {level} ({levelData.size}×{levelData.size})
          </span>
          <button
            onClick={() => onLevelChange(level + 1)}
            aria-label="Next Sudoku Level"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-sky-300 bg-sky-500/10 px-2 py-1 rounded-lg border border-sky-500/20">
            {filledCells}/{totalCells} Cells
          </span>
          <button
            onClick={handleAutoNotes}
            disabled={isCompleted}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 cursor-pointer disabled:opacity-40"
            title="Auto-calculate valid candidate pencil marks for all empty cells"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>Auto-Notes</span>
          </button>
          <button
            onClick={handleHint}
            disabled={isCompleted}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 cursor-pointer disabled:opacity-40"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-300" />
            <span>Hint</span>
          </button>
        </div>
      </div>

      {/* Main Sudoku Grid + Number Pad Layout */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 my-auto">
        {/* Sudoku Board */}
        <div
          role="grid"
          aria-label={`Zen Sudoku ${levelData.size} by ${levelData.size} grid`}
          style={{
            gridTemplateColumns: `repeat(${levelData.size}, minmax(0, 1fr))`,
          }}
          className={`grid bg-slate-800 border-2 border-teal-500/50 rounded-2xl overflow-hidden shadow-2xl ${
            levelData.size === 6
              ? 'w-full max-w-[320px] sm:max-w-[350px] aspect-square'
              : 'w-full max-w-[340px] sm:max-w-[390px] aspect-square'
          }`}
        >
          {activeGrid.map((row, r) =>
            row.map((val, c) => {
              const isLocked = (levelData.initialGrid[r]?.[c] || 0) !== 0;
              const isSelected =
                selectedCell !== null && selectedCell[0] === r && selectedCell[1] === c;
              const isSameRowOrColOrBox =
                selectedCell !== null &&
                (selectedCell[0] === r ||
                  selectedCell[1] === c ||
                  (Math.floor(selectedCell[0] / levelData.boxRows) ===
                    Math.floor(r / levelData.boxRows) &&
                    Math.floor(selectedCell[1] / levelData.boxCols) ===
                      Math.floor(c / levelData.boxCols)));
              const isSameNumber = selectedValue !== null && val === selectedValue;
              const hasConflict = Boolean(conflicts[r]?.[c]);
              const cellNotes = notes[`${r}-${c}`] || [];

              // Thick sub-box borders
              const rightBoxBorder =
                (c + 1) % levelData.boxCols === 0 && c < levelData.size - 1
                  ? 'border-r-2 border-r-teal-500/50'
                  : 'border-r border-r-slate-800';
              const bottomBoxBorder =
                (r + 1) % levelData.boxRows === 0 && r < levelData.size - 1
                  ? 'border-b-2 border-b-teal-500/50'
                  : 'border-b border-b-slate-800';

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => setSelectedCell([r, c])}
                  aria-label={`Row ${r + 1} Column ${c + 1} ${
                    val ? `Value ${val}` : 'Empty'
                  }`}
                  className={`relative flex items-center justify-center font-bold transition-colors focus:outline-none cursor-pointer ${rightBoxBorder} ${bottomBoxBorder} ${
                    isSelected
                      ? 'bg-teal-500/35 text-white ring-2 ring-inset ring-teal-300 z-10'
                      : hasConflict
                      ? 'bg-rose-950/80 text-rose-300'
                      : isSameNumber
                      ? 'bg-indigo-500/30 text-indigo-200'
                      : isSameRowOrColOrBox
                      ? 'bg-slate-900/90'
                      : 'bg-slate-950/95 hover:bg-slate-900'
                  } ${
                    levelData.size === 6 ? 'text-base sm:text-xl' : 'text-sm sm:text-lg'
                  }`}
                >
                  {val !== 0 ? (
                    <span
                      className={
                        hasConflict
                          ? 'text-rose-400 font-extrabold'
                          : isLocked
                          ? 'text-slate-200 font-bold'
                          : 'text-teal-300 font-extrabold'
                      }
                    >
                      {val}
                    </span>
                  ) : cellNotes.length > 0 ? (
                    <div className="grid grid-cols-3 w-full h-full p-0.5 place-items-center text-[8px] sm:text-[9px] text-sky-300/90 font-mono leading-none">
                      {Array.from({ length: levelData.size }, (_, idx) => idx + 1).map(
                        (cand) => (
                          <span key={cand}>
                            {cellNotes.includes(cand) ? cand : ''}
                          </span>
                        )
                      )}
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {/* Tactile Number Pad & Pencil Notes Controls */}
        <div className="w-full max-w-[340px] md:w-56 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNotesMode(!isNotesMode)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isNotesMode
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Notes: {isNotesMode ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={handleEraseCell}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition cursor-pointer"
              title="Erase selected cell"
            >
              <Eraser className="w-3.5 h-3.5 text-rose-400" />
              <span>Erase</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: levelData.size }, (_, idx) => idx + 1).map((num) => {
              const count = digitCounts[num] || 0;
              const isAllPlaced = count >= levelData.size;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePlaceNumber(num)}
                  className={`flex flex-col items-center justify-center py-2.5 sm:py-3 rounded-xl border font-bold transition active:scale-95 cursor-pointer ${
                    selectedValue === num
                      ? 'bg-teal-600 border-teal-400 text-white shadow-md'
                      : isAllPlaced
                      ? 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  <span className="text-base sm:text-lg leading-none">{num}</span>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                    {count}/{levelData.size}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 text-center md:text-left leading-snug">
            Tip: Tap any cell and use the keypad or keyboard (<kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">1–{levelData.size}</kbd>, <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">N</kbd> for Notes).
          </p>
        </div>
      </div>

      {/* Completion Modal Overlay */}
      {isCompleted && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="p-6 rounded-3xl bg-slate-900 border border-emerald-400/40 text-center shadow-2xl max-w-sm w-full">
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-2">
              {Array.from({ length: tier.starsReward }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
              +{tier.starsReward} Harmony Stars
            </div>
            <h3 className="text-xl font-bold text-white">{levelData.title} Complete!</h3>
            <p className="text-xs text-slate-300 mt-1">
              Ready for{' '}
              <span className="text-teal-300 font-semibold">
                Level {level + 1} ({nextTier.tierName})
              </span>
              ?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => onLevelChange(level)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                Replay
              </button>
              <button
                onClick={() => onLevelChange(level + 1)}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-xs font-bold text-slate-950 cursor-pointer"
              >
                <span>Next Level</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
