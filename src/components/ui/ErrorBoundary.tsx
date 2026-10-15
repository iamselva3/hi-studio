import React from 'react';

interface State {
  error: Error | null;
}

/** Keeps a render error in one part of the app from blanking the whole page. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // `fallback={null}` means "render nothing", so check presence, not truthiness.
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-serif text-3xl text-ink-light">Something went wrong on this page.</h1>
          <p className="text-ink-faint">Please reload. If it keeps happening, message us on WhatsApp and we'll help.</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
