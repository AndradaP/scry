import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Custom fallback — defaults to the full-page error UI */
  fallback?: ReactNode;
  /** Called when an error is caught, before rendering the fallback */
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          background: "#0A0A08",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
        }}
      >
        <span
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "26px",
            fontWeight: 600,
            color: "#D4A843",
          }}
        >
          Scry
        </span>
        <p
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "14px",
            color: "#7A7670",
            textAlign: "center",
            maxWidth: "320px",
          }}
        >
          Something went wrong rendering this page.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "13px",
            color: "#D4A843",
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
