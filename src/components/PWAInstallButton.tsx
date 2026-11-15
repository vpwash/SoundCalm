import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { Download, Smartphone, X, ShieldCheck } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-full bg-teal-600/90 hover:bg-teal-500 min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer"
        aria-label="Install SoundCalm PWA"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Install PWA</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-300 transition-all focus:outline-none cursor-pointer"
        aria-label="PWA ready"
      >
        {isIOS ? (
          <Smartphone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        )}
        <span className="hidden sm:inline">Install PWA</span>
        <span className="sm:hidden">Install</span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install SoundCalm App"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 shadow-2xl text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <h3 className="font-semibold text-white text-sm sm:text-base">
                  Install SoundCalm App
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Close installation guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-300">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/60">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-300">
                  1
                </span>
                <p>
                  On <strong className="text-white">iOS Safari</strong>, tap the{' '}
                  <strong className="text-white">Share</strong> icon on your toolbar and choose{' '}
                  <strong className="text-white">Add to Home Screen</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/60">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-300">
                  2
                </span>
                <p>
                  On <strong className="text-white">Android / Chrome / Edge</strong>, tap the browser menu or address bar{' '}
                  <strong className="text-white">Install App</strong> icon.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-teal-600 hover:bg-teal-500 py-2.5 text-xs sm:text-sm font-semibold text-white transition cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
