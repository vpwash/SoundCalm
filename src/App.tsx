/**
 * SoundCalm - Misophonia Sound Therapy PWA (Neuro-Acoustic Habituation Platform)
 * Full Clinical & Web Audio Architecture implementation.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  audioEngine,
  SoundscapeType,
  MusicRotationStatus,
  BUILTIN_TRIGGERS,
} from './audio/AudioEngine.ts';
import {
  ParentSettings,
  SessionLog,
} from './types.ts';
import {
  calculateDeltaSuds,
  calculateNormalizationMultiplier,
  calculateTargetSessionMinutes,
} from './utils/clinical.ts';
import {
  getParentSettings,
  saveSessionLog,
  getAllSessionLogs,
  getAllCustomAudioRecords,
  saveCustomAudioTrack,
  renameCustomAudioRecord,
  reconstructAudioBufferFromRecord,
  DEFAULT_PARENT_SETTINGS,
} from './utils/storage.ts';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { BreathingFlower } from './components/BreathingFlower.tsx';
import { PanicButton } from './components/PanicButton.tsx';
import { SudsModal } from './components/SudsModal.tsx';
import { SoundscapeSelector } from './components/SoundscapeSelector.tsx';
import { TriggerStudio } from './components/TriggerStudio.tsx';
import { ConstellationGame } from './components/ConstellationGame.tsx';
import { ParentPortal } from './components/ParentPortal.tsx';
import { SettingsMenu } from './components/SettingsMenu.tsx';
import { SudsHistoryChart } from './components/SudsHistoryChart.tsx';
import { useDailyReminder } from './hooks/useDailyReminder.ts';
import {
  ThemeId,
  getStoredThemeId,
  saveStoredThemeId,
  applyThemeToDocument,
} from './utils/themes.ts';
import {
  Sparkles,
  Lock,
  Headphones,
  Sliders,
  Play,
  Volume2,
  CheckCircle2,
  Settings,
  TrendingDown,
  Bell,
} from 'lucide-react';

export default function App() {
  // Splash & Audio Context State
  const [hasStarted, setHasStarted] = useState(false);
  const hasStartedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'therapy' | 'studio'>('therapy');
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>(() => getStoredThemeId());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Audio Engine Settings (default randomly picked by AudioEngine on boot)
  const [currentSoundscape, setCurrentSoundscape] = useState<SoundscapeType>(() =>
    audioEngine.getCurrentSoundscape()
  );
  const [soundscapeVolume, setSoundscapeVolume] = useState<number>(0.75);
  const [isSoundscapePlaying, setIsSoundscapePlaying] = useState<boolean>(false);
  const [musicRotationStatus, setMusicRotationStatus] = useState<MusicRotationStatus>(() =>
    audioEngine.getMusicRotationStatus()
  );
  const isSoundscapeEnabledRef = useRef<boolean>(true);
  const [activeTriggerId, setActiveTriggerId] = useState<string>('');
  const [activeTriggerName, setActiveTriggerName] = useState<string>('No Clip Loaded');
  const [customAudioBuffer, setCustomAudioBuffer] = useState<AudioBuffer | undefined>(undefined);
  const [clipOffsetSec, setClipOffsetSec] = useState<number>(0);
  const [clipDurationSec, setClipDurationSec] = useState<number>(0.5);

  // Parent Configuration
  const [parentSettings, setParentSettings] = useState<ParentSettings>(DEFAULT_PARENT_SETTINGS);
  const [isParentPortalOpen, setIsParentPortalOpen] = useState(false);

  // Active Session & Longitudinal History State
  const [sessionState, setSessionState] = useState<'idle' | 'pre_suds' | 'active' | 'post_suds' | 'summary'>('idle');
  const [preSudsScore, setPreSudsScore] = useState<number>(2);
  const [postSudsScore, setPostSudsScore] = useState<number>(1);
  const [panicCount, setPanicCount] = useState<number>(0);
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState<number>(0);
  const [exposureElapsedSeconds, setExposureElapsedSeconds] = useState<number>(0);
  const [isBreathingActive, setIsBreathingActive] = useState<boolean>(false);
  const [latestSavedSession, setLatestSavedSession] = useState<SessionLog | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionLog[]>([]);
  const [wasAutoCompleted, setWasAutoCompleted] = useState<boolean>(false);

  const targetSessionInfo = calculateTargetSessionMinutes({
    baseMinutes: parentSettings.maxSessionDurationMinutes,
    programStartIso: parentSettings.programStartDate,
    sessions: sessionHistory,
    weeklyProgressionEnabled: parentSettings.weeklyProgressionEnabled ?? true,
  });

  const dailyReminder = useDailyReminder({
    sessionHistory,
    targetMinutes: targetSessionInfo.targetMinutes,
    weekNumber: targetSessionInfo.currentWeekNumber,
  });

  // Apply active UI theme to document root
  useEffect(() => {
    applyThemeToDocument(currentThemeId);
  }, [currentThemeId]);

  const handleSelectTheme = (themeId: ThemeId) => {
    setCurrentThemeId(themeId);
    saveStoredThemeId(themeId);
    applyThemeToDocument(themeId);
  };

  // Sync soundscape playing state, active piece, and 3-minute Auto-Mix countdown with AudioEngine
  useEffect(() => {
    const unsubPlay = audioEngine.onSoundscapeStateChange((playing) => {
      setIsSoundscapePlaying(playing);
    });
    const unsubTrack = audioEngine.onSoundscapeChange((type) => {
      setCurrentSoundscape(type);
    });
    const unsubRotation = audioEngine.onMusicRotationChange((status) => {
      setMusicRotationStatus(status);
    });
    return () => {
      unsubPlay();
      unsubTrack();
      unsubRotation();
    };
  }, []);

  // Restore saved settings and any previously recorded/uploaded trigger clip from IndexedDB
  useEffect(() => {
    const settings = getParentSettings();
    setParentSettings(settings);
    audioEngine.setParentCeilingGain(settings.maxTriggerCeilingGain);
    audioEngine.setLowpassCutoff(settings.filterCutoffHz);

    const params = new URLSearchParams(window.location.search);
    const shouldAutoStart = params.get('autostart') === '1';

    getAllSessionLogs()
      .then((logs) => setSessionHistory(logs))
      .catch(() => {});

    getAllCustomAudioRecords()
      .then((records) => {
        if (records.length > 0) {
          const ctx = audioEngine.ensureContext();
          for (let i = records.length - 1; i >= 0; i--) {
            const rec = records[i];
            const buf = reconstructAudioBufferFromRecord(rec, ctx);
            if (buf) {
              const offset = Number.isFinite(rec.clipOffsetSec) ? Number(rec.clipOffsetSec) : 0;
              const dur = Number.isFinite(rec.clipDurationSec) ? Number(rec.clipDurationSec) : 0.5;
              setActiveTriggerId(rec.id);
              setActiveTriggerName(rec.name || 'Saved Trigger Clip');
              setCustomAudioBuffer(buf);
              setClipOffsetSec(offset);
              setClipDurationSec(dur);
              audioEngine.setLowpassCutoff(rec.lowpassCutoffHz || 2200);
              audioEngine.loadTriggerClip(buf, offset, dur);
              break;
            }
          }
        }
      })
      .catch(() => {});

    if (shouldAutoStart) {
      handleInitialStart();
    }
  }, []);

  // Timer for active session — defaults to auto-ending at 15 min (+1 min per week progression)
  useEffect(() => {
    if (sessionState !== 'active') return;
    const timer = window.setInterval(() => {
      setSessionElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= targetSessionInfo.targetSeconds) {
          window.clearInterval(timer);
          audioEngine.stopTriggerExposure();
          audioEngine.playCompletionChord();
          setWasAutoCompleted(true);
          setSessionState('post_suds');
        }
        return next;
      });
      if (audioEngine.getEffectiveGain() > 0.001 && audioEngine.hasRecordedTriggerClip()) {
        setExposureElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionState, targetSessionInfo.targetSeconds]);

  // AudioContext unlock on initial tap — starts soundscape while keeping triggers stopped until a session is logged
  const handleInitialStart = async () => {
    hasStartedRef.current = true;
    setHasStarted(true);
    await audioEngine.initAudio();
    audioEngine.setStudioDucking(false);
    if (isSoundscapeEnabledRef.current) {
      audioEngine.startSoundscape(currentSoundscape);
    }
    if (customAudioBuffer) {
      audioEngine.loadTriggerClip(customAudioBuffer, clipOffsetSec, clipDurationSec);
    }
  };

  const handleSwitchTab = (tab: 'therapy' | 'studio') => {
    setActiveTab(tab);
    if (tab === 'therapy') {
      audioEngine.setStudioDucking(false);
      if (customAudioBuffer) {
        if (sessionState === 'active') {
          audioEngine.startTriggerExposure(
            activeTriggerId,
            customAudioBuffer,
            clipOffsetSec,
            clipDurationSec
          );
        } else {
          audioEngine.loadTriggerClip(customAudioBuffer, clipOffsetSec, clipDurationSec);
        }
      }
    }
  };

  // Soundscape selector, crossfade skip, Auto-Mix, & play/stop control
  const handleSelectSoundscape = (type: SoundscapeType) => {
    setCurrentSoundscape(type);
    isSoundscapeEnabledRef.current = true;
    audioEngine.startSoundscape(type, 1.5);
  };

  const handleToggleSoundscape = () => {
    const nextPlaying = audioEngine.toggleSoundscape();
    isSoundscapeEnabledRef.current = nextPlaying;
  };

  const handleToggleAutoRotate = () => {
    audioEngine.setAutoRotateMusic(!musicRotationStatus.autoRotateEnabled);
  };

  const handleNextRandomMusic = () => {
    isSoundscapeEnabledRef.current = true;
    audioEngine.skipToNextRandomMusic(3.5);
  };

  const handleSoundscapeVolumeChange = (vol: number) => {
    setSoundscapeVolume(vol);
    audioEngine.setSoundscapeVolume(vol);
  };

  // Trigger Selection from Studio
  const handleSelectTrigger = (
    id: string,
    customBuffer?: AudioBuffer,
    name?: string,
    cutoffHz?: number,
    offsetSec: number = 0,
    durationSec: number = 0.5
  ) => {
    setActiveTriggerId(id);
    setCustomAudioBuffer(customBuffer);
    setClipOffsetSec(offsetSec);
    setClipDurationSec(durationSec);
    setActiveTriggerName(name || 'Recorded Micro-Clip');

    if (cutoffHz) {
      audioEngine.setLowpassCutoff(cutoffHz);
    }

    if (customBuffer) {
      if (sessionState === 'active') {
        audioEngine.startTriggerExposure(id, customBuffer, offsetSec, durationSec);
      } else {
        audioEngine.loadTriggerClip(customBuffer, offsetSec, durationSec);
      }
    }
  };

  const handleRenameTrigger = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (!id || id === activeTriggerId) {
      setActiveTriggerName(trimmed);
    }
  };

  const handleRenameActiveTrigger = async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setActiveTriggerName(trimmed);
    if (activeTriggerId) {
      await renameCustomAudioRecord(activeTriggerId, trimmed);
    }
  };

  // Quick 1-step Audio File Upload directly from the Game HUD
  const handleQuickUploadClip = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = audioEngine.ensureContext();
      const decoded = await ctx.decodeAudioData(arrayBuffer);

      const length = decoded.length;
      const sr = decoded.sampleRate;
      const normBuf = ctx.createBuffer(1, length, sr);
      const dst = normBuf.getChannelData(0);
      const ch0 = decoded.getChannelData(0);

      let maxPeak = 0;
      for (let i = 0; i < length; i++) {
        dst[i] = ch0[i];
        const abs = Math.abs(ch0[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
      const mult = calculateNormalizationMultiplier(maxPeak, -14);
      for (let i = 0; i < length; i++) {
        dst[i] *= mult;
      }

      const dur = Math.min(0.5, Math.max(0.2, normBuf.duration));
      const cleanName = file.name.replace(/\.[^/.]+$/, '') || 'Uploaded Trigger Clip';
      const id = `upload_${Date.now()}`;

      await saveCustomAudioTrack(id, cleanName, normBuf, 2200, 0, dur, 'upload');
      handleSelectTrigger(id, normBuf, cleanName, 2200, 0, dur);
      audioEngine.playMicroClipNow();
    } catch {
      handleSwitchTab('studio');
    }
  };

  // Session Lifecycle
  const startNewSessionFlow = () => {
    setSessionState('pre_suds');
    setPanicCount(0);
    setSessionElapsedSeconds(0);
    setExposureElapsedSeconds(0);
    setWasAutoCompleted(false);
  };

  const handleOpenSummary = async () => {
    const logs = await getAllSessionLogs();
    setSessionHistory(logs);
    if (logs.length > 0) {
      setLatestSavedSession(logs[logs.length - 1]);
      setWasAutoCompleted(false);
      setSessionState('summary');
    }
  };

  const handlePreSudsSubmit = (score: number) => {
    setPreSudsScore(score);
    setSessionState('active');
    setSessionStartTime(Date.now());
    setActiveTab('therapy');
    // Start ambient (unless user explicitly stopped it) and trigger exposure automatically
    audioEngine.setStudioDucking(false);
    if (isSoundscapeEnabledRef.current) {
      audioEngine.startSoundscape(currentSoundscape);
    }
    audioEngine.startTriggerExposure(
      activeTriggerId,
      customAudioBuffer,
      clipOffsetSec,
      clipDurationSec
    );
  };

  const handleFinishSession = () => {
    audioEngine.stopTriggerExposure();
    setWasAutoCompleted(false);
    setSessionState('post_suds');
  };

  const handlePostSudsSubmit = async (score: number) => {
    setPostSudsScore(score);

    const delta = calculateDeltaSuds(preSudsScore, score);
    const newLog: SessionLog = {
      id: `session_${Date.now()}`,
      timestamp: new Date().toISOString(),
      preSuds: preSudsScore,
      postSuds: score,
      deltaSuds: delta,
      sessionDurationSeconds: sessionElapsedSeconds,
      triggerSoundId: activeTriggerId,
      triggerSoundName: activeTriggerName,
      triggerExposureSeconds: exposureElapsedSeconds,
      effectiveGainRatio: audioEngine.getEffectiveGain(),
      filterCutoffHz: audioEngine.getFilterCutoff(),
      panicActivated: panicCount > 0,
      panicCount,
    };

    await saveSessionLog(newLog);
    const updatedLogs = await getAllSessionLogs();
    setSessionHistory(updatedLogs.length > 0 ? updatedLogs : [...sessionHistory, newLog]);
    setLatestSavedSession(newLog);
    setSessionState('summary');
  };

  // Instant Panic Action
  const handlePanicTriggered = () => {
    setPanicCount((prev) => prev + 1);
    setIsBreathingActive(true);
  };

  const handleDismissBreathing = () => {
    setIsBreathingActive(false);
    audioEngine.resetPanicMute();
  };

  // Parent Settings Update
  const handleSettingsUpdated = (newSettings: ParentSettings) => {
    setParentSettings(newSettings);
    audioEngine.setParentCeilingGain(newSettings.maxTriggerCeilingGain);
    audioEngine.setLowpassCutoff(newSettings.filterCutoffHz);
  };

  // Format MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-teal-500/30 selection:text-teal-200">
      {/* Offline Toast Indicator */}
      <OfflineIndicator />

      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Brand Icon */}
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-500 to-sky-400 p-0.5 shadow-md shadow-teal-950">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
              <Sparkles className="w-4 h-4 text-teal-400" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2 truncate">
              <span>SoundCalm</span>
              <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 font-medium">
                PWA Neuro-Habituation
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block truncate">
              Clinical Counterconditioning & Desensitization
            </p>
          </div>
        </div>

        {/* Header Right Nav Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open Settings Menu"
            className="flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <button
            onClick={() => setIsParentPortalOpen(true)}
            className="flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 transition cursor-pointer"
            aria-label="Open Parent and Therapist Portal"
          >
            <Lock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="hidden sm:inline">Parent Lock</span>
          </button>

          {/* Persistent Panic Button in Header */}
          <PanicButton onPanicTriggered={handlePanicTriggered} size="compact" />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 pt-3 sm:pt-6 pb-24 sm:pb-6 space-y-4 sm:space-y-6">
        {/* Installed PWA Daily Reminder Onboarding Banner */}
        {dailyReminder.shouldShowInstallReminderBanner && (
          <div
            role="region"
            aria-label="Daily Reminder Setup"
            className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-teal-950/90 via-slate-900 to-slate-900 border border-teal-500/40 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0 mt-0.5">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  App Installed — Turn on Daily Calming Reminder?
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Get a gentle notification at{' '}
                  <strong className="text-teal-300">{dailyReminder.formattedTimeLabel}</strong>{' '}
                  for your {targetSessionInfo.targetMinutes}-minute session (auto-skipped if you already practiced today).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={dailyReminder.dismissInstallBanner}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition cursor-pointer"
              >
                Not Now
              </button>
              <button
                type="button"
                onClick={() => void dailyReminder.enableReminders()}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                Enable Reminder
              </button>
            </div>
          </div>
        )}

        {/* Splash Unlock Screen (iOS Safari Audio Unlock Requirement) */}
        {!hasStarted ? (
          <div className="my-4 sm:my-10 p-6 sm:p-12 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-teal-500/30 text-center shadow-2xl flex flex-col items-center max-w-xl mx-auto animate-in fade-in">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-teal-500/10 border-2 border-teal-400/30 flex items-center justify-center text-teal-300 mb-5 sm:mb-6 shadow-lg shadow-teal-950/50">
              <Headphones className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome to SoundCalm
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md leading-relaxed">
              A gentle, child-safe acoustic therapy platform designed to rewire misophonia reflexes through calming spatial puzzles and sub-threshold sound pairing.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 my-5 sm:my-6 w-full text-left text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="font-bold text-teal-300 block mb-0.5">Zero Pressure</span>
                <span className="text-slate-400">No timers, no countdowns, no point loss.</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="font-bold text-rose-300 block mb-0.5">Instant Panic Button</span>
                <span className="text-slate-400">Instant mute anytime you feel overwhelmed.</span>
              </div>
            </div>

            <button
              onClick={handleInitialStart}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white font-bold text-sm sm:text-base shadow-xl shadow-teal-950 transition active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-teal-500/30 cursor-pointer"
              aria-label="Begin Therapy Session"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Tap to Begin (Enable Audio Engine)</span>
            </button>
            <p className="text-[11px] text-slate-500 mt-3">
              Requires headphones for optimal acoustic masking and binaural calibration.
            </p>
          </div>
        ) : (
          /* Active App Core Views */
          <div className="space-y-4 sm:space-y-6">
            {/* View Switcher: Interactive Therapy Session vs Trigger Exposure Studio (Desktop/Tablet) */}
            <div className="hidden sm:flex flex-wrap items-center justify-between gap-2">
              <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl">
                <button
                  onClick={() => handleSwitchTab('therapy')}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'therapy'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Therapy Puzzle & Exposure</span>
                </button>
                <button
                  onClick={() => handleSwitchTab('studio')}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'studio'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 shrink-0" />
                  <span>In-App Trigger Studio</span>
                </button>
              </div>

              {/* Session Status HUD */}
              {sessionState === 'active' && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      Session: {formatTime(sessionElapsedSeconds)} / {targetSessionInfo.targetMinutes}:00
                    </span>
                    <span className="text-[10px] text-teal-400 font-sans font-semibold ml-1">
                      (Week {targetSessionInfo.currentWeekNumber})
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* View 1: Clinical Therapy Space */}
            {activeTab === 'therapy' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Channel A: Ambient Soundscape Controls */}
                <SoundscapeSelector
                  currentSoundscape={currentSoundscape}
                  volume={soundscapeVolume}
                  isPlaying={isSoundscapePlaying}
                  rotationStatus={musicRotationStatus}
                  onSelectSoundscape={handleSelectSoundscape}
                  onVolumeChange={handleSoundscapeVolumeChange}
                  onTogglePlay={handleToggleSoundscape}
                  onToggleAutoRotate={handleToggleAutoRotate}
                  onNextRandomMusic={handleNextRandomMusic}
                />

                {/* Main Interactive Counterconditioning Game & Micro-Clip Pairing Bar */}
                <ConstellationGame
                  parentCeilingGain={parentSettings.maxTriggerCeilingGain}
                  activeTriggerName={activeTriggerName}
                  hasRecordedClip={!!customAudioBuffer}
                  themeId={currentThemeId}
                  onPanicTriggered={handlePanicTriggered}
                  onFinishSession={handleFinishSession}
                  onOpenStudio={() => handleSwitchTab('studio')}
                  onQuickUploadClip={handleQuickUploadClip}
                  onRenameActiveTrigger={handleRenameActiveTrigger}
                />

                {/* Session Start / Progress Trigger & Summary Entry */}
                {sessionState === 'idle' && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Ready for a Guided Habituation Session?</h4>
                      <p className="text-xs text-slate-400">
                        Auto-ends at <strong className="text-teal-300">{targetSessionInfo.targetMinutes} minutes</strong> (Week {targetSessionInfo.currentWeekNumber}
                        {parentSettings.weeklyProgressionEnabled !== false
                          ? ` • progresses +1 min weekly to ${targetSessionInfo.nextMilestoneMinutes}m`
                          : ''}
                        ).
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {sessionHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={handleOpenSummary}
                          className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                        >
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Summary ({sessionHistory.length})</span>
                        </button>
                      )}
                      <button
                        onClick={startNewSessionFlow}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition cursor-pointer shrink-0"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Start Logged Session</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* View 2: In-App Trigger Studio */}
            {activeTab === 'studio' && (
              <TriggerStudio
                activeTriggerId={activeTriggerId}
                activeTriggerName={activeTriggerName}
                customAudioBuffer={customAudioBuffer}
                themeId={currentThemeId}
                onSelectTrigger={handleSelectTrigger}
                onRenameTrigger={handleRenameTrigger}
                onReturnToGame={() => handleSwitchTab('therapy')}
              />
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Thumb-Navigation Bar (<640px) */}
      {hasStarted && (
        <nav
          aria-label="Mobile quick actions"
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2.5 py-2 flex items-center justify-between gap-1.5"
        >
          <button
            onClick={() => handleSwitchTab('therapy')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl text-[11px] font-semibold transition cursor-pointer ${
              activeTab === 'therapy'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 mb-0.5" />
            <span>Puzzles</span>
          </button>

          <button
            onClick={() => handleSwitchTab('studio')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl text-[11px] font-semibold transition cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4 mb-0.5" />
            <span>Studio</span>
          </button>

          <button
            onClick={
              sessionState === 'active' ? handleFinishSession : startNewSessionFlow
            }
            className="flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200 text-[11px] font-semibold transition cursor-pointer"
          >
            {sessionState === 'active' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-0.5" />
                <span>End ({formatTime(sessionElapsedSeconds)})</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-teal-400 mb-0.5" />
                <span>Log Session</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              audioEngine.triggerPanicMute();
              handlePanicTriggered();
            }}
            aria-label="Mobile Instant Panic Stop"
            className="flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl bg-rose-600 active:bg-rose-700 text-white text-[11px] font-bold shadow-md border border-rose-400/50 transition cursor-pointer"
          >
            <Volume2 className="w-4 h-4 mb-0.5" />
            <span>Panic Mute</span>
          </button>
        </nav>
      )}

      {/* Footer info */}
      <footer className="hidden sm:block mt-8 border-t border-slate-900 px-4 py-4 text-center text-xs text-slate-500">
        <p>SoundCalm • Client-Side Neuro-Acoustic Desensitization • Zero-telemetry offline clinical platform</p>
      </footer>

      {/* MODAL 1: Pre-Session SUDS Prompt */}
      {sessionState === 'pre_suds' && (
        <SudsModal
          type="pre"
          initialScore={2}
          triggerName={activeTriggerName}
          onSubmit={handlePreSudsSubmit}
        />
      )}

      {/* MODAL 2: Post-Session SUDS Prompt */}
      {sessionState === 'post_suds' && (
        <SudsModal
          type="post"
          initialScore={preSudsScore}
          triggerName={activeTriggerName}
          onSubmit={handlePostSudsSubmit}
        />
      )}

      {/* MODAL 3: Session Summary & Habituation Feedback */}
      {sessionState === 'summary' && latestSavedSession && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Session Summary"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in"
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-teal-500/40 p-5 sm:p-7 shadow-2xl text-center space-y-4">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-teal-500/20 text-teal-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">Session Summary</h3>
              <p className="text-xs text-slate-300 mt-1">
                {wasAutoCompleted
                  ? `Reached your ${targetSessionInfo.targetMinutes}-minute Week ${targetSessionInfo.currentWeekNumber} goal automatically.`
                  : 'Great job maintaining calm. Here is your clinical summary and 7-session trend:'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Pre-SUDS</span>
                <span className="text-base font-bold text-sky-400">{latestSavedSession.preSuds}/10</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Post-SUDS</span>
                <span className="text-base font-bold text-emerald-400">{latestSavedSession.postSuds}/10</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Distress Delta</span>
                <span className={`text-base font-bold ${latestSavedSession.deltaSuds <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {latestSavedSession.deltaSuds > 0 ? `+${latestSavedSession.deltaSuds}` : latestSavedSession.deltaSuds}
                </span>
              </div>
            </div>

            {/* D3.js Historical SUDS Improvement Chart (Last 7 Sessions) */}
            <SudsHistoryChart
              sessions={sessionHistory}
              title="SUDS Improvement (Last 7 Sessions)"
              compact
            />

            <div className="text-xs text-slate-400 p-3 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-1">
              <p>• Trigger Exposed: <strong className="text-white">{latestSavedSession.triggerSoundName || 'None Loaded'}</strong></p>
              <p>• Exposure Duration: <strong className="text-teal-400">{latestSavedSession.triggerExposureSeconds}s</strong></p>
              <p>• Session Target: <strong className="text-slate-200">{targetSessionInfo.targetMinutes} min (Week {targetSessionInfo.currentWeekNumber})</strong></p>
              <p>• Panic Events: <strong className="text-white">{latestSavedSession.panicCount}</strong></p>
            </div>

            <button
              onClick={() => setSessionState('idle')}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 font-semibold text-white text-xs shadow-md transition cursor-pointer"
            >
              Back to Sound Therapy
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: Tranquil Breathing Flower (Post-Panic) */}
      {isBreathingActive && (
        <BreathingFlower onDismiss={handleDismissBreathing} />
      )}

      {/* MODAL 5: Parent & Therapist Locked Portal */}
      <ParentPortal
        isOpen={isParentPortalOpen}
        onClose={() => setIsParentPortalOpen(false)}
        onSettingsUpdated={handleSettingsUpdated}
      />

      {/* MODAL 6: Settings Menu (UI Theme, Daily Reminders & Preferences) */}
      <SettingsMenu
        isOpen={isSettingsOpen}
        currentThemeId={currentThemeId}
        onSelectTheme={handleSelectTheme}
        onClose={() => setIsSettingsOpen(false)}
        onOpenParentPortal={() => setIsParentPortalOpen(true)}
        dailyReminder={dailyReminder}
      />
    </div>
  );
}
