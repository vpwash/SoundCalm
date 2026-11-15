import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine.ts';

interface PanicButtonProps {
  onPanicTriggered: () => void;
  size?: 'normal' | 'compact';
}

export const PanicButton: React.FC<PanicButtonProps> = ({
  onPanicTriggered,
  size = 'normal',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Sub-10ms instantaneous mute execution
    audioEngine.triggerPanicMute();
    onPanicTriggered();
  };

  if (size === 'compact') {
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-950/40 border border-rose-400/50 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-400"
        aria-label="Instant Panic Stop: Mute Trigger Immediately"
      >
        <ShieldAlert className="w-3.5 h-3.5 fill-white/20" />
        <span>Panic Mute</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="group relative flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-bold text-sm shadow-xl shadow-rose-950/60 border-2 border-rose-400/60 transition-all focus:outline-none focus:ring-4 focus:ring-rose-500/40"
      aria-label="Panic Button - Instant Sound Mute"
      title="One-Tap Instant Panic Button (Zero Latency Mute)"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 group-hover:bg-white/30 transition">
        <ShieldAlert className="w-4 h-4 fill-white text-rose-100" />
      </div>
      <div className="flex flex-col text-left">
        <span className="leading-tight tracking-wide uppercase text-xs font-black">PANIC STOP</span>
        <span className="text-[10px] text-rose-200 font-normal leading-tight">Instant Mute & Breathe</span>
      </div>
    </button>
  );
};
