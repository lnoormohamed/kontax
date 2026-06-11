"use client";

import { useState } from "react";

import { DOWNGRADE_COPY, type PlanKey } from "~/app/_components/plan-data";

type Props = {
  current: PlanKey;
  target: PlanKey;
  onConfirm: () => void;
  onClose: () => void;
};

export function DowngradeModal({ current, target, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const key = `${current}>${target}`;
  const d = DOWNGRADE_COPY[key] ?? DOWNGRADE_COPY["Pro>Free"]!;
  const dotColor = d.group ? "#17352e" : "#bf8526";

  const handleConfirm = () => {
    setBusy(true);
    onConfirm();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "rgba(20,30,25,.4)",
      }}
      onClick={onClose}
    >
      <style>{`@keyframes prRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }`}</style>
      <div
        style={{
          width: 520,
          maxWidth: "100%",
          maxHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 24px 60px rgba(20,30,25,.34)",
          overflow: "hidden",
          animation: "prRise .18s cubic-bezier(.2,0,.1,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "24px 26px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "rgba(181,71,47,.1)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                color: "#b5472f",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.3 3.3L2 19h20L13.7 3.3a2 2 0 00-3.4 0z" />
                <path d="M12 10v4M12 17h.01" />
              </svg>
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "#1d2823",
              }}
            >
              {d.title}
            </h2>
          </div>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 14.5,
              color: "#1d2823",
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            {d.lead}
          </p>
        </div>

        {/* Impact list */}
        <div style={{ overflowY: "auto", padding: "14px 26px 4px", flex: 1 }}>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {d.items.map((item, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 11,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: "#5c655e",
                  marginBottom: i < d.items.length - 1 ? 12 : 0,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    marginTop: 7,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: dotColor,
                  }}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* Reassurance */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "12px 14px",
              background: "#e7efe9",
              borderRadius: 11,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#17352e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M3 12l5 5L20 6" />
            </svg>
            <p style={{ margin: 0, fontSize: 13, color: "#17352e", lineHeight: 1.5, fontWeight: 500 }}>
              Your data is never deleted by downgrading. Over-limit contacts are kept read-only
              and export is always available.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            padding: "18px 26px 22px",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <button
            onClick={handleConfirm}
            disabled={busy}
            style={{
              height: 44,
              padding: "0 18px",
              borderRadius: 11,
              border: "none",
              background: "transparent",
              color: "#b5472f",
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              fontFamily: "inherit",
            }}
          >
            {busy ? "Downgrading…" : `Downgrade to ${target}`}
          </button>
          <button
            onClick={onClose}
            autoFocus
            style={{
              height: 44,
              padding: "0 22px",
              borderRadius: 11,
              border: "none",
              background: "#17352e",
              color: "#fff",
              fontSize: 14.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Keep my plan
          </button>
        </div>
      </div>
    </div>
  );
}
