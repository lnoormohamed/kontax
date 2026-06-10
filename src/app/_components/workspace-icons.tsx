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
  signout: ["M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  gear: [
    "M12 9a3 3 0 100 6 3 3 0 000-6z",
    "M19 12a7 7 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3L14 2h-4l-.3 2.4a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .9.1 1.3l-2 1.6 2 3.4 2.4-1a7 7 0 002.2 1.3L10 22h4l.3-2.4a7 7 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z",
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
