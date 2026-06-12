"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * P24B-05 — Confirm / destructive-action dialog (spec §D4).
 *
 * Centered card over a scrim. 17/700 title, 14 ink2 body, action row with a
 * destructive (red) or neutral (green) primary + outline cancel. Dismiss on
 * scrim tap / Escape / cancel. Rendered via a portal so it escapes any
 * overflow-hidden ancestor. Respects prefers-reduced-motion.
 *
 * Use for archive-all, leave family, revoke device, delete, sign out, etc.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  /** Async in flight — disables buttons and shows a working label. */
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, busy, onClose]);

  if (!mounted || !open) return null;

  const primaryBg = busy ? "#aeb4ac" : destructive ? "#b5472f" : "#17352e";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
      }}
    >
      <div
        onClick={busy ? undefined : onClose}
        className="cd-scrim"
        style={{ position: "absolute", inset: 0, background: "rgba(20,28,24,0.42)" }}
      />
      <div
        className="cd-card"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          background: "#fff",
          borderRadius: 18,
          padding: "22px 22px 16px",
          boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1d2823", lineHeight: 1.3 }}>{title}</h2>
        {body ? <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "#5c655e" }}>{body}</p> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 12,
              border: "1px solid #d8ddd6",
              background: "#fff",
              color: "#5c655e",
              fontSize: 15,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 12,
              border: "none",
              background: primaryBg,
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        .cd-scrim { animation: cd-fade .18s ease; }
        .cd-card { animation: cd-pop .22s cubic-bezier(.2,.8,.2,1); }
        @keyframes cd-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cd-pop { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) {
          .cd-scrim, .cd-card { animation: none; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
