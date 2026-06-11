# P18-10 — Rate Limiting & Security Infrastructure

## Purpose

Multiple Phase 18 tickets reference rate limiting (P18-02 password change, P18-04 email resend, P18-05 password reset, P18-07 TOTP attempts, P18-09 deletion) and a Next.js middleware file (P18-07 TOTP challenge redirect, P18-09 pending-deletion redirect). Neither exists in the codebase today. This ticket establishes both pieces of shared infrastructure before any of those features are implemented, so each ticket can depend on stable utilities rather than implementing ad-hoc in-memory counters.

It also owns three small but critical security configurations that have nowhere else to live: NextAuth JWT `maxAge`, the `CRON_SECRET` guard for background jobs, and the `.env.example` update consolidating all Phase 18 environment variables.

## Background

The current codebase has:
- No `src/middleware.ts` — all routes are unguarded at the middleware layer.
- No rate limiting library — using `rate-limiter-flexible` + `ioredis` backed by the self-hosted Valkey instance.
- No JWT `maxAge` — issued tokens are valid indefinitely (until `sessionVersion` changes), which means a stolen token that is never explicitly revoked is valid forever.
- An `.env.example` with only 3 variables (`APP_URL`, `AUTH_SECRET`, `DATABASE_URL`).

This ticket creates the foundation. It is a prerequisite for P18-02, P18-04, P18-05, P18-07, and P18-09.

## Scope

