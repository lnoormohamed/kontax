"use client";

// Admin icon set (24-grid stroke), ported from the design prototype's `AI` map.
// Marked client so it can be rendered inside both server pages and the
// interactive client components (dialogs, toggles, slide-over).

export const AD = {
  ink: "#1d2823",
  ink2: "#5c655e",
  mute: "#8b938c",
  faint: "#aeb4ac",
  line: "#d8ddd6",
  blue: "#4158f4",
  red: "#dc2626",
  amber: "#d97706",
  green: "#15803d",
} as const;

const AI: Record<string, string[]> = {
  users: ["M9 11a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8z", "M2.5 20c0-3.4 2.9-5.4 6.5-5.4s6.5 2 6.5 5.4", "M16.5 4.6a3 3 0 010 5.8", "M18 14.4c2.2.7 3.5 2.2 3.5 4.6"],
  metrics: ["M4 20V4", "M4 20h16", "M8 20v-6", "M12.5 20V9", "M17 20v-9", "M8 11l4.5-5L17 9"],
  flag: ["M5 21V4", "M5 4h11l-2.2 3.5L16 11H5"],
  audit: ["M6 3.5h9l3.5 3.5V20a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z", "M14.5 3.5V8H19", "M8 12h7", "M8 15.5h7", "M8 8.5h3"],
  exit: ["M14 20H6a1 1 0 01-1-1V5a1 1 0 011-1h8", "M17 8l4 4-4 4", "M21 12H10"],
  search: ["M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3"],
  eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z", "M12 15a3 3 0 100-6 3 3 0 000 6z"],
  card: ["M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2z", "M3 9.5h18", "M6.5 15.5h4"],
  chevd: ["M6 9l6 6 6-6"],
  chev: ["M9 6l6 6-6 6"],
  chevu: ["M6 15l6-6 6 6"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  warn: ["M12 4l9 16H3z", "M12 10v4", "M12 17h.01"],
  filter: ["M4 6h16", "M7 12h10", "M10 18h4"],
  calendar: ["M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z", "M4 9.5h16", "M8 3.5v3", "M16 3.5v3"],
  edit: ["M4 20h4L19 9l-4-4L4 16z", "M14 6l4 4"],
  sync: ["M4 9a8 8 0 0114-3l2 2", "M20 15a8 8 0 01-14 3l-2-2", "M20 4v4h-4", "M4 20v-4h4"],
  upload: ["M12 16V4", "M7 9l5-5 5 5", "M5 20h14"],
  share: ["M16 8a3 3 0 10-3-3", "M8 14a3 3 0 100-2 3 3 0 000 2z", "M16 19a3 3 0 10-3-3", "M10.5 12.5l4 2.5M14.5 6.8l-4 4.3"],
  merge: ["M7 4v6a5 5 0 005 5h5", "M14 4v6", "M14 12l3 3-3 3"],
  fam: ["M4 11.5L12 5l8 6.5", "M6 10.3V19h12v-8.7", "M10 19v-4.6h4V19"],
  account: ["M12 12.4a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8z", "M5 19.2c0-3 3.1-4.8 7-4.8s7 1.8 7 4.8"],
  spinner: ["M12 3a9 9 0 109 9"],
  check: ["M4 12.5l5 5 11-11"],
  flagchip: ["M5 21V4", "M5 4h11l-2.2 3.5L16 11H5"],
};

export function AdIcon({
  name,
  size = 18,
  c = AD.ink2,
  w = 1.7,
  spin = false,
}: {
  name: string;
  size?: number;
  c?: string;
  w?: number;
  spin?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spin ? "ad-spin" : undefined}
    >
      {(AI[name] ?? []).map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}
