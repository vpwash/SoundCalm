import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wand2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Star,
  ArrowRight,
} from 'lucide-react';
import {
  generateBlockSlideLevel,
  getMasteryTier,
  SlidingBlock,
  getBlockSlideBounds,
  moveSlidingBlock,
  checkBlockSlideSolved,
  applyBlockSlideHint,
} from '../../utils/puzzles.ts';
import { audioEngine } from '../../audio/AudioEngine.ts';

interface BlockSlideGameProps {
  level: number;
  onLevelComplete: (stars: number) => void;
  onLevelChange: (newLevel: number) => void;
  resetSignal: number;
  onHeaderUpdate?: (title: string, subtitle: string) => void;
}

export const BlockSlideGame: React.FC<BlockSlideGameProps> = ({
  level,
  onLevelComplete,
  onLevelChange,
  resetSignal,
  onHeaderUpdate,
}) => {
  const config = useMemo(() => generateBlockSlideLevel(level), [level]);
  const tier = getMasteryTier(level);
  const nextTier = getMasteryTier(level + 1);
  const nextConfig = useMemo(() => generateBlockSlideLevel(level + 1), [level]);

  const [blocks, setBlocks] = useState<SlidingBlock[]>(() =>
    config.blocks.map((b) => ({ ...b }))
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string>('key');
  const [moveCount, setMoveCount] = useState<number>(0);
  const [isSolved, setIsSolved] = useState<boolean>(false);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    blockId: string;
    startX: number;
    startY: number;
    appliedSteps: number;
  } | null>(null);

  useEffect(() => {
    const fresh = generateBlockSlideLevel(level);
    setBlocks(fresh.blocks.map((b) => ({ ...b })));
    setSelectedBlockId('key');
    setMoveCount(0);
    setIsSolved(false);
    onHeaderUpdate?.(fresh.name, fresh.theme);
  }, [level, resetSignal, onHeaderUpdate]);

  const applyMove = (blockId: string, delta: number) => {
    if (isSolved || delta === 0) return;
    setBlocks((prev) => {
      const next = moveSlidingBlock(prev, blockId, delta, config.gridSize);
      if (next !== prev) {
        setMoveCount((m) => m + 1);
        audioEngine.playHarmonicChime((moveCount % 6) + 1);
        if (checkBlockSlideSolved(next, config.gridSize)) {
          setIsSolved(true);
          audioEngine.playCompletionChord();
          onLevelComplete(tier.starsReward);
        }
      }
      return next;
    });
  };

  const handleBlockPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    blockId: string
  ) => {
    if (isSolved) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedBlockId(blockId);
    dragStateRef.current = {
      blockId,
      startX: e.clientX,
      startY: e.clientY,
      appliedSteps: 0,
    };
  };

  const handleBlockPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    const boardEl = boardRef.current;
    if (!drag || !boardEl || isSolved) return;

    const block = blocks.find((b) => b.id === drag.blockId);
    if (!block) return;

    const cellPx = boardEl.clientWidth / config.gridSize;
    if (cellPx <= 0) return;

    const rawDeltaPx =
      block.orientation === 'h' ? e.clientX - drag.startX : e.clientY - drag.startY;
    const desiredTotalSteps = Math.round(rawDeltaPx / cellPx);
    const stepDiff = desiredTotalSteps - drag.appliedSteps;

    if (stepDiff !== 0) {
      const { minDelta, maxDelta } = getBlockSlideBounds(
        blocks,
        block.id,
        config.gridSize
      );
      const clampedStep = Math.max(minDelta, Math.min(maxDelta, stepDiff));
      if (clampedStep !== 0) {
        drag.appliedSteps += clampedStep;
        applyMove(block.id, clampedStep);
      }
    }
  };

  const handleBlockPointerUp = () => {
    dragStateRef.current = null;
  };

  const handleHint = () => {
    if (isSolved) return;
    const next = applyBlockSlideHint(blocks, config.gridSize);
    if (next !== blocks) {
      setBlocks(next);
      setMoveCount((m) => m + 1);
      if (checkBlockSlideSolved(next, config.gridSize)) {
        setIsSolved(true);
        audioEngine.playCompletionChord();
        onLevelComplete(tier.starsReward);
      } else {
        audioEngine.playHarmonicChime(4);
      }
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;
  const selectedBounds = selectedBlock
    ? getBlockSlideBounds(blocks, selectedBlock.id, config.gridSize)
    : { minDelta: 0, maxDelta: 0 };

  return (
    <div className="relative w-full min-h-[410px] sm:min-h-[460px] h-full flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden">
      {/* Top Progressive Level & Mastery Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 z-10 bg-slate-900/80 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-700/70">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => level > 1 && onLevelChange(level - 1)}
            disabled={level <= 1}
            aria-label="Previous Block Slide Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-teal-300 tracking-wide">
            <span className="hidden sm:inline">{tier.tierBadge} • </span>Lvl {level} (6×6)
          </span>
          <button
            onClick={() => onLevelChange(level + 1)}
            aria-label="Next Block Slide Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] sm:text-xs font-semibold text-sky-300 bg-sky-500/10 px-2 py-1 rounded-lg border border-sky-500/20">
            Moves: {moveCount}
          </span>
          <button
            onClick={handleHint}
            disabled={isSolved}
            className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition-all cursor-pointer disabled:opacity-40"
            title="Slide one block along the shortest path to the exit"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Harmonic Hint</span>
          </button>
        </div>
      </div>

      {/* Main 6x6 Sliding Board */}
      <div className="flex-1 flex flex-col items-center justify-center my-2.5 gap-3">
        <div className="relative flex items-center">
          <div
            ref={boardRef}
            className="relative w-[264px] h-[264px] sm:w-[324px] sm:h-[324px] rounded-2xl bg-slate-950/90 border-2 border-slate-800 shadow-inner touch-none overflow-hidden"
          >
            {/* Background 6x6 Grid Cells */}
            <div className="grid grid-cols-6 grid-rows-6 w-full h-full">
              {Array.from({ length: 36 }).map((_, idx) => {
                const r = Math.floor(idx / 6);
                const c = idx % 6;
                const isExitLane = r === config.exitRow;
                return (
                  <div
                    key={idx}
                    className={`border border-slate-800/50 ${
                      isExitLane ? 'bg-teal-950/20' : ''
                    }`}
                  />
                );
              })}
            </div>

            {/* Exit Notch Indicator on Right Wall */}
            <div
              style={{
                top: `${(config.exitRow / config.gridSize) * 100}%`,
                height: `${(1 / config.gridSize) * 100}%`,
              }}
              className="absolute right-0 w-1.5 bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.9)] z-10"
            />

            {/* Sliding Blocks */}
            {blocks.map((block) => {
              const isSelected = block.id === selectedBlockId;
              const leftPct = (block.col / config.gridSize) * 100;
              const topPct = (block.row / config.gridSize) * 100;
              const widthPct =
                ((block.orientation === 'h' ? block.length : 1) / config.gridSize) * 100;
              const heightPct =
                ((block.orientation === 'v' ? block.length : 1) / config.gridSize) * 100;

              return (
                <button
                  key={block.id}
                  type="button"
                  onPointerDown={(e) => handleBlockPointerDown(e, block.id)}
                  onPointerMove={handleBlockPointerMove}
                  onPointerUp={handleBlockPointerUp}
                  onPointerCancel={handleBlockPointerUp}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                  aria-label={
                    block.isKey
                      ? 'Jade Key Block (slide right to exit)'
                      : `${block.orientation === 'h' ? 'Horizontal' : 'Vertical'} stone block`
                  }
                  className="absolute p-1 transition-all duration-150 ease-out cursor-grab active:cursor-grabbing focus:outline-none z-20"
                >
                  <div
                    style={{ backgroundColor: block.color }}
                    className={`w-full h-full rounded-xl flex items-center justify-center shadow-md border transition-all ${
                      block.isKey
                        ? 'border-teal-100 ring-2 ring-teal-300/60 shadow-teal-500/30'
                        : isSelected
                          ? 'border-white ring-2 ring-white/70'
                          : 'border-white/25 hover:brightness-110'
                    }`}
                  >
                    {block.isKey ? (
                      <span className="flex items-center gap-1 text-[10px] sm:text-xs font-extrabold text-slate-950 tracking-wide">
                        JADE <ArrowRight className="w-3 h-3" />
                      </span>
                    ) : (
                      <div
                        className={`rounded-full bg-slate-950/30 ${
                          block.orientation === 'h' ? 'w-6 h-1.5' : 'w-1.5 h-6'
                        }`}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right-side EXIT Label */}
          <div
            className="hidden sm:flex items-center gap-1 ml-2 text-[10px] font-bold uppercase tracking-wider text-teal-300"
            style={{
              marginTop: `${((config.exitRow - 2.5) / 6) * 324}px`,
            }}
          >
            <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
            <span>Exit</span>
          </div>
        </div>

        {/* Accessible Tap Step Controls for Selected Block */}
        {selectedBlock && (
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-[11px] text-slate-400 mr-1">
              {selectedBlock.isKey ? 'Jade Key:' : 'Selected Stone:'}
            </span>
            {selectedBlock.orientation === 'h' ? (
              <>
                <button
                  type="button"
                  onClick={() => applyMove(selectedBlock.id, -1)}
                  disabled={selectedBounds.minDelta >= 0 || isSolved}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 cursor-pointer"
                  aria-label="Slide left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyMove(selectedBlock.id, 1)}
                  disabled={selectedBounds.maxDelta <= 0 || isSolved}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 cursor-pointer"
                  aria-label="Slide right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => applyMove(selectedBlock.id, -1)}
                  disabled={selectedBounds.minDelta >= 0 || isSolved}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 cursor-pointer"
                  aria-label="Slide up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyMove(selectedBlock.id, 1)}
                  disabled={selectedBounds.maxDelta <= 0 || isSolved}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 cursor-pointer"
                  aria-label="Slide down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
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
          <h4 className="text-xl font-bold text-white mb-1">{config.name} Cleared!</h4>
          <p className="text-xs text-slate-300 max-w-sm mb-4">
            Jade block guided smoothly to the exit in {moveCount} moves. Next up:{' '}
            <span className="text-teal-300 font-semibold">
              Level {level + 1} ({nextConfig.name.replace(/^Level \d+:\s*/, '')} • {nextTier.tierName})
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
