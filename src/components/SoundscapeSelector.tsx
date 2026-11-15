import React, { useEffect, useState } from 'react';
import {
  SOUNDSCAPE_OPTIONS,
  SoundscapeType,
  MusicRotationStatus,
  audioEngine,
} from '../audio/AudioEngine.ts';
import {
  Volume2,
  VolumeX,
  Music,
  Waves,
  ChevronDown,
  ChevronUp,
  Square,
  Play,
  Shuffle,
  SkipForward,
  Headphones,
  Info,
} from 'lucide-react';

interface SoundscapeSelectorProps {
  currentSoundscape: SoundscapeType;
  volume: number;
  isPlaying: boolean;
  rotationStatus: MusicRotationStatus;
  externalMusicMode: boolean;
  onSelectSoundscape: (type: SoundscapeType) => void;
  onVolumeChange: (vol: number) => void;
  onTogglePlay: () => void;
  onToggleAutoRotate: () => void;
  onNextRandomMusic: () => void;
  onToggleExternalMusicMode: (enabled: boolean) => void;
}

function formatCountdown(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const SoundscapeSelector: React.FC<SoundscapeSelectorProps> = ({
  currentSoundscape,
  volume,
  isPlaying,
  rotationStatus,
  externalMusicMode,
  onSelectSoundscape,
  onVolumeChange,
  onTogglePlay,
  onToggleAutoRotate,
  onNextRandomMusic,
  onToggleExternalMusicMode,
}) => {
  const [activeHarmonyLabel, setActiveHarmonyLabel] = useState<string>('Harmonic Sanctuary');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = audioEngine.onChordChange((chordName) => {
      setActiveHarmonyLabel(chordName);
    });
    return unsubscribe;
  }, []);

  const spaMusicOptions = SOUNDSCAPE_OPTIONS.filter((o) => o.category === 'spa_music');
  const natureOptions = SOUNDSCAPE_OPTIONS.filter((o) => o.category === 'nature_masking');
  const activeOption = SOUNDSCAPE_OPTIONS.find((o) => o.id === currentSoundscape);

  return (
    <div className="rounded-2xl bg-slate-900/85 border border-slate-800 px-3.5 py-2.5 sm:px-4 sm:py-3 text-slate-200 space-y-3">
      {/* Compact Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs sm:text-sm font-semibold text-white truncate">
            Channel A:
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer truncate max-w-[220px] sm:max-w-none"
            title="Click to browse or change Channel A music and nature soundscapes"
          >
            <span>{externalMusicMode && !isPlaying ? '🎧' : activeOption?.icon || '🪷'}</span>
            <span className="truncate">
              {externalMusicMode && !isPlaying
                ? 'External Music App'
                : activeOption?.name || 'Soundscape'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-teal-400 shrink-0 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
          <span
            className={`hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${
              externalMusicMode && !isPlaying
                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                : isPlaying
                  ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {externalMusicMode && !isPlaying
              ? 'Spotify / External Audio Active'
              : isPlaying
                ? activeHarmonyLabel
                : 'Stopped (Silent)'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* External Music Mode (Spotify / Amazon Music / etc.) Toggle */}
          <button
            type="button"
            onClick={() => onToggleExternalMusicMode(!externalMusicMode)}
            aria-pressed={externalMusicMode}
            aria-label="Toggle External App Music Mode for Spotify, Amazon Music, or YouTube Music"
            title="Keep your own music app (Spotify, Amazon Music, Apple Music, etc.) playing in the background while SoundCalm plays puzzle chimes and trigger clips on top"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
              externalMusicMode
                ? 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-400/50 text-indigo-200 shadow-sm'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
            <span>{externalMusicMode ? 'My Music App: On' : 'Use My Own Music App'}</span>
          </button>

          {/* Auto-Mix 3m Crossfade Toggle */}
          {!externalMusicMode && (
            <>
              <button
                type="button"
                onClick={onToggleAutoRotate}
                aria-pressed={rotationStatus.autoRotateEnabled}
                aria-label="Toggle 3-minute automatic music crossfade"
                title="Automatically fades into a new randomly selected music piece every 3 minutes"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                  rotationStatus.autoRotateEnabled
                    ? 'bg-teal-500/15 hover:bg-teal-500/25 border-teal-500/35 text-teal-200'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-400'
                }`}
              >
                <Shuffle className="w-3 h-3 shrink-0" />
                <span>
                  {rotationStatus.autoRotateEnabled
                    ? rotationStatus.isRotatingMusicActive
                      ? `Auto-Mix 3m • ${formatCountdown(rotationStatus.secondsUntilNextTrack)}`
                      : 'Auto-Mix 3m'
                    : 'Auto-Mix Off'}
                </span>
              </button>

              {/* Next Random Piece (Crossfade) */}
              <button
                type="button"
                onClick={onNextRandomMusic}
                aria-label="Fade to next random music piece"
                title="Smoothly crossfade to another random music piece"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-200 whitespace-nowrap transition cursor-pointer"
              >
                <SkipForward className="w-3 h-3 text-teal-300 shrink-0" />
                <span>Next</span>
              </button>
            </>
          )}

          {/* Stop / Play Audio Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Stop Music and Ambient Noise' : 'Play Music and Ambient Noise'}
            aria-pressed={isPlaying}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              isPlaying
                ? 'bg-rose-600/20 hover:bg-rose-600/30 border-rose-500/40 text-rose-200'
                : 'bg-teal-600 hover:bg-teal-500 border-teal-400 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-3 h-3 fill-current shrink-0" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-white shrink-0" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Compact Inline Volume Control */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-2.5 py-1 rounded-xl">
            {isPlaying && volume > 0 ? (
              <Volume2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-16 sm:w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
              aria-label="Channel A Soundscape Volume"
            />
            <span className="text-[11px] text-slate-300 font-mono tabular-nums w-8 text-right">
              {isPlaying ? `${Math.round(volume * 100)}%` : 'Off'}
            </span>
          </div>

          {/* Universal Expand/Collapse Soundscape Picker Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-teal-300 cursor-pointer ml-auto sm:ml-0"
            aria-expanded={isExpanded}
            aria-label="Toggle Channel A soundscape options"
          >
            <span>{isExpanded ? 'Hide Sounds' : `Sounds (${SOUNDSCAPE_OPTIONS.length})`}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Drawer: External Music Banner + Full Categorized Soundscape Grid */}
      {isExpanded && (
        <div className="pt-2 border-t border-slate-800/80 space-y-3.5 animate-in fade-in">
          {/* External App Music Mode Banner */}
          {externalMusicMode && (
            <div className="p-2.5 sm:p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-2.5 text-xs text-indigo-100">
              <Info className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-indigo-200">
                  External Music Mode Active — Built-in Spa Music is muted so your background app (Spotify, Amazon Music, YouTube Music, etc.) plays uninterrupted.
                </p>
                <p className="text-[11px] text-slate-300">
                  Puzzle chimes (Channel B) and scheduled trigger micro-clips (Channel C) mix cleanly on top of your music. You can also tap any <strong className="text-sky-300">Nature Masking Bed</strong> below to layer gentle rain or pink noise underneath your song.{' '}
                  <span className="text-slate-400">
                    (Tip: On iPhone/iPad, keep the Silent Mode switch off so Safari allows ambient audio mixing.)
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Group 1: Generative Spa, Jazz & Acoustic Music */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-300">
                <Music className="w-3.5 h-3.5 shrink-0" />
                <span>Relaxing Instrumental Music (Spa, Jazz & Acoustic)</span>
              </span>
              {activeOption && (
                <span className="text-[11px] text-slate-400 hidden md:inline truncate">
                  {activeOption.description}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {spaMusicOptions.map((opt) => {
                const isSelected = opt.id === currentSoundscape;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onSelectSoundscape(opt.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-950/70 border-teal-400 text-white shadow-sm ring-1 ring-teal-400/30'
                        : 'bg-slate-800/45 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="text-xl sm:text-2xl shrink-0">{opt.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">{opt.name}</div>
                      <div className="text-[10px] text-teal-300/80 truncate mt-0.5">{opt.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group 2: Ambient Nature & Acoustic Masking */}
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              <Waves className="w-3.5 h-3.5 shrink-0" />
              <span>Pure Nature & Acoustic Masking Beds</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {natureOptions.map((opt) => {
                const isSelected = opt.id === currentSoundscape;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onSelectSoundscape(opt.id)}
                    className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-950/60 border-teal-400 text-white shadow-sm ring-1 ring-teal-400/30'
                        : 'bg-slate-800/35 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="text-lg mb-0.5">{opt.icon}</span>
                    <span className="text-xs font-semibold leading-tight line-clamp-1">{opt.name}</span>
                    <span className="text-[10px] text-slate-400 line-clamp-1">{opt.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
