"use client";

// Root-level error boundary. Only fires when the root layout itself crashes —
// very rare. Renders its own <html> + <body> because Next.js unmounts the layout.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error.message?.includes("module factory") ||
    error.message?.includes("ChunkLoadError") ||
    error.message?.includes("Failed to fetch dynamically imported module");

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#f6f7f4" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100dvh",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 21, fontWeight: 700, color: "#1d2823", margin: "0 0 8px" }}>
            {isChunkError ? "Update available" : "Something went wrong"}
          </h1>
          <p style={{ fontSize: 14, color: "#5c655e", lineHeight: 1.55, maxWidth: 300, margin: "0 auto 24px" }}>
            {isChunkError
              ? "Kontax was updated. Reload to get the latest version."
              : "An unexpected error occurred. Reload to recover."}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => window.location.reload()}
              style={{ height: 44, padding: "0 24px", borderRadius: 12, background: "#17352e", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              Reload
            </button>
            {!isChunkError && (
              <button
                onClick={reset}
                style={{ height: 44, padding: "0 24px", borderRadius: 12, background: "#fff", color: "#1d2823", fontSize: 14, fontWeight: 600, border: "1.5px solid #d8ddd6", cursor: "pointer" }}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
