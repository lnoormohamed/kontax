// Resolve the real client IP from request headers.
//
// Production edge chain is Cloudflare → Nginx Proxy Manager → Coolify Traefik →
// app. Traefik does not trust NPM's `X-Forwarded-For`, so by the time a request
// reaches the app that header (and `X-Real-IP`) carry the *proxy's* address, not
// the visitor's — which would collapse every visitor into one rate-limit bucket.
//
// Cloudflare sets `CF-Connecting-IP` to the true client address and every hop in
// the chain forwards it unchanged, so we prefer it. It is trustworthy here
// because the origin is only reachable *through* Cloudflare (the homelab IPs are
// not publicly routable), so it cannot be spoofed by a direct-to-origin request.
//
// P49A-13: the `X-Forwarded-For` / `X-Real-IP` fallbacks apply outside
// production deployments only (local/dev/staging-without-Cloudflare). In
// production they never carried the visitor's address (see above), and a client
// can put anything in `X-Forwarded-For` — so a request that arrived without
// `CF-Connecting-IP` could have picked its own rate-limit bucket. A self-hosted
// deployment behind a trusted proxy that sets X-Forwarded-For (and no
// Cloudflare) can opt back in with KONTAX_TRUST_FORWARDED_FOR=1.
//
// "Production" is the repo-wide rule (Fable review): KONTAX_DEPLOY_ENV decides
// when set, NODE_ENV only when it is unset — the same test as
// `isProductionRuntime()` (src/lib/site-url.ts), src/server/rate-limit.ts and
// scripts/runtime/start-production.mjs. Staging (NODE_ENV=production,
// KONTAX_DEPLOY_ENV=staging) is therefore NOT production here.
//
// A production request without CF-Connecting-IP returns null; callers fall back
// to a shared "unknown" bucket, and that is logged (throttled) because it means
// the edge chain is not what this file assumes.
//
// KEEP IN SYNC with src/server/dav/client-ip.mjs (tests assert they agree).

interface HeaderGetter {
  get(name: string): string | null;
}

const isProductionDeploy = (): boolean => {
  const deployEnv = (process.env.KONTAX_DEPLOY_ENV ?? "").trim().toLowerCase();
  return deployEnv ? deployEnv === "production" : process.env.NODE_ENV === "production";
};

export const trustsForwardedFor = (): boolean =>
  !isProductionDeploy() || process.env.KONTAX_TRUST_FORWARDED_FOR === "1";

const MISSING_CF_WARN_INTERVAL_MS = 60_000;
let lastMissingCfWarnAt = 0;

const warnMissingCfHeader = () => {
  const now = Date.now();
  if (now - lastMissingCfWarnAt < MISSING_CF_WARN_INTERVAL_MS) return;
  lastMissingCfWarnAt = now;
  console.warn(
    "[Kontax] production request without CF-Connecting-IP — per-IP rate limits are using a shared bucket. Check that traffic reaches the app through Cloudflare (or set KONTAX_TRUST_FORWARDED_FOR=1 behind a trusted proxy).",
  );
};

export function getClientIp(headers: HeaderGetter): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  if (!trustsForwardedFor()) {
    warnMissingCfHeader();
    return null;
  }

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return headers.get("x-real-ip")?.trim() ?? null;
}
