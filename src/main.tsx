import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { logClientError } from "./lib/errorLogger.ts";
import "./index.css";

window.addEventListener("unhandledrejection", (event) => {
  const err = event.reason;
  logClientError(
    err instanceof Error ? err.message : String(err),
    err instanceof Error ? err.stack : undefined,
  );
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary
    onError={(error, info) =>
      logClientError(
        error.message,
        error.stack + "\n\nComponent stack:" + info.componentStack,
      )
    }
  >
    <App />
  </ErrorBoundary>
);
