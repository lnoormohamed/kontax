"use client";

import Link from "next/link";

import type { UpgradeGate } from "~/app/_components/plan-data";

// ── Shared icon glyphs ────────────────────────────────────────────────────────

function WarnIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.3L2 19h20L13.7 3.3a2 2 0 00-3.4 0z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function LockIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

// ── Inline banner — soft, dismissible ────────────────────────────────────────

type UpgradeBannerProps = {
  gate: UpgradeGate;
  onUpgrade: (gate: UpgradeGate) => void;
  onDismiss: () => void;
};

export function UpgradeBanner({ gate, onUpgrade, onDismiss }: UpgradeBannerProps) {
  const unlockLabel = gate.unlock === "Family" ? "Family & Teams" : "Pro and above";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "12px 14px",
        background: "#f6edd9",
        border: "1px solid #ecdcb6",
        borderRadius: 11,
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "rgba(191,133,38,.16)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          color: "#bf8526",
        }}
      >
        <WarnIcon />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#6f5417", lineHeight: 1.4 }}>
          {gate.bannerLead ?? gate.value}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 12, color: "#8a6a26" }}>
          Available on {unlockLabel}.
        </p>
      </div>
      <button
        onClick={() => onUpgrade(gate)}
        style={{
          flexShrink: 0,
          height: 32,
          padding: "0 14px",
          borderRadius: 8,
          border: "none",
          background: "#4158f4",
          color: "#fff",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Upgrade
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          borderRadius: 7,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "#8a6a26",
          fontFamily: "inherit",
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

// ── Blocking locked-state card — replaces gated content ──────────────────────

type LockedCardProps = {
  gate: UpgradeGate;
  planLabel?: string;
  onUpgrade: (gate: UpgradeGate) => void;
  compact?: boolean;
};

export function LockedCard({ gate, planLabel = "Free", onUpgrade, compact }: LockedCardProps) {
  const upgradeLabel = gate.unlock === "Family" ? "Family" : gate.unlock;

  return (
    <div
      style={{
        width: compact ? "100%" : 460,
        maxWidth: "100%",
        textAlign: "center",
        background: "#ffffff",
        border: "1px solid #d8ddd6",
        borderRadius: 18,
        padding: compact ? "30px 26px" : "40px 36px",
        boxShadow: "0 1px 2px rgba(20,30,25,.03)",
        margin: "0 auto",
      }}
    >
      <span
        style={{
          width: 58,
          height: 58,
          margin: "0 auto 16px",
          borderRadius: "50%",
          background: "#e7efe9",
          display: "grid",
          placeItems: "center",
          color: "#17352e",
        }}
      >
        <LockIcon size={26} />
      </span>
      <h2
        style={{
          margin: 0,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "#1d2823",
        }}
      >
        {gate.lockedTitle}
      </h2>
      <p
        style={{
          margin: "10px auto 0",
          fontSize: 14,
          color: "#5c655e",
          lineHeight: 1.6,
          maxWidth: 380,
        }}
      >
        {gate.value}
      </p>
      <button
        onClick={() => onUpgrade(gate)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: 46,
          padding: "0 24px",
          marginTop: 22,
          borderRadius: 12,
          border: "none",
          background: "#4158f4",
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          fontFamily: "inherit",
        }}
      >
        Upgrade to {upgradeLabel}
      </button>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Link
          href="/pricing"
          style={{
            color: "#4158f4",
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          See all plans
        </Link>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 12, color: "#8b938c" }}>
        You&rsquo;re on the {planLabel} plan
      </p>
    </div>
  );
}
