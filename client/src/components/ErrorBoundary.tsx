import { AlertTriangle, RefreshCw } from "lucide-react";
import React from "react";
import { Button, Panel } from "./ui";

class ErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback?: React.ReactNode;
  },
  {
    hasError: boolean;
    error: Error | null;
  }
> {
  constructor(props: {
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main className="route-loading">
          <div style={{ width: "min(600px, 100%)" }}>
            <Panel
              title="SYS.ERR // FATAL"
              description="The application encountered an unexpected error and cannot recover."
            >
              <div
                className="query-error-state"
                style={{ padding: "24px 0", gap: "24px" }}
              >
                <AlertTriangle size={48} color="var(--danger)" />
                <div
                  style={{
                    background: "var(--surface-strong)",
                    padding: "16px",
                    border: "var(--border-width) solid var(--border)",
                    width: "100%",
                    overflowX: "auto",
                  }}
                >
                  <code
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--danger)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {this.state.error?.message || "Unknown Application Error"}
                  </code>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw size={16} />
                  REBOOT SYSTEM
                </Button>
              </div>
            </Panel>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
