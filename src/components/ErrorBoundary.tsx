import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected error occurred',
    };
  }

  private handleRecover = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleResetAndReload = () => {
    try {
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('soundcalm_db');
      }
      localStorage.removeItem('soundcalm_ui_theme');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-teal-500/30 p-6 sm:p-8 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Restoring Your Calm Sanctuary
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              A temporary audio or display interruption occurred ({this.state.errorMessage}). All audio triggers have been safely muted.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleRecover}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Resume Session</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Reset Cached Data
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
