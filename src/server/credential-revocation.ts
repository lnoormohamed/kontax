import type { Prisma } from "../../generated/prisma";
import type { db } from "~/server/db";

/**
 * P49A-13 (Fable review): revoke every live CardDAV app password for a user.
 *
 * Used by password RESET (account recovery — a leaked password lets an
 * attacker pass step-up and mint an app password, which would otherwise keep
 * CardDAV access after the owner rotates the password) and by the "Sign out
 * all devices" action offered after a password CHANGE.
 *
 * Takes the caller's transaction so the revocation commits with whatever it
 * belongs to. The caller MUST call `invalidateDavCredentialCacheForUser`
 * (`~/server/app-passwords`) after the commit — the CardDAV server caches a
 * verified credential for up to 10 minutes. Returns how many were revoked.
 */
export async function revokeAllAppPasswords(
  client: Prisma.TransactionClient | typeof db,
  userId: string,
): Promise<number> {
  const result = await client.appPassword.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
