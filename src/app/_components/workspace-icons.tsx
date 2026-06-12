// Shared line icons for the contacts workspace (header + sidebar + nav).
// Pure SVG — safe in server components. Paths mirror the approved design kit.

const PATHS: Record<string, string[]> = {
  search: ["M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3"],
  people: [
    "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
    "M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5",
    "M16 5.2a3 3 0 010 5.6",
    "M17.5 14.4c2 .8 3.5 2.3 3.5 4.6",
  ],
  star: ["M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 17.8 6.1 20.5l1.3-6.3L2.7 9.6l6.3-.7z"],
  archive: ["M3 7h18v3H3z", "M5 10v9h14v-9", "M9.5 13.5h5"],
  plus: ["M12 5v14", "M5 12h14"],
  bell: ["M18 8a6 6 0 10-12 0c0 7-2 8-2 8h16s-2-1-2-8", "M10.5 21a1.8 1.8 0 003 0"],
  upload: ["M12 16V4", "M7 9l5-5 5 5", "M5 20h14"],
  download: ["M12 4v12", "M7 11l5 5 5-5", "M5 20h14"],
  sync: ["M4 9a8 8 0 0114-3l2 2", "M20 15a8 8 0 01-14 3l-2-2", "M20 4v4h-4", "M4 20v-4h4"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  clock: ["M12 3a9 9 0 100 18 9 9 0 000-18z", "M12 7v5l3.5 2"],
  back: ["M15 5l-7 7 7 7"],
  phone: [
    "M6.5 4h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 6.2 2 2 0 016.5 4z",
  ],
  mail: ["M3.5 6h17v12h-17z", "M4 6.5l8 6 8-6"],
  share: ["M5 12v7h14v-7", "M12 3v12", "M8 7l4-4 4 4"],
  send: ["M21 3L3 10.5l7 2.5 2.5 7z", "M21 3l-9 11"],
  live: [
    "M12 12.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
    "M8.2 7.8a5 5 0 000 8.4",
    "M15.8 7.8a5 5 0 010 8.4",
    "M5.6 5.2a8.5 8.5 0 000 13.6",
    "M18.4 5.2a8.5 8.5 0 010 13.6",
  ],
  link: ["M9.5 13.5l5-5", "M8 11l-2 2a3.5 3.5 0 005 5l2-2", "M16 13l2-2a3.5 3.5 0 00-5-5l-2 2"],
  chevronRight: ["M9 5l7 7-7 7"],
  check: ["M5 12.5l4.5 4.5L19 7"],
  briefcase: ["M3 8h18v12H3z", "M8 8V5.5h8V8", "M3 13h18"],
  gift: [
    "M4 11h16v9H4z",
    "M3 8h18v3H3z",
    "M12 8v12",
    "M12 8S10.5 4 8.5 5 9 8 12 8z",
    "M12 8s1.5-4 3.5-3-.5 3-3.5 3z",
  ],
  restore: ["M3 7h18v3.5H3z", "M5 10.5V19h14v-8.5", "M12 17v-4", "M10 15l2-2 2 2"],
  x: ["M6 6l12 12", "M18 6L6 18"],
  cloud: ["M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 18z"],
  copy: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
  emergency: ["M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6z", "M12 8.5v3.5", "M12 14.5h.01"],
  users: [
    "M8 11a3 3 0 100-6 3 3 0 000 6z",
    "M2 19c0-3 2.4-4.8 6-4.8s6 1.8 6 4.8",
    "M16 5.2a3 3 0 010 5.6",
    "M17.5 14.6c2 .8 3.5 2 3.5 4.4",
  ],
  team: [
    "M4 21V9l6-4 6 4v12",
    "M9 21v-5h2v5",
    "M14 12h2",
    "M14 9h2",
    "M16 21h4V12l-4-2.5",
  ],
  pencil: ["M4 20h4l10.5-10.5a2 2 0 00-2.8-2.8L5 17.2z", "M13.5 6.5l4 4"],
  warning: ["M12 4l9 16H3z", "M12 10v4", "M12 17h.01"],
  merge: ["M7 4v6a5 5 0 005 5h5", "M17 4v6", "M14 12l3 3-3 3", "M7 4l-2 2", "M7 4l2 2"],
  trash: ["M4 7h16", "M9 7V4.5h6V7", "M6 7l1 13h10l1-13", "M10 11v6", "M14 11v6"],
  lock: ["M8 11V7a4 4 0 018 0v4", "M5 11h14v10H5z"],
  signout: ["M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  person: ["M12 11a4 4 0 100-8 4 4 0 000 8z", "M4 21c0-4 3.6-7 8-7s8 3 8 7"],
  gear: [
    "M12 9a3 3 0 100 6 3 3 0 000-6z",
    "M19 12a7 7 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3L14 2h-4l-.3 2.4a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .9.1 1.3l-2 1.6 2 3.4 2.4-1a7 7 0 002.2 1.3L10 22h4l.3-2.4a7 7 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z",
  ],
  // P22-DB05: notification category icons (Lucide-style, 24×24).
  shieldAlert: [
    "M12 2.5l7.5 2.7V11c0 5.2-3.5 8.4-7.5 9.8C8 19.4 4.5 16.2 4.5 11V5.2z",
    "M12 8.2v4.2",
    "M12 15.6h.01",
  ],
  arrowDownLeft: ["M17 7L7 17", "M16.5 17H7V7.5"],
  creditCard: [
    "M3.5 5.5h17A1.5 1.5 0 0122 7v10a1.5 1.5 0 01-1.5 1.5h-17A1.5 1.5 0 012 17V7a1.5 1.5 0 011.5-1.5z",
    "M2 9.8h20",
    "M6 14h4",
  ],
  cake: [
    "M4.5 21h15",
    "M6 21v-7.5h12V21",
    "M6 13.5a1.8 1.8 0 001.8-1.6 1.8 1.8 0 001.8 1.6 1.8 1.8 0 001.8-1.6 1.8 1.8 0 001.8 1.6 1.8 1.8 0 001.8-1.6 1.8 1.8 0 001.8 1.6",
    "M8.5 9.5V6.5",
    "M12 9.5V6.5",
    "M15.5 9.5V6.5",
    "M8.5 4.6h.01",
    "M12 4.6h.01",
    "M15.5 4.6h.01",
  ],
  sparkles: [
    "M12 3.2l1.7 4.9 4.9 1.7-4.9 1.7L12 16.4l-1.7-4.9L5.4 9.8l4.9-1.7z",
    "M18.8 14.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  ],
  refreshCcw: [
    "M21 11.5A8.5 8.5 0 0 0 6.6 6L3 9.2",
    "M3 4.4V9.2h4.8",
    "M3 12.5A8.5 8.5 0 0 0 17.4 18L21 14.8",
    "M21 19.6V14.8h-4.8",
  ],
};

export function WorkspaceIcon({
  name,
  size = 18,
  className,
  strokeWidth = 1.7,
  fill = "none",
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const paths = PATHS[name] ?? [];
  return (
    <svg
      aria-hidden
      className={className}
      fill={fill}
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths.map((d, index) => (
        <path d={d} key={index} />
      ))}
    </svg>
  );
}
