import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");
const root = createRoot(rootElement);

// Same startup-failure-visibility pattern as igroom-frontend-bo's main.tsx:
// App (and its import of src/lib/env.ts, which throws at module-evaluation
// time on a missing/invalid env var) loads dynamically inside a try/catch
// so a bad .env renders a readable message instead of a blank page.
import("@/App")
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <div style={{ fontFamily: "monospace", padding: "2rem", color: "#f87171" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Failed to start the app</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
        <p style={{ marginTop: "1rem", color: "#94a3b8" }}>
          Check your .env file against .env.example, and the browser console for the full error.
        </p>
      </div>,
    );
  });
