import "server-only";

export type AdminTier = "SUPPORT_OPS" | "BILLING_OPS" | "SYNC_OPS" | "GOVERNANCE";
export type AdminPolicySource = "override" | "bootstrap" | "default";

export type AdminCapability =
  | "users.view"
  | "support.manage"
  | "billing.manage"
  | "sync.view"
  | "sync.override"
  | "account.lifecycle"
  | "plan.override"
  | "impersonation"
  | "audit.view"
  | "flags.manage"
  | "broadcast.manage";

export type AdminCapabilityMap = Record<AdminCapability, boolean>;

export const ADMIN_TIER_LABELS: Record<AdminTier, string> = {
  SUPPORT_OPS: "Support ops admin",
  BILLING_OPS: "Billing ops admin",
  SYNC_OPS: "Sync ops admin",
  GOVERNANCE: "Governance admin",
};

const DEFAULT_TIER: AdminTier = "SUPPORT_OPS";

const CAPABILITIES_BY_TIER: Record<AdminTier, AdminCapability[]> = {
  SUPPORT_OPS: ["users.view", "support.manage"],
  BILLING_OPS: ["users.view", "support.manage", "billing.manage", "account.lifecycle", "plan.override"],
  SYNC_OPS: ["users.view", "support.manage", "sync.view", "sync.override"],
  GOVERNANCE: [
    "users.view",
    "support.manage",
    "billing.manage",
    "sync.view",
    "sync.override",
    "account.lifecycle",
    "plan.override",
    "impersonation",
    "audit.view",
    "flags.manage",
    "broadcast.manage",
  ],
};

const REQUIRED_TIER_LABELS: Record<AdminCapability, string> = {
  "users.view": "Support ops or higher",
  "support.manage": "Support ops or higher",
  "billing.manage": "Billing ops or governance",
  "sync.view": "Sync ops or governance",
  "sync.override": "Sync ops or governance",
  "account.lifecycle": "Billing ops or governance",
  "plan.override": "Billing ops or governance",
  "impersonation": "Governance",
  "audit.view": "Governance",
  "flags.manage": "Governance",
  "broadcast.manage": "Governance",
};

const CAPABILITY_REASONS: Record<AdminCapability, string> = {
  "users.view": "User operations are limited to internal support-aligned admin tiers.",
  "support.manage": "Support case and note workflows are limited to support-aligned admin tiers.",
  "billing.manage": "Billing controls are limited to billing ops and governance admins.",
  "sync.view": "Sync operations are limited to sync ops and governance admins.",
  "sync.override": "Capability-profile overrides are limited to sync ops and governance admins.",
  "account.lifecycle": "Suspensions and deletion schedules are limited to billing ops and governance admins.",
  "plan.override": "Plan overrides are limited to billing ops and governance admins.",
  "impersonation": "Impersonation is limited to governance admins because it crosses support boundaries.",
  "audit.view": "The audit log is limited to governance admins because it exposes privileged cross-domain history.",
  "flags.manage": "Feature flag control is limited to governance admins because it can affect every customer.",
  "broadcast.manage": "Broadcast control is limited to governance admins because it can message broad user cohorts.",
};

const ALL_CAPABILITIES = Object.keys(REQUIRED_TIER_LABELS) as AdminCapability[];

function normalizeTier(value: string | null | undefined): AdminTier | null {
  const normalized = value?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (
    normalized === "SUPPORT_OPS" ||
    normalized === "BILLING_OPS" ||
    normalized === "SYNC_OPS" ||
    normalized === "GOVERNANCE"
  ) {
    return normalized;
  }
  return null;
}

function parseTierOverrideMap(raw: string | undefined) {
  const map = new Map<string, AdminTier>();
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const [email, tierValue] = trimmed.split(":");
    const tier = normalizeTier(tierValue);
    if (!email?.trim() || !tier) continue;
    map.set(email.trim().toLowerCase(), tier);
  }
  return map;
}

export function resolveAdminTier(args: {
  email: string;
  bootstrapAdminId?: string | null;
  adminId: string;
}) {
  const overrides = parseTierOverrideMap(process.env.ADMIN_CAPABILITY_OVERRIDES);
  const explicit = overrides.get(args.email.trim().toLowerCase());
  if (explicit) {
    return { tier: explicit, source: "override" as const };
  }

  if (args.bootstrapAdminId && args.bootstrapAdminId === args.adminId) {
    return { tier: "GOVERNANCE" as const, source: "bootstrap" as const };
  }

  const envDefault = normalizeTier(process.env.ADMIN_DEFAULT_TIER);
  return { tier: envDefault ?? DEFAULT_TIER, source: "default" as const };
}

export function adminCapabilitiesForTier(tier: AdminTier): AdminCapabilityMap {
  const allowed = new Set(CAPABILITIES_BY_TIER[tier]);
  return Object.fromEntries(
    ALL_CAPABILITIES.map((capability) => [capability, allowed.has(capability)]),
  ) as AdminCapabilityMap;
}

export function capabilityReason(capability: AdminCapability) {
  return CAPABILITY_REASONS[capability];
}

export function requiredTierLabel(capability: AdminCapability) {
  return REQUIRED_TIER_LABELS[capability];
}
