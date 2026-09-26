// Canonical plan matrix, gate definitions, delta helpers, and downgrade copy.
// All other pricing/upgrade components derive from this module.
//
// P49A-14 · the public comparison matrix (/pricing) and the plan-card bullets
// are rendered from PLAN_MATRIX / planCardFeatures below. Every limit is read
// from the entitlement matrix the product enforces
// (src/server/dav/plan-entitlements.mjs → PLAN_DEFAULTS), never typed by hand;
// values that live in modules which can't be imported here (server actions,
// the API rate limiter) are mirrored as constants and pinned to their source
// by tests/node/pricing-plan-data.test.ts.

import { PLAN_DEFAULTS, type PlanEntitlements } from "~/server/dav/plan-entitlements.mjs";

export const PLAN_ORDER = ["Free", "Pro", "Family", "Teams"] as const;
export type PlanKey = (typeof PLAN_ORDER)[number];

/** Plan key → entitlement row (the product's source of truth). */
export const PLAN_ENTITLEMENTS: Record<PlanKey, PlanEntitlements> = {
  Free: PLAN_DEFAULTS.FREE,
  Pro: PLAN_DEFAULTS.PRO,
  Family: PLAN_DEFAULTS.FAMILY,
  Teams: PLAN_DEFAULTS.TEAMS,
};

// ── Mirrored constants (pinned by tests/node/pricing-plan-data.test.ts) ──────
/** src/app/actions/billing.ts — checkout `seats` bounds (Teams is per seat). */
export const TEAMS_SEAT_MIN = 3;
export const TEAMS_SEAT_MAX = 500;
/** src/app/actions/shares.ts — FREE_LINK_TTL_MS */
export const FREE_SHARE_LINK_DAYS = 7;
/** src/server/api-rate-limit.ts — API_RATE_LIMITS (per token, every plan with API) */
export const API_READ_ONLY_PER_HOUR = 1_000;
export const API_READ_WRITE_PER_HOUR = 200;

const fmt = (n: number) => n.toLocaleString("en-GB");

export type PlanInfo = {
  name: PlanKey;
  who: string;
  price: string;
  period: string;
  annualPrice: string;
  annualPeriod: string;
  cta: "get" | "up" | "sales";
  recommended?: true;
};

export const PLAN_INFO: Record<PlanKey, PlanInfo> = {
  Free: {
    name: "Free",
    who: "Individual, evaluating",
    price: "£0",
    period: "Free forever",
    annualPrice: "£0",
    annualPeriod: "Free forever",
    cta: "get",
  },
  Pro: {
    name: "Pro",
    who: "Individual power user",
    price: "£X",
    period: "per month",
    annualPrice: "£X",
    annualPeriod: "per month · billed yearly",
    cta: "up",
    recommended: true,
  },
  Family: {
    name: "Family",
    who: `Households, up to ${PLAN_DEFAULTS.FAMILY.memberSlotsLimit} members`,
    price: "£X",
    period: "per month",
    annualPrice: "£X",
    annualPeriod: "per month · billed yearly",
    cta: "up",
  },
  Teams: {
    name: "Teams",
    who: `Organisations, per seat (min. ${TEAMS_SEAT_MIN})`,
    price: "£X",
    period: "per seat / month",
    annualPrice: "£X",
    annualPeriod: "per seat · billed yearly",
    cta: "sales",
  },
};

// A matrix cell: true = included (check), false = not included (dash), string = value
export type CellValue = boolean | string | { v: string; note: string };

export type FeatureRow = {
  id: string;
  label: string;
  vals: Record<PlanKey, CellValue>;
  /** Only shown when Microsoft (Outlook) sync is configured (P50A-01). */
  requiresOutlook?: true;
};

export type FeatureGroup = {
  cat: string;
  note?: string;
  rows: FeatureRow[];
};

