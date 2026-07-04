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

// ── P46-DB03: notification aging & event-passed derivation ────────────────────
// Two independent triggers, kept distinct (D1):
//   • aged        — createdAt older than AGED_AFTER_DAYS. "still true, just old."
//   • eventPassed — (eventAt ?? expiresAt) is now in the past. "the thing this
//                   was about is over." Can fire on a fresh (< threshold) row.
// The one named threshold — no scattered literals.
export const AGED_AFTER_DAYS = 7;
const AGED_AFTER_MS = AGED_AFTER_DAYS * 24 * 60 * 60 * 1000;

// D3 — read-time outcome of a SHARING invite, resolved server-side from the
// linked entity: "expired" (gone → disable) / "accepted" (consumed → repoint).
export type ShareOutcome = "expired" | "accepted";

/** The linked-invite fields the outcome derivation reads. */
export type ShareValidityRow = {
  status: string;
  recipientContactId: string | null;
  expiresAt: Date | string | null;
};

/**
 * D3 — derive a SHARING invite's actionability from the linked entity, never
 * from the notification's age:
 *   • accepted (recipientContactId set) → the invite was consumed. "Passed",
 *     link repointed to the copied contact.
 *   • not ACTIVE (revoked/declined/expired) or past its expiresAt → the invite is
 *     gone. "Expired", link disabled so it can't dead-end the user.
 *   • otherwise still pending → live; age/date rules apply as usual.
 */
export function resolveShareInviteOutcome(
  share: ShareValidityRow,
  now = Date.now(),
): { outcome: "live" | ShareOutcome; actionUrl: string | null } {
  if (share.recipientContactId) {
    return { outcome: "accepted", actionUrl: `/contacts/${share.recipientContactId}` };
  }
  const dateExpired = share.expiresAt != null && new Date(share.expiresAt).getTime() < now;
  if (share.status !== "ACTIVE" || dateExpired) {
    return { outcome: "expired", actionUrl: null };
  }
  return { outcome: "live", actionUrl: null };
}

/** Minimal shape the aging derivation reads off a feed row. */
export type AgingInput = {
  createdAt: string | Date;
  eventAt?: string | Date | null;
  expiresAt?: string | Date | null;
  // Entity truth (D3): the linked invite is gone/consumed even if no date passed.
  entityPassed?: boolean;
};

export type Aging = {
  /** createdAt older than the threshold. */
  aged: boolean;
  /** the dated moment / deadline has passed. */
  eventPassed: boolean;
  /** either trigger fired → render the muted register. */
  muted: boolean;
};

/**
 * Compute both aging triggers for one row against `now`. Independent by design:
 * a row can be neither, aged-only, passed-only (fresh but event over), or both.
 */
export function deriveAging(row: AgingInput, now = Date.now()): Aging {
  const aged = now - new Date(row.createdAt).getTime() >= AGED_AFTER_MS;
  const moment = row.eventAt ?? row.expiresAt ?? null;
  const datePassed = moment != null && new Date(moment).getTime() < now;
  const eventPassed = datePassed || row.entityPassed === true;
  return { aged, eventPassed, muted: aged || eventPassed };
}

export type EventAffix = { label: "Passed" | "Expired"; disableAction: boolean } | null;

/**
 * D3 — actionability of an event-passed row. Merely-aged (not event-passed) gets
 * no affix; the timestamp already says "old". For event-passed rows the affix is
 * the visible signal of which branch fired:
 *   • SHARING invite resolved gone (`shareOutcome === "expired"`, or a passed
 *     `expiresAt` date hint) → "Expired" + the deep-link is disabled so it can't
 *     dead-end the user.
 *   • SHARING invite consumed (`shareOutcome === "accepted"`) → "Passed", link
 *     stays live (server has repointed it to the copied contact).
 *   • everything else event-passed → "Passed", link stays live (target still
 *     resolves — e.g. a birthday's contact).
 */
export function deriveEventAffix(
  row: {
    category: NotificationCategory;
    expiresAt?: string | Date | null;
    shareOutcome?: ShareOutcome | null;
  },
  aging: Aging,
): EventAffix {
  if (!aging.eventPassed) return null;
  if (row.shareOutcome === "accepted") return { label: "Passed", disableAction: false };
  if (row.shareOutcome === "expired") return { label: "Expired", disableAction: true };
  if (row.category === "SHARING" && row.expiresAt != null) {
    return { label: "Expired", disableAction: true };
  }
  return { label: "Passed", disableAction: false };
}
