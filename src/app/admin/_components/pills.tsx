"use client";

// Plan + status pills (DB04 §2). Tailwind-token colours per the brief.

const PLAN_PILL: Record<string, { bg: string; fg: string }> = {
  Free: { bg: "#f3f4f6", fg: "#4b5563" }, // gray-100 / gray-600
  Pro: { bg: "#eff6ff", fg: "#1d4ed8" }, // blue-50 / blue-700
  Family: { bg: "#faf5ff", fg: "#7e22ce" }, // purple-50 / purple-700
  Teams: { bg: "#f0fdf4", fg: "#15803d" }, // green-50 / green-700
};

const STATUS_PILL: Record<string, { bg: string; fg: string; dot: string }> = {
  Active: { bg: "#f0fdf4", fg: "#15803d", dot: "#22c55e" },
  Grace: { bg: "#fffbeb", fg: "#b45309", dot: "#f59e0b" },
  Locked: { bg: "#fef2f2", fg: "#b91c1c", dot: "#ef4444" },
};

export function PlanPill({ plan }: { plan: string }) {
  const c = PLAN_PILL[plan] ?? PLAN_PILL.Free!;
  return (
    <span className="ad-pill" style={{ background: c.bg, color: c.fg }}>
      {plan}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const c = STATUS_PILL[status] ?? STATUS_PILL.Active!;
  return (
    <span className="ad-pill" style={{ background: c.bg, color: c.fg }}>
      <span className="ad-dot" style={{ background: c.dot }} />
      {status}
    </span>
  );
}
