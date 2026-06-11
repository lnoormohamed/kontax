// Canonical plan matrix, gate definitions, delta helpers, and downgrade copy.
// All other pricing/upgrade components derive from this module.
// Data frozen from p11-01; numbers remain £X placeholders per commercial policy.

export const PLAN_ORDER = ["Free", "Pro", "Family", "Teams"] as const;
export type PlanKey = (typeof PLAN_ORDER)[number];

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
    who: "Households, up to 6 members",
    price: "£X",
    period: "per month",
    annualPrice: "£X",
    annualPeriod: "per month · billed yearly",
    cta: "up",
  },
  Teams: {
    name: "Teams",
    who: "Organisations, up to 25",
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
};

export type FeatureGroup = {
  cat: string;
  note?: string;
  rows: FeatureRow[];
};

export const PLAN_MATRIX: FeatureGroup[] = [
  {
    cat: "Contacts",
    rows: [
      {
        id: "contacts",
        label: "Contacts",
        vals: {
          Free: "500",
          Pro: "Unlimited",
          Family: { v: "Unlimited", note: "per member" },
          Teams: { v: "Unlimited", note: "per member" },
        },
      },
      {
        id: "imports",
        label: "Monthly imports",
        vals: { Free: "3 / mo", Pro: "Unlimited", Family: "Unlimited", Teams: "Unlimited" },
      },
      {
        id: "export",
        label: "Export formats",
        vals: { Free: "CSV, vCard", Pro: "All formats", Family: "All formats", Teams: "All formats" },
      },
      {
        id: "merge",
        label: "Duplicate merge",
        vals: {
          Free: "Basic suggestions",
          Pro: { v: "Advanced", note: "field-level, bulk, 30-day undo" },
          Family: "Advanced",
          Teams: "Advanced",
        },
      },
    ],
  },
  {
    cat: "Sync",
    rows: [
      {
        id: "sync",
        label: "CardDAV sync accounts",
        vals: {
          Free: "1",
          Pro: "5",
          Family: { v: "5", note: "per member" },
          Teams: { v: "5", note: "per member" },
        },
      },
      {
        id: "devices",
        label: "Device app passwords",
        vals: { Free: "1", Pro: "5", Family: "5", Teams: "5" },
      },
      {
        id: "teamsync",
        label: "Team-level CardDAV sync",
        vals: { Free: false, Pro: false, Family: false, Teams: true },
      },
    ],
  },
  {
    cat: "Sharing",
    rows: [
      {
        id: "vcardlink",
        label: "vCard share links",
        vals: {
          Free: "Expire after 7 days",
          Pro: "No expiry, revocable",
          Family: "No expiry, revocable",
          Teams: "No expiry, revocable",
        },
      },
      {
        id: "static",
        label: "Static contact sharing",
        vals: { Free: false, Pro: true, Family: true, Teams: true },
      },
      {
        id: "live",
        label: "Live contact sharing",
        vals: { Free: false, Pro: true, Family: true, Teams: true },
      },
    ],
  },
  {
    cat: "Collaboration",
    note: "shared books — Phase 13+",
    rows: [
      {
        id: "members",
        label: "Members",
        vals: { Free: false, Pro: false, Family: "Up to 6", Teams: "Up to 25" },
      },
      {
        id: "books",
        label: "Shared address books",
        vals: { Free: false, Pro: false, Family: "1 shared book", Teams: "Multiple" },
      },
      {
        id: "roles",
        label: "Roles & admin controls",
        vals: { Free: false, Pro: false, Family: "Admin controls", Teams: "Roles per book" },
      },
      {
        id: "audit",
        label: "Audit log",
        vals: {
          Free: false,
          Pro: false,
          Family: false,
          Teams: { v: "Full", note: "unlimited retention" },
        },
      },
    ],
  },
  {
    cat: "Activity",
    rows: [
      {
        id: "feed",
        label: "Global activity feed",
        vals: { Free: false, Pro: "365 days", Family: "90 days", Teams: "Unlimited" },
      },
      {
        id: "history",
        label: "Per-contact history",
        vals: {
          Free: "Last 3 shown",
          Pro: "Full · 365 days",
          Family: "Full · 90 days",
          Teams: "Full · unlimited",
        },
      },
    ],
  },
  {
    cat: "Support",
    rows: [
      {
        id: "support",
        label: "Support",
        vals: { Free: "Community", Pro: "Priority", Family: "Priority", Teams: "Dedicated manager" },
      },
    ],
  },
];

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
    billing: "Free plan import limit reached. You can import up to 3 contacts per month on this plan.",
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
    id: "merge",
    icon: "merge",
    featureRow: "merge",
    unlock: "Pro",
    form: "locked",
    title: "Advanced merge",
    lockedTitle: "Advanced merge is a Pro feature",
    value:
      "Choose the winning value field-by-field, accept duplicates in bulk, and undo within 30 days.",
    billing: "Field-level merge, bulk accept and 30-day undo are available on the Pro plan.",
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
    featureRow: "live",
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

// ── Downgrade consequences ────────────────────────────────────────────────────

export type DowngradeCopy = {
  title: string;
  lead: string;
  items: string[];
  group?: true;
};

export const DOWNGRADE_COPY: Record<string, DowngradeCopy> = {
  "Pro>Free": {
    title: "Downgrade to Free?",
    lead: "You’ll keep all your contacts, but:",
    items: [
      "Contacts over 500 become read-only — you can’t add new ones until you’re back under the limit.",
      "The activity feed is locked; per-contact history shows only the last 3 events.",
      "Extra sync accounts and device app passwords beyond 1 stop syncing.",
      "Live shares you receive convert to static snapshots.",
      "Advanced merge, bulk accept and 30-day undo are no longer available.",
    ],
  },
  "Family>Pro": {
    title: "Downgrade to Pro?",
    lead: "Your personal library is unaffected, but your family group will be dissolved:",
    items: [
      "The shared family address book is exported to you as a read-only vCard snapshot in your personal library.",
      "The other members revert to Free immediately and lose access to the shared book.",
      "Contacts that lived only in the shared book are preserved in your archive — never deleted.",
      "Personal activity retention changes from 90 days to 365 days (Pro keeps a longer trail).",
    ],
    group: true,
  },
  "Family>Free": {
    title: "Downgrade to Free?",
    lead: "Your family group will be dissolved and your account moves to Free:",
    items: [
      "The shared family address book is exported to you as a read-only vCard snapshot, then archived.",
      "All other members revert to Free and lose access to the shared book.",
      "Contacts over 500 in your personal library become read-only until you’re under the limit.",
      "The activity feed locks and live shares convert to static snapshots.",
    ],
    group: true,
  },
  "Teams>Pro": {
    title: "Downgrade to Pro?",
    lead: "Your personal library is unaffected, but the team will be wound down:",
    items: [
      "All shared team address books become read-only. You keep read + export access; members lose write access.",
      "You have a 30-day grace period to export team books before they’re archived.",
      "The full audit log stops collecting new events after the downgrade.",
      "Members revert to Free unless they subscribe individually.",
    ],
    group: true,
  },
  "Teams>Free": {
    title: "Downgrade to Free?",
    lead: "The team will be wound down and your account moves to Free:",
    items: [
      "All shared team address books become read-only, then archive after a 30-day export grace period.",
      "Members revert to Free and lose write access immediately.",
      "Contacts over 500 in your personal library become read-only until you’re under the limit.",
      "The activity feed locks and live shares convert to static snapshots.",
    ],
    group: true,
  },
};
