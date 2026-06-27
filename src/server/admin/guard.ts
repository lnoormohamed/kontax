import "server-only";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  adminCapabilitiesForTier,
  capabilityReason,
  requiredTierLabel,
  resolveAdminTier,
  type AdminCapability,
  type AdminCapabilityMap,
  type AdminPolicySource,
  type AdminTier,
} from "./capabilities";

export class AdminForbiddenError extends Error {
  capability?: AdminCapability;

  constructor(capability?: AdminCapability) {
    super("FORBIDDEN");
    this.name = "AdminForbiddenError";
    this.capability = capability;
  }
}

export type AdminContext = {
  adminId: string;
  name: string;
  email: string;
  tier: AdminTier;
  tierLabel: string;
  policySource: AdminPolicySource;
  capabilities: AdminCapabilityMap;
};

/**
 * Authoritative admin gate (P21-01). Every /admin page and every admin server
 * action must call this — the middleware token check is only a fast first pass.
 * Throws AdminForbiddenError when the current session is missing or not ADMIN.
 *
 * Note: while an admin is impersonating a user (P21-07), auth() resolves to the
 * impersonated (USER) identity, so this correctly denies admin access until the
 * impersonation session is ended.
 */
export async function assertAdmin(): Promise<AdminContext> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new AdminForbiddenError();

  const [user, bootstrapAdmin] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true, email: true },
    }),
    db.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);
  if (user?.role !== "ADMIN") throw new AdminForbiddenError();

  const resolved = resolveAdminTier({
    adminId: userId,
    email: user.email,
    bootstrapAdminId: bootstrapAdmin?.id ?? null,
  });

  return {
    adminId: userId,
    name: user.name?.trim() ?? user.email,
    email: user.email,
    tier: resolved.tier,
    tierLabel:
      resolved.tier === "SUPPORT_OPS"
        ? "Support ops admin"
        : resolved.tier === "BILLING_OPS"
          ? "Billing ops admin"
          : resolved.tier === "SYNC_OPS"
            ? "Sync ops admin"
            : "Governance admin",
    policySource: resolved.source,
    capabilities: adminCapabilitiesForTier(resolved.tier),
  };
}

export function requireAdminCapability(admin: AdminContext, capability: AdminCapability) {
  if (!admin.capabilities[capability]) {
    throw new AdminForbiddenError(capability);
  }
}

export function explainMissingAdminCapability(admin: AdminContext, capability: AdminCapability) {
  return {
    capability,
    reason: capabilityReason(capability),
    requiredTierLabel: requiredTierLabel(capability),
    currentTierLabel: admin.tierLabel,
    policySource: admin.policySource,
  };
}
