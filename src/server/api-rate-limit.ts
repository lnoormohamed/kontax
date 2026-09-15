import type { ApiTokenScope } from "~/server/api-tokens";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

export const API_RATE_LIMITS: Record<ApiTokenScope, number> = {
  READ_ONLY: 1_000,
  READ_WRITE: 200,
};

/**
 * P48-16: this used to wrap `checkRateLimit` in a "fail open" try/catch. That
 * branch was already dead — `checkRateLimit` never throws — and the API
 * limiters now carry a `RateLimiterMemory` insurance limiter, so a Redis outage
 * degrades to per-process limiting instead of surfacing a transport error. See
 * the outage policy note in `src/server/rate-limit.ts`.
 */
export async function checkApiRateLimit(
  tokenHash: string,
  scope: ApiTokenScope,
): Promise<{ allowed: boolean; limit: number; remaining: number; resetAt: Date }> {
  const limiter = scope === "READ_ONLY" ? rateLimiters.apiRead : rateLimiters.apiWrite;
  const limit = API_RATE_LIMITS[scope];

  const result = await checkRateLimit(limiter, tokenHash);
  return { ...result, limit };
}