/** Build a row's four cells from each plan's entitlements. */
const perPlan = (cell: (e: PlanEntitlements, plan: PlanKey) => CellValue): Record<PlanKey, CellValue> => ({
  Free: cell(PLAN_ENTITLEMENTS.Free, "Free"),
  Pro: cell(PLAN_ENTITLEMENTS.Pro, "Pro"),
  Family: cell(PLAN_ENTITLEMENTS.Family, "Family"),
  Teams: cell(PLAN_ENTITLEMENTS.Teams, "Teams"),
});
const every = (v: CellValue) => perPlan(() => v);

/** "500" / "Unlimited" */
const limit = (n: number | null) => (n === null ? "Unlimited" : fmt(n));
/** "1" / "Up to 5" */
const upTo = (n: number) => (n === 1 ? "1" : `Up to ${fmt(n)}`);

const API_LIMIT_CELL = `${fmt(API_READ_ONLY_PER_HOUR)}/hr read-only · ${fmt(API_READ_WRITE_PER_HOUR)}/hr read/write`;

export const PLAN_MATRIX: FeatureGroup[] = [
  {
    cat: "Core",
    rows: [
      { id: "contacts", label: "Contacts", vals: perPlan((e) => limit(e.contactsLimit)) },
      { id: "search", label: "Advanced search", vals: every(true) },
      { id: "labels", label: "Labels", vals: every(true) },
      { id: "merge", label: "Merge duplicates (30-day undo)", vals: perPlan((e) => e.advancedMergeEnabled) },
      { id: "import", label: "Import (CSV, Kontax archive)", vals: every(true) },
      {
        id: "imports",
        label: "Imports per month",
        vals: perPlan((e) => (e.monthlyImportLimit === null ? "Unlimited" : `${e.monthlyImportLimit} a month`)),
      },
      { id: "kontaxexport", label: "Export (CSV, Kontax archive)", vals: every(true) },
      { id: "export", label: "vCard export (whole library)", vals: perPlan((e) => e.premiumExportEnabled) },
    ],
  },
  {
    cat: "History",
    rows: [
      {
        id: "history",
        label: "Per-contact history",
        vals: perPlan((e) =>
          e.historyDisplayCap === null ? "All changes" : `Last ${fmt(e.historyDisplayCap)} changes`,
        ),
      },
      {
        id: "feed",
        label: "Activity feed",
        vals: perPlan((e) =>
          e.activityLogRetentionDays === 0
            ? false
            : e.activityLogRetentionDays === null
              ? "All activity"
              : `Last ${fmt(e.activityLogRetentionDays)} days`,
        ),
      },
    ],
  },
  {
    cat: "Sync",
    rows: [
      {
        id: "sync",
        label: "Sync sources (Google, iCloud, any CardDAV server)",
        vals: perPlan((e) => upTo(e.syncAccountsLimit)),
      },
      { id: "outlook", label: "Outlook", vals: perPlan((e) => e.syncAccountsLimit > 0), requiresOutlook: true },
      { id: "twoway", label: "Two-way sync", vals: every(true) },
      {
        id: "devices",
        label: "iPhones and Macs (CardDAV)",
        vals: perPlan((e) => upTo(e.appPasswordsLimit)),
      },
    ],
  },
  {
    cat: "Sharing",
    rows: [
      { id: "card", label: "Public contact card", vals: every(true) },
      {
        id: "share",
        label: "Share individual contacts",
        vals: perPlan((e) =>
          e.liveShareEnabled && e.staticShareEnabled
            ? "Link, copy or live"
            : `Link, ${FREE_SHARE_LINK_DAYS} days`,
        ),
      },
      {
        id: "books",
        label: "Shared address books",
        vals: perPlan((e) =>
          e.sharedAddressBooksLimit === 0
            ? false
            : e.sharedAddressBooksLimit === null
              ? "Multiple"
              : e.sharedAddressBooksLimit === 1
                ? "1 shared book"
                : `Up to ${fmt(e.sharedAddressBooksLimit)}`,
        ),
      },
      {
        id: "members",
        label: "Members",
        vals: perPlan((e, plan) =>
          plan === "Teams"
            ? `Per seat (min. ${TEAMS_SEAT_MIN})`
            : e.familyGroupEnabled && e.memberSlotsLimit !== null
              ? `Up to ${fmt(e.memberSlotsLimit)}`
              : false,
        ),
      },
      {
        id: "roles",
        label: "Roles & permissions",
        vals: perPlan((e) =>
          e.teamsEnabled
            ? "Admins, members, access per book"
            : e.familyGroupEnabled
              ? "Edit or view per member"
              : false,
        ),
      },
      { id: "audit", label: "Audit log", vals: perPlan((e) => e.teamsEnabled) },
    ],
  },
  {
    cat: "Developer",
    rows: [
      { id: "api", label: "REST API", vals: perPlan((e) => e.apiAccessEnabled) },
      {
        id: "apilimit",
        label: "API rate limit (per token)",
        vals: perPlan((e) => (e.apiAccessEnabled ? API_LIMIT_CELL : false)),
      },
    ],
  },
  {
    cat: "Support",
    rows: [
      { id: "help", label: "Help centre", vals: every(true) },
      { id: "support", label: "Email support", vals: every(true) },
    ],
  },
];

