// Pure path-matching logic for src/middleware.ts, split out so it can be unit
// tested with plain Node (no next/server / edge runtime needed). See
// tests/node/public-paths.test.ts.

// Static assets + auth endpoints — always allowed, bypass all session gating
// (these must load even for restricted sessions, e.g. CSS/JS for the 2FA page).
export const ALWAYS_ALLOW = [
  "/_next",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  "/api/auth",
  "/api/pwa-icon",
  "/robots.txt", // P26-08
  "/sitemap.xml", // P26-08
  "/opengraph-image.png", // P26-07 — default OG card (static file in /public)
];

// Public content pages — viewable while logged out. The page component itself
// decides what to render based on session (e.g. "/" shows the marketing landing
// when logged out, the dashboard when logged in). "/" is matched exactly because
// it cannot be a startsWith prefix (that would match every route).
export const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password", // P18-05
  "/reset-password", // P18-05
  "/verify-email",
  // P48-03: the "this wasn't me" link from the email-change notice. Must work
  // signed-out — the person clicking it may have just lost access to the
  // account, and the page authenticates the single-use token, not a session.
  "/revert-email",
  "/account-deleted", // P18-09
  "/share/", // vCard share public links (P12-02) — trailing slash so it
  // matches /share/<token> but NOT the authenticated /shares page
  "/pricing", // marketing
  "/features", // marketing
  "/security", // marketing
  "/changelog", // marketing — also covers the /changelog.xml RSS feed (P49A-15)
  "/help", // P26-12: public FAQ / help centre
  "/privacy", // legal
  "/terms", // legal
  "/api/register", // Account creation
  // P38-10: read-only session peeks for statically-rendered public pages.
  // Both call auth() themselves and return a null-ish payload when logged
  // out, so let them run instead of redirecting the fetch to /login.
  "/api/impersonation",
  "/api/billing/plan",
  "/api/cron", // Protected separately by CRON_SECRET
  "/api/stripe/webhook", // Authenticated by Stripe signature, not session
  "/api/ses/events", // SNS bounce/complaint webhook (P20-10)
  "/api/calendar", // P22-11: iCal feed authenticated by per-user calToken
  "/api/v1", // P29-06: REST API — authenticated by Bearer token in withApiAuth
  "/api/card", // P30-01: public card click-tracking (unauthenticated)
  "/api/health", // uptime monitoring — no auth required
  "/developers", // P29-07: public API documentation page
  "/format/", // P45-07: public export-format artifacts (schemas, examples,
  // validator, spec) linked from /developers — no login required
  "/u/", // P30-01: public contact cards — no login required
];

// P49A-15: public paths that must be matched EXACTLY (or as "<path>/…"), never
// as a plain startsWith prefix like PUBLIC_PREFIXES above. Each one collides
// with an authenticated app route that starts with the same characters:
//   "/contact"      vs "/contacts"      (the signed-in address book)
//   "/api/contact"  vs "/api/contacts"  (the signed-in contacts REST route)
// A naive `pathname.startsWith("/contact")` would make both /contacts and
// /api/contacts public too, so these get their own stricter check instead.
export const EXACT_PUBLIC_PATHS = [
  "/about", // marketing
  "/contact", // marketing — contact form page
  "/api/contact", // contact form submission endpoint (rate-limited, see route)
];

export const isAlwaysAllowed = (pathname: string): boolean =>
  ALWAYS_ALLOW.some((p) => pathname.startsWith(p));

export const isExactPublicPath = (pathname: string): boolean =>
  EXACT_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * True when a logged-out request to `pathname` should be let through to the
 * page/route (which then self-selects logged-out vs logged-in content, or —
 * for API routes — does its own auth). False means "requires a session
 * cookie", the middleware's gate 3.
 */
export const isPublicPath = (pathname: string): boolean =>
  pathname === "/" ||
  isExactPublicPath(pathname) ||
  PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
