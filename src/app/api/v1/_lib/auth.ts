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
