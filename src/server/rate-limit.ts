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

  // P31-02: step-up password verify — 5 attempts per user per hour
  stepUpVerify: makeLimiter(5, 60 * 60, "rl:step-up-verify"),

  // Registration: new accounts per IP — 10 per hour
  registration: makeLimiter(10, 60 * 60, "rl:registration"),

  // P23-06: sync settings re-auth (sudo) — 5 password attempts per 15 minutes
  syncSettingsElevation: makeLimiter(5, 15 * 60, "rl:sync-elevation"),

  // P29-08: REST API per-token sliding window (key = token SHA-256 hash)
  apiRead: makeLimiter(1_000, 60 * 60, "rl:api-read:"),
  apiWrite: makeLimiter(200, 60 * 60, "rl:api-write:"),

  // P34C-14: contact form — 3 submissions per IP per hour
  contactForm: makeLimiter(3, 60 * 60, "rl:contact-form"),

  // P38-08 follow-up: external avatar image proxy — 240 fetches per user per
  // minute (a full list window of proxied avatars stays well under this).
  imageProxy: makeLimiter(240, 60, "rl:image-proxy"),

  // P34D-01: login brute-force — 5 wrong-password attempts per email per 15 minutes
  loginByEmail: makeLimiter(5, 15 * 60, "rl:login-email"),
  // P34D-01: login brute-force — 20 attempts per IP per 15 minutes (shared across accounts)
  loginByIp: makeLimiter(20, 15 * 60, "rl:login-ip"),
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Consume one point and return the result. Use for actions that should always
 * count toward the limit (e.g. failed login attempts).
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

/**
 * Check whether a key is currently blocked WITHOUT consuming a point.
 * Use to gate an action before performing it (e.g. check login rate limit
 * before the bcrypt comparison, then consume only on failure).
 */
export async function peekRateLimit(
  limiter: Limiter,
  identifier: string,
): Promise<RateLimitResult> {
  try {
    const res = await limiter.get(identifier);
    if (!res || res.remainingPoints > 0) {
      return { allowed: true, remaining: res?.remainingPoints ?? Infinity, resetAt: new Date(0) };
    }
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + (res.msBeforeNext ?? 0)),
    };
  } catch {
    return { allowed: true, remaining: 0, resetAt: new Date(0) };
  }
}
