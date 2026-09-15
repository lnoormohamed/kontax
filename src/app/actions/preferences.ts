"use server";

import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { updatePreferences } from "~/server/preferences";
import type { UserPreferences } from "~/lib/preferences-shared";

export async function updatePreferencesAction(
  patch: Partial<UserPreferences>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return { ok: false, error: err.code };
    throw err;
  }

  try {
    await updatePreferences(userId, patch);
    return { ok: true };
  } catch {
    return { ok: false, error: "UNKNOWN" };
  }
}
