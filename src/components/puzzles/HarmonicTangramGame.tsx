import React, { useState, useEffect } from 'react';
import { RotateCw, Sparkles, CheckCircle2, Wand2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import {
  generateTangramLevel,
  getMasteryTier,
  TangramPiece,
  rotateTangramPiece,
  placeTangramPiece,
  isTangramPieceAligned,
  checkTangramSolved,
  applyTangramHint,
} from '../../utils/puzzles.ts';
import { audioEngine } from '../../audio/AudioEngine.ts';

interface HarmonicTangramGameProps {
  level: number;
  onLevelComplete: (stars: number) => void;
  onLevelChange: (newLevel: number) => void;
  resetSignal: number;
  onHeaderUpdate?: (title: string, subtitle: string) => void;
}

export const HarmonicTangramGame: React.FC<HarmonicTangramGameProps> = ({
  level,
  onLevelComplete,
  onLevelChange,
  resetSignal,
  onHeaderUpdate,
}) => {
  const puzzle = generateTangramLevel(level);
  const tier = getMasteryTier(level);
  const nextTier = getMasteryTier(level + 1);

  const [pieces, setPieces] = useState<TangramPiece[]>(() =>
    puzzle.pieces.map((p) => ({ ...p }))
  );
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(
    puzzle.pieces.find((p) => !isTangramPieceAligned(p))?.id || puzzle.pieces[0]?.id || null
  );
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    const freshPuzzle = generateTangramLevel(level);
    const fresh = freshPuzzle.pieces.map((p) => ({ ...p }));
    setPieces(fresh);
    setSelectedPieceId(
      fresh.find((p) => !isTangramPieceAligned(p))?.id || fresh[0]?.id || null
    );
    setIsSolved(false);
    onHeaderUpdate?.(freshPuzzle.name, freshPuzzle.theme);
  }, [level, resetSignal]);

  const alignedCount = pieces.filter(isTangramPieceAligned).length;
  const selectedPiece = pieces.find((p) => p.id === selectedPieceId) || null;

  const verifyCompletion = (updated: TangramPiece[]) => {
    if (!isSolved && checkTangramSolved(updated)) {
      setIsSolved(true);
      audioEngine.playCompletionChord();
      onLevelComplete(tier.starsReward);
    }
  };

  const handleSelectPiece = (pieceId: string) => {
    setSelectedPieceId(pieceId);
    audioEngine.playHarmonicChime(1);
  };

  const handleRotateSelected = () => {
    if (!selectedPieceId || isSolved) return;
    const updated = pieces.map((p) =>
      p.id === selectedPieceId ? rotateTangramPiece(p) : p
    );
    setPieces(updated);
    audioEngine.playHarmonicChime(2);
    verifyCompletion(updated);
  };

  const handleSlotClick = (slotId: string) => {
    if (isSolved) return;
    const occupant = pieces.find((p) => p.currentSlotId === slotId);

    if (occupant && occupant.id === selectedPieceId) {
      const updated = pieces.map((p) =>
        p.id === occupant.id ? rotateTangramPiece(p) : p
      );
      setPieces(updated);
      audioEngine.playHarmonicChime(3);
      verifyCompletion(updated);
      return;
    }

    if (selectedPieceId) {
      const updated = placeTangramPiece(pieces, selectedPieceId, slotId);
      setPieces(updated);
      audioEngine.playHarmonicChime(4);
      verifyCompletion(updated);
    } else if (occupant) {
      setSelectedPieceId(occupant.id);
      audioEngine.playHarmonicChime(1);
    }
  };

  const handleHint = () => {
    if (isSolved) return;
    const updated = applyTangramHint(pieces);
    setPieces(updated);
    const nextUnaligned = updated.find((p) => !isTangramPieceAligned(p));
    setSelectedPieceId(nextUnaligned?.id || null);
    audioEngine.playHarmonicChime(5);
    verifyCompletion(updated);
  };

  const renderShapeSvg = (shape: TangramPiece['shape'], color: string, rotation: number, aligned: boolean) => {
    let points = '50,12 88,84 12,84';
    if (shape === 'triangle-lg') points = '50,10 90,86 10,86';
    else if (shape === 'triangle-md') points = '50,16 84,82 16,82';
    else if (shape === 'triangle-sm') points = '50,22 78,78 22,78';
    else if (shape === 'square') points = '50,14 86,50 50,86 14,50';
    else if (shape === 'rhombus') points = '35,18 85,18 65,82 15,82';

    return (
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full transition-transform duration-300 ease-out drop-shadow-md"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <polygon
          points={points}
          fill={color}
          fillOpacity={aligned ? 0.92 : 0.72}
          stroke={aligned ? '#FEF08A' : '#E2E8F0'}
          strokeWidth={aligned ? 4 : 2.5}
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="relative w-full min-h-[410px] sm:min-h-[440px] h-full flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden">
      {/* Top Progressive Level & Mastery Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 z-10 bg-slate-900/80 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-700/70">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => level > 1 && onLevelChange(level - 1)}
            disabled={level <= 1}
            aria-label="Previous Tangram Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-teal-300 tracking-wide">
            {tier.tierBadge} • Lvl {level}
          </span>
          <button
            onClick={() => onLevelChange(level + 1)}
            aria-label="Next Tangram Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] sm:text-xs font-semibold text-sky-300 bg-sky-500/10 px-2 py-1 rounded-lg border border-sky-500/20">
            {alignedCount}/{pieces.length} Aligned
          </span>
          <button
            onClick={handleHint}
            disabled={isSolved}
            className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition-all cursor-pointer disabled:opacity-40"
            title="Gently align one crystal with a 432 Hz chime"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Harmonic Hint</span>
          </button>
        </div>
      </div>

      {/* Main Sacred Silhouette Board */}
      <div className="relative flex-1 min-h-[250px] sm:min-h-[280px] my-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 overflow-hidden flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" viewBox="0 0 100 100" preserveAspectRatio="none">
          {puzzle.slots.map((slot, i) => {
            const next = puzzle.slots[(i + 1) % puzzle.slots.length];
            return (
              <line
                key={slot.id}
                x1={slot.x}
                y1={slot.y}
                x2={next.x}
                y2={next.y}
                stroke="#38BDF8"
                strokeWidth="0.6"
                strokeDasharray="2 2"
              />
            );
          })}
        </svg>

        {puzzle.slots.map((slot) => {
          const occupant = pieces.find((p) => p.currentSlotId === slot.id);
          const targetPiece = pieces.find((p) => p.targetSlotId === slot.id);
          const isAligned = occupant ? isTangramPieceAligned(occupant) : false;
          const isSelectedOccupant = occupant && occupant.id === selectedPieceId;
          const slotSize =
            pieces.length >= 6
              ? 'w-14 h-14 sm:w-20 sm:h-20'
              : 'w-16 h-16 sm:w-24 sm:h-24';

          return (
            <button
              key={slot.id}
              onClick={() => handleSlotClick(slot.id)}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              aria-label={`Slot ${slot.label}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${slotSize} rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                isAligned
                  ? 'bg-teal-500/15 border-2 border-teal-400/70 shadow-lg shadow-teal-500/10'
                  : isSelectedOccupant
                  ? 'bg-sky-500/20 border-2 border-sky-400 shadow-lg shadow-sky-500/20'
                  : 'bg-slate-900/70 hover:bg-slate-800/80 border-2 border-dashed border-slate-600/80'
              }`}
            >
              {occupant ? (
                <div className="w-9 h-9 sm:w-14 sm:h-14 relative">
                  {renderShapeSvg(occupant.shape, occupant.color, occupant.currentRotation, isAligned)}
                  {isAligned && (
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-300 absolute -top-1 -right-1 bg-slate-950 rounded-full" />
                  )}
                </div>
              ) : (
                <div className="w-8 h-8 sm:w-12 sm:h-12 opacity-25 pointer-events-none">
                  {targetPiece && renderShapeSvg(targetPiece.shape, '#94A3B8', targetPiece.targetRotation, false)}
                </div>
              )}
              <span className="text-[9px] sm:text-[10px] font-medium text-slate-300 mt-0.5 truncate max-w-[92%]">
                {slot.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Crystal Tray & Rotation Control */}
      <div className="flex flex-wrap items-center justify-between gap-2 z-10 bg-slate-900/90 backdrop-blur-md p-2 sm:p-2.5 rounded-xl border border-slate-700/70">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          {pieces.map((piece) => {
            const aligned = isTangramPieceAligned(piece);
            const selected = piece.id === selectedPieceId;
            return (
              <button
                key={piece.id}
                onClick={() => handleSelectPiece(piece.id)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  selected
                    ? 'bg-sky-500/20 border-sky-400 text-white shadow-sm'
                    : aligned
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="w-5 h-5 shrink-0">
                  {renderShapeSvg(piece.shape, piece.color, piece.currentRotation, aligned)}
                </div>
                <span className="hidden md:inline">{piece.name}</span>
                {aligned && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleRotateSelected}
          disabled={!selectedPiece || isSolved}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-40 text-indigo-200 border border-indigo-400/30 text-xs font-semibold transition-all cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Rotate 90° ({selectedPiece ? `${selectedPiece.currentRotation}°` : '0°'})
        </button>
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
          <h4 className="text-xl font-bold text-white mb-1">{puzzle.name} Complete!</h4>
          <p className="text-xs text-slate-300 max-w-sm mb-4">
            Every crystal resonates in 432 Hz symmetry. Ready for{' '}
            <span className="text-teal-300 font-semibold">Level {level + 1} ({nextTier.tierName})</span> with{' '}
            {generateTangramLevel(level + 1).pieces.length} harmonic crystals?
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
