import React, { useState, useEffect } from 'react';
import {
  ParentSettings,
  SessionLog,
} from '../types.ts';
import {
  verifyPin,
  hashPin,
  calculateHabituationIndex,
  calculateTargetSessionMinutes,
  gainToDb,
} from '../utils/clinical.ts';
import { SudsHistoryChart } from './SudsHistoryChart.tsx';
import {
  getParentSettings,
  saveParentSettings,
  getAllSessionLogs,
  clearAllSessionLogs,
} from '../utils/storage.ts';
import {
  Lock,
  Unlock,
  Sliders,
  TrendingDown,
  Download,
  Trash2,
  X,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface ParentPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: (newSettings: ParentSettings) => void;
}

export const ParentPortal: React.FC<ParentPortalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [settings, setSettings] = useState<ParentSettings>(getParentSettings());
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [activeTab, setActiveTab] = useState<'clinical' | 'settings' | 'pin'>('clinical');
  const [newPin, setNewPin] = useState('');
  const [newPinSuccess, setNewPinSuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getParentSettings();
      setSettings(current);
      loadSessions();
    } else {
      setIsAuthenticated(false);
      setPinInput('');
      setPinError(false);
    }
  }, [isOpen]);

  const loadSessions = async () => {
    const list = await getAllSessionLogs();
    setSessions(list);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = verifyPin(pinInput, settings.pinHash, settings.salt);
    if (isValid) {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleSaveSettings = () => {
    saveParentSettings(settings);
    onSettingsUpdated(settings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4) return;
    const newHash = hashPin(newPin, settings.salt);
    const updated = { ...settings, pinHash: newHash };
    setSettings(updated);
    saveParentSettings(updated);
    onSettingsUpdated(updated);
    setNewPin('');
    setNewPinSuccess(true);
    setTimeout(() => setNewPinSuccess(false), 2500);
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all SUDS session history? This cannot be undone.')) {
      await clearAllSessionLogs();
      setSessions([]);
    }
  };

  // Export to CSV
  const exportCsv = () => {
    if (sessions.length === 0) return;
    const headers = [
      'sessionId',
      'timestamp',
      'preSuds',
      'postSuds',
      'deltaSuds',
      'sessionDurationSeconds',
      'triggerSoundName',
      'triggerExposureSeconds',
      'effectiveGainRatio',
      'filterCutoffHz',
      'panicCount',
    ];

    const rows = sessions.map((s) => [
      s.id,
      s.timestamp,
      s.preSuds,
      s.postSuds,
      s.deltaSuds,
      s.sessionDurationSeconds,
      `"${s.triggerSoundName || s.triggerSoundId}"`,
      s.triggerExposureSeconds,
      s.effectiveGainRatio,
      s.filterCutoffHz,
      s.panicCount || (s.panicActivated ? 1 : 0),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soundcalm_clinical_data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export to JSON
  const exportJson = () => {
    const dataStr = JSON.stringify({ settings, sessions }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soundcalm_clinical_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const habituationStats = calculateHabituationIndex(sessions);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Parent & Therapist Portal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-700 p-6 md:p-8 shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              {isAuthenticated ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Parent & Therapist Control Portal</h2>
              <p className="text-xs text-slate-400">Clinical Safety Caps & Longitudinal Habituation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close portal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN Authentication Screen */}
        {!isAuthenticated ? (
          <div className="py-12 flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 mb-4 shadow-inner">
              <KeyRound className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white">Parent PIN Required</h3>
            <p className="text-xs text-slate-400 mt-1 mb-6">
              Enter your 4-digit security PIN to access exposure limits and SUDS clinical records. (Default is <strong>1234</strong>)
            </p>

            <form onSubmit={handlePinSubmit} className="w-full space-y-4">
              <input
                type="password"
                maxLength={4}
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • •"
                className="w-48 text-center text-3xl font-mono tracking-widest py-3 rounded-2xl bg-slate-950 border border-slate-700 text-teal-300 focus:outline-none focus:border-teal-400 shadow-inner"
              />

              {pinError && (
                <p className="text-xs text-rose-400 font-medium">
                  Incorrect PIN. Please try again.
                </p>
              )}

              <button
                type="submit"
                disabled={pinInput.length !== 4}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition"
              >
                Unlock Controls
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="pt-4 space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-slate-800 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('clinical')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
                  activeTab === 'clinical'
                    ? 'border-teal-400 text-teal-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingDown className="w-4 h-4 shrink-0" />
                <span>SUDS Logs ({sessions.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
                  activeTab === 'settings'
                    ? 'border-teal-400 text-teal-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>Safety Caps</span>
              </button>
              <button
                onClick={() => setActiveTab('pin')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
                  activeTab === 'pin'
                    ? 'border-teal-400 text-teal-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Change PIN</span>
              </button>
            </div>

            {/* TAB 1: Clinical Logs & Longitudinal SUDS Graph */}
            {activeTab === 'clinical' && (
              <div className="space-y-6">
                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Sessions</span>
                    <p className="text-xl font-bold text-white mt-0.5">{habituationStats.totalSessions}</p>
                    <span className="text-[10px] text-teal-400">{habituationStats.totalExposureMinutes}m total exposure</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Avg SUDS Delta</span>
                    <p className="text-xl font-bold text-emerald-400 mt-0.5">
                      {habituationStats.averageDelta > 0 ? `+${habituationStats.averageDelta}` : habituationStats.averageDelta}
                    </p>
                    <span className="text-[10px] text-slate-400">Post vs Pre</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Habituation Index</span>
                    <p className="text-xs font-bold text-teal-300 mt-1 truncate">
                      {habituationStats.habituationStatus.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    <span className="text-[10px] text-slate-400">Moving 10-session trend</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Panic Trigger Rate</span>
                    <p className="text-xl font-bold text-slate-200 mt-0.5">{habituationStats.panicRatePercent}%</p>
                    <span className="text-[10px] text-slate-400">Instant safety events</span>
                  </div>
                </div>

                {/* D3.js Historical SUDS Improvement Chart (Last 7 Sessions) */}
                <SudsHistoryChart
                  sessions={sessions}
                  title="SUDS Improvement (Last 7 Sessions)"
                />

                {/* Session Records Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Recent Session Log Records
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={exportCsv}
                        disabled={sessions.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600/90 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-medium transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>
                      <button
                        onClick={exportJson}
                        disabled={sessions.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium border border-slate-700 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>JSON</span>
                      </button>
                      <button
                        onClick={handleClearData}
                        disabled={sessions.length === 0}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 transition"
                        title="Clear History"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">Date & Time</th>
                          <th className="p-2.5">Trigger Used</th>
                          <th className="p-2.5">Pre-SUDS</th>
                          <th className="p-2.5">Post-SUDS</th>
                          <th className="p-2.5">Delta</th>
                          <th className="p-2.5">Exposure (s)</th>
                          <th className="p-2.5">Panic</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {sessions.slice(-8).reverse().map((s) => (
                          <tr key={s.id} className="hover:bg-slate-900/40">
                            <td className="p-2.5 font-mono text-slate-400">
                              {new Date(s.timestamp).toLocaleDateString()} {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2.5 font-medium text-white">{s.triggerSoundName || s.triggerSoundId}</td>
                            <td className="p-2.5 text-sky-300 font-semibold">{s.preSuds}</td>
                            <td className="p-2.5 text-emerald-300 font-semibold">{s.postSuds}</td>
                            <td className="p-2.5 font-bold">
                              <span className={s.deltaSuds < 0 ? 'text-emerald-400' : s.deltaSuds > 0 ? 'text-rose-400' : 'text-slate-400'}>
                                {s.deltaSuds > 0 ? `+${s.deltaSuds}` : s.deltaSuds}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono">{s.triggerExposureSeconds}s</td>
                            <td className="p-2.5">
                              {s.panicActivated || s.panicCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-bold">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{s.panicCount || 1}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500">None</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Acoustic Safety Caps & Settings */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-200 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Clinical Hardware Lock:</strong> The volume ceiling configured below is an immutable hard upper limit. Even if the child moves their in-game exposure slider to 100%, physical audio gain will strictly not exceed this cap.
                  </p>
                </div>

                {/* Ceiling Slider */}
                <div className="space-y-2 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-bold text-white">
                        Max Trigger Exposure Ceiling Cap
                      </label>
                      <p className="text-xs text-slate-400">
                        Default: 0.08 (-22 dBFS). Strictly limited between 0.00 and 0.25 (-12 dBFS).
                      </p>
                    </div>
                    <span className="text-sm font-mono font-bold text-teal-400">
                      {settings.maxTriggerCeilingGain.toFixed(2)} ({gainToDb(settings.maxTriggerCeilingGain)} dBFS)
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0.01"
                    max="0.25"
                    step="0.01"
                    value={settings.maxTriggerCeilingGain}
                    onChange={(e) =>
                      setSettings({ ...settings, maxTriggerCeilingGain: parseFloat(e.target.value) })
                    }
                    className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>

                {/* Filter Cutoff */}
                <div className="space-y-2 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-bold text-white">
                        Acoustic Shield Low-Pass Cutoff Lock
                      </label>
                      <p className="text-xs text-slate-400">
                        Removes harsh high frequencies above this threshold (Butterworth 0.707 Q).
                      </p>
                    </div>
                    <span className="text-sm font-mono font-bold text-indigo-400">
                      {settings.filterCutoffHz} Hz
                    </span>
                  </div>

                  <input
                    type="range"
                    min="500"
                    max="8000"
                    step="100"
                    value={settings.filterCutoffHz}
                    onChange={(e) =>
                      setSettings({ ...settings, filterCutoffHz: parseInt(e.target.value) })
                    }
                    className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                  />
                </div>

                {/* Base & Weekly Progressive Session Duration */}
                {(() => {
                  const targetInfo = calculateTargetSessionMinutes({
                    baseMinutes: settings.maxSessionDurationMinutes,
                    programStartIso: settings.programStartDate,
                    sessions,
                    weeklyProgressionEnabled: settings.weeklyProgressionEnabled ?? true,
                  });
                  const weeklyEnabled = settings.weeklyProgressionEnabled ?? true;
                  return (
                    <div className="space-y-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <label className="text-sm font-bold text-white">
                            Base Session Auto-End Duration
                          </label>
                          <p className="text-xs text-slate-400">
                            Defaults to 15 minutes and automatically ends the session at target time.
                          </p>
                        </div>
                        <span className="text-sm font-mono font-bold text-white shrink-0">
                          {settings.maxSessionDurationMinutes} min base
                        </span>
                      </div>

                      <input
                        type="range"
                        min="3"
                        max="45"
                        step="1"
                        value={settings.maxSessionDurationMinutes}
                        onChange={(e) =>
                          setSettings({ ...settings, maxSessionDurationMinutes: parseInt(e.target.value, 10) })
                        }
                        className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <div>
                          <span className="text-xs font-semibold text-teal-300 block">
                            Weekly +1 Minute Progression
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Current target: <strong className="text-white">{targetInfo.targetMinutes} min</strong> (Week {targetInfo.currentWeekNumber}
                            {weeklyEnabled ? ` • ${targetInfo.nextMilestoneMinutes}m in ${targetInfo.daysUntilNextIncrease}d` : ' • Fixed'})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              weeklyProgressionEnabled: !weeklyEnabled,
                            })
                          }
                          aria-pressed={weeklyEnabled}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            weeklyEnabled
                              ? 'bg-teal-500/20 border-teal-400/50 text-teal-200'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {weeklyEnabled ? '+1 Min / Week ON' : 'Weekly Auto Off'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <button
                  onClick={handleSaveSettings}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 font-semibold text-white text-sm shadow-md transition"
                >
                  {saveSuccess ? 'Settings Saved Successfully!' : 'Save Clinical Safeguards'}
                </button>
              </div>
            )}

            {/* TAB 3: Change Parent PIN */}
            {activeTab === 'pin' && (
              <div className="space-y-4 max-w-sm mx-auto py-6">
                <h4 className="text-sm font-bold text-white text-center">Change 4-Digit Parent PIN</h4>
                <p className="text-xs text-slate-400 text-center">
                  Set a new 4-digit code to protect clinical settings from child modification.
                </p>

                <form onSubmit={handleChangePin} className="space-y-4">
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="New 4 digits"
                    className="w-full text-center text-2xl font-mono tracking-widest py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-teal-300 focus:outline-none focus:border-teal-400"
                  />

                  {newPinSuccess && (
                    <p className="text-xs text-emerald-400 text-center font-medium">
                      PIN updated successfully!
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={newPin.length !== 4}
                    className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md transition"
                  >
                    Save New PIN
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
