import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let parsedMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          parsedMsg = `${parsed.error} (Operation: ${parsed.operationType}, Path: ${parsed.path || 'unknown'})`;
        }
      } catch {
        // non-JSON message
      }

      return (
        <div className="min-h-screen bg-[#101418] text-[#F4F5F6] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#1B2229] border border-white/10 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#F5B942]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-semibold">Workspace Recovery Required</h2>
            </div>
            <p className="text-sm text-[#9AA5B1] leading-relaxed break-words">
              {parsedMsg}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f7c663] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
