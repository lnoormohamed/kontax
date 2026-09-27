import { createHash, randomBytes } from "crypto";

import type { ApiTokenScope, Prisma } from "../../generated/prisma";
import { db } from "~/server/db";

export type { ApiTokenScope };

export type ApiTokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: ApiTokenScope;
  lastUsedAt: Date | null;
  requestCountThisMonth: number;
  createdAt: Date;
  revokedAt: Date | null;
};

export function generateApiToken(): { plaintext: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("base64url"); // 43-char URL-safe string
  const plaintext = `ktx_live_${raw}`;
  const hash = hashApiToken(plaintext);
  const prefix = plaintext.slice(0, 12); // "ktx_live_7f3"
  return { plaintext, hash, prefix };
}

export function hashApiToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Resolve a bearer token to its owner and scope, or null. Side-effect free:
 * P49A-13 moved the usage-stats write out to `recordApiTokenUse`, which the
 * REST layer calls only once the request has passed the rate limit — a
 * rate-limited (429) request used to be counted as a use.
 */
export async function validateApiToken(
  bearerToken: string,
): Promise<{ userId: string; scope: ApiTokenScope; tokenHash: string } | null> {
  if (!bearerToken.startsWith("ktx_live_")) return null;

  const hash = hashApiToken(bearerToken);

  const token = await db.apiToken.findUnique({
    where: { tokenHash: hash },
    select: {
      userId: true,
      scope: true,
      revokedAt: true,
      // P48-03: the token used to be validated in isolation, so a suspended or
      // self-deleting account kept full REST API access — the web session was
      // the only thing anyone had bothered to lock.
      user: { select: { lifecycleState: true, scheduledDeleteAt: true } },
    },
  });

  if (!token || token.revokedAt) return null;

  // Admin-suspended account: refuse outright (the caller turns null into 401).
  if (token.user.lifecycleState === "LOCKED") return null;

  // Pending deletion: the web app grants these sessions reads-but-no-writes
  // (P48-02). The REST layer resolves a token to a { userId, scope } pair
  // *before* it knows whether the route mutates, so there is no honest place to
  // draw that line here — the read/write split lives in each handler. Refusing
  // the token entirely is the conservative choice and matches the grace
  // period's intent: the account is on its way out. Revisit if/when the API
  // layer gains a method-aware guard.
  if (token.user.scheduledDeleteAt) return null;

  return { userId: token.userId, scope: token.scope, tokenHash: hash };
}

/** Usage stats for a request that got past auth *and* the rate limit. */
export function recordApiTokenUse(tokenHash: string): void {
  // Fire-and-forget — don't block the API response on a stats write
  void db.apiToken
    .update({
      where: { tokenHash },
      data: {
        lastUsedAt: new Date(),
        requestCountThisMonth: { increment: 1 },
      },
    })
    .catch(() => undefined);
}

/**
 * P49A-13: revoke every live API token for a user (password change / reset).
 * Takes the caller's transaction so the revocation commits with the password
 * write. Returns how many were revoked, for the confirmation shown to the user.
 */
export async function revokeAllApiTokens(
  client: Prisma.TransactionClient | typeof db,
  userId: string,
): Promise<number> {
  const result = await client.apiToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function listUserApiTokens(userId: string): Promise<ApiTokenSummary[]> {
  return db.apiToken.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scope: true,
      lastUsedAt: true,
      requestCountThisMonth: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
