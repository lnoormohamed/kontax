import { getRedis } from "~/server/rate-limit";

/**
 * P38-09 — short-TTL Redis cache for the per-request session validation.
 *
 * The JWT callback validates every authenticated request against the database
 * (User.sessionVersion / lifecycleState + UserSession revocation). That is a
 * deliberate security design — this cache keeps its semantics while removing
 * the two queries from the steady-state path:
 *
 *  - TTL is short (45s) and every write that must take effect immediately
 *    (device revocation, revoke-all, password change, security lockdown,
 *    admin lock, account deletion, email change) explicitly deletes the
 *    affected keys — the TTL is only the backstop for a missed path.
 *  - Redis unavailable or SESSION_VALIDATION_CACHE=off → callers fall back to
 *    the database. Never fail closed on cache infrastructure, never skip
 *    validation.
 *  - pendingTotp sessions bypass the cache entirely (they need a fresh
 *    totpChallengeVerified read so the 2FA gate lifts immediately).
 *
 * Payload is versioned via the key prefix so a shape change can never
 * deserialize stale entries.
 */

const TTL_SECONDS = 45;
const PREFIX = "sessval:v1";

const cacheEnabled = () =>
  process.env.SESSION_VALIDATION_CACHE !== "off" && getRedis() !== null;

const keyFor = (userId: string, sid: string) => `${PREFIX}:${userId}:${sid}`;

export type SessionValidationSnapshot = {
  sessionVersion: number;
  lifecycleState: string;
  role: "USER" | "ADMIN";
  emailVerified: string | null;
  revoked: boolean;
};

export async function readSessionValidation(
  userId: string,
  sid: string,
): Promise<SessionValidationSnapshot | null> {
  if (!cacheEnabled()) return null;
  try {
    const raw = await getRedis()!.get(keyFor(userId, sid));
    if (!raw) return null;
    return JSON.parse(raw) as SessionValidationSnapshot;
  } catch {
    return null; // fail open to the DB
  }
}

export async function writeSessionValidation(
  userId: string,
  sid: string,
  snapshot: SessionValidationSnapshot,
): Promise<void> {
  if (!cacheEnabled()) return;
  try {
    await getRedis()!.setex(keyFor(userId, sid), TTL_SECONDS, JSON.stringify(snapshot));
  } catch {
    // best effort
  }
}

/**
 * Delete cached validation state so a security-relevant write takes effect on
 * the very next request. Omit `sid` to invalidate every session of the user
 * (password change, revoke-all, lock, deletion).
 */
export async function invalidateSessionValidation(userId: string, sid?: string): Promise<void> {
  if (!cacheEnabled()) return;
  try {
    const redis = getRedis()!;
    if (sid) {
      await redis.del(keyFor(userId, sid));
      return;
    }
    // A user has a handful of sessions at most — SCAN with a tight pattern.
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await redis.scan(cursor, "MATCH", `${PREFIX}:${userId}:*`, "COUNT", 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== "0");
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // best effort — the 45s TTL is the backstop
  }
}
