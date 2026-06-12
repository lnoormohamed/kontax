import type { Session } from "next-auth";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

// P23-06: "sudo mode" for sync settings. The user must re-confirm their password
// to gain a short-lived elevation before changing connection settings.
export const SYNC_SETTINGS_ELEVATION_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const SYNC_SETTINGS_ELEVATION_REQUIRED = "SYNC_SETTINGS_ELEVATION_REQUIRED";

// Bind the elevation to the session's UserSession id (jti) so a new login or a
// session revoke invalidates it. Fall back to a per-user key for legacy sessions
// minted before session ids existed (P18-06) so those users are not locked out.
const resolveElevationJti = (session: Session | null): string | null => {
  const userId = session?.user?.id;
  if (!userId) return null;
  return session?.jti ?? `legacy:${userId}`;
};

/** Issue (or refresh) a 15-minute elevation for the current session. */
export const issueSyncSettingsElevation = async (
  userId: string,
  jti: string,
): Promise<void> => {
  const expiresAt = new Date(Date.now() + SYNC_SETTINGS_ELEVATION_TTL_MS);
  await db.syncSettingsElevation.upsert({
    where: { userId_jti: { userId, jti } },
    create: { userId, jti, expiresAt },
    update: { expiresAt },
  });
};

/** True when the current session holds a valid, unexpired elevation. */
export const hasValidSyncSettingsElevation = async (
  userId: string,
  jti: string,
): Promise<boolean> => {
  const elevation = await db.syncSettingsElevation.findFirst({
    where: { userId, jti, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return elevation != null;
};

/**
 * Guard called at the top of every sync settings mutation. Returns a result the
 * action can hand straight back to the client; on a missing elevation the client
 * detects SYNC_SETTINGS_ELEVATION_REQUIRED and shows the re-auth modal.
 */
export const requireSyncSettingsElevation = async (): Promise<
  { ok: true } | { ok: false; error: string }
> => {
  const session = await auth();
  const userId = session?.user?.id;
  const jti = resolveElevationJti(session);
  if (!userId || !jti) {
    return { ok: false, error: SYNC_SETTINGS_ELEVATION_REQUIRED };
  }
  const elevated = await hasValidSyncSettingsElevation(userId, jti);
  return elevated ? { ok: true } : { ok: false, error: SYNC_SETTINGS_ELEVATION_REQUIRED };
};

/** Resolve the elevation key for the current session, for the confirm action. */
export const getCurrentElevationContext = async (): Promise<{
  userId: string;
  jti: string;
} | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  const jti = resolveElevationJti(session);
  if (!userId || !jti) return null;
  return { userId, jti };
};
