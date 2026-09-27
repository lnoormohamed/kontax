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

// P49A-13 (Fable review): same "production" rule as src/lib/client-ip.ts —
// KONTAX_DEPLOY_ENV decides when set, NODE_ENV only when it is unset.
const isProductionDeploy = () => {
  const deployEnv = (process.env.KONTAX_DEPLOY_ENV ?? "").trim().toLowerCase();
  return deployEnv ? deployEnv === "production" : process.env.NODE_ENV === "production";
};

/** Mirrors `trustsForwardedFor` in src/lib/client-ip.ts. */
export const trustsForwardedFor = () =>
  !isProductionDeploy() || process.env.KONTAX_TRUST_FORWARDED_FOR === "1";

const MISSING_CF_WARN_INTERVAL_MS = 60_000;
let lastMissingCfWarnAt = 0;

const warnMissingCfHeader = () => {
  const now = Date.now();
  if (now - lastMissingCfWarnAt < MISSING_CF_WARN_INTERVAL_MS) return;
  lastMissingCfWarnAt = now;
  console.warn(
    "[Kontax] production CardDAV request without CF-Connecting-IP — per-IP rate limits are using a shared bucket. Check that traffic reaches the app through Cloudflare (or set KONTAX_TRUST_FORWARDED_FOR=1 behind a trusted proxy).",
  );
};

/**
 * @param {NodeJS.Dict<string | string[]>} headers  `req.headers` (lower-cased keys).
 * @returns {string | null}
 */
export const clientIpFromNodeHeaders = (headers) => {
  const cf = first(headers["cf-connecting-ip"])?.trim();
  if (cf) return cf;

  // P49A-13: X-Forwarded-For / X-Real-IP only outside production (or with
  // KONTAX_TRUST_FORWARDED_FOR=1) — see src/lib/client-ip.ts.
  if (!trustsForwardedFor()) {
    warnMissingCfHeader();
    return null;
  }

  const forwarded = first(headers["x-forwarded-for"])?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return first(headers["x-real-ip"])?.trim() ?? null;
};

/**
 * Resolved client IP for an inbound request. Outside production (or with the
 * forwarded-for opt-in) it falls back to the socket peer, for traffic that
 * never traversed a proxy (local/dev). In production the socket peer is always
 * the reverse proxy, so — like the Next side — a request without
 * CF-Connecting-IP gets the shared "unknown" key (P49A-13, Fable review: the
 * two twins used to disagree on this).
 *
 * @param {{ headers: NodeJS.Dict<string | string[]>, socket?: { remoteAddress?: string } }} req
 * @returns {string}
 */
export const getRequestIp = (req) => {
  const ip = clientIpFromNodeHeaders(req.headers);
  if (ip) return ip;
  if (!trustsForwardedFor()) return "unknown";
  return req.socket?.remoteAddress ?? "unknown";
};
