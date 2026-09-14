// P48-09: real client IP for the plain-ESM CardDAV server.
//
// This is the `node:http` twin of `src/lib/client-ip.ts` — same precedence,
// same reasoning. `server.mjs` boots Next itself and therefore cannot import a
// TypeScript module, so the (tiny) logic is duplicated here rather than shared.
// KEEP THE TWO IN SYNC; `tests/node/dav-body-limits.test.ts` asserts that they
// agree on the same header sets.
//
// Why `cf-connecting-ip` first: the production edge chain is Cloudflare → Nginx
// Proxy Manager → Coolify Traefik → app. Traefik does not trust NPM's
// `X-Forwarded-For`, so by the time a request reaches the app that header (and
// `X-Real-IP`) carry the *proxy's* address. Keying the DAV brute-force limiter
// on it collapsed every CardDAV client in the world into one bucket, so 20 bad
// passwords from anyone blocked sync for everyone for 15 minutes.

/**
 * `node:http` gives repeated headers as arrays; take the first value.
 * @param {string | string[] | undefined} value
 * @returns {string | undefined}
 */
const first = (value) => (Array.isArray(value) ? value[0] : value);

/**
 * @param {NodeJS.Dict<string | string[]>} headers  `req.headers` (lower-cased keys).
 * @returns {string | null}
 */
export const clientIpFromNodeHeaders = (headers) => {
  const cf = first(headers["cf-connecting-ip"])?.trim();
  if (cf) return cf;

  const forwarded = first(headers["x-forwarded-for"])?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return first(headers["x-real-ip"])?.trim() ?? null;
};

/**
 * Resolved client IP for an inbound request, falling back to the socket peer
 * for traffic that never traversed a proxy (local/dev).
 *
 * @param {{ headers: NodeJS.Dict<string | string[]>, socket?: { remoteAddress?: string } }} req
 * @returns {string}
 */
export const getRequestIp = (req) =>
  clientIpFromNodeHeaders(req.headers) ?? req.socket?.remoteAddress ?? "unknown";
