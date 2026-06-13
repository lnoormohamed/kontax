/**
 * Canonical public origin for SEO surfaces (metadata, sitemap, robots).
 *
 * These run at module / build scope where the request-scoped `getPublicOrigin`
 * helper (which reads `headers()`) is unavailable, so we resolve from `APP_URL`
 * with a production fallback. Set `APP_URL=https://kontax.vexon.co` in the
 * deployment environment to keep canonical URLs correct behind the proxy.
 */
export const SITE_URL = (process.env.APP_URL ?? "https://kontax.vexon.co").replace(/\/$/, "");
