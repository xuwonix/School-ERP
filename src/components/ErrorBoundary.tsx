import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { FIREBASE_CONFIG } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', isQuotaError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'An unexpected error occurred.';
    let parsedMessage = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.error === 'string') {
        parsedMessage = `${parsed.error}${parsed.path ? ` (${parsed.operationType} on ${parsed.path})` : ''}`;
      }
    } catch {
      // keep raw message
    }
    const isQuotaError = parsedMessage.toLowerCase().includes('quota exceeded');
    return { hasError: true, message: parsedMessage, isQuotaError };
  }

  componentDidCatch(error: Error) {
    console.error('Application error boundary caught:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const upgradeLink = `https://console.firebase.google.com/project/${FIREBASE_CONFIG.projectId}/firestore/databases/${FIREBASE_CONFIG.firestoreDatabaseId}/data?openUpgradeDialog=true`;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-8 space-y-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold text-slate-900">
                {this.state.isQuotaError ? 'Firestore Daily Quota Reached' : 'Workspace Error'}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {this.state.isQuotaError
                  ? 'Your Firestore free-tier daily quota has been exceeded. Quota resets tomorrow, or you can review database limits in Firebase Console.'
                  : 'An error occurred while syncing workspace records. Reload to reconnect cleanly.'}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 font-mono text-xs text-slate-700 break-words">
            {this.state.message}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F4C5C] hover:bg-[#0B3945] rounded-md transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Workspace
            </button>
            {this.state.isQuotaError && (
              <a
                href={upgradeLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-[#0F4C5C] hover:underline"
              >
                Open Firebase Console
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }
}
