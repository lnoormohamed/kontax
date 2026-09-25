"use server";

import { revalidatePath } from "next/cache";

import { requestPasswordReset } from "~/app/actions/auth";
import { requireSession, requireUserId } from "~/server/auth/require-session";
import {
  calDisplayToken,
  calTokenColumns,
  calTokenDisplaySelect,
  noCalTokenWhere,
} from "~/server/capability-tokens";
import { db } from "~/server/db";
import { generateCalToken } from "~/server/ical";
import {
  dismissNotification,
  getSecurityAlert,
  markAllNotificationsRead,
  markNotificationRead,
  resolveSecurityAlert,
  type SecurityAlertView,
  updateNotificationSettings,
} from "~/server/notifications";

import type { DigestCadence } from "../../../generated/prisma";

export const markNotificationReadAction = async (id: string) => {
  const userId = await requireUserId({ write: true });
  await markNotificationRead(userId, id);
  revalidatePath("/contacts");
};

export const markAllNotificationsReadAction = async () => {
  const userId = await requireUserId({ write: true });
  await markAllNotificationsRead(userId);
  revalidatePath("/contacts");
};

export const dismissNotificationAction = async (id: string) => {
  const userId = await requireUserId({ write: true });
  await dismissNotification(userId, id);
  revalidatePath("/contacts");
};

export const resolveSecurityAlertAction = async (
  alertId: string,
  resolution: "DISMISSED" | "SECURED",
) => {
  const session = await requireSession({ write: true });
  const userId = session.user.id;
  await resolveSecurityAlert(userId, alertId, resolution);
  // P22-06: after lockdown, email a password-reset link so the user must set a
  // new password to sign back in. Their current session is already invalidated.
  if (resolution === "SECURED" && session?.user?.email) {
    await requestPasswordReset(session.user.email);
  }
  revalidatePath("/contacts");
  return { ok: true, secured: resolution === "SECURED" };
};

/** Read-only: fetch one alert so the bell's SECURITY rows can open the drawer. */
export const fetchSecurityAlertAction = async (
  alertId: string,
): Promise<SecurityAlertView | null> => {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return null;
  return getSecurityAlert(userId, alertId);
};

const CAL_TOKEN_UNAVAILABLE =
  'Your calendar link can\'t be displayed any more. Use "Regenerate link" to issue a new one.';

/**
 * P22-11: create the iCal token if absent, returning it. Idempotent.
 *
 * P48-18: the token is stored as a hash + encrypted display copy. If a token
 * exists but its display copy can't be decrypted (key retired), this refuses
 * rather than silently rotating — the Settings page shows "Regenerate link",
 * which calls `regenerateCalTokenAction` explicitly.
 */
export const ensureCalTokenAction = async (): Promise<string> => {
  const userId = await requireUserId({ write: true });

  const readExisting = async () => {
    const row = await db.user.findUnique({
      where: { id: userId },
      select: calTokenDisplaySelect,
    });
    return calDisplayToken(row);
  };

  const existing = await readExisting();
  if (existing.status === "ok") return existing.token;
  if (existing.status === "unavailable") throw new Error(CAL_TOKEN_UNAVAILABLE);

  const token = generateCalToken();
  // Only issue while the user still has no token (hashed or legacy), so two
  // concurrent calls can't leave the UI holding a token the DB doesn't match.
  const { count } = await db.user.updateMany({
    where: { id: userId, ...noCalTokenWhere },
    data: calTokenColumns(token),
  });
  if (count === 0) {
    const raced = await readExisting();
    if (raced.status === "ok") return raced.token;
    throw new Error(CAL_TOKEN_UNAVAILABLE);
  }
  revalidatePath("/settings/notifications");
  return token;
};

/** P22-11: revoke the old token and issue a new one (breaks existing subscriptions). */
export const regenerateCalTokenAction = async (): Promise<string> => {
  const userId = await requireUserId({ write: true });
  const token = generateCalToken();
  // calTokenColumns also nulls the legacy plaintext column, so a pre-P48-18
  // subscription URL stops working here too.
  await db.user.update({ where: { id: userId }, data: calTokenColumns(token) });
  revalidatePath("/settings/notifications");
  return token;
};

const DIGEST_VALUES: DigestCadence[] = ["NONE", "DAILY", "WEEKLY"];

/**
 * Form action for /settings/notifications. Unchecked checkboxes are absent from
 * FormData, so every togglable channel is read explicitly. SECURITY and BILLING
 * are always-on and have no fields.
 */
export const updateNotificationPreferences = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const on = (name: string) => formData.get(name) === "on";
  const rawDigest = formData.get("digest");
  const digest =
    typeof rawDigest === "string" && DIGEST_VALUES.includes(rawDigest as DigestCadence)
      ? (rawDigest as DigestCadence)
      : "NONE";

  await updateNotificationSettings(userId, {
    sharingInApp: on("sharingInApp"),
    sharingEmail: on("sharingEmail"),
    syncInApp: on("syncInApp"),
    syncEmail: on("syncEmail"),
    remindersInApp: on("remindersInApp"),
    remindersEmail: on("remindersEmail"),
    productInApp: on("productInApp"),
    productEmail: on("productEmail"),
    digest,
  });

  // P22-10: reminder lead-time. Absent (disabled select) → leave unchanged.
  const VALID_LEAD_DAYS = [1, 3, 7, 14, 30];
  const rawLead = formData.get("reminderLeadDays");
  if (typeof rawLead === "string" && VALID_LEAD_DAYS.includes(Number(rawLead))) {
    await db.user.update({
      where: { id: userId },
      data: { reminderLeadDays: Number(rawLead) },
    });
  }

  revalidatePath("/settings/notifications");
};
