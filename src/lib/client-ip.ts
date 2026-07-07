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
// The `X-Forwarded-For`/`X-Real-IP` fallbacks preserve the prior behaviour for
// any path that does not traverse Cloudflare (e.g. local/dev).

interface HeaderGetter {
  get(name: string): string | null;
}

export function getClientIp(headers: HeaderGetter): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return headers.get("x-real-ip")?.trim() ?? null;
}
