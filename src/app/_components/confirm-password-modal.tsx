"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { verifyPasswordForStepUp } from "~/app/actions/account";

// Reusable step-up auth modal (P31-02). Shows before any sensitive action when
// the user has a password set. OAuth-only users bypass this automatically at
// the server action level — this component should not be mounted for them.
export function ConfirmPasswordModal({
  title,
  description,
  confirmLabel = "Confirm",
  onConfirmed,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirmed: () => Promise<void>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await verifyPasswordForStepUp(password);
      if (!result.ok) {
        setError(
          result.error === "RATE_LIMITED"
            ? "Too many attempts. Please wait a moment and try again."
            : "Incorrect password. Please try again.",
        );
        setPassword("");
        inputRef.current?.focus();
        return;
      }
      try {
        await onConfirmed();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] grid place-items-center p-4"
      style={{ background: "rgba(20,30,25,0.48)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-[1.6rem] bg-white p-6 shadow-[0_24px_60px_rgba(20,30,25,0.28)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* lock icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f2f4f0", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5c655e" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1d2823", letterSpacing: "-0.01em" }}>{title}</h3>
        </div>

        <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.55, color: "#5c655e" }}>{description}</p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "#8b938c", marginBottom: 6 }}>
              Your password
            </span>
            <input
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
              disabled={isPending}
              style={{
                display: "block",
                width: "100%",
                padding: "11px 16px",
                borderRadius: 14,
                border: `1.5px solid ${error ? "#c98a76" : "#d8ddd6"}`,
                fontSize: 14,
                color: "#1d2823",
                background: "#fff",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              placeholder="Enter your Kontax password"
            />
          </label>

          {error && (
            <p style={{ margin: "7px 0 0", fontSize: 12.5, color: "#9a3a23" }}>{error}</p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{ padding: "10px 18px", borderRadius: 14, border: "1px solid #d8ddd6", background: "#fff", fontSize: 14, fontWeight: 600, color: "#1d2823", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password || isPending}
              style={{ padding: "10px 18px", borderRadius: 14, border: "none", background: "#17352e", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: (!password || isPending) ? 0.55 : 1 }}
            >
              {isPending ? "Verifying…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
