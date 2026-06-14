// P31B-03: label palette, dot, and chip — shared across sidebar, rows, detail,
// filter bar, and management modal.

export type LabelPaletteSwatch = {
  id: string;
  col: string;  // solid dot / border color
  soft: string; // chip background (~14% tint)
  text: string; // readable text on soft background
};

// Eight-swatch palette — the four brief tokens extended to an even set.
// New labels are auto-assigned in rotation order; override via recolor.
export const LABEL_PALETTE: LabelPaletteSwatch[] = [
  { id: "sage",  col: "#7aa37f", soft: "#e9f0ea", text: "#3c6149" },
  { id: "teal",  col: "#6fa3a0", soft: "#e7f0ef", text: "#336360" },
  { id: "peri",  col: "#8a93c8", soft: "#ebedf7", text: "#434c86" },
  { id: "plum",  col: "#a98cc0", soft: "#f1ecf6", text: "#5e4880" },
  { id: "rose",  col: "#c98a8a", soft: "#f6ebeb", text: "#8a4242" },
  { id: "clay",  col: "#c08d6a", soft: "#f4ece4", text: "#855736" },
  { id: "gold",  col: "#c9a86a", soft: "#f6efdd", text: "#7e5d1e" },
  { id: "olive", col: "#9aa86a", soft: "#eef1e3", text: "#566133" },
];

const BY_COL = new Map(LABEL_PALETTE.map((p) => [p.col, p]));

export function paletteSwatch(col: string): LabelPaletteSwatch {
  return BY_COL.get(col) ?? { id: "custom", col, soft: "#eef0ec", text: "#5c655e" };
}

// ── LabelDot ─────────────────────────────────────────────────────────────────

interface LabelDotProps {
  col: string;
  size?: number;
}

export function LabelDot({ col, size = 9 }: LabelDotProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 3,
        background: col,
        flexShrink: 0,
      }}
    />
  );
}

// ── LabelChip ────────────────────────────────────────────────────────────────
// sz: "sm" (h:22, contact rows) | "md" (h:28, detail / filter bar)
// ghost: dashed outline "Add label" affordance
// onRemove: shows an ✕ button (detail only)

interface LabelChipProps {
  name: string;
  col: string;
  sz?: "sm" | "md";
  ghost?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
}

export function LabelChip({ name, col, sz = "sm", ghost = false, onRemove, onClick }: LabelChipProps) {
  const p = paletteSwatch(col);
  const h = sz === "md" ? 28 : 22;
  const px = sz === "md" ? "0 11px 0 10px" : "0 9px 0 8px";
  const gap = sz === "md" ? 7 : 6;
  const fs = sz === "md" ? 13 : 12;
  const dotSize = sz === "md" ? 8 : 7;

  if (ghost) {
    return (
      <span
        className={onClick ? "cursor-pointer" : undefined}
        onClick={onClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: h,
          padding: px,
          borderRadius: 999,
          border: "1px dashed #d8ddd6",
          background: "transparent",
          color: "#8b938c",
          fontSize: fs,
          fontWeight: 600,
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: fs - 1, lineHeight: 1 }}>+</span>
        {name}
      </span>
    );
  }

  const inner = (
    <>
      <LabelDot col={col} size={dotSize} />
      <span style={{ lineHeight: 1 }}>{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remove ${name}`}
          style={{
            display: "grid",
            placeItems: "center",
            marginLeft: 1,
            width: 16,
            height: 16,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: p.text,
            opacity: 0.75,
            padding: 0,
            cursor: "pointer",
            fontSize: 11,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </>
  );

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap,
    height: h,
    padding: px,
    borderRadius: 999,
    background: p.soft,
    color: p.text,
    fontSize: fs,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{ ...style, border: "none", cursor: "pointer" }}
      >
        {inner}
      </button>
    );
  }

  return <span style={style}>{inner}</span>;
}

// ── RecolorSwatches ───────────────────────────────────────────────────────────

interface RecolorSwatchesProps {
  value: string;
  onPick: (col: string) => void;
  size?: number;
}

export function RecolorSwatches({ value, onPick, size = 26 }: RecolorSwatchesProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {LABEL_PALETTE.map((p) => {
        const on = p.col === value;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.col)}
            title={p.id}
            aria-label={p.id}
            aria-pressed={on}
            style={{
              width: size,
              height: size,
              borderRadius: 8,
              background: p.col,
              border: "none",
              padding: 0,
              cursor: "pointer",
              position: "relative",
              boxShadow: on
                ? `0 0 0 2px #fff, 0 0 0 4px ${p.col}`
                : "inset 0 0 0 1px rgba(0,0,0,.07)",
            }}
          >
            {on && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 12 12"
                fill="none"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: "absolute", inset: 0, margin: "auto" }}
              >
                <path d="M2.5 6.2l2.3 2.3L9.5 3.5" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
