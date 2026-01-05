import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Ideally log to Sentry here
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-900 text-white p-6">
          <div className="max-w-md text-center">
            <h1 className="text-3xl font-bold bg-red-600/20 text-red-500 p-4 rounded-xl mb-4 border border-red-500/30">
                Critical Error
            </h1>
            <p className="text-zinc-400 mb-6">
              The application encountered an unexpected state and needs to restart.
            </p>
            {this.state.error && (
                <div className="bg-black/50 p-4 rounded text-left overflow-auto max-h-48 mb-6 font-mono text-xs text-red-300">
                    {this.state.error.toString()}
                </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
