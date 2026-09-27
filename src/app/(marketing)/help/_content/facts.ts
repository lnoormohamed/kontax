// P50A-05 · Product facts quoted in help articles. Plan limits are read from
// the entitlement matrix and sync thresholds from sync-health.ts; values whose
// source module pulls in the database or Redis are mirrored here and pinned to
// their source by tests/node/help-centre.test.ts (it reads the source text), so
// the help centre can't drift from the product silently.

import { TEAMS_SEAT_MIN } from "~/app/_components/plan-data";
import { PAYMENT_GRACE_DAYS, PLAN_DEFAULTS } from "~/server/dav/plan-entitlements.mjs";
import { DEFAULT_MAX_ATTEMPTS_BEFORE_PAUSE, MANUAL_CONFLICT_QUEUE_LIMIT } from "~/server/sync-health";

const fmt = (n: number) => n.toLocaleString("en-GB");

const need = (n: number | null, what: string): number => {
  if (n === null) throw new Error(`help facts: expected a finite ${what}`);
  return n;
};

export const FACTS = {
  // ── Plans (src/server/dav/plan-entitlements.mjs) ──
  freeContactLimit: fmt(need(PLAN_DEFAULTS.FREE.contactsLimit, "Free contact limit")),
  freeSyncAccounts: PLAN_DEFAULTS.FREE.syncAccountsLimit,
  /** Import runs a month on Free (P49A-19: runs, not contacts). */
  freeMonthlyImports: need(PLAN_DEFAULTS.FREE.monthlyImportLimit, "Free monthly imports"),
  proSyncAccounts: PLAN_DEFAULTS.PRO.syncAccountsLimit,
  freeDevicePasswords: PLAN_DEFAULTS.FREE.appPasswordsLimit,
  proDevicePasswords: PLAN_DEFAULTS.PRO.appPasswordsLimit,
  freeHistoryShown: need(PLAN_DEFAULTS.FREE.historyDisplayCap, "Free history cap"),
  proActivityDays: need(PLAN_DEFAULTS.PRO.activityLogRetentionDays, "Pro activity retention"),
  familyActivityDays: need(PLAN_DEFAULTS.FAMILY.activityLogRetentionDays, "Family activity retention"),
  familyMembers: need(PLAN_DEFAULTS.FAMILY.memberSlotsLimit, "Family member slots"),
  /** Teams is per seat: the team size is the number of seats bought, from this
   *  minimum (src/app/actions/billing.ts, pinned by pricing-plan-data.test.ts).
   *  PLAN_DEFAULTS.TEAMS.memberSlotsLimit is only a fallback default. */
  teamsMinSeats: TEAMS_SEAT_MIN,
  /** Failed-payment grace before the account uses Free limits (P49A-19: enforced). */
  paymentGraceDays: PAYMENT_GRACE_DAYS,

  // ── Sync (src/server/sync-health.ts) ──
  conflictQueueLimit: MANUAL_CONFLICT_QUEUE_LIMIT,
  autoPauseDefaultFailures: DEFAULT_MAX_ATTEMPTS_BEFORE_PAUSE,

  // ── Mirrored (pinned by tests/node/help-centre.test.ts) ──
  /** src/app/actions/account.ts — scheduledDeleteAt = now + 30 days */
  deletionGraceDays: 30,
  /** src/server/stripe-handlers.ts — TEAMS_GRACE_MS */
  teamsGraceDays: 14,
  /** src/server/family-lifecycle.ts — FAMILY_DISSOLVE_NOTICE_MS */
  familyNoticeDays: 7,
  /** src/app/actions/family.ts — INVITE_TTL_MS (Teams uses the same 48 hours) */
  inviteHours: 48,
  /** src/app/actions/totp.ts — recovery codes generated at enrolment */
  recoveryCodes: 8,
  /** src/app/actions/auth.ts — password reset token expiry */
  passwordResetMinutes: 15,
  /** src/app/actions/shares.ts — FREE_LINK_TTL_MS */
  freeVcardLinkDays: 7,
  /** src/server/api-rate-limit.ts — API_RATE_LIMITS */
  apiReadPerHour: fmt(1_000),
  apiWritePerHour: fmt(200),
  /** src/server/contact-merge.ts — merge undo window */
  mergeUndoDays: 30,
} as const;
