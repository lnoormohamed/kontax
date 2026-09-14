import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import Redis from "ioredis";

type Limiter = RateLimiterRedis | RateLimiterMemory;

/**
 * P48-16 — Redis outage policy.
 *
 * Every Redis-backed limiter below is created with an `insuranceLimiter`: a
 * `RateLimiterMemory` with identical points/duration. When the Redis round-trip
 * fails, rate-limiter-flexible transparently retries the operation against that
 * in-process memory limiter (see `RateLimiterInsuredAbstract._handleError`), so
 * `consume()`/`get()` still resolve or reject with a real `RateLimiterRes`.
 *
 * The practical consequences:
 *
 *   - Every bucket — security-critical (login, password reset, TOTP,
 *     registration, step-up, sync elevation) *and* convenience (image proxy,
 *     REST API, contact form, card clicks) — keeps limiting during an outage.
 *     Protection degrades from cluster-wide to per-process, it does not vanish.
 *   - Counters are per-process and start empty, so limits are effectively
 *     multiplied by the number of app processes for the duration of the outage.
 *     That is the deliberate trade-off: no lockout of legitimate users, no
 *     unlimited brute-force window.
 *   - Nothing needs restarting when Redis comes back; the next successful
 *     round-trip goes to Redis again. The memory counters simply age out.
 *   - `checkRateLimit` therefore never sees a transport `Error` for these
 *     limiters, which makes the old "fail open" branch in
 *     `src/server/api-rate-limit.ts` unreachable — it has been removed.
 *
 * The transport-error branch in `checkRateLimit` is kept only for limiters
 * constructed without insurance (e.g. a bare `RateLimiterMemory` in tests, or a
 * future store-backed limiter added without one).
 */

const isProductionDeploy =
  process.env.NODE_ENV === "production" ||
  process.env.KONTAX_DEPLOY_ENV === "production";

// P48-16: production must use the shared store. The in-memory fallback is a dev
// convenience — in production it silently turns cluster-wide limits into
// per-process ones that reset on every deploy. `SKIP_ENV_VALIDATION` (set by the
// Docker build stage) exempts `next build`, which imports this module while
// prerendering but never serves traffic.
if (isProductionDeploy && !process.env.REDIS_URL && !process.env.SKIP_ENV_VALIDATION) {
  throw new Error(
    "REDIS_URL is required in production — rate limiting would silently fall back to a per-process in-memory store that resets on every deploy. Set REDIS_URL (e.g. redis://valkey:6379).",
  );
}

// Singleton Valkey/Redis client. Falls back to null in dev if REDIS_URL is unset.
const redisClient =
  process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      })
    : null;

// ── Throttled outage logging ─────────────────────────────────────────────────
// An outage produces one failure per request; log at most once a minute so the
// warning is visible without drowning the log.

const WARN_INTERVAL_MS = 60_000;
const lastWarnAt = new Map<string, number>();

const warnThrottled = (scope: string, error: unknown) => {
  const now = Date.now();
  const previous = lastWarnAt.get(scope) ?? 0;
  if (now - previous < WARN_INTERVAL_MS) return;
  lastWarnAt.set(scope, now);
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(
    `[Kontax] rate-limit store unavailable (${scope}): ${detail} — limiters are running on per-process memory insurance until Redis recovers.`,
  );
};

redisClient?.on("error", (error: unknown) => {
  warnThrottled("redis-client", error);
});

// P38-09: shared client for other Redis-backed concerns (session validation
// cache). Null when REDIS_URL is unset — callers must fail open to the DB.
export const getRedis = () => redisClient;

function makeLimiter(points: number, duration: number, keyPrefix: string): Limiter {
  if (!redisClient) {
    // Dev fallback: per-process in-memory store. Not shared across instances.
    return new RateLimiterMemory({ points, duration, keyPrefix });
  }
  return new RateLimiterRedis({
    storeClient: redisClient,
    points,
    duration,
    keyPrefix,
    // P48-16: fail closed to a per-process memory limiter during a Redis outage.
    insuranceLimiter: new RateLimiterMemory({ points, duration, keyPrefix }),
  });
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

  // P48-10: public-card "add to Kontax" click counter — 30 per IP per hour so
  // the unauthenticated analytics counter cannot be inflated trivially.
  cardClick: makeLimiter(30, 60 * 60, "rl:card-click"),

  // P38-08 follow-up: external avatar image proxy — 240 fetches per user per
  // minute (a full list window of proxied avatars stays well under this).
  imageProxy: makeLimiter(240, 60, "rl:image-proxy"),

  // P34D-01: login brute-force — 5 wrong-password attempts per email per 15 minutes
  loginByEmail: makeLimiter(5, 15 * 60, "rl:login-email"),
  // P34D-01: login brute-force — 20 attempts per IP per 15 minutes (shared across accounts)
  loginByIp: makeLimiter(20, 15 * 60, "rl:login-ip"),

  // P48-09: CardDAV auth. The (IP, email) pair is the bucket that actually
  // blocks — a burst from one shared Cloudflare edge IP must not lock sync for
  // every other user behind it — and the per-IP bucket is a loose backstop.
  // Key layout (`dav:pair:<ip>:<email>`, `dav:ip:<ip>`) is deliberately
  // identical to the limiters `server.mjs` builds, so both share Redis buckets.
  // `server.mjs` cannot import this module (plain ESM, no TS), which is why the
  // points/duration are repeated there — keep them in sync.
  davAuthByPair: makeLimiter(10, 15 * 60, "dav:pair"),
  davAuthByIp: makeLimiter(100, 15 * 60, "dav:ip"),
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * A rejection carrying limiter state (`RateLimiterRes`, or the plain object a
 * custom store may reject with) means "limited". A rejection that is an `Error`
 * means the store itself failed. With `insuranceLimiter` configured the latter
 * cannot reach us — see the outage policy note at the top of this file.
 */
const isLimitedRejection = (rejection: unknown): rejection is RateLimiterRes => {
  if (rejection instanceof RateLimiterRes) return true;
  if (rejection instanceof Error) return false;
  return (
    typeof rejection === "object" &&
    rejection !== null &&
    "msBeforeNext" in rejection
  );
};

/**
 * Consume one point and return the result. Use for actions that should always
 * count toward the limit (e.g. failed login attempts).
 *
 * Never throws. A limited key returns `{ allowed: false }`; a store failure on
 * a limiter without insurance is logged (throttled) and treated as allowed.
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
  } catch (rejection: unknown) {
    if (isLimitedRejection(rejection)) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + (rejection.msBeforeNext ?? 0)),
      };
    }

    // Transport failure on a limiter with no insurance limiter. Fail open so a
    // store outage cannot lock every user out, but make it loud.
    warnThrottled("consume", rejection);
    return { allowed: true, remaining: 0, resetAt: new Date(0) };
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
  } catch (error) {
    // `get()` also routes through the insurance limiter, so this is only
    // reachable for limiters configured without one.
    warnThrottled("peek", error);
    return { allowed: true, remaining: 0, resetAt: new Date(0) };
  }
}
