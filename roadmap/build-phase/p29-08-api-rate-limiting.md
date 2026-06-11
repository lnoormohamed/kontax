# P29-08 — API Rate Limiting & Usage Tracking

## Purpose

Enforce per-token request rate limits (1,000/hour for read-only, 200/hour for read-write) and expose usage statistics in the developer settings panel. Without rate limiting, a misbehaving script or a compromised token could exhaust database connections or run up infrastructure costs.

## Background

P29-05 added `requestCountThisMonth` on `ApiToken` — a running counter for the settings panel display. This ticket adds the per-hour rate limit enforcement that the P29-06 API middleware calls via `checkApiRateLimit`. The rate limiter uses the same Valkey + `rate-limiter-flexible` infrastructure as P18-10's login rate limiter — a sliding window per token hash.

## Scope

**In scope:**
- `checkApiRateLimit(userId, tokenHash)` — returns `null` (allowed) or `{ limit, resetAt }` (rate limited)
- Rate limits: 1,000 requests/hour for `READ_ONLY`, 200 requests/hour for `READ_WRITE`
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on every API response (not just 429s)
- Monthly usage counter display in the settings panel (reads `ApiToken.requestCountThisMonth`)
- Monthly counter reset CRON (first of each month at 00:00 UTC)

**Out of scope:**
- IP-based rate limiting (token-based is sufficient for v1)
- Burst allowance / token bucket algorithm (sliding window is sufficient)

---

## Design / Implementation Spec

### Rate limit store

Using Valkey (self-hosted) with `rate-limiter-flexible` + `ioredis` — same infrastructure as P18-10. No additional packages needed beyond what P18-10 installs.

`src/server/api-rate-limit.ts`:

```typescript
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";

// Reuse the same Valkey client as P18-10 if possible, or create a dedicated one here.
const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { enableOfflineQueue: false, lazyConnect: true })
  : null;

function makeApiLimiter(points: number, keyPrefix: string) {
  if (!redisClient) return new RateLimiterMemory({ points, duration: 60 * 60, keyPrefix });
  return new RateLimiterRedis({ storeClient: redisClient, points, duration: 60 * 60, keyPrefix });
}

const readOnlyLimiter = makeApiLimiter(1000, "api:read:");
const readWriteLimiter = makeApiLimiter(200, "api:write:");

export async function checkApiRateLimit(
  tokenHash: string,
  scope: ApiTokenScope,
): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}> {
  const limiter = scope === "READ_ONLY" ? readOnlyLimiter : readWriteLimiter;
  const limit = scope === "READ_ONLY" ? 1000 : 200;

  try {
    const res = await limiter.consume(tokenHash, 1);
    return {
      allowed: true,
      limit,
      remaining: res.remainingPoints,
      resetAt: new Date(Date.now() + res.msBeforeNext),
    };
  } catch (res: unknown) {
    const msBeforeNext = (res as { msBeforeNext?: number }).msBeforeNext ?? 0;
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: new Date(Date.now() + msBeforeNext),
    };
  }
}
```

### Wiring into the API middleware

In `src/app/api/v1/_middleware/auth.ts` (P29-06), after `validateApiToken` succeeds:

```typescript
const rateLimitResult = await checkApiRateLimit(tokenHash, identity.scope);

// Always add rate limit headers to the response
const rateLimitHeaders = {
  "X-RateLimit-Limit": rateLimitResult.limit.toString(),
  "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
  "X-RateLimit-Reset": rateLimitResult.resetAt.toISOString(),
};

if (!rateLimitResult.allowed) {
  return NextResponse.json(
    { error: "RATE_LIMITED", message: "Too many requests." },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders,
        "Retry-After": Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000).toString(),
      },
    }
  );
}

// Pass headers to the handler response
const response = await handler(identity.userId, identity.scope);
Object.entries(rateLimitHeaders).forEach(([key, value]) => response.headers.set(key, value));
return response;
```

The `tokenHash` (SHA-256 of the bearer token) is used as the rate limit key — this ensures the limit is per-token, not per-user.

### Monthly counter reset CRON

`src/app/api/cron/reset-api-counters/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Only run on the 1st of the month
  const now = new Date();
  if (now.getUTCDate() !== 1) {
    return NextResponse.json({ skipped: true });
  }

  const result = await db.apiToken.updateMany({
    where: { revokedAt: null },
    data: { requestCountThisMonth: 0 },
  });

  return NextResponse.json({ reset: result.count });
}
```

Register on the LXC cron (`crontab -e`):
```
0 0 * * * curl -s -X POST https://your-app-url/api/cron/reset-api-counters -H "x-cron-secret: $CRON_SECRET"
```
(daily at midnight UTC — the handler body checks if it's the 1st of the month before doing any work)

### Usage display in the settings panel

In `/settings/developer`, below each token row:

```
My scripts          read-only    Last used: 2h ago
492 requests this month   ·   Rate limit: 1,000 / hour
```

`ApiToken.requestCountThisMonth` is read from the DB (updated by `validateApiToken` in P29-05). The rate limit display shows the static limit for the token's scope — not the current window remaining (that would require a Redis query per token for the settings page, which is unnecessary).

---

## Acceptance Criteria

- `checkApiRateLimit` returns `allowed: false` after the per-scope request limit is exceeded within a sliding 1-hour window.
- All API responses (not just 429s) include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.
- A 429 response also includes a `Retry-After` header with the number of seconds until the limit resets.
- The rate limit key is the token hash — two different tokens owned by the same user have independent limits.
- The monthly counter reset CRON runs on the 1st of each month and resets `requestCountThisMonth` to 0 for all active tokens.
- The settings panel shows the monthly request count and the hourly rate limit for each token.

---

## Risks and Open Questions

- **Valkey availability:** if the self-hosted Valkey instance is unavailable, `checkApiRateLimit` will throw. Handle this gracefully by catching the error and allowing the request through (fail open) with a logged warning. Rate limiting is a best-effort protection, not a hard security gate — the token validation (P29-05) is the security layer.
- **Sliding window vs fixed window:** `Ratelimit.slidingWindow` is fairer than `fixedWindow` (avoids the "burst at the top of the hour" exploit) but slightly more expensive in Redis. For the request volumes expected at v1 launch (hundreds of tokens, not millions), this is not a concern.