// ── Plan-card bullets (/pricing) ─────────────────────────────────────────────
// Short summaries for the four plan cards, built from the same entitlements.
// Rendered as `pre` + <strong>{strong}</strong> + `text`.

export type CardFeature = { pre?: string; strong?: string; text?: string };

export function planCardFeatures(outlookLive: boolean): Record<PlanKey, CardFeature[]> {
  const e = PLAN_ENTITLEMENTS;
  const sources = outlookLive ? "Google, iCloud, Outlook or CardDAV" : "Google, iCloud or any CardDAV server";
  const syncSources = (n: number) => (n === 1 ? "1 sync source" : `up to ${fmt(n)} sync sources`);
  const devices = (n: number) => (n === 1 ? "1 iPhone or Mac" : `up to ${fmt(n)} iPhones or Macs`);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const contacts = (n: number | null): CardFeature =>
    n === null ? { strong: "Unlimited", text: " contacts" } : { pre: "Up to ", strong: `${fmt(n)} contacts` };
  return {
    Free: [
      contacts(e.Free.contactsLimit),
      { text: `${cap(syncSources(e.Free.syncAccountsLimit))}: ${sources}` },
      { text: cap(devices(e.Free.appPasswordsLimit)) },
      { text: "Labels, search and duplicate merge" },
      { text: "Export any time (CSV, Kontax archive)" },
    ],
    Pro: [
      contacts(e.Pro.contactsLimit),
      { text: `${cap(syncSources(e.Pro.syncAccountsLimit))}, ${devices(e.Pro.appPasswordsLimit)}` },
      { text: "Share contacts as a copy or live" },
      { text: "vCard export" },
      { text: "Developer API" },
    ],
    Family: [
      contacts(e.Family.contactsLimit),
      { text: "Family shared address book" },
      { pre: "Up to ", strong: `${fmt(e.Family.memberSlotsLimit ?? 0)} members` },
      { text: "Edit or view per member" },
      { text: "One bill for the whole family" },
    ],
    Teams: [
      contacts(e.Teams.contactsLimit),
      { text: "Shared team address books" },
      { pre: "Minimum ", strong: `${TEAMS_SEAT_MIN} seats` },
      { text: "Roles & permissions, audit log" },
      { text: "Developer API" },
    ],
  };
}

// Flat row lookup keyed by id
export const PLAN_ROWS: Record<string, FeatureRow & { cat: string }> = {};
for (const g of PLAN_MATRIX) {
  for (const r of g.rows) {
    PLAN_ROWS[r.id] = { ...r, cat: g.cat };
  }
}

// ── Upgrade gates ─────────────────────────────────────────────────────────────
// Copy matches billing.ts gate strings. `unlock` is the minimum tier that lifts
// the gate. `form` drives which prompt variant is shown.

export type GateForm = "banner" | "locked";

export type UpgradeGate = {
  id: string;
  icon: string;
  featureRow: string;
  unlock: "Pro" | "Family";
  form: GateForm;
  title: string;
  bannerLead?: string;
  lockedTitle: string;
  value: string;
  billing: string;
};

