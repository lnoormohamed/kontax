"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin, AdminForbiddenError } from "~/server/admin/guard";
import { ADMIN_ACTIONS, emitAdminEvent } from "~/server/admin/audit";
import { db } from "~/server/db";
import type { FeatureFlagMode } from "../../../generated/prisma";

type Result = { success: true } | { error: string };

const MODES: FeatureFlagMode[] = ["OFF", "SPECIFIC_USERS", "ALL", "ROLLOUT"];

async function requireAdmin() {
  return assertAdmin();
}

/** Binary Status toggle — flip OFF ↔ last enabled mode (DB04 §5, feedback B). */
export async function toggleFeatureFlag(input: { key: string; enable: boolean; restoreMode?: string }): Promise<Result> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const flag = await db.featureFlag.findUnique({ where: { key: input.key } });
  if (!flag) return { error: "FLAG_NOT_FOUND" };

  const restore = (input.restoreMode?.toUpperCase() as FeatureFlagMode) ?? "ALL";
  const nextMode: FeatureFlagMode = input.enable
    ? MODES.includes(restore) && restore !== "OFF"
      ? restore
      : "ALL"
    : "OFF";

  await db.featureFlag.update({
    where: { key: input.key },
    data: { mode: nextMode, updatedById: admin.adminId, updatedByName: admin.name },
  });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.FEATURE_FLAG_CHANGED,
    details: { flag: input.key, from: flag.mode, to: nextMode },
  });

  revalidatePath("/admin/feature-flags");
  return { success: true };
}

/** Slide-over save — description + mode + rollout percentage. */
export async function saveFeatureFlag(input: {
  key: string;
  description: string;
  owner: string;
  purpose: string;
  environmentScope: string[];
  riskLevel: string;
  killSwitch: boolean;
  mode: string;
  rolloutPct: number;
  allowedUserIds: string[];
  changeSummary: string;
}): Promise<Result> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    if (e instanceof AdminForbiddenError) return { error: "FORBIDDEN" };
    throw e;
  }

  const mode = input.mode.toUpperCase() as FeatureFlagMode;
  if (!MODES.includes(mode)) return { error: "INVALID_MODE" };
  const changeSummary = input.changeSummary.trim();
  if (!changeSummary) return { error: "REASON_REQUIRED" };

  const flag = await db.featureFlag.findUnique({ where: { key: input.key } });
  if (!flag) return { error: "FLAG_NOT_FOUND" };

  const rolloutPct = Math.max(0, Math.min(100, Math.round(input.rolloutPct)));
  const allowedUserIds = [...new Set(input.allowedUserIds.map((value) => value.trim()).filter(Boolean))].slice(0, 250);
  const environmentScope = [...new Set(input.environmentScope.map((value) => value.trim()).filter(Boolean))].slice(0, 8);

  await db.featureFlag.update({
    where: { key: input.key },
    data: {
      description: input.description.slice(0, 280),
      owner: input.owner.trim() || null,
      purpose: input.purpose.trim() || null,
      environmentScope,
      riskLevel: input.riskLevel.trim().toLowerCase() || "standard",
      killSwitch: input.killSwitch,
      mode,
      rolloutPct,
      allowedUserIds,
      updatedById: admin.adminId,
      updatedByName: admin.name,
    },
  });

  await emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.FEATURE_FLAG_CHANGED,
    details: {
      flag: input.key,
      from: flag.mode,
      to: mode,
      rolloutPct,
      owner: input.owner.trim() || null,
      purpose: input.purpose.trim() || null,
      environmentScope,
      riskLevel: input.riskLevel.trim().toLowerCase() || "standard",
      killSwitch: input.killSwitch,
      allowedUserCount: allowedUserIds.length,
      changeSummary,
    },
  });

  revalidatePath("/admin/feature-flags");
  return { success: true };
}
