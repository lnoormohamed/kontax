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
// P49A-13: the `X-Forwarded-For` / `X-Real-IP` fallbacks now apply outside
// production only (local/dev, where there is no Cloudflare). In production they
// never carried the visitor's address (see above), and a client can put
// anything in `X-Forwarded-For` — so a request that somehow arrived without
// `CF-Connecting-IP` could have picked its own rate-limit bucket. A self-hosted
// deployment behind a trusted proxy that sets X-Forwarded-For (and no
// Cloudflare) can opt back in with KONTAX_TRUST_FORWARDED_FOR=1.
//
// KEEP IN SYNC with src/server/dav/client-ip.mjs (tests assert they agree).

interface HeaderGetter {
  get(name: string): string | null;
}

export const trustsForwardedFor = (): boolean =>
  process.env.NODE_ENV !== "production" || process.env.KONTAX_TRUST_FORWARDED_FOR === "1";

export function getClientIp(headers: HeaderGetter): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  if (!trustsForwardedFor()) return null;

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return headers.get("x-real-ip")?.trim() ?? null;
}
