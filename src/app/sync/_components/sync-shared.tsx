"use client";

// Shared primitives for the sync surface: re-auth sentinel, design tokens,
// and the spinner. Extracted so the connection-settings panel can reuse them
// without a circular import back into sync-page-client.

// P23-06: server sentinel returned by settings actions when a re-auth elevation
// is required. Mirrored here so the client can detect it and open the modal.
export const ELEVATION_REQUIRED = "SYNC_SETTINGS_ELEVATION_REQUIRED";

// ── Design tokens ────────────────────────────────────────────────────────────
export const T = {
  ink: "#1d2823",
  ink2: "#5c655e",
  mute: "#8b938c",
  line: "#d8ddd6",
  line2: "#e9ece7",
  wash: "#f2f4f0",
  green: "#17352e",
  greenSoft: "#e7efe9",
  blue: "#4158f4",
  blueT: "rgba(65,88,244,0.07)",
  amberT: "rgba(191,133,38,0.12)",
  sgreen: "#1f8a5b",
  sgreenWash: "#e3efe7",
  sgreenText: "#1c6b48",
  amber: "#bf8526",
  red: "#b5472f",
  redWash: "#f3e1da",
} as const;

export function Spinner({ size = 14, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "sy-spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
