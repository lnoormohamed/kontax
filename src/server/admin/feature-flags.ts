import "server-only";

import { createHash } from "node:crypto";

import { db } from "~/server/db";
import type { FeatureFlagMode } from "../../../generated/prisma";

export type AdminFlagRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  mode: FeatureFlagMode;
  rolloutPct: number;
  userCount: number;
  updatedLabel: string;
};

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);

export async function listFlags(): Promise<AdminFlagRow[]> {
  const flags = await db.featureFlag.findMany({ orderBy: { name: "asc" } });
  return flags.map((f) => ({
    id: f.id,
    key: f.key,
    name: f.name,
    description: f.description,
    mode: f.mode,
    rolloutPct: f.rolloutPct,
    userCount: f.allowedUserIds.length,
    updatedLabel: `${fmt(f.updatedAt)}${f.updatedByName ? ` · ${f.updatedByName}` : ""}`,
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
    select: { mode: true, rolloutPct: true, allowedUserIds: true },
  });
  if (!flag) return false;
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
