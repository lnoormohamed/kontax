"use client";

import { useEffect, useState } from "react";

import {
  attemptChunkErrorRecovery,
  isRecoverableChunkError,
} from "./chunk-error-recovery";

// P42-01 §3: connectivity blips must not read as app errors. Match only
// network-failure signatures (fetch TypeErrors / offline at render time) —
// genuine app errors keep the full error shell below.
const CONNECTIVITY_MESSAGE =
  /failed to fetch|load failed|networkerror|fetch failed|network request failed/i;

function isConnectivityError(error: Error): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError && CONNECTIVITY_MESSAGE.test(error.message ?? "");
}

/**
 * Calm connectivity fallback — same amber family and voice as the P42-DB01
 * banner. Retries via `reset()` the moment the connection returns; nothing
 * about it suggests the app is broken.
 */
function ConnectivityShell({ reset, root }: { reset: () => void; root: boolean }) {
  useEffect(() => {
    const retry = () => reset();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [reset]);

  const content = (
    <div
      role="status"
      aria-live="polite"
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
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 8.5C5 6 8.5 4.6 12 4.6" />
          <path d="M5.5 12c1.3-1 2.9-1.6 4.5-1.8" />
          <path d="M9 15.5c.9-.5 2-.8 3-.8" />
          <path d="M12 19h.01" />
          <path d="M2 2l20 20" />
        </svg>
      </div>

      <h1 style={{ fontSize: 21, fontWeight: 700, color: "#1d2823", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
        You&rsquo;re offline
      </h1>
      <p style={{ fontSize: 14, color: "#5c655e", lineHeight: 1.55, maxWidth: 340, margin: "0 auto 24px" }}>
        This page needs a connection to load. Your contacts are safe &mdash; we&rsquo;ll retry
        automatically as soon as you&rsquo;re back online.
      </p>

      <button
        onClick={reset}
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
        Try again
      </button>
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
  // P42-01 §3: a chunk error takes precedence (it has its own recovery); after
  // that, connectivity failures get the calm offline fallback, not the shell.
  const isOfflineError = !isChunkError && isConnectivityError(error);
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

  if (isOfflineError) {
    return <ConnectivityShell reset={reset} root={root} />;
  }

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
