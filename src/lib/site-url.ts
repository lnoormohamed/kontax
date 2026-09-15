/**
 * Canonical public origin helpers.
 *
 * P48-16: there used to be three different `APP_URL` fallbacks scattered across
 * the codebase (`http://localhost:3000`, `https://getkontax.com`,
 * `https://vexon.co`), so a missing `APP_URL` silently produced links pointing
 * at the wrong domain. `getAppUrl()` is now the single request-time resolver
 * and has exactly two behaviours:
 *
 *   - outside production: `APP_URL` if set, otherwise `http://localhost:3000`
 *   - in production: `APP_URL`, or a thrown error if it is unset
 *
 * In production `APP_URL` is also enforced at boot by `assertProductionEnv()`
 * in `src/env.js`, so the throw here is a defence-in-depth backstop rather than
 * the primary guard.
 */

/**
 * The public origin Kontax is served from in production. Used only by
 * `SITE_URL` below (build-time SEO metadata) — never as a request-time
 * fallback for links we send to users.
 */
const CANONICAL_PUBLIC_ORIGIN = "https://getkontax.com";

const DEV_FALLBACK_ORIGIN = "http://localhost:3000";

const stripTrailingSlash = (value: string) => value.replace(/\/$/, "");

/** True when this process is a production deployment (runtime, not build). */
const isProductionRuntime = () =>
  process.env.NODE_ENV === "production" ||
  process.env.KONTAX_DEPLOY_ENV === "production";

/**
 * The public origin to use when building an absolute URL for a user (email
 * CTAs, OAuth redirects, share links). Throws in production when `APP_URL` is
 * unset rather than guessing a domain.
 */
export const getAppUrl = (): string => {
  const configured = process.env.APP_URL?.trim();
  if (configured) return stripTrailingSlash(configured);

  if (isProductionRuntime()) {
    throw new Error(
      "APP_URL is required in production — absolute links (emails, OAuth redirects, share links) cannot be built without it. Set APP_URL to the public origin, e.g. https://getkontax.com.",
    );
  }

  return DEV_FALLBACK_ORIGIN;
};

/**
 * Canonical public origin for SEO surfaces (metadata, sitemap, robots, JSON-LD).
 *
 * Deliberately NOT `getAppUrl()`: these are read at module/build scope by
 * statically prerendered routes, where (a) throwing would break `next build`
 * and (b) the dev `localhost` fallback would be baked into the shipped HTML.
 * The canonical production domain is the only safe default here. Set `APP_URL`
 * in the build environment to override it.
 */
export const SITE_URL = stripTrailingSlash(
  process.env.APP_URL?.trim() ?? CANONICAL_PUBLIC_ORIGIN,
);
