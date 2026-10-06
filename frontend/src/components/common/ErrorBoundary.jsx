import React, { Component } from "react";
import { LuTriangleAlert, LuRefreshCw, LuArrowLeft } from "react-icons/lu";

/**
 * ErrorBoundary
 * Catches unhandled JavaScript runtime errors anywhere in the React child tree,
 * logs the error details, and renders a graceful, futuristic Cheeni recovery UI
 * rather than crashing the entire browser session to a blank screen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error telemetry for debugging and incident diagnosis
    console.error("[ErrorBoundary] Unhandled UI Exception caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV !== "production";
      const errorMessage = this.state.error?.message || "An unexpected error interrupted the assistant interface.";

      return (
        <div className="w-full min-h-screen bg-[#050713] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-cyan-500 selection:text-black">
          {/* Ambient Glowing Orbs */}
          <div className="fixed top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />
          <div className="fixed bottom-1/4 right-1/3 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />

          {/* Recovery Glass Card */}
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.85)] relative z-10 flex flex-col items-center text-center animate-fade-in">
            {/* Warning Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_25px_rgba(244,63,94,0.25)] animate-pulse">
              <LuTriangleAlert className="w-8 h-8" />
            </div>

            {/* Heading & Friendly Subtitle */}
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
              Cheeni Encountered an Issue
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
              Don't worry, your voice model and configuration are safe. An unexpected view rendering error occurred in the interface.
            </p>

            {/* Error Message Box */}
            <div className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/5 text-left mb-6 font-mono text-[11px] text-rose-300/90 overflow-x-auto max-h-32 scroll-premium">
              <span className="text-slate-500 block mb-1">// Error trace</span>
              {errorMessage}
            </div>

            {/* Recovery Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <button
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-95 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.3)]"
              >
                <LuRefreshCw className="w-4 h-4" />
                <span>Reload Interface</span>
              </button>

              <button
                onClick={this.handleResetState}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl glass-pill hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/10"
              >
                <LuArrowLeft className="w-4 h-4" />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
