"use client";

import { useEffect } from "react";

// App-level error boundary (Next.js App Router). Catches runtime errors including
// chunk-load failures ("module factory not available") that occur when a PWA tab
// is open across a deploy that changes JS chunk hashes. The SW sends SW_UPDATED
// which triggers a soft reload via sw-register.tsx, but if the tab was asleep
// during the swap this boundary catches whatever slips through.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.message?.includes("module factory") ||
    error.message?.includes("ChunkLoadError") ||
    error.message?.includes("Loading chunk") ||
    error.message?.includes("Failed to fetch dynamically imported module");

  useEffect(() => {
    // Log to console; a real error reporter goes here.
    console.error("[Kontax] App error boundary:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "24px",
        background: "#f6f7f4",
        textAlign: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "#17352e",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 20px",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
          <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
          <path d="M16 5.2a3 3 0 010 5.6" />
          <path d="M17.5 14.4c2 .8 3.5 2.3 3.5 4.6" />
        </svg>
      </div>

      <h1 style={{ fontSize: 21, fontWeight: 700, color: "#1d2823", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
        {isChunkError ? "Update available" : "Something went wrong"}
      </h1>
      <p style={{ fontSize: 14, color: "#5c655e", lineHeight: 1.55, maxWidth: 320, margin: "0 auto 24px" }}>
        {isChunkError
          ? "Kontax was updated while this tab was open. Reload to get the latest version."
          : "An unexpected error occurred. Try reloading the page — your contacts are safe."}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            height: 44,
            padding: "0 24px",
            borderRadius: 12,
            background: "#17352e",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          {isChunkError ? "Reload to update" : "Reload page"}
        </button>
        {!isChunkError && (
          <button
            onClick={reset}
            style={{
              height: 44,
              padding: "0 24px",
              borderRadius: 12,
              background: "#fff",
              color: "#1d2823",
              fontSize: 14,
              fontWeight: 600,
              border: "1.5px solid #d8ddd6",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
