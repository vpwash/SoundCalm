import React, { useEffect, useState } from 'react';
import { Heart, Sparkles, Check } from 'lucide-react';

interface BreathingFlowerProps {
  onDismiss: () => void;
}

type BreathPhase = 'inhale' | 'hold' | 'exhale';

export const BreathingFlower: React.FC<BreathingFlowerProps> = ({ onDismiss }) => {
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [cycleCount, setCycleCount] = useState(0);

  useEffect(() => {
    let currentPhase: BreathPhase = 'inhale';
    let count = 4;
    setSecondsLeft(4);

    const interval = window.setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (currentPhase === 'inhale') {
          currentPhase = 'hold';
          count = 4;
        } else if (currentPhase === 'hold') {
          currentPhase = 'exhale';
          count = 6;
        } else {
          currentPhase = 'inhale';
          count = 4;
          setCycleCount((c) => c + 1);
        }
        setPhase(currentPhase);
      }
      setSecondsLeft(count);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getPhaseInstruction = () => {
    switch (phase) {
      case 'inhale':
        return { title: 'Breathe In Gently', subtitle: 'Feel your lungs expand with cool, fresh calm', scale: 'scale-125' };
      case 'hold':
        return { title: 'Hold Peacefully', subtitle: 'Rest in this gentle stillness', scale: 'scale-125' };
      case 'exhale':
        return { title: 'Slowly Release', subtitle: 'Blow all the tension out like a gentle breeze', scale: 'scale-90' };
    }
  };

  const instruction = getPhaseInstruction();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Calm Down Breathing Circle"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-300"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900/90 border border-teal-500/30 p-8 shadow-2xl flex flex-col items-center text-center">
        {/* Soft Shield Indicator */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold mb-4 border border-rose-500/30">
          <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400 animate-pulse" />
          <span>Panic Activated — Trigger Muted Instantly</span>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-wide">
          {instruction.title}
        </h2>
        <p className="text-sm text-slate-300 mt-1 max-w-xs">
          {instruction.subtitle}
        </p>

        {/* Dynamic Expanding/Contracting Breathing Petals Visual */}
        <div className="relative my-8 flex items-center justify-center w-56 h-56">
          {/* Outer halo */}
          <div
            className={`absolute inset-0 rounded-full bg-teal-500/10 blur-xl transition-all duration-1000 ${
              phase === 'inhale' || phase === 'hold' ? 'scale-150 opacity-100' : 'scale-95 opacity-40'
            }`}
          />

          {/* Calming Geometric Flower Petals */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <div
              key={deg}
              style={{ transform: `rotate(${deg}deg)` }}
              className={`absolute w-14 h-32 rounded-full bg-gradient-to-t from-teal-500/20 to-sky-400/40 border border-teal-300/30 transition-transform duration-1000 ${
                phase === 'inhale' || phase === 'hold' ? 'scale-110' : 'scale-75'
              }`}
            />
          ))}

          {/* Center Pulsing Orb with Countdown */}
          <div className="relative z-10 flex flex-col items-center justify-center w-28 h-28 rounded-full bg-slate-900 border-2 border-teal-400/60 shadow-inner">
            <span className="text-3xl font-extrabold text-teal-200 tabular-nums">
              {secondsLeft}s
            </span>
            <span className="text-[11px] uppercase tracking-wider text-teal-400 font-semibold">
              {phase}
            </span>
          </div>
        </div>

        {/* Breathing Progress Info */}
        <div className="text-xs text-slate-400 mb-6 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>
            {cycleCount === 0
              ? 'Take your time. You are completely safe and in control.'
              : `Completed ${cycleCount} deep calming breath cycles.`}
          </span>
        </div>

        {/* Return Button */}
        <button
          onClick={onDismiss}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-500 py-3.5 px-6 font-semibold text-white shadow-lg shadow-teal-900/30 transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <Check className="w-4 h-4" />
          <span>I Feel Safe & Ready to Continue</span>
        </button>
      </div>
    </div>
  );
};
