import { createHash } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

import type { ApiTokenScope } from "~/server/api-tokens";
import { validateApiToken } from "~/server/api-tokens";
import { checkApiRateLimit } from "~/server/api-rate-limit";
import { corsHeaders } from "~/lib/api-cors";

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

  const token = authHeader.slice(7);
  const identity = await validateApiToken(token);

  if (!identity) {
    return NextResponse.json(
      { error: "INVALID_TOKEN", message: "The provided API token is invalid or revoked." },
      { status: 401, headers: corsHeaders },
    );
  }

  // Hash the bearer token — rate limit key is per-token, not per-user
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rateLimit = await checkApiRateLimit(tokenHash, identity.scope);

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
