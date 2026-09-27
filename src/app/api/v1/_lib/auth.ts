import { type NextRequest, NextResponse } from "next/server";

import type { ApiTokenScope } from "~/server/api-tokens";
import { recordApiTokenUse, validateApiToken } from "~/server/api-tokens";
import { checkApiRateLimit } from "~/server/api-rate-limit";
import { getUserBillingContext } from "~/server/billing";
import { corsHeaders } from "~/lib/api-cors";
import { getClientIp } from "~/lib/client-ip";
import { checkRateLimit, peekRateLimit, rateLimiters } from "~/server/rate-limit";

const tooManyAuthFailures = (resetAt: Date) =>
  NextResponse.json(
    { error: "RATE_LIMITED", message: "Too many invalid API tokens from this address. Try again later." },
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Retry-After": Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)).toString(),
      },
    },
  );

// P49A-13 (Fable review): say when the invalid-token gate refuses someone —
// at most once a minute, and without the IP (it's a volume signal; a blocked
// shared address shows up as repeated lines).
const AUTH_FAIL_LOG_INTERVAL_MS = 60_000;
let lastAuthFailLogAt = 0;
let refusedSinceLastLog = 0;
const logAuthFailGateTripped = () => {
  refusedSinceLastLog += 1;
  const now = Date.now();
  if (now - lastAuthFailLogAt < AUTH_FAIL_LOG_INTERVAL_MS) return;
  console.warn(
    `[api] invalid-token limit refused ${refusedSinceLastLog} request(s) since the last report (per-IP, 150 bad tokens / 15 min)`,
  );
  lastAuthFailLogAt = now;
  refusedSinceLastLog = 0;
};

export async function withApiAuth(
  req: NextRequest,
  handler: (userId: string, scope: ApiTokenScope) => Promise<NextResponse>,
): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Missing or invalid Authorization header." },
      { status: 401, headers: corsHeaders },
    );
  }

  // P49A-13: invalid-token spraying used to be unlimited — every guess was a DB
  // lookup. Refuse an IP that has sent too many bad tokens *before* looking
  // this one up; only failed lookups count, so valid traffic is unaffected.
  const ipKey = `ip:${getClientIp(req.headers) ?? "unknown"}`;
  const ipGate = await peekRateLimit(rateLimiters.apiAuthFailByIp, ipKey);
  if (!ipGate.allowed) {
    logAuthFailGateTripped();
    return tooManyAuthFailures(ipGate.resetAt);
  }

  const token = authHeader.slice(7);
  const identity = await validateApiToken(token);

  if (!identity) {
    await checkRateLimit(rateLimiters.apiAuthFailByIp, ipKey);
    return NextResponse.json(
      { error: "INVALID_TOKEN", message: "The provided API token is invalid or revoked." },
      { status: 401, headers: corsHeaders },
    );
  }

  // Token creation is plan-gated, but a token outlives the plan that minted it
  // (downgrade to Free, or Family losing API access), so check on every call.
  const billing = await getUserBillingContext(identity.userId);
  if (!billing.entitlements.apiAccessEnabled) {
    return NextResponse.json(
      { error: "UPGRADE_REQUIRED", message: "API access is not included in your current plan." },
      { status: 403, headers: corsHeaders },
    );
  }

  // Rate limit key is per-token (its hash), not per-user
  const rateLimit = await checkApiRateLimit(identity.tokenHash, identity.scope);

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": rateLimit.limit.toString(),
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
  };

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many requests. See X-RateLimit-* headers." },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          ...corsHeaders,
          "Retry-After": Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  // P49A-13: counted only once the request is past the rate limit (a 429 used
  // to count as a use and bump lastUsedAt).
  recordApiTokenUse(identity.tokenHash);

  const response = await handler(identity.userId, identity.scope);

  // Append rate limit + CORS headers to every response
  for (const [key, value] of Object.entries(rateLimitHeaders)) {
    response.headers.set(key, value);
  }
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export function requireWriteScope(scope: ApiTokenScope): NextResponse | null {
  if (scope === "READ_ONLY") {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "This token is read-only. Use a read-write token to modify data." },
      { status: 403 },
    );
  }
  return null;
}

/**
 * P48-05: resolve the book a contact should live in. A caller-supplied `bookId`
 * must belong to the token owner; a missing/null id means the default book.
 * Returns the same "not found" shape for a foreign id and a non-existent id so
 * book ids cannot be probed.
 */
export async function resolveOwnedBookId(
  userId: string,
  bookId: string | null | undefined,
): Promise<{ bookId: string } | { error: NextResponse }> {
  const { db } = await import("~/server/db");
  const { getUserDefaultBook } = await import("~/server/address-books");
  if (!bookId) return { bookId: (await getUserDefaultBook(userId)).id };
  const book = await db.addressBook.findFirst({
    where: { id: bookId, userId, archivedAt: null },
    select: { id: true },
  });
  if (!book) {
    return {
      error: NextResponse.json(
        { error: "VALIDATION_ERROR", message: "bookId does not refer to one of your address books." },
        { status: 422, headers: corsHeaders },
      ),
    };
  }
  return { bookId: book.id };
}
