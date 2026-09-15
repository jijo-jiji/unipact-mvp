import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { reportError } from '../monitoring';

// Catches crashes anywhere in the app and shows a friendly screen instead of a blank page
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F5F7FC] text-[#0A1748] font-body flex items-center justify-center px-4">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={26} />
          </div>
          <h1 className="font-heading font-bold text-2xl mb-2">Something went wrong</h1>
          <p className="text-sm text-[#5B6478] mb-6">
            Sorry, this page ran into a problem. Our team has been notified. Reloading usually fixes it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">
              <RotateCcw size={16} /> Reload page
            </button>
            <a href="/" className="btn-secondary">Go to home page</a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
