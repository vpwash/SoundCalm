import React, { useState, useEffect } from 'react';
import { Wand2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import {
  generateMandalaLevel,
  getMasteryTier,
  cycleMandalaPetal,
  checkMandalaSolved,
  applyMandalaHint,
} from '../../utils/puzzles.ts';
import { audioEngine } from '../../audio/AudioEngine.ts';

interface MandalaSymmetryGameProps {
  level: number;
  onLevelComplete: (stars: number) => void;
  onLevelChange: (newLevel: number) => void;
  resetSignal: number;
  onHeaderUpdate?: (title: string, subtitle: string) => void;
}

export const MandalaSymmetryGame: React.FC<MandalaSymmetryGameProps> = ({
  level,
  onLevelComplete,
  onLevelChange,
  resetSignal,
  onHeaderUpdate,
}) => {
  const pattern = generateMandalaLevel(level);
  const tier = getMasteryTier(level);
  const nextTier = getMasteryTier(level + 1);
  const nextPattern = generateMandalaLevel(level + 1);

  const [grid, setGrid] = useState<number[][]>(() =>
    pattern.initialGrid.map((r) => [...r])
  );
  const [autoMirror, setAutoMirror] = useState(true);
  const [isSolved, setIsSolved] = useState(false);

  useEffect(() => {
    const freshPattern = generateMandalaLevel(level);
    setGrid(freshPattern.initialGrid.map((r) => [...r]));
    setIsSolved(false);
    onHeaderUpdate?.(freshPattern.name, freshPattern.theme);
  }, [level, resetSignal]);

  const totalPetals = pattern.rings * pattern.sectors;
  let matchingPetals = 0;
  for (let r = 0; r < pattern.rings; r++) {
    for (let s = 0; s < pattern.sectors; s++) {
      if (grid[r]?.[s] === pattern.targetGrid[r]?.[s]) matchingPetals++;
    }
  }

  const verifyCompletion = (updated: number[][]) => {
    if (!isSolved && checkMandalaSolved(updated, pattern.targetGrid)) {
      setIsSolved(true);
      audioEngine.playCompletionChord();
      onLevelComplete(tier.starsReward);
    }
  };

  const handlePetalClick = (ring: number, sector: number) => {
    if (isSolved) return;
    const updated = cycleMandalaPetal(
      grid,
      ring,
      sector,
      pattern.palette.length,
      autoMirror
    );
    setGrid(updated);
    audioEngine.playHarmonicChime(ring * 3 + (sector % 5));
    verifyCompletion(updated);
  };

  const handleHint = () => {
    if (isSolved) return;
    const updated = applyMandalaHint(grid, pattern.targetGrid);
    setGrid(updated);
    audioEngine.playHarmonicChime(5);
    verifyCompletion(updated);
  };

  const getRingBounds = (ringIdx: number, totalRings: number): [number, number] => {
    if (totalRings === 2) {
      return ringIdx === 0 ? [18, 48] : [52, 86];
    }
    if (ringIdx === 0) return [16, 38];
    if (ringIdx === 1) return [41, 63];
    return [66, 88];
  };

  const buildPetalPath = (ringIdx: number, sectorIdx: number, totalRings: number, totalSectors: number) => {
    const cx = 100;
    const cy = 100;
    const [rInner, rOuter] = getRingBounds(ringIdx, totalRings);
    const stepDeg = 360 / totalSectors;
    const padDeg = totalSectors >= 12 ? 1.5 : 2;
    const startAngle = (sectorIdx * stepDeg - 90 - stepDeg / 2 + padDeg) * (Math.PI / 180);
    const endAngle = ((sectorIdx + 1) * stepDeg - 90 - stepDeg / 2 - padDeg) * (Math.PI / 180);
    const midAngle = (startAngle + endAngle) / 2;

    const x1 = cx + rInner * Math.cos(startAngle);
    const y1 = cy + rInner * Math.sin(startAngle);
    const x2 = cx + rOuter * Math.cos(startAngle);
    const y2 = cy + rOuter * Math.sin(startAngle);
    const xTip = cx + (rOuter + 6) * Math.cos(midAngle);
    const yTip = cy + (rOuter + 6) * Math.sin(midAngle);
    const x3 = cx + rOuter * Math.cos(endAngle);
    const y3 = cy + rOuter * Math.sin(endAngle);
    const x4 = cx + rInner * Math.cos(endAngle);
    const y4 = cy + rInner * Math.sin(endAngle);

    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} Q ${xTip.toFixed(1)} ${yTip.toFixed(1)} ${x3.toFixed(1)} ${y3.toFixed(1)} L ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
  };

  return (
    <div className="relative w-full min-h-[390px] sm:min-h-[440px] h-full flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden">
      {/* Top Progressive Level & Mastery Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 z-10 bg-slate-900/80 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-700/70">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => level > 1 && onLevelChange(level - 1)}
            disabled={level <= 1}
            aria-label="Previous Mandala Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-teal-300 tracking-wide">
            <span className="hidden sm:inline">{tier.tierBadge} • </span>Lvl {level} ({pattern.rings}R×{pattern.sectors}P)
          </span>
          <button
            onClick={() => onLevelChange(level + 1)}
            aria-label="Next Mandala Level"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setAutoMirror(!autoMirror)}
            className={`min-h-[32px] px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all cursor-pointer ${
              autoMirror
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Mirror: {autoMirror ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={handleHint}
            disabled={isSolved}
            className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition-all cursor-pointer disabled:opacity-40"
            title="Harmonize one symmetric pair of mandala petals"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Harmonic Hint</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Mandala + Target Blueprint */}
      <div className="relative flex-1 min-h-[260px] sm:min-h-[290px] my-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
        {/* Interactive SVG Mandala */}
        <div className="relative w-44 h-44 sm:w-64 sm:h-64 flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg">
            <circle cx="100" cy="100" r="94" fill="#090D16" stroke="#1E293B" strokeWidth="2" />
            {Array.from({ length: pattern.rings }).map((_, ringIdx) =>
              Array.from({ length: pattern.sectors }).map((__, sectorIdx) => {
                const colorIdx = grid[ringIdx]?.[sectorIdx] ?? 0;
                const targetColorIdx = pattern.targetGrid[ringIdx]?.[sectorIdx] ?? 1;
                const isMatched = colorIdx === targetColorIdx;
                const fillHex = pattern.palette[colorIdx] || pattern.palette[0];

                return (
                  <path
                    key={`petal-${ringIdx}-${sectorIdx}`}
                    d={buildPetalPath(ringIdx, sectorIdx, pattern.rings, pattern.sectors)}
                    fill={fillHex}
                    stroke={isMatched ? '#5EEAD4' : '#475569'}
                    strokeWidth={isMatched ? '2' : '1.2'}
                    onClick={() => handlePetalClick(ringIdx, sectorIdx)}
                    role="button"
                    aria-label={`Mandala Ring ${ringIdx + 1} Petal ${sectorIdx + 1}`}
                    className="cursor-pointer transition-colors duration-200 hover:opacity-90"
                  />
                );
              })
            )}
            <circle cx="100" cy="100" r="12" fill="#2DD4BF" stroke="#0F172A" strokeWidth="3" />
          </svg>
        </div>

        {/* Target Mandala Blueprint & Ring Guide */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 sm:p-3 flex sm:flex-col items-center gap-3 w-full sm:w-auto max-w-xs">
          <div className="w-16 h-16 sm:w-24 sm:h-24 shrink-0">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <circle cx="100" cy="100" r="94" fill="#090D16" stroke="#334155" strokeWidth="2" />
              {Array.from({ length: pattern.rings }).map((_, ringIdx) =>
                Array.from({ length: pattern.sectors }).map((__, sectorIdx) => {
                  const targetColorIdx = pattern.targetGrid[ringIdx]?.[sectorIdx] ?? 1;
                  return (
                    <path
                      key={`target-${ringIdx}-${sectorIdx}`}
                      d={buildPetalPath(ringIdx, sectorIdx, pattern.rings, pattern.sectors)}
                      fill={pattern.palette[targetColorIdx]}
                      stroke="#1E293B"
                      strokeWidth="1"
                    />
                  );
                })
              )}
              <circle cx="100" cy="100" r="12" fill="#2DD4BF" />
            </svg>
          </div>
          <div className="text-left sm:text-center min-w-0">
            <p className="text-xs font-bold text-slate-200">
              Target Blueprint ({matchingPetals}/{totalPetals})
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tap petals to cycle colors until your mandala matches the blueprint.
            </p>
            <div className="flex items-center sm:justify-center gap-1.5 mt-1.5 sm:mt-2">
              {pattern.palette.map((hex, idx) => (
                <div
                  key={idx}
                  style={{ backgroundColor: hex }}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border border-white/30"
                  title={idx === 0 ? 'Unpainted Slate' : `Tone ${idx}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Guidance Bar */}
      <div className="flex items-center justify-between gap-2 bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/70 text-[11px] text-slate-400">
        <span>Glowing Teal Border = Petal Matches Target Blueprint</span>
        <span className="text-teal-300 font-semibold">
          {matchingPetals} / {totalPetals} Petals Harmonized
        </span>
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
          <h4 className="text-xl font-bold text-white mb-1">{pattern.name} Complete!</h4>
          <p className="text-xs text-slate-300 max-w-sm mb-4">
            Radial symmetry achieved. Next up:{' '}
            <span className="text-teal-300 font-semibold">
              Level {level + 1} ({nextPattern.rings} Rings × {nextPattern.sectors} Petals • {nextTier.tierName})
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
