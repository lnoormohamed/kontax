"use client";

// Initials avatar — same look as the design prototype's Avatar.

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministic soft background from the name so avatars are distinguishable.
const PALETTE = [
  { bg: "#e7efe9", fg: "#17352e" },
  { bg: "#eef2ff", fg: "#3730a3" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#fae8ff", fg: "#86198f" },
  { bg: "#dcfce7", fg: "#166534" },
  { bg: "#ffe4e6", fg: "#9f1239" },
];

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const c = PALETTE[h % PALETTE.length]!;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: c.bg,
        color: c.fg,
        display: "grid",
        placeItems: "center",
        fontWeight: 600,
        fontSize: Math.round(size * 0.4),
        flex: "0 0 auto",
      }}
    >
      {initials(name)}
    </span>
  );
}
