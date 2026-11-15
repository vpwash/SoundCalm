import React, { useState } from 'react';
import { SUDS_ANCHORS, getNearestSudsAnchor } from '../utils/clinical.ts';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface SudsModalProps {
  type: 'pre' | 'post';
  initialScore?: number;
  triggerName?: string;
  onSubmit: (score: number) => void;
}

export const SudsModal: React.FC<SudsModalProps> = ({
  type,
  initialScore = 2,
  triggerName,
  onSubmit,
}) => {
  const [score, setScore] = useState<number>(initialScore);
  const activeAnchor = getNearestSudsAnchor(score);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={type === 'pre' ? 'Pre-Session Check-in' : 'Post-Session Reflection'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in"
    >
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-700/80 p-5 sm:p-6 md:p-8 shadow-2xl text-slate-100 flex flex-col items-center text-center">
        {/* Header Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-300 text-xs font-semibold mb-2.5 border border-teal-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{type === 'pre' ? 'Pre-Session Check-In' : 'Session Completed!'}</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white">
          {type === 'pre'
            ? 'How are you feeling right now?'
            : 'How do you feel after playing?'}
        </h2>

        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-sm">
          {type === 'pre'
            ? `Before we start your calming puzzle and gentle ${triggerName ? `exposure to "${triggerName}"` : 'soundscape'}, let's check in.`
            : `Reflect on your feelings right now. Notice your body, breathing, and comfort level.`}
        </p>

        {/* Big Visual Anchor Card */}
        <div
          className="w-full my-4 sm:my-6 p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col items-center bg-slate-800/60"
          style={{ borderColor: `${activeAnchor.color}60` }}
        >
          <div className="text-5xl my-1 animate-bounce duration-1000">
            {activeAnchor.emoji}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-xl font-bold"
              style={{ color: activeAnchor.color }}
            >
              Level {score}: {activeAnchor.label}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xs">
            {activeAnchor.description}
          </p>
        </div>

        {/* SUDS 0-10 Slider */}
        <div className="w-full space-y-3 px-2">
          <div className="flex justify-between text-xs font-semibold text-slate-400">
            <span className="text-sky-300">0 (Relaxed)</span>
            <span className="text-amber-300">5 (Mild)</span>
            <span className="text-rose-400">10 (Overwhelmed)</span>
          </div>

          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
            aria-label="Distress scale slider from 0 to 10"
          />

          {/* Quick anchor buttons for fast tapping */}
          <div className="grid grid-cols-6 gap-1 pt-2">
            {SUDS_ANCHORS.map((anchor) => (
              <button
                key={anchor.score}
                onClick={() => setScore(anchor.score)}
                className={`flex flex-col items-center py-1.5 px-1 rounded-xl text-xs transition border ${
                  Math.abs(score - anchor.score) <= 1
                    ? 'bg-slate-700/80 border-teal-400 text-white font-bold'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-base">{anchor.emoji}</span>
                <span className="text-[10px] mt-0.5">{anchor.score}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onSubmit(score)}
          className="mt-7 w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-500 py-3.5 px-6 font-semibold text-white shadow-lg shadow-teal-900/30 transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {type === 'pre' ? (
            <>
              <span>Begin Calming Session</span>
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Save & View Results</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
