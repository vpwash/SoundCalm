import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, Wand2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import {
  generateChromaLevel,
  getMasteryTier,
  ChromaTile,
  swapChromaTiles,
  checkChromaSolved,
  applyChromaHint,
} from '../../utils/puzzles.ts';
import { audioEngine } from '../../audio/AudioEngine.ts';

interface ChromaFlowGameProps {
  level: number;
  onLevelComplete: (stars: number) => void;
  onLevelChange: (newLevel: number) => void;
  resetSignal: number;
  onHeaderUpdate?: (title: string, subtitle: string) => void;
}

export const ChromaFlowGame: React.FC<ChromaFlowGameProps> = ({
  level,
  onLevelComplete,
  onLevelChange,
  resetSignal,
  onHeaderUpdate,
}) => {
  const config = generateChromaLevel(level);
  const tier = getMasteryTier(level);
  const nextTier = getMasteryTier(level + 1);
  const nextConfig = generateChromaLevel(level + 1);

  const [tiles, setTiles] = useState<ChromaTile[]>(() =>
    config.tiles.map((t) => ({ ...t }))
  );
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    const freshConfig = generateChromaLevel(level);
    setTiles(freshConfig.tiles.map((t) => ({ ...t })));
    setSelectedPos(null);
    setIsSolved(false);
    onHeaderUpdate?.(freshConfig.name, freshConfig.theme);
  }, [level, resetSignal]);

  const alignedCount = tiles.filter((t) => t.id === t.currentPos).length;

  const verifyCompletion = (updated: ChromaTile[]) => {
    if (!isSolved && checkChromaSolved(updated)) {
      setIsSolved(true);
      audioEngine.playCompletionChord();
      onLevelComplete(tier.starsReward);
    }
  };

  const handleTileClick = (pos: number) => {
    if (isSolved) return;
    const clickedTile = tiles.find((t) => t.currentPos === pos);
    if (!clickedTile || clickedTile.locked) return;

    if (selectedPos === null) {
      setSelectedPos(pos);
      audioEngine.playHarmonicChime(pos);
    } else if (selectedPos === pos) {
      setSelectedPos(null);
    } else {
      const updated = swapChromaTiles(tiles, selectedPos, pos);
      setTiles(updated);
      setSelectedPos(null);
      audioEngine.playHarmonicChime(pos + 2);
      verifyCompletion(updated);
    }
  };

  const handleHint = () => {
    if (isSolved) return;
    const updated = applyChromaHint(tiles);
    setTiles(updated);
    setSelectedPos(null);
    audioEngine.playHarmonicChime(4);
    verifyCompletion(updated);
  };

  const orderedSlots = Array.from({ length: config.gridSize * config.gridSize }, (_, pos) =>
    tiles.find((t) => t.currentPos === pos)!
  );

  return (
    <div className="relative w-full min-h-[390px] sm:min-h-[440px] h-full flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden">
      {/* Top Progressive Level & Mastery Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 z-10 bg-slate-900/80 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-700/70">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => level > 1 && onLevelChange(level - 1)}
            disabled={level <= 1}
            aria-label="Previous Chroma Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-teal-300 tracking-wide">
            <span className="hidden sm:inline">{tier.tierBadge} • </span>Lvl {level} ({config.gridSize}×{config.gridSize})
          </span>
          <button
            onClick={() => onLevelChange(level + 1)}
            aria-label="Next Chroma Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] sm:text-xs font-semibold text-teal-300 bg-teal-500/10 px-2 py-1 rounded-lg border border-teal-500/20">
            {alignedCount}/{tiles.length} Stones
          </span>
          <button
            onClick={handleHint}
            disabled={isSolved}
            className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition-all cursor-pointer disabled:opacity-40"
            title="Harmonize one misplaced gradient stone"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Harmonic Hint</span>
          </button>
        </div>
      </div>

      {/* Main Dynamic 3x3 or 4x4 Gradient Grid */}
      <div className="relative flex-1 min-h-[250px] sm:min-h-[290px] my-1.5 sm:my-2 flex items-center justify-center">
        <div
          className={`grid gap-2 sm:gap-2.5 w-full ${
            config.gridSize === 4 ? 'max-w-[248px] sm:max-w-[310px]' : 'max-w-[236px] sm:max-w-[290px]'
          } aspect-square p-2.5 sm:p-3 rounded-3xl bg-slate-950/70 border border-slate-800/80 shadow-inner`}
          style={{
            gridTemplateColumns: `repeat(${config.gridSize}, minmax(0, 1fr))`,
          }}
        >
          {orderedSlots.map((tile, pos) => {
            if (!tile) return null;
            const isSelected = selectedPos === pos;
            const isCorrectSpot = tile.id === tile.currentPos;

            return (
              <button
                key={tile.id}
                onClick={() => handleTileClick(pos)}
                disabled={tile.locked}
                aria-label={`Color Stone ${pos + 1} ${tile.locked ? 'Locked Anchor' : tile.label}`}
                style={{ backgroundColor: tile.color }}
                className={`relative rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all duration-300 shadow-md ${
                  tile.locked
                    ? 'cursor-default ring-2 ring-white/40'
                    : 'cursor-pointer hover:scale-[1.03] active:scale-95'
                } ${
                  isSelected
                    ? 'ring-4 ring-white scale-105 z-10 shadow-xl'
                    : isCorrectSpot && !tile.locked
                    ? 'ring-2 ring-teal-200/75'
                    : ''
                }`}
              >
                {tile.locked ? (
                  <div className="bg-slate-950/50 backdrop-blur-xs p-1 rounded-full">
                    <Lock className="w-3 h-3 text-white/90" />
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-slate-950/80 bg-white/45 backdrop-blur-xs px-1.5 py-0.5 rounded-md">
                    {isCorrectSpot ? '✓' : 'Swap'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Target Spectrum Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/70">
        <span className="text-[11px] font-medium text-slate-400">
          Target {config.gridSize}×{config.gridSize} Spectrum:
        </span>
        <div className="flex items-center gap-1">
          {config.colors.map((hex, i) => (
            <div
              key={i}
              style={{ backgroundColor: hex }}
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm border border-white/20"
              title={`Target position ${i + 1}`}
            />
          ))}
        </div>
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
          <h4 className="text-xl font-bold text-white mb-1">{config.name} Harmonized!</h4>
          <p className="text-xs text-slate-300 max-w-sm mb-4">
            Seamless chromatic flow achieved. Next up:{' '}
            <span className="text-teal-300 font-semibold">
              Level {level + 1} ({nextConfig.gridSize}×{nextConfig.gridSize} • {nextTier.tierName})
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
