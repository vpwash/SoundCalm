import React, { useEffect } from 'react';
import {
  Settings,
  Palette,
  Check,
  Sun,
  Moon,
  X,
  Lock,
  Bell,
  BellOff,
  Clock,
  Send,
  Smartphone,
} from 'lucide-react';
import { APP_THEMES, AppTheme, ThemeId } from '../utils/themes.ts';
import { audioEngine } from '../audio/AudioEngine.ts';
import { DailyReminderState } from '../hooks/useDailyReminder.ts';

interface SettingsMenuProps {
  isOpen: boolean;
  currentThemeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  onClose: () => void;
  onOpenParentPortal: () => void;
  dailyReminder: DailyReminderState;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  currentThemeId,
  onSelectTheme,
  onClose,
  onOpenParentPortal,
  dailyReminder,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeTheme: AppTheme =
    APP_THEMES.find((t) => t.id === currentThemeId) || APP_THEMES[0];

  const handleChooseTheme = (id: ThemeId) => {
    onSelectTheme(id);
    audioEngine.playHarmonicChime(4);
  };

  const {
    isInstalled,
    settings: reminderSettings,
    permission,
    statusFeedback,
    formattedTimeLabel,
    enableReminders,
    disableReminders,
    updateReminderTime,
    sendTestNotification,
  } = dailyReminder;

  const isReminderActive =
    reminderSettings.enabled && permission === 'granted';

  const handleToggleReminder = async () => {
    if (isReminderActive) {
      disableReminders();
    } else {
      await enableReminders();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings Menu"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-4 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                Settings
              </h2>
              <p className="text-[11px] text-slate-400">
                Sensory UI Theme & Sanctuary Preferences
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings Menu"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Daily Reminder Notifications (PWA) Section */}
        <div className="space-y-3 rounded-2xl bg-slate-950/70 border border-slate-800 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-400">
              <Bell className="w-3.5 h-3.5" />
              <span>Daily Reminder (PWA)</span>
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                isInstalled
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <Smartphone className="w-2.5 h-2.5" />
              <span>{isInstalled ? 'PWA Installed' : 'Browser Mode'}</span>
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isInstalled
              ? 'Get a gentle daily reminder at your preferred time when the app is installed. Skips automatically on days you already completed a session.'
              : 'Install SoundCalm as a PWA for automatic daily reminders, or customize your schedule and test notifications below.'}
          </p>

          {/* Toggle Row */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <p className="text-xs font-semibold text-slate-100">
                Daily Practice Reminder
              </p>
              <p className="text-[10px] text-slate-400">
                {isReminderActive
                  ? `Scheduled daily at ${formattedTimeLabel}`
                  : permission === 'denied'
                  ? 'Permission blocked in browser settings'
                  : reminderSettings.enabled
                  ? 'Tap Enable to allow notifications'
                  : 'Notifications paused'}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isReminderActive}
              aria-label="Toggle Daily Reminder Notifications"
              onClick={handleToggleReminder}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer shrink-0 ${
                isReminderActive
                  ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-400/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {isReminderActive ? (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>Enabled</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Enable</span>
                </>
              )}
            </button>
          </div>

          {/* Preferred Time Picker + Test Notification Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Reminder Time</span>
              </span>
              <input
                type="time"
                aria-label="Daily reminder time"
                value={reminderSettings.timeHHMM}
                onChange={(e) => updateReminderTime(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              />
            </label>

            <button
              type="button"
              onClick={() => void sendTestNotification()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-teal-300 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Test Notification</span>
            </button>
          </div>

          {statusFeedback && (
            <p
              role="status"
              className="text-[11px] text-teal-300 bg-teal-950/60 border border-teal-500/30 rounded-xl px-3 py-2"
            >
              {statusFeedback}
            </p>
          )}
        </div>

        {/* UI Theme Selector Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-400">
              <Palette className="w-3.5 h-3.5" />
              <span>UI Theme</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Active: <strong className="text-slate-200">{activeTheme.shortName}</strong>
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Choose a low-glare dark sanctuary or warm daylight paper palette calibrated for calm focus.
          </p>

          <div className="grid grid-cols-1 gap-2">
            {APP_THEMES.map((theme) => {
              const isSelected = theme.id === currentThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleChooseTheme(theme.id)}
                  className={`w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-teal-950/75 border-teal-400 ring-1 ring-teal-400/40'
                      : 'bg-slate-950/70 border-slate-800 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Swatch Preview Pill */}
                    <div
                      style={{ backgroundColor: theme.previewSwatches[0] }}
                      className="w-10 h-10 rounded-xl border border-slate-600/50 flex items-center justify-center relative shrink-0 shadow-inner overflow-hidden"
                    >
                      <div
                        style={{ backgroundColor: theme.previewSwatches[1] }}
                        className="absolute inset-x-0 bottom-0 h-1/2"
                      />
                      <span
                        style={{ backgroundColor: theme.previewSwatches[2] }}
                        className="relative z-10 w-4 h-4 rounded-full border border-white/40 shadow-xs flex items-center justify-center text-[10px]"
                      >
                        {theme.emoji}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100 truncate">
                          {theme.name}
                        </span>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                          {theme.mode === 'light' ? (
                            <>
                              <Sun className="w-2.5 h-2.5 text-amber-400" />
                              <span>Daylight</span>
                            </>
                          ) : (
                            <>
                              <Moon className="w-2.5 h-2.5 text-teal-400" />
                              <span>Dark</span>
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {theme.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isSelected ? (
                      <span className="w-6 h-6 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {theme.previewSwatches.map((hex, idx) => (
                          <span
                            key={idx}
                            style={{ backgroundColor: hex }}
                            className="w-2.5 h-2.5 rounded-full border border-slate-600"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Clinical & Parent Portal Shortcut */}
        <div className="border-t border-slate-800 pt-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-200">
              Parent & Therapist Controls
            </p>
            <p className="text-[10px] text-slate-400">
              Manage PIN lock, ceiling gain caps, and SUDS logs
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenParentPortal();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-teal-300 transition cursor-pointer shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Open Portal</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
