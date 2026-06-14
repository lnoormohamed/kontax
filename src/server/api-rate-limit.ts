import type { ApiTokenScope } from "~/server/api-tokens";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

export const API_RATE_LIMITS: Record<ApiTokenScope, number> = {
  READ_ONLY: 1_000,
  READ_WRITE: 200,
};

export async function checkApiRateLimit(
  tokenHash: string,
  scope: ApiTokenScope,
): Promise<{ allowed: boolean; limit: number; remaining: number; resetAt: Date }> {
  const limiter = scope === "READ_ONLY" ? rateLimiters.apiRead : rateLimiters.apiWrite;
  const limit = API_RATE_LIMITS[scope];

  try {
    const result = await checkRateLimit(limiter, tokenHash);
    return { ...result, limit };
  } catch {
    // Fail open — rate limiting is best-effort, token validation is the security gate
    console.warn("[api-rate-limit] limiter error — failing open");
    return { allowed: true, limit, remaining: limit, resetAt: new Date(Date.now() + 3_600_000) };
  }
}