export const UPGRADE_GATES: UpgradeGate[] = [
  {
    id: "contacts",
    icon: "people",
    featureRow: "contacts",
    unlock: "Pro",
    form: "banner",
    title: "Contacts",
    bannerLead: "You’re approaching your contact limit on the Free plan.",
    lockedTitle: "You’ve reached your contact limit",
    value: "Pro gives you unlimited contacts — keep adding without a ceiling.",
    billing: "Free plan limit reached. You can store up to 500 contacts on this plan.",
  },
  {
    id: "imports",
    icon: "upload",
    featureRow: "imports",
    unlock: "Pro",
    form: "banner",
    title: "Monthly imports",
    bannerLead: "You’ve used all 3 imports this month on the Free plan.",
    lockedTitle: "You’ve hit this month’s import limit",
    value: "Pro removes the monthly cap — import as often as you need.",
    // P49A-19: 3 import runs a month (CSV / Kontax archive), not 3 contacts —
    // mirrors importLimitMessage() in src/server/billing.ts.
    billing:
      "You've used your 3 imports this month on the Free plan. Upgrade for unlimited imports, or wait until the 1st of next month.",
  },
  {
    id: "sync",
    icon: "sync",
    featureRow: "sync",
    unlock: "Pro",
    form: "locked",
    title: "CardDAV sync",
    lockedTitle: "CardDAV sync is a Pro feature",
    value: "Connect up to 5 CardDAV accounts and keep every device in sync.",
    billing: "CardDAV sync is available on the Pro plan.",
  },
  {
    id: "export",
    icon: "download",
    featureRow: "export",
    unlock: "Pro",
    form: "locked",
    title: "vCard export",
    lockedTitle: "vCard export is a Pro feature",
    value: "Export the full vCard format alongside CSV, with no limits.",
    billing: "vCard export is available on the Pro plan.",
  },
  {
    id: "feed",
    icon: "clock",
    featureRow: "feed",
    unlock: "Pro",
    form: "locked",
    title: "Activity log",
    lockedTitle: "Activity log is a Pro feature",
    value:
      "See every edit, sync, import, merge and share across all your contacts — with a year of history and filters.",
    billing: "The activity log is available on the Pro plan and above.",
  },
  {
    id: "live",
    icon: "signal",
    featureRow: "share",
    unlock: "Pro",
    form: "locked",
    title: "Live sharing",
    lockedTitle: "Live sharing is a Pro feature",
    value: "Share a contact so your edits keep flowing to them in near real-time.",
    billing: "Live contact sharing is available on the Pro plan and above.",
  },
  {
    id: "books",
    icon: "people",
    featureRow: "books",
    unlock: "Family",
    form: "locked",
    title: "Shared address books",
    lockedTitle: "Shared address books need a Family or Teams plan",
    value:
      "Keep one address book your whole household — or team — can view and edit, live-synced to everyone.",
    billing: "Shared address books are available on the Family and Teams plans.",
  },
];

export const GATE_MAP: Record<string, UpgradeGate> = {};
for (const g of UPGRADE_GATES) {
  GATE_MAP[g.id] = g;
}

// ── Delta helper for the comparison modal ────────────────────────────────────
// Returns rows that DIFFER between current and target, with the lead row first.

export type DeltaRow = {
  id: string;
  label: string;
  from: CellValue;
  to: CellValue;
};

export function computePlanDelta(
  current: PlanKey,
  target: PlanKey,
  leadRowId?: string | null,
): DeltaRow[] {
  const out: DeltaRow[] = [];
  for (const g of PLAN_MATRIX) {
    for (const r of g.rows) {
      const a = JSON.stringify(r.vals[current]);
      const b = JSON.stringify(r.vals[target]);
      if (a !== b) out.push({ id: r.id, label: r.label, from: r.vals[current], to: r.vals[target] });
    }
  }
  if (leadRowId) {
    const i = out.findIndex((r) => r.id === leadRowId);
    if (i > 0) {
      const [lead] = out.splice(i, 1);
      out.unshift(lead!);
    }
  }
  return out;
}