**In scope:**
- Rate limiting utility (`src/server/rate-limit.ts`) using `rate-limiter-flexible` + `ioredis` backed by self-hosted Valkey
- `src/middleware.ts` — initial implementation covering: auth guard, `pendingTotp` redirect (P18-07), `pendingDeletion` redirect (P18-09)
- NextAuth JWT `maxAge` configuration (30-day tokens, 7-day idle extension)
- `CRON_SECRET` request guard utility for `/api/cron/*` routes (used by P18-09's deletion job)
- `.env.example` update — all Phase 18 env vars documented

**Out of scope:**
- Application-level DDoS protection (use Vercel's built-in or Cloudflare)
- IP blocking lists
- Bot detection (honeypots, CAPTCHA) — deferred to a later security hardening phase

---

## Design / Implementation Spec

### 1. Rate limiting utility

**Dependencies:** `rate-limiter-flexible` + `ioredis`

```bash
npm install rate-limiter-flexible ioredis
```

Required env var:
- `REDIS_URL` — connection string for the self-hosted Valkey instance (e.g. `redis://192.168.x.x:6379`)

For local development without Valkey, the utility falls back to an in-memory store using `RateLimiterMemory` (suitable for single-process dev; not shared across multiple server instances).

**`src/server/rate-limit.ts`:**

```typescript
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";

// Shared Valkey/Redis client — reused across all limiters.
// Falls back gracefully if REDIS_URL is missing (dev mode).
const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { enableOfflineQueue: false, lazyConnect: true })
  : null;

type Limiter = RateLimiterRedis | RateLimiterMemory;

function makeLimiter(points: number, duration: number, keyPrefix: string): Limiter {
  if (!redisClient) {
    // Dev fallback: in-memory (per-process, not shared across instances)
    return new RateLimiterMemory({ points, duration, keyPrefix });
  }
  return new RateLimiterRedis({
    storeClient: redisClient,
    points,
    duration,
    keyPrefix,
  });
}

// Named limiters — one per use case with its own key namespace and window.
export const rateLimiters = {
  // P18-02: password change attempts per userId — 5 per hour
  passwordChange: makeLimiter(5, 60 * 60, "rl:pw-change"),

  // P18-04: verification email resend per userId — 3 per 5 minutes
  emailResend: makeLimiter(3, 5 * 60, "rl:email-resend"),

  // P18-05: password reset request per email — 3 per 30 minutes
  passwordResetByEmail: makeLimiter(3, 30 * 60, "rl:pw-reset-email"),

  // P18-05: password reset request per IP — 10 per 30 minutes
  passwordResetByIp: makeLimiter(10, 30 * 60, "rl:pw-reset-ip"),

  // P18-07: TOTP challenge attempts per userId — 5 per 15 minutes
  totpChallenge: makeLimiter(5, 15 * 60, "rl:totp-challenge"),

  // P18-07: TOTP recovery code attempts per userId — 5 per 15 minutes
  totpRecovery: makeLimiter(5, 15 * 60, "rl:totp-recovery"),

  // Registration: new account creation per IP — 10 per hour
  registration: makeLimiter(10, 60 * 60, "rl:registration"),
} as const;

/**
 * Check a rate limit. Returns { allowed, remaining, resetAt }.
 * identifier: unique key for the user or IP (e.g. userId, "ip:1.2.3.4")
 */
export async function checkRateLimit(
  limiter: Limiter,
  identifier: string,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  try {
    const res = await limiter.consume(identifier, 1);
    return {
      allowed: true,
      remaining: res.remainingPoints,
      resetAt: new Date(Date.now() + res.msBeforeNext),
    };
  } catch (res: unknown) {
    // RateLimiterRes is thrown when the limit is exceeded
    const msBeforeNext = (res as { msBeforeNext?: number }).msBeforeNext ?? 0;
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + msBeforeNext),
    };
  }
}
```

**Usage pattern** (example for P18-02):

```typescript
import { rateLimiters, checkRateLimit } from "~/server/rate-limit";

const rl = await checkRateLimit(rateLimiters.passwordChange, `user:${session.user.id}`);
if (!rl.allowed) return { error: "RATE_LIMIT_EXCEEDED" };
```

### 2. Next.js middleware

Create `src/middleware.ts` at the project root (co-located with `next.config.js`):

```typescript
import { auth } from "~/server/auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Public routes — no auth required
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/share",       // vCard share public links (P12-02)
  "/api/auth",    // NextAuth endpoints
  "/api/register",
  "/api/cron",    // Protected separately by CRON_SECRET, not session
  "/_next",
  "/favicon.ico",
];

// Routes accessible only during TOTP challenge (pendingTotp session)
const TOTP_CHALLENGE_PATHS = ["/login/verify-2fa", "/api/auth"];

// Routes accessible only during pending-deletion grace period
const PENDING_DELETION_PATHS = ["/account-pending-deletion", "/api/auth"];

export default auth((req: NextRequest & { auth: { user?: { id?: string }; pendingTotp?: boolean; pendingDeletion?: boolean } | null }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow public paths through unconditionally
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // No session → redirect to login
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // pendingTotp session — only allow the TOTP challenge page
  if (session.pendingTotp) {
    if (!TOTP_CHALLENGE_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/login/verify-2fa", req.url));
    }
    return NextResponse.next();
  }

  // pendingDeletion session (grace period, signed back in) — only allow the recovery page
  if (session.pendingDeletion) {
    if (!PENDING_DELETION_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/account-pending-deletion", req.url));
    }
    return NextResponse.next();
  }

  // Normal authenticated session — allow through
  return NextResponse.next();
});

export const config = {
  // Apply middleware to all routes except static files
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
```

**Notes on the middleware:**
- `auth` is the NextAuth middleware helper from `~/server/auth`. It populates `req.auth` with the current session.
- `pendingTotp` and `pendingDeletion` must be surfaced in the session type (extend the `Session` interface in `src/server/auth/config.ts`).
- The `PUBLIC_PATHS` list must be kept in sync as new public routes are added. Consider a shared constant file.
- Admin routes (`/admin/**`) are not added here — Phase 21 adds its own middleware guard.

### 3. JWT `maxAge` configuration

In `src/server/auth/config.ts`, add to the top-level config:

```typescript
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days — absolute maximum token lifetime
  updateAge: 7 * 24 * 60 * 60, // 7 days — re-issue token (reset maxAge) if user is still active
},
```

**`maxAge`:** A JWT issued at login will be rejected after 30 days regardless of `sessionVersion`. This bounds the worst-case exposure of a stolen token: even if `sessionVersion` is never incremented and the `UserSession` row is never revoked, the token expires in 30 days.

**`updateAge`:** NextAuth automatically re-issues the JWT (resetting the expiry clock) if the session is accessed more than 7 days since the last issue. Active users never expire; inactive users are logged out after 30 days.

### 4. `CRON_SECRET` guard utility

All `/api/cron/*` routes are called by Vercel Cron Jobs (or an external scheduler). They must be protected against arbitrary HTTP access.

**`src/server/cron-guard.ts`:**

```typescript
import { type NextRequest, NextResponse } from "next/server";

export function assertCronSecret(req: NextRequest): NextResponse | null {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // allowed
}
```

Usage in a cron route handler:

```typescript
export async function GET(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;
  // ... cron logic
}
```

`CRON_SECRET` is a random 32-byte hex string. Set it in Vercel's environment variables and configure the Vercel Cron Job to send it as a header.

### 5. Register route security updates

The existing `/api/register/route.ts` needs three changes now that Phase 18 infrastructure exists:

1. **Minimum password length:** Change `z.string().min(6)` to `z.string().min(8)` to match P18-02's policy.
2. **Rate limiting on registration:** Add `checkRateLimit(rateLimiters.registration, ip)` at the top of the handler. If limited, return 429.
3. **Email verification send:** After the user is created, call `sendVerificationEmail(user.id, "SIGNUP")` (P18-04). Wrap in try/catch — a failed email send must not fail the registration.

These changes are small but must be made in the same PR as P18-04 to avoid a window where new signups go unverified.

### 6. `.env.example` updates

All Phase 18 environment variables, to be added to `.env.example` and validated in `src/env.js`:

```bash
# ─── Auth ────────────────────────────────────────────────────────────────────
AUTH_SECRET=""          # Next Auth secret — npx auth secret

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/kontax"

# ─── App ─────────────────────────────────────────────────────────────────────
APP_URL=""              # Public origin, e.g. https://kontax.example.com

# ─── Rate limiting (Valkey / Redis) ──────────────────────────────────────────
# Self-hosted Valkey instance (LXC on Proxmox or similar)
# Falls back to in-memory store in dev if unset
REDIS_URL="redis://192.168.x.x:6379"

# ─── Blob storage (MinIO) — P18-01 ──────────────────────────────────────────
# Self-hosted MinIO on LXC. If unset, avatar upload falls back to URL-input only.
MINIO_ENDPOINT=""        # e.g. https://minio.yourdomain.com
MINIO_ACCESS_KEY=""
MINIO_SECRET_KEY=""
MINIO_BUCKET=""          # e.g. kontax-uploads
MINIO_PUBLIC_URL=""      # Public base URL for served objects

# ─── 2FA encryption — P18-07 ─────────────────────────────────────────────────
# 64-character hex string (32 bytes). Generate: openssl rand -hex 32
TOTP_ENCRYPTION_KEY=""

# ─── OAuth providers — deferred to TBD (P18-08) ─────────────────────────────
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# APPLE_CLIENT_ID=""
# APPLE_TEAM_ID=""
# APPLE_KEY_ID=""
# APPLE_PRIVATE_KEY=""

# ─── Email transport — Phase 20 ──────────────────────────────────────────────
# Configured in Phase 20 (Amazon SES). Leave empty in dev — emails log to console.
# AWS_ACCESS_KEY_ID=""
# AWS_SECRET_ACCESS_KEY=""
# AWS_SES_REGION=""
# EMAIL_FROM=""

# ─── Cron jobs — P18-09 ──────────────────────────────────────────────────────
# Secret sent as x-cron-secret header by Vercel Cron Jobs
# Generate: openssl rand -hex 32
CRON_SECRET=""
```

---

## Acceptance Criteria

- `rate-limiter-flexible` and `ioredis` are installed and listed in `package.json`.
- `src/server/rate-limit.ts` exports the named limiters and `checkRateLimit` function.
- The in-memory fallback (`RateLimiterMemory`) is used when `REDIS_URL` is absent; the app starts and functions without error in local dev.
- `src/middleware.ts` exists and enforces auth guards on all non-public routes.
- Unauthenticated requests to protected routes are redirected to `/login?callbackUrl=...`.
- `pendingTotp` sessions can only reach `/login/verify-2fa`.
- `pendingDeletion` sessions can only reach `/account-pending-deletion`.
- JWT `maxAge` is set to 30 days; `updateAge` is set to 7 days in the NextAuth config.
- `assertCronSecret` rejects requests without the correct `CRON_SECRET` header with 401.
- `/api/register/route.ts` is updated: min 8-char password, rate-limited by IP, sends verification email on success.
- `.env.example` is updated with all Phase 18 vars and generation instructions.
- `src/env.js` is updated to validate new required and optional env vars.

---

## Risks and Open Questions

- **In-memory fallback is per-process:** In local development without `REDIS_URL`, the in-memory rate limit store is not shared across processes. Rate limits will not function correctly in multi-process or multi-instance environments. Always set `REDIS_URL` in staging and production.
- **Valkey connectivity:** `ioredis` connects over TCP — it does not work in Next.js Edge Runtime (middleware). Rate limiting must only be called from server actions and API route handlers, never from `src/middleware.ts`. The middleware in this ticket handles only auth redirects, so this is not a problem.
- **Middleware and Edge Runtime:** Next.js middleware runs on the Edge Runtime. The `auth()` helper from NextAuth must be Edge-compatible. Verify the current NextAuth version's middleware export before shipping.
- **`PUBLIC_PATHS` maintenance:** As new public routes are added (e.g. a marketing page, an API webhook endpoint), `PUBLIC_PATHS` must be updated. Consider a comment in the file marking it as a maintenance point.
- **Apple private key format:** The `APPLE_PRIVATE_KEY` is a multi-line PEM file. Environment variables cannot contain literal newlines in most CI/CD systems. Use `\n`-escaped strings or reference a mounted secret file. Add a note to the `.env.example` with the workaround.
