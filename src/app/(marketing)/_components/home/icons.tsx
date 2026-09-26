// P49 · Homepage icon sprite (design P49-DB01). Rendered once at the top of
// the page; every icon below is a <use> reference into it, so the page ships
// each path once and no icon dependency is needed. Shared by server sections
// and the client hero demo (no hooks, no "use client").

export type HomeIconName =
  | "check"
  | "arrow"
  | "down"
  | "plus"
  | "search"
  | "tag"
  | "card"
  | "clock"
  | "file"
  | "code"
  | "key"
  | "lock"
  | "shield"
  | "export"
  | "sync";

const stroke = {
  fill: "none",
  stroke: "currentColor",
} as const;

export function HomeIconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="hp-i-check" viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="hp-i-arrow" viewBox="0 0 24 24">
          <path d="M5 12h13M13 6l6 6-6 6" {...stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="hp-i-down" viewBox="0 0 24 24">
          <path d="M12 5v13M6 12l6 6 6-6" {...stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="hp-i-plus" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" {...stroke} strokeWidth="1.8" strokeLinecap="round" />
        </symbol>
        <symbol id="hp-i-search" viewBox="0 0 24 24">
          <path d="M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3" {...stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="hp-i-tag" viewBox="0 0 24 24">
          <path d="M3.5 12.2V4.5a1 1 0 011-1h7.7l8.3 8.3a1 1 0 010 1.4l-7.2 7.2a1 1 0 01-1.4 0z" {...stroke} strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        </symbol>
        <symbol id="hp-i-card" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2.5" {...stroke} strokeWidth="1.7" />
          <circle cx="9" cy="11" r="2.2" {...stroke} strokeWidth="1.7" />
          <path d="M5.8 16c.5-1.5 1.7-2.3 3.2-2.3s2.7.8 3.2 2.3M14.5 10h3.5M14.5 13.5h3.5" {...stroke} strokeWidth="1.7" strokeLinecap="round" />
        </symbol>
        <symbol id="hp-i-clock" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" {...stroke} strokeWidth="1.7" />
          <path d="M12 8v4l3 2" {...stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="hp-i-file" viewBox="0 0 24 24">
          <path d="M6 3.5h8l4.5 4.5v12a.5.5 0 01-.5.5H6a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z M14 3.5V8h4.5" {...stroke} strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 13h6M9 16.5h4" {...stroke} strokeWidth="1.7" strokeLinecap="round" />
        </symbol>
        <symbol id="hp-i-code" viewBox="0 0 24 24">
          <path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5" {...stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="hp-i-key" viewBox="0 0 24 24">
          <circle cx="8" cy="15" r="4" {...stroke} strokeWidth="1.7" />
          <path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" {...stroke} strokeWidth="1.7" strokeLinecap="round" />
        </symbol>
        <symbol id="hp-i-lock" viewBox="0 0 24 24">
          <rect x="5" y="10.5" width="14" height="10" rx="2" {...stroke} strokeWidth="1.7" />
          <path d="M8 10.5V7.5a4 4 0 018 0v3" {...stroke} strokeWidth="1.7" />
        </symbol>
        <symbol id="hp-i-shield" viewBox="0 0 24 24">
          <path d="M12 3l8 3.5v5.3c0 4.4-3.2 7.6-8 9.2-4.8-1.6-8-4.8-8-9.2V6.5z" {...stroke} strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M8 8l8 8" {...stroke} strokeWidth="1.7" strokeLinecap="round" />
        </symbol>
        <symbol id="hp-i-export" viewBox="0 0 24 24">
          <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5" {...stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="hp-i-sync" viewBox="0 0 24 24">
          <path d="M4 9a8 8 0 0114-3l2 2M20 15a8 8 0 01-14 3l-2-2M20 4v4h-4M4 20v-4h4" {...stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
      </defs>
    </svg>
  );
}

// Decorative by default: every icon on the page sits next to text that
// carries its meaning.
export function Icon({
  name,
  size,
  className,
  style,
}: {
  name: HomeIconName;
  size: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#hp-i-${name}`} />
    </svg>
  );
}
