import "server-only";

import { createHash } from "node:crypto";

import { db } from "~/server/db";
import { loadFeatureFlagAuditHistory } from "~/server/admin/audit";
import type { FeatureFlagMode } from "../../../generated/prisma";

export type AdminFlagRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  owner: string | null;
  purpose: string | null;
  environmentScope: string[];
  riskLevel: string;
  killSwitch: boolean;
  mode: FeatureFlagMode;
  rolloutPct: number;
  allowedUserIds: string[];
  userCount: number;
  updatedLabel: string;
  history: Array<{
    id: string;
    when: string;
    actor: string;
    details: Record<string, unknown>;
  }>;
};

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);

export async function listFlags(query = ""): Promise<AdminFlagRow[]> {
  const q = query.trim();
  const flags = await db.featureFlag.findMany({
    where: q
      ? {
          OR: [
            { key: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { owner: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { purpose: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });
  const histories = await Promise.all(flags.map((flag) => loadFeatureFlagAuditHistory(flag.key, 4)));

  return flags.map((f, index) => ({
    id: f.id,
    key: f.key,
    name: f.name,
    description: f.description,
    owner: f.owner,
    purpose: f.purpose,
    environmentScope: f.environmentScope,
    riskLevel: f.riskLevel,
    killSwitch: f.killSwitch,
    mode: f.mode,
    rolloutPct: f.rolloutPct,
    allowedUserIds: f.allowedUserIds,
    userCount: f.allowedUserIds.length,
    updatedLabel: `${fmt(f.updatedAt)}${f.updatedByName ? ` · ${f.updatedByName}` : ""}`,
    history: histories[index]!.map((row) => ({
      id: row.id,
      when: fmt(row.createdAt),
      actor: row.adminName,
      details: row.details,
    })),
  }));
}

/**
 * Resolve a flag for a user (P21-08).
 *   OFF            → false
 *   ALL            → true
 *   SPECIFIC_USERS → membership of the allow-list
 *   ROLLOUT        → deterministic hash(key+userId) % 100 < rolloutPct, so a
 *                    user's bucket is stable as the percentage grows.
 */
export async function isFeatureEnabled(key: string, userId: string): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({
    where: { key },
    select: { mode: true, rolloutPct: true, allowedUserIds: true, killSwitch: true, environmentScope: true },
  });
  if (!flag) return false;
  if (flag.killSwitch) return false;
  if (flag.environmentScope.length > 0 && !flag.environmentScope.includes(process.env.NODE_ENV ?? "development")) {
    return false;
  }
  switch (flag.mode) {
    case "OFF":
      return false;
    case "ALL":
      return true;
    case "SPECIFIC_USERS":
      return flag.allowedUserIds.includes(userId);
    case "ROLLOUT": {
      const h = createHash("sha256").update(`${key}:${userId}`).digest();
      const bucket = h.readUInt32BE(0) % 100;
      return bucket < flag.rolloutPct;
    }
    default:
      return false;
  }
}
