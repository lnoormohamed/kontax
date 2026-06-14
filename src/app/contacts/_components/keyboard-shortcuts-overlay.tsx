"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// P28-05 — keyboard-shortcuts overlay (P28-DB09 §4). Centered modal summoned by
// `?`, grouped Navigation / Contacts / Lists, each row a space-between of key
// chips and the action. Backdrop rgba(29,40,35,0.5).

type Row = { keys: string[]; glyph?: string; action: string };

const SHORTCUTS: { group: string; rows: Row[] }[] = [
  {
    group: "Navigation",
    rows: [
      { keys: ["j", "/", "k"], action: "Next / previous contact" },
      { keys: ["↵"], glyph: "Return", action: "Open contact detail" },
      { keys: ["Esc"], action: "Close / go back" },
    ],
  },
  {
    group: "Contacts",
    rows: [
      { keys: ["c"], action: "Create contact" },
      { keys: ["e"], action: "Edit focused contact" },
      { keys: ["f"], action: "Toggle favorite" },
      { keys: ["⌫"], glyph: "Backspace", action: "Archive contact" },
      { keys: ["/"], action: "Focus search" },
    ],
  },
  {
    group: "Lists",
    rows: [
      { keys: ["1", "–", "9"], action: "Switch to smart list 1–9" },
      { keys: ["?"], action: "Show keyboard shortcuts" },
    ],
  },
];

function KeyChip({ k }: { k: string }) {
  return (
    <kbd
      style={{
        display: "inline-grid",
        placeItems: "center",
        minWidth: 22,
        height: 22,
        padding: "0 7px",
        borderRadius: 5,
        background: "#f2f4f0",
        border: "1px solid #d8ddd6",
        fontFamily: '"Geist Mono", ui-monospace, monospace',
        fontSize: 12,
        fontWeight: 500,
        color: "#1d2823",
        lineHeight: 1,
      }}
    >
      {k}
    </kbd>
  );
}

function ShortcutRow({ row }: { row: Row }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "7px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "0 0 auto", whiteSpace: "nowrap" }}>
        {row.keys.map((k, i) =>
          k === "/" || k === "–" ? (
            <span key={i} style={{ color: "#8b938c", fontSize: 12.5, padding: "0 1px" }}>
              {k}
            </span>
          ) : (
            <KeyChip key={i} k={k} />
          ),
        )}
        {row.glyph ? <span style={{ fontSize: 12.5, color: "#8b938c", marginLeft: 3 }}>{row.glyph}</span> : null}
      </div>
      <span style={{ fontSize: 13, color: "#5c655e", textAlign: "right", whiteSpace: "nowrap" }}>{row.action}</span>
    </div>
  );
}

export function KeyboardShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(29,40,35,0.5)" }} />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          borderRadius: 16,
          padding: "28px 32px",
          boxShadow: "0 24px 60px rgba(20,30,25,0.28)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#17352e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="12" rx="1.5" />
            <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
          </svg>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "#1d2823" }}>Keyboard shortcuts</span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: "#5c655e", cursor: "pointer", fontSize: 18 }}
          >
            ✕
          </button>
        </div>
        {SHORTCUTS.map((g) => (
          <div key={g.group} style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8b938c", marginBottom: 4 }}>
              {g.group}
            </div>
            {g.rows.map((r, i) => (
              <ShortcutRow key={i} row={r} />
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
