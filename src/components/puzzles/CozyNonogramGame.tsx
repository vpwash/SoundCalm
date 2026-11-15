import React, { useState, useEffect, useCallback } from 'react';
import { audioEngine } from '../../audio/AudioEngine.ts';
import {
  generateNonogramLevel,
  computeLineClues,
  isNonogramSolved,
} from '../../utils/focusGames.ts';
import { getMasteryTier } from '../../utils/puzzles.ts';
import {
  ChevronLeft,
  ChevronRight,
  Wand2,
  Star,
  Paintbrush,
  X,
} from 'lucide-react';

interface CozyNonogramGameProps {
  level: number;
  onLevelComplete: (starsEarned: number) => void;
  onLevelChange: (newLevel: number) => void;
  resetSignal: number;
  onHeaderUpdate: (title: string, subtitle: string) => void;
}

export const CozyNonogramGame: React.FC<CozyNonogramGameProps> = ({
  level,
  onLevelComplete,
  onLevelChange,
  resetSignal,
  onHeaderUpdate,
}) => {
  const levelData = generateNonogramLevel(level);
  const tier = getMasteryTier(level);

  // 0 = empty, 1 = painted, -1 = marked X
  const [userGrid, setUserGrid] = useState<number[][]>(() =>
    Array.from({ length: levelData.size }, () => Array(levelData.size).fill(0))
  );
  const [toolMode, setToolMode] = useState<'paint' | 'markX'>('paint');
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const fresh = generateNonogramLevel(level);
    setUserGrid(Array.from({ length: fresh.size }, () => Array(fresh.size).fill(0)));
    setIsCompleted(false);
    onHeaderUpdate(
      fresh.title,
      `Use row & column number clues to paint the hidden cozy picture`
    );
  }, [level, resetSignal, onHeaderUpdate]);

  const checkSolved = useCallback(
    (nextGrid: number[][]) => {
      if (!isCompleted && isNonogramSolved(nextGrid, levelData.solution)) {
        setIsCompleted(true);
        audioEngine.playCompletionChord();
        onLevelComplete(tier.starsReward);
      }
    },
    [isCompleted, levelData.solution, onLevelComplete, tier.starsReward]
  );

  const handleCellClick = (r: number, c: number) => {
    if (isCompleted) return;
    const current = userGrid[r][c];
    let nextVal: number;
    if (toolMode === 'paint') {
      nextVal = current === 1 ? 0 : 1;
    } else {
      nextVal = current === -1 ? 0 : -1;
    }

    const nextGrid = userGrid.map((row, rIdx) =>
      row.map((v, cIdx) => (rIdx === r && cIdx === c ? nextVal : v))
    );
    setUserGrid(nextGrid);
    audioEngine.playHarmonicChime((r + c) % 8, nextVal === 1 ? 0 : -2);
    checkSolved(nextGrid);
  };

  const handleHint = () => {
    if (isCompleted) return;
    // Find a cell that doesn't match the solution
    for (let r = 0; r < levelData.size; r++) {
      for (let c = 0; c < levelData.size; c++) {
        const target = levelData.solution[r][c];
        const current = userGrid[r][c];
        if ((target === 1 && current !== 1) || (target === 0 && current === 1)) {
          const nextGrid = userGrid.map((row, rIdx) =>
            row.map((v, cIdx) =>
              rIdx === r && cIdx === c ? (target === 1 ? 1 : -1) : v
            )
          );
          setUserGrid(nextGrid);
          audioEngine.playHarmonicChime(5);
          checkSolved(nextGrid);
          return;
        }
      }
    }
  };

  const activeGrid =
    userGrid.length === levelData.size && userGrid[0]?.length === levelData.size
      ? userGrid
      : Array.from({ length: levelData.size }, () => Array(levelData.size).fill(0));

  const isRowComplete = (r: number): boolean => {
    const row = activeGrid[r];
    const targetClues = levelData.rowClues[r];
    if (!row || !targetClues) return false;
    const userLine = row.map((v) => (v === 1 ? 1 : 0));
    const currentClues = computeLineClues(userLine);
    return (
      currentClues.length === targetClues.length &&
      currentClues.every((val, i) => val === targetClues[i])
    );
  };

  const isColComplete = (c: number): boolean => {
    const targetClues = levelData.colClues[c];
    if (!targetClues) return false;
    const userCol = activeGrid.map((row) => (row?.[c] === 1 ? 1 : 0));
    const currentClues = computeLineClues(userCol);
    return (
      currentClues.length === targetClues.length &&
      currentClues.every((val, i) => val === targetClues[i])
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-3 sm:p-5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 select-none">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/85 border border-slate-800 px-3 py-2 rounded-xl mb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => level > 1 && onLevelChange(level - 1)}
            disabled={level <= 1}
            aria-label="Previous Nonogram Level"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-teal-300">
            {levelData.artEmoji} Lvl {level} ({levelData.size}×{levelData.size} Logic Grid)
          </span>
          <button
            onClick={() => onLevelChange(level + 1)}
            aria-label="Next Nonogram Level"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setToolMode(toolMode === 'paint' ? 'markX' : 'paint')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
              toolMode === 'paint'
                ? 'bg-teal-500/25 border-teal-400 text-teal-200'
                : 'bg-slate-800 border-slate-600 text-slate-200'
            }`}
          >
            {toolMode === 'paint' ? (
              <>
                <Paintbrush className="w-3.5 h-3.5 text-teal-300" />
                <span>Mode: Paint Tile</span>
              </>
            ) : (
              <>
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Mode: Mark Empty (×)</span>
              </>
            )}
          </button>

          <button
            onClick={handleHint}
            disabled={isCompleted}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 cursor-pointer disabled:opacity-40"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-300" />
            <span>Hint</span>
          </button>
        </div>
      </div>

      {/* Nonogram Board with Top Column Clues & Left Row Clues */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto">
        <div className="inline-block bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-2xl">
          {/* Column Clues Header */}
          <div className="flex">
            <div className="w-14 sm:w-16 shrink-0 flex items-center justify-center text-lg">
              {levelData.artEmoji}
            </div>
            <div
              style={{
                gridTemplateColumns: `repeat(${levelData.size}, minmax(0, 1fr))`,
              }}
              className="grid gap-1 flex-1"
            >
              {levelData.colClues.map((clues, cIdx) => {
                const done = isColComplete(cIdx);
                return (
                  <div
                    key={cIdx}
                    className={`w-9 sm:w-11 pb-1.5 flex flex-col items-center justify-end font-mono text-xs font-bold rounded-t-lg transition-colors ${
                      done ? 'text-emerald-400/50 line-through' : 'text-sky-300'
                    }`}
                  >
                    {clues.map((n, i) => (
                      <span key={i} className="leading-tight">
                        {n}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows with Left Clues + Cells */}
          <div className="space-y-1">
            {activeGrid.map((row, rIdx) => {
              const rowDone = isRowComplete(rIdx);
              const rClues = levelData.rowClues[rIdx] || [0];
              return (
                <div key={rIdx} className="flex items-center">
                  {/* Row Clues */}
                  <div
                    className={`w-14 sm:w-16 pr-2.5 flex items-center justify-end gap-1 font-mono text-xs font-bold transition-colors ${
                      rowDone ? 'text-emerald-400/50 line-through' : 'text-sky-300'
                    }`}
                  >
                    {rClues.map((n, i) => (
                      <span key={i}>{n}</span>
                    ))}
                  </div>

                  {/* Row Cells */}
                  <div
                    style={{
                      gridTemplateColumns: `repeat(${levelData.size}, minmax(0, 1fr))`,
                    }}
                    className="grid gap-1"
                  >
                    {row.map((cellVal, cIdx) => {
                      const isFilled = cellVal === 1;
                      const isMarkedX = cellVal === -1;
                      return (
                        <button
                          key={`${rIdx}-${cIdx}`}
                          type="button"
                          onClick={() => handleCellClick(rIdx, cIdx)}
                          aria-label={`Nonogram Row ${rIdx + 1} Col ${cIdx + 1}`}
                          style={
                            isFilled
                              ? {
                                  backgroundColor: levelData.accentColor,
                                  boxShadow: `0 0 12px ${levelData.accentColor}55`,
                                }
                              : undefined
                          }
                          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg border flex items-center justify-center font-bold transition-all active:scale-95 cursor-pointer ${
                            isFilled
                              ? 'border-white/40 text-slate-950'
                              : isMarkedX
                              ? 'bg-slate-950/80 border-slate-800 text-slate-500'
                              : 'bg-slate-950 hover:bg-slate-800 border-slate-700/80'
                          }`}
                        >
                          {isMarkedX && <X className="w-4 h-4 text-slate-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-3 text-center">
          Numbers show how many connected tiles to paint in each row and column. Completed clues turn green!
        </p>
      </div>

      {/* Completion Celebration */}
      {isCompleted && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="p-6 rounded-3xl bg-slate-900 border border-emerald-400/40 text-center shadow-2xl max-w-sm w-full">
            <div className="text-4xl mb-2">{levelData.artEmoji}</div>
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-2">
              {Array.from({ length: tier.starsReward }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
              +{tier.starsReward} Harmony Stars
            </div>
            <h3 className="text-xl font-bold text-white">{levelData.artName} Revealed!</h3>
            <p className="text-xs text-slate-300 mt-1">
              Wonderful focus. Ready for the next cozy picture puzzle?
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
                <span>Next Picture</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
