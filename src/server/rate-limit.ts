import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";

type Limiter = RateLimiterRedis | RateLimiterMemory;

// Singleton Valkey/Redis client. Falls back to null in dev if REDIS_URL is unset.
const redisClient =
  process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      })
    : null;

function makeLimiter(points: number, duration: number, keyPrefix: string): Limiter {
  if (!redisClient) {
    // Dev fallback: per-process in-memory store. Not shared across instances.
    return new RateLimiterMemory({ points, duration, keyPrefix });
  }
  return new RateLimiterRedis({ storeClient: redisClient, points, duration, keyPrefix });
}

// Named limiters — each has its own key namespace and window.
export const rateLimiters = {
  // P18-02: password change — 5 attempts per user per hour
  passwordChange: makeLimiter(5, 60 * 60, "rl:pw-change"),

  // P18-04: verification email resend — 3 per user per 5 minutes
  emailResend: makeLimiter(3, 5 * 60, "rl:email-resend"),

  // P18-05: password reset per email — 3 per 30 minutes
  passwordResetByEmail: makeLimiter(3, 30 * 60, "rl:pw-reset-email"),

  // P18-05: password reset per IP — 10 per 30 minutes
  passwordResetByIp: makeLimiter(10, 30 * 60, "rl:pw-reset-ip"),

  // P18-07: TOTP challenge per user — 5 attempts per 15 minutes
  totpChallenge: makeLimiter(5, 15 * 60, "rl:totp-challenge"),

  // P18-07: TOTP recovery code per user — 5 attempts per 15 minutes
  totpRecovery: makeLimiter(5, 15 * 60, "rl:totp-recovery"),

  // Registration: new accounts per IP — 10 per hour
  registration: makeLimiter(10, 60 * 60, "rl:registration"),
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check a rate limit. Returns allowed=true if the request is within limits.
 * identifier: a unique key, e.g. userId or "ip:1.2.3.4"
 */
export async function checkRateLimit(
  limiter: Limiter,
  identifier: string,
): Promise<RateLimitResult> {
  try {
    const res = await limiter.consume(identifier, 1);
    return {
      allowed: true,
      remaining: res.remainingPoints,
      resetAt: new Date(Date.now() + res.msBeforeNext),
    };
  } catch (res: unknown) {
    const msBeforeNext = (res as { msBeforeNext?: number }).msBeforeNext ?? 0;
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + msBeforeNext),
    };
  }
}
