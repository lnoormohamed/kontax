"use client";

import { useEffect, useState } from "react";

import {
  attemptChunkErrorRecovery,
  isRecoverableChunkError,
} from "./chunk-error-recovery";

export function ErrorShell({
  error,
  reset,
  root = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  root?: boolean;
}) {
  const isChunkError = isRecoverableChunkError(error);
  const [autoRecovering, setAutoRecovering] = useState(false);

  useEffect(() => {
    console.error("[Kontax] App error boundary:", error);
  }, [error]);

  useEffect(() => {
    if (!isChunkError) return;

    let cancelled = false;

    void attemptChunkErrorRecovery().then((started) => {
      if (!cancelled && started) {
        setAutoRecovering(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isChunkError]);

  const content = (
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
        {isChunkError ? "Refreshing Kontax" : "Something went wrong"}
      </h1>
      <p style={{ fontSize: 14, color: "#5c655e", lineHeight: 1.55, maxWidth: 340, margin: "0 auto 24px" }}>
        {isChunkError
          ? autoRecovering
            ? "Kontax just updated. We are refreshing this page once to pick up the latest version."
            : "Kontax was updated while this tab was open. If the automatic refresh does not complete, reload once to recover."
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
          {isChunkError ? "Reload now" : "Reload page"}
        </button>
        {!isChunkError && !root ? (
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
        ) : null}
      </div>
    </div>
  );

  if (root) {
    return (
      <html lang="en">
        <body style={{ margin: 0 }}>{content}</body>
      </html>
    );
  }

  return content;
}
