// P22-DB05: category icon-tile config (exact hex per the design brief). Shared by
// the bell dropdown feed rows.

export type NotificationCategory =
  | "SECURITY"
  | "SHARING"
  | "SYNC_STATUS"
  | "BILLING"
  | "REMINDERS"
  | "PRODUCT_UPDATES";

export const CATEGORY_TILE: Record<
  NotificationCategory,
  { icon: string; bg: string; fg: string }
> = {
  SECURITY: { icon: "shieldAlert", bg: "#fef2f2", fg: "#dc2626" },
  SHARING: { icon: "arrowDownLeft", bg: "#f0fdf4", fg: "#16a34a" },
  SYNC_STATUS: { icon: "refreshCcw", bg: "#faf5ff", fg: "#9333ea" },
  BILLING: { icon: "creditCard", bg: "#fffbeb", fg: "#d97706" },
  REMINDERS: { icon: "cake", bg: "#eff6ff", fg: "#2563eb" },
  PRODUCT_UPDATES: { icon: "sparkles", bg: "#f0fdfa", fg: "#0d9488" },
};

/** Compact relative time for feed rows: "2m", "1h", "3d", "1w". */
export function relativeTime(value: string | Date, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(value).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}
