import Link from "next/link";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

/**
 * P24B-03 — Mobile variance & gating primitives (design brief P24B-DB14).
 *
 * Shared treatments that express plan / billing-lifecycle / group-role variance
 * consistently across every mobile surface. All are presentational and
 * server-compatible (navigation via <Link>, no client hooks). Built to the
 * approved DB14 tokens/copy/measurements; see spec §E0.4.
 *
 * Rules these encode:
 *  - hide (not disable) controls a role can't use → PermissionGate
 *  - distinguish empty-because-plan (UpsellCard) from empty-because-new (GenuineEmpty)
 *  - read-only (GRACE/LOCKED) wins over near-limit; suppress the create affordance
 */

// ── 01 · UpsellCard — blocking plan gate ─────────────────────────────────────
export function UpsellCard({
  feature,
  plan,
  icon = "sparkles",
  body,
  currentPlan = "Free",
  disabled = false,
  upgradeHref = "/pricing",
}: {
  feature: string;
  plan: string;
  /** WorkspaceIcon name for the feature being gated. */
  icon?: string;
  body: string;
  currentPlan?: string;
  /** Offline/temporary gate: shows a disabled "Reconnect to upgrade". */
  disabled?: boolean;
  upgradeHref?: string;
}) {
  const buttonBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    padding: "0 22px",
    marginTop: 18,
    borderRadius: 12,
    border: "none",
    color: "#fff",
    fontSize: 14.5,
    fontWeight: 600,
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 460,
        margin: "0 auto",
        textAlign: "center",
        background: "#fff",
        border: "1px solid #d8ddd6",
        borderRadius: 18,
        padding: "30px 26px",
        boxShadow: "0 1px 2px rgba(20,30,25,0.03)",
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
        }}
      >
        <WorkspaceIcon name={icon} size={26} strokeWidth={1.6} className="text-[#17352e]" />
      </span>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "#1d2823", lineHeight: 1.25 }}>
        {feature} is a {plan} feature
      </h3>
      <p style={{ margin: "9px auto 0", fontSize: 13.5, color: "#5c655e", lineHeight: 1.55, maxWidth: 300 }}>{body}</p>
      {disabled ? (
        <button disabled style={{ ...buttonBase, background: "#aeb4ac", cursor: "not-allowed" }} type="button">
          Reconnect to upgrade
        </button>
      ) : (
        <Link href={upgradeHref} style={{ ...buttonBase, background: "#4158f4" }}>
          Upgrade to {plan}
        </Link>
      )}
      <p style={{ margin: "14px 0 0", fontSize: 12, color: "#8b938c" }}>You&apos;re on the {currentPlan} plan.</p>
    </div>
  );
}

// ── Genuine empty (Rule 2 contrast — must NOT look like an upsell) ────────────
export function GenuineEmpty({
  title,
  body,
  icon = "sync",
}: {
  title: string;
  body: string;
  icon?: string;
}) {
  return (
    <div style={{ width: "100%", textAlign: "center", padding: "34px 26px" }}>
      <span
        style={{
          width: 52,
          height: 52,
          margin: "0 auto 14px",
          borderRadius: 14,
          background: "#f2f4f0",
          display: "grid",
          placeItems: "center",
        }}
      >
        <WorkspaceIcon name={icon} size={24} strokeWidth={1.6} className="text-[#aeb4ac]" />
      </span>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#5c655e" }}>{title}</h3>
      <p style={{ margin: "7px auto 0", fontSize: 13, color: "#8b938c", lineHeight: 1.5, maxWidth: 260 }}>{body}</p>
    </div>
  );
}

// ── 02 · NearLimitBanner ─────────────────────────────────────────────────────
export function NearLimitBanner({
  used,
  limit,
  unit = "contacts",
  target = "Pro",
  atLimit = false,
  upgradeHref = "/pricing",
}: {
  used: number;
  limit: number;
  unit?: string;
  target?: string;
  /** At the ceiling: the consuming screen should also disable its create affordance. */
  atLimit?: boolean;
  upgradeHref?: string;
}) {
  const remaining = Math.max(0, limit - used);
  return (
    <div
      style={{
        flexShrink: 0,
        background: "#f6edd9",
        borderBottom: "1px solid #ecdcb6",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 14px",
      }}
    >
      <WorkspaceIcon name="warning" size={16} strokeWidth={1.9} className="shrink-0 text-[#bf8526]" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "#6f5417", lineHeight: 1.35 }}>
          {atLimit ? `You've used all ${limit} ${unit}.` : `${used} of ${limit} ${unit} — ${remaining} remaining`}
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "#8a6a26" }}>Available on {target} and above.</p>
      </div>
      <Link
        href={upgradeHref}
        style={{ flexShrink: 0, color: "#4158f4", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
      >
        Upgrade
      </Link>
    </div>
  );
}

// ── 03 · ReadOnlyBanner ──────────────────────────────────────────────────────
export function ReadOnlyBanner({
  variant = "grace",
  reason,
  canManage = true,
  manageHref = "/settings",
}: {
  variant?: "grace" | "locked";
  /** Defaults to a generic reason; pass the real lifecycle reason where known. */
  reason?: string;
  /** Non-owners can't manage billing — hide the "Manage plan" link. */
  canManage?: boolean;
  manageHref?: string;
}) {
  const defaultReason =
    variant === "locked"
      ? "Your subscription was canceled. Owned data stays viewable."
      : "Payment failed — fix billing to keep editing.";
  return (
    <div
      style={{
        flexShrink: 0,
        background: "#f3e1da",
        borderBottom: "1px solid #e7c8bd",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 14px",
      }}
    >
      <WorkspaceIcon name="warning" size={16} strokeWidth={1.9} className="shrink-0 text-[#b5472f]" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#7c2f1d", lineHeight: 1.35 }}>
          Your account is read-only.
        </p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9a5240", lineHeight: 1.35 }}>{reason ?? defaultReason}</p>
      </div>
      {canManage ? (
        <Link
          href={manageHref}
          style={{ flexShrink: 0, color: "#b5472f", fontSize: 12.5, fontWeight: 700, textDecoration: "underline" }}
        >
          Manage plan
        </Link>
      ) : null}
    </div>
  );
}

// ── 04 · PendingChip ─────────────────────────────────────────────────────────
export function PendingChip({ label = "Pending" }: { label?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        borderRadius: 6,
        background: "#f2f4f0",
        color: "#8b938c",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}

// ── 05 · PermissionGate ──────────────────────────────────────────────────────
// Hide (do not disable) controls a role can't use. For temporary gates (offline,
// read-only) keep the control visible and pass `disabled` to it instead — that's
// the consuming component's job, not this gate's.
export function PermissionGate({
  allow,
  children,
  fallback = null,
}: {
  allow: boolean;
  children: React.ReactNode;
  /** Optional read-only stand-in (e.g. a static role label) for members. */
  fallback?: React.ReactNode;
}) {
  return <>{allow ? children : fallback}</>;
}
