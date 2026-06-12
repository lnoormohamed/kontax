"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
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

/**
 * Auth guard shared by every notification mutation. Mirrors actions/settings.ts:
 * impersonation sessions (P21-07) are read-only.
 */
const getRequiredUserId = async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("You must be signed in.");
  }
  if (session?.impersonatedBy) {
    throw new Error("This is a read-only impersonation session — changes are blocked.");
  }
  return userId;
};

export const markNotificationReadAction = async (id: string) => {
  const userId = await getRequiredUserId();
  await markNotificationRead(userId, id);
  revalidatePath("/contacts");
};

export const markAllNotificationsReadAction = async () => {
  const userId = await getRequiredUserId();
  await markAllNotificationsRead(userId);
  revalidatePath("/contacts");
};

export const dismissNotificationAction = async (id: string) => {
  const userId = await getRequiredUserId();
  await dismissNotification(userId, id);
  revalidatePath("/contacts");
};

export const resolveSecurityAlertAction = async (
  alertId: string,
  resolution: "DISMISSED" | "SECURED",
) => {
  const userId = await getRequiredUserId();
  await resolveSecurityAlert(userId, alertId, resolution);
  revalidatePath("/contacts");
  return { ok: true, secured: resolution === "SECURED" };
};

/** Read-only: fetch one alert so the bell's SECURITY rows can open the drawer. */
export const fetchSecurityAlertAction = async (
  alertId: string,
): Promise<SecurityAlertView | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return getSecurityAlert(userId, alertId);
};

const DIGEST_VALUES: DigestCadence[] = ["NONE", "DAILY", "WEEKLY"];

/**
 * Form action for /settings/notifications. Unchecked checkboxes are absent from
 * FormData, so every togglable channel is read explicitly. SECURITY and BILLING
 * are always-on and have no fields.
 */
export const updateNotificationPreferences = async (formData: FormData) => {
  const userId = await getRequiredUserId();
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

  revalidatePath("/settings/notifications");
};
