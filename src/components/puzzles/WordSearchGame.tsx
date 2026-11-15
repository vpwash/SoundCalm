import React, { useState, useEffect, useMemo } from 'react';
import { Check, Wand2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import {
  generateWordSearchLevel,
  getMasteryTier,
  getWordSearchLineCells,
  matchWordSearchSelection,
  WordSearchPlacement,
} from '../../utils/puzzles.ts';
import { audioEngine } from '../../audio/AudioEngine.ts';

interface WordSearchGameProps {
  level: number;
  onLevelComplete: (stars: number) => void;
  onLevelChange: (newLevel: number) => void;
  resetSignal: number;
  onHeaderUpdate?: (title: string, subtitle: string) => void;
}

export const WordSearchGame: React.FC<WordSearchGameProps> = ({
  level,
  onLevelComplete,
  onLevelChange,
  resetSignal,
  onHeaderUpdate,
}) => {
  const config = useMemo(() => generateWordSearchLevel(level), [level]);
  const tier = getMasteryTier(level);
  const nextTier = getMasteryTier(level + 1);
  const nextConfig = useMemo(() => generateWordSearchLevel(level + 1), [level]);

  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [anchorCell, setAnchorCell] = useState<[number, number] | null>(null);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    setFoundWords([]);
    setAnchorCell(null);
    setHoverCell(null);
    setIsDragging(false);
    setIsSolved(false);
    onHeaderUpdate?.(config.name, config.theme);
  }, [level, resetSignal, config.name, config.theme]);

  const previewCells = useMemo(() => {
    if (!anchorCell || !hoverCell) return anchorCell ? [anchorCell] : [];
    const line = getWordSearchLineCells(anchorCell, hoverCell);
    return line.length > 0 ? line : [anchorCell];
  }, [anchorCell, hoverCell]);

  const previewKeySet = useMemo(
    () => new Set(previewCells.map(([r, c]) => `${r},${c}`)),
    [previewCells]
  );

  // Map each cell coordinate to the found word color(s)
  const foundCellColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const placement of config.words) {
      if (!foundWords.includes(placement.word)) continue;
      for (const [r, c] of placement.cells) {
        map.set(`${r},${c}`, placement.color);
      }
    }
    return map;
  }, [config.words, foundWords]);

  const tryCommitSelection = (start: [number, number], end: [number, number]): boolean => {
    const line = getWordSearchLineCells(start, end);
    const matched: WordSearchPlacement | null = matchWordSearchSelection(
      line,
      config.words,
      foundWords
    );
    if (matched) {
      const nextFound = [...foundWords, matched.word];
      setFoundWords(nextFound);
      setAnchorCell(null);
      setHoverCell(null);

      if (nextFound.length >= config.words.length && !isSolved) {
        setIsSolved(true);
        audioEngine.playCompletionChord();
        onLevelComplete(tier.starsReward);
      } else {
        audioEngine.playHarmonicChime(nextFound.length + 1);
      }
      return true;
    }
    return false;
  };

  const handleCellPointerDown = (r: number, c: number) => {
    if (isSolved) return;

    // Support tap-start -> tap-end as well as click-and-drag
    if (anchorCell && (anchorCell[0] !== r || anchorCell[1] !== c)) {
      const committed = tryCommitSelection(anchorCell, [r, c]);
      if (committed) {
        setIsDragging(false);
        return;
      }
    }

    setAnchorCell([r, c]);
    setHoverCell([r, c]);
    setIsDragging(true);
    audioEngine.playHarmonicChime(0);
  };

  const handleCellPointerEnter = (r: number, c: number) => {
    if (!anchorCell || isSolved) return;
    if (isDragging) {
      setHoverCell([r, c]);
    }
  };

  const handlePointerUp = () => {
    if (!isDragging || !anchorCell || !hoverCell) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);
    if (anchorCell[0] !== hoverCell[0] || anchorCell[1] !== hoverCell[1]) {
      const committed = tryCommitSelection(anchorCell, hoverCell);
      if (!committed) {
        setAnchorCell(null);
        setHoverCell(null);
      }
    }
  };

  const handleHint = () => {
    if (isSolved) return;
    const unfound = config.words.find((w) => !foundWords.includes(w.word));
    if (!unfound) return;
    const nextFound = [...foundWords, unfound.word];
    setFoundWords(nextFound);
    setAnchorCell(null);
    setHoverCell(null);
    if (nextFound.length >= config.words.length) {
      setIsSolved(true);
      audioEngine.playCompletionChord();
      onLevelComplete(tier.starsReward);
    } else {
      audioEngine.playHarmonicChime(4);
    }
  };

  return (
    <div
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="relative w-full min-h-[410px] sm:min-h-[460px] h-full flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden"
    >
      {/* Top Progressive Level & Mastery Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 z-10 bg-slate-900/80 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-700/70">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => level > 1 && onLevelChange(level - 1)}
            disabled={level <= 1}
            aria-label="Previous Word Search Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-teal-300 tracking-wide">
            <span className="hidden sm:inline">{tier.tierBadge} • </span>Lvl {level} ({config.gridSize}×{config.gridSize})
          </span>
          <button
            onClick={() => onLevelChange(level + 1)}
            aria-label="Next Word Search Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] sm:text-xs font-semibold text-teal-300 bg-teal-500/10 px-2 py-1 rounded-lg border border-teal-500/20">
            {foundWords.length}/{config.words.length} Words
          </span>
          <button
            onClick={handleHint}
            disabled={isSolved}
            className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition-all cursor-pointer disabled:opacity-40"
            title="Reveal one calming word in the grid"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Harmonic Hint</span>
          </button>
        </div>
      </div>

      {/* Main Letter Grid + Target Word List */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 my-2.5">
        {/* Letter Grid */}
        <div
          className="grid gap-1 sm:gap-1.5 p-2.5 sm:p-3 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner touch-none"
          style={{
            gridTemplateColumns: `repeat(${config.gridSize}, minmax(0, 1fr))`,
          }}
        >
          {config.grid.map((row, r) =>
            row.map((letter, c) => {
              const key = `${r},${c}`;
              const isSelected = previewKeySet.has(key);
              const foundBg = foundCellColorMap.get(key);
              const isAnchor = anchorCell?.[0] === r && anchorCell?.[1] === c;

              return (
                <button
                  key={key}
                  type="button"
                  onPointerDown={() => handleCellPointerDown(r, c)}
                  onPointerEnter={() => handleCellPointerEnter(r, c)}
                  style={
                    isSelected
                      ? undefined
                      : foundBg
                        ? { backgroundColor: foundBg }
                        : undefined
                  }
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-teal-500 text-slate-950 border-teal-300 scale-105 shadow-md'
                      : isAnchor
                        ? 'bg-teal-500/40 text-white border-teal-400'
                        : foundBg
                          ? 'text-white border-white/25 shadow-xs'
                          : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-800'
                  }`}
                  aria-label={`Row ${r + 1} Column ${c + 1} Letter ${letter}`}
                >
                  {letter}
                </button>
              );
            })
          )}
        </div>

        {/* Target Words Panel */}
        <div className="w-full lg:w-56 flex flex-col gap-2 bg-slate-900/65 border border-slate-800 rounded-2xl p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Words to Find
          </div>
          <div className="flex flex-wrap lg:flex-col gap-1.5">
            {config.words.map((w) => {
              const isFound = foundWords.includes(w.word);
              return (
                <div
                  key={w.word}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    isFound
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 line-through opacity-80'
                      : 'bg-slate-950/70 border-slate-800 text-slate-200'
                  }`}
                >
                  <span className="tracking-wider">{w.word}</span>
                  {isFound && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
            Drag across letters or tap the first and last letter of a word.
          </p>
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
          <h4 className="text-xl font-bold text-white mb-1">{config.name} Complete!</h4>
          <p className="text-xs text-slate-300 max-w-sm mb-4">
            All {config.words.length} calming words uncovered. Next up:{' '}
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
