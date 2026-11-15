import React, { useState, useEffect } from 'react';
import { Wand2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import {
  generateZenLoopLevel,
  getMasteryTier,
  ZenLoopTile,
  getActivePorts,
  rotateZenTile,
  checkZenLoopsSolved,
  applyZenLoopHint,
} from '../../utils/puzzles.ts';
import { audioEngine } from '../../audio/AudioEngine.ts';

interface ZenRippleLoopsGameProps {
  level: number;
  onLevelComplete: (stars: number) => void;
  onLevelChange: (newLevel: number) => void;
  resetSignal: number;
  onHeaderUpdate?: (title: string, subtitle: string) => void;
}

export const ZenRippleLoopsGame: React.FC<ZenRippleLoopsGameProps> = ({
  level,
  onLevelComplete,
  onLevelChange,
  resetSignal,
  onHeaderUpdate,
}) => {
  const levelConfig = generateZenLoopLevel(level);
  const tier = getMasteryTier(level);
  const nextTier = getMasteryTier(level + 1);
  const nextConfig = generateZenLoopLevel(level + 1);

  const [grid, setGrid] = useState<ZenLoopTile[][]>(() =>
    levelConfig.grid.map((row) => row.map((c) => ({ ...c })))
  );
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    const freshConfig = generateZenLoopLevel(level);
    setGrid(freshConfig.grid.map((row) => row.map((c) => ({ ...c }))));
    setIsSolved(false);
    onHeaderUpdate?.(freshConfig.name, freshConfig.theme);
  }, [level, resetSignal]);

  const verifyCompletion = (updated: ZenLoopTile[][]) => {
    if (!isSolved && checkZenLoopsSolved(updated)) {
      setIsSolved(true);
      audioEngine.playCompletionChord();
      onLevelComplete(tier.starsReward);
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (isSolved) return;
    const updated = rotateZenTile(grid, r, c);
    setGrid(updated);
    audioEngine.playHarmonicChime(r * levelConfig.cols + c);
    verifyCompletion(updated);
  };

  const handleHint = () => {
    if (isSolved) return;
    const updated = applyZenLoopHint(grid);
    setGrid(updated);
    audioEngine.playHarmonicChime(4);
    verifyCompletion(updated);
  };

  const isPortMatched = (r: number, c: number, dir: 0 | 1 | 2 | 3): boolean => {
    const rows = grid.length;
    const cols = grid[0]?.length || 0;
    const ports = getActivePorts(grid[r][c].basePorts, grid[r][c].rotation);
    if (!ports[dir]) return false;

    if (dir === 0 && r > 0) {
      return getActivePorts(grid[r - 1][c].basePorts, grid[r - 1][c].rotation)[2];
    }
    if (dir === 1 && c < cols - 1) {
      return getActivePorts(grid[r][c + 1].basePorts, grid[r][c + 1].rotation)[3];
    }
    if (dir === 2 && r < rows - 1) {
      return getActivePorts(grid[r + 1][c].basePorts, grid[r + 1][c].rotation)[0];
    }
    if (dir === 3 && c > 0) {
      return getActivePorts(grid[r][c - 1].basePorts, grid[r][c - 1].rotation)[1];
    }
    return false;
  };

  return (
    <div className="relative w-full min-h-[390px] sm:min-h-[440px] h-full flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden">
      {/* Top Progressive Level & Mastery Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 z-10 bg-slate-900/80 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-700/70">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => level > 1 && onLevelChange(level - 1)}
            disabled={level <= 1}
            aria-label="Previous Zen Loop Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-teal-300 tracking-wide">
            <span className="hidden sm:inline">{tier.tierBadge} • </span>Lvl {level} ({levelConfig.rows}×{levelConfig.cols})
          </span>
          <button
            onClick={() => onLevelChange(level + 1)}
            aria-label="Next Zen Loop Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleHint}
          disabled={isSolved}
          className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition-all cursor-pointer disabled:opacity-40"
          title="Align one crystal conduit into its closed-loop orientation"
        >
          <Wand2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>Harmonic Hint</span>
        </button>
      </div>

      {/* Main Dynamic 3x3, 3x4, or 4x4 Conduit Grid */}
      <div className="relative flex-1 min-h-[250px] sm:min-h-[290px] my-1.5 sm:my-2 flex items-center justify-center">
        <div
          className={`grid gap-2 sm:gap-2.5 w-full ${
            levelConfig.cols === 4 ? 'max-w-[250px] sm:max-w-[310px]' : 'max-w-[236px] sm:max-w-[285px]'
          } p-3 rounded-3xl bg-slate-950/75 border border-slate-800/80 shadow-inner`}
          style={{
            gridTemplateColumns: `repeat(${levelConfig.cols}, minmax(0, 1fr))`,
          }}
        >
          {grid.map((row, rIdx) =>
            row.map((cell, cIdx) => {
              const activePorts = getActivePorts(cell.basePorts, cell.rotation);
              const hasAnyPort = activePorts.some(Boolean);
              const allCellPortsMatched =
                hasAnyPort &&
                ([0, 1, 2, 3] as const).every(
                  (dir) => !activePorts[dir] || isPortMatched(rIdx, cIdx, dir)
                );

              const strokeColor = isSolved
                ? '#2DD4BF'
                : allCellPortsMatched
                ? '#38BDF8'
                : '#94A3B8';

              return (
                <button
                  key={`${rIdx}-${cIdx}`}
                  onClick={() => handleCellClick(rIdx, cIdx)}
                  aria-label={`Zen Loop Tile Row ${rIdx + 1} Col ${cIdx + 1}`}
                  className={`relative aspect-square rounded-2xl border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                    isSolved
                      ? 'bg-teal-500/15 border-teal-400/60 shadow-lg shadow-teal-500/10'
                      : allCellPortsMatched
                      ? 'bg-sky-500/10 border-sky-400/50'
                      : 'bg-slate-900/85 hover:bg-slate-800/90 border-slate-700/80'
                  }`}
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    {activePorts[0] && (
                      <line
                        x1="50"
                        y1="50"
                        x2="50"
                        y2="0"
                        stroke={isPortMatched(rIdx, cIdx, 0) ? '#2DD4BF' : strokeColor}
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                    )}
                    {activePorts[1] && (
                      <line
                        x1="50"
                        y1="50"
                        x2="100"
                        y2="50"
                        stroke={isPortMatched(rIdx, cIdx, 1) ? '#2DD4BF' : strokeColor}
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                    )}
                    {activePorts[2] && (
                      <line
                        x1="50"
                        y1="50"
                        x2="50"
                        y2="100"
                        stroke={isPortMatched(rIdx, cIdx, 2) ? '#2DD4BF' : strokeColor}
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                    )}
                    {activePorts[3] && (
                      <line
                        x1="50"
                        y1="50"
                        x2="0"
                        y2="50"
                        stroke={isPortMatched(rIdx, cIdx, 3) ? '#2DD4BF' : strokeColor}
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                    )}
                    {hasAnyPort && (
                      <circle
                        cx="50"
                        cy="50"
                        r="14"
                        fill={allCellPortsMatched ? '#2DD4BF' : '#38BDF8'}
                        stroke="#0F172A"
                        strokeWidth="4"
                      />
                    )}
                  </svg>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Guidance Bar */}
      <div className="flex items-center justify-between gap-2 bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/70 text-[11px] text-slate-400">
        <span>Tap any crystal conduit to rotate 90° clockwise</span>
        <span className="text-teal-300 font-semibold">Teal = Connected Branch</span>
      </div>

      {/* Level Complete Celebration Modal */}
      {isSolved && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center animate-fade-in">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-2">
            {Array.from({ length: tier.starsReward }).map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            ))}
            +{tier.starsReward} Harmony {tier.starsReward === 1 ? 'Star' : 'Stars'} Earned
          </div>
          <h4 className="text-xl font-bold text-white mb-1">{levelConfig.name} Complete!</h4>
          <p className="text-xs text-slate-300 max-w-sm mb-4">
            Every crystal branch flows in unbroken equilibrium. Next up:{' '}
            <span className="text-teal-300 font-semibold">
              Level {level + 1} ({nextConfig.rows}×{nextConfig.cols} • {nextTier.tierName})
            </span>
            .
          </p>
          <button
            onClick={() => onLevelChange(level + 1)}
            className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-teal-500/25 cursor-pointer"
          >
            Advance to Level {level + 1} →
          </button>
        </div>
      )}
    </div>
  );
};
