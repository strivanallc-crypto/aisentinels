"use client";

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-6 gap-5 text-center">
          <div className="relative">
            <div
              className="absolute inset-0 -m-4 rounded-full animate-pulse"
              style={{ background: "radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)" }}
            />
            <AlertTriangle className="relative h-10 w-10" style={{ color: "#dc2626" }} />
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            Something went wrong
          </h2>
          <p className="text-sm max-w-md leading-relaxed" style={{ color: "var(--muted)" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
            style={{
              background: "var(--btn-primary-bg)",
              color: "var(--btn-primary-text)",
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
