"use server";

import { auth } from "~/server/auth";
import { updatePreferences } from "~/server/preferences";
import type { UserPreferences } from "~/lib/preferences-shared";

export async function updatePreferencesAction(
  patch: Partial<UserPreferences>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "UNAUTHENTICATED" };

  try {
    await updatePreferences(session.user.id, patch);
    return { ok: true };
  } catch {
    return { ok: false, error: "UNKNOWN" };
  }
}
