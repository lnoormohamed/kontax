"use client";

import { useState } from "react";

import {
  computePlanDelta,
  PLAN_INFO,
  PLAN_ROWS,
  type CellValue,
  type PlanKey,
} from "~/app/_components/plan-data";

// ── Cell value renderer ───────────────────────────────────────────────────────

function DeltaVal({ v, strong }: { v: CellValue; strong?: boolean }) {
  if (v === true) return <span style={{ color: "#3f7d6a", fontWeight: 600 }}>Included</span>;
  if (v === false) return <span style={{ color: "#8b938c" }}>Not included</span>;
  const val = typeof v === "object" ? v.v : v;
  const note = typeof v === "object" ? v.note : null;
  return (
    <span style={{ color: strong ? "#1d2823" : "#5c655e", fontWeight: strong ? 600 : 500 }}>
      {val}
      {note && <span style={{ color: "#8b938c", fontWeight: 400 }}> ({note})</span>}
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type Props = {
  current: PlanKey;
  target: PlanKey;
  leadRowId?: string | null;
  onUpgrade: (target: PlanKey) => void;
  onSeeAll: () => void;
  onClose: () => void;
};

export function PlanComparisonModal({
  current,
  target,
  leadRowId,
  onUpgrade,
  onSeeAll,
  onClose,
}: Props) {
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = useState(false);

  const rows = computePlanDelta(current, target, leadRowId);
  const lead = leadRowId ? PLAN_ROWS[leadRowId] : null;
  const p = PLAN_INFO[target];
  const price = period === "annual" ? p.annualPrice : p.price;
  const per = period === "annual" ? p.annualPeriod : p.period;

  const handleUpgrade = () => {
    setBusy(true);
    onUpgrade(target);
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
        animation: "prFade .16s ease-out",
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes prFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes prRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes prSpin { to { transform: rotate(360deg) } }
      `}</style>
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
        <div
          style={{
            padding: "22px 24px 16px",
            borderBottom: "1px solid #e9ece7",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              border: "none",
              background: "transparent",
              borderRadius: 8,
              cursor: "pointer",
              color: "#8b938c",
              fontFamily: "inherit",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "#17352e",
            }}
          >
            Upgrade
          </div>
          <h2
            style={{
              margin: "6px 0 0",
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#1d2823",
            }}
          >
            Upgrade to {target}
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: 14, color: "#5c655e" }}>
            {lead
              ? `Unlock ${lead.label.toLowerCase()} and more.`
              : "Unlock more of Kontax."}
          </p>
        </div>

        {/* Delta rows */}
        <div style={{ overflowY: "auto", padding: "8px 24px 4px", flex: 1 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr auto 1fr",
              alignItems: "center",
              gap: 4,
              padding: "10px 0 6px",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "#8b938c",
            }}
          >
            <span />
            <span>
              {current}{" "}
              <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                (current)
              </span>
            </span>
            <span />
            <span>{target}</span>
          </div>

          {rows.map((r) => {
            const isLead = r.id === leadRowId;
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.3fr 1fr auto 1fr",
                  alignItems: "center",
                  gap: 4,
                  padding: "10px 10px",
                  margin: "0 -10px",
                  fontSize: 13,
                  borderRadius: 9,
                  background: isLead ? "#e7efe9" : "transparent",
                  borderBottom: isLead ? "none" : "1px solid #e9ece7",
                }}
              >
                <span style={{ color: "#1d2823", fontWeight: isLead ? 700 : 500 }}>
                  {r.label}
                  {isLead && (
                    <span
                      style={{
                        display: "block",
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: "#17352e",
                        textTransform: "uppercase",
                        letterSpacing: ".05em",
                        marginTop: 1,
                      }}
                    >
                      What you came for
                    </span>
                  )}
                </span>
                <DeltaVal v={r.from} />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aeb4ac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <DeltaVal v={r.to} strong />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px 20px",
            borderTop: "1px solid #e9ece7",
            background: "#f6f7f4",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                padding: 3,
                background: "#f2f4f0",
                border: "1px solid #d8ddd6",
                borderRadius: 9,
              }}
            >
              {(["monthly", "annual"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPeriod(m)}
                  style={{
                    border: "none",
                    background: period === m ? "#ffffff" : "transparent",
                    color: period === m ? "#1d2823" : "#5c655e",
                    fontWeight: 600,
                    fontSize: 12,
                    padding: "6px 12px",
                    borderRadius: 7,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    fontFamily: "inherit",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#1d2823",
                  letterSpacing: "-0.02em",
                }}
              >
                {price}
              </span>
              <span style={{ fontSize: 12, color: "#8b938c", marginLeft: 4 }}>{per}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onSeeAll}
              style={{
                flex: "0 0 auto",
                height: 44,
                padding: "0 18px",
                borderRadius: 11,
                border: "1px solid #d8ddd6",
                background: "#ffffff",
                color: "#1d2823",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              See all plans
            </button>
            <button
              onClick={handleUpgrade}
              disabled={busy}
              aria-label={`Upgrade to ${target} plan`}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 11,
                border: "none",
                background: "#4158f4",
                color: "#fff",
                fontSize: 14.5,
                fontWeight: 600,
                cursor: busy ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                fontFamily: "inherit",
              }}
            >
              {busy ? (
                <>
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      border: "2px solid rgba(255,255,255,.45)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "prSpin .7s linear infinite",
                    }}
                  />
                  Upgrading…
                </>
              ) : (
                `Upgrade to ${target}`
              )}
            </button>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "#8b938c", textAlign: "center" }}>
            Placeholder pricing — billing arrives later. Cancel anytime; your data is never deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
