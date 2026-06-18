import { type NextRequest, NextResponse } from "next/server";

// Static assets + auth endpoints — always allowed, bypass all session gating
// (these must load even for restricted sessions, e.g. CSS/JS for the 2FA page).
const ALWAYS_ALLOW = [
  "/_next",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  "/api/auth",
  "/api/pwa-icon",
  "/robots.txt", // P26-08
  "/sitemap.xml", // P26-08
  "/opengraph-image", // P26-07 — default OG card (matches the ?hash query too)
];

// Public content pages — viewable while logged out. The page component itself
// decides what to render based on session (e.g. "/" shows the marketing landing
// when logged out, the dashboard when logged in). "/" is matched exactly because
// it cannot be a startsWith prefix (that would match every route).
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password", // P18-05
  "/reset-password", // P18-05
  "/verify-email",
  "/account-deleted", // P18-09
  "/share/", // vCard share public links (P12-02) — trailing slash so it
  // matches /share/<token> but NOT the authenticated /shares page
  "/pricing", // marketing
  "/features", // marketing
  "/security", // marketing
  "/changelog", // marketing
  "/help", // P26-12: public FAQ / help centre
  "/privacy", // legal
  "/terms", // legal
  "/api/register", // Account creation
  "/api/cron", // Protected separately by CRON_SECRET
  "/api/stripe/webhook", // Authenticated by Stripe signature, not session
  "/api/ses/events", // SNS bounce/complaint webhook (P20-10)
  "/api/calendar", // P22-11: iCal feed authenticated by per-user calToken
  "/api/v1", // P29-06: REST API — authenticated by Bearer token in withApiAuth
  "/api/card", // P30-01: public card click-tracking (unauthenticated)
  "/api/health", // uptime monitoring — no auth required
  "/developers", // P29-07: public API documentation page
  "/u/", // P30-01: public contact cards — no login required
];

const hasAuthSessionCookie = (req: NextRequest) =>
  req.cookies
    .getAll()
    .some(({ name }) => name.includes("authjs.session-token"));

// The middleware intentionally does NOT use NextAuth(authConfigEdge) as a
// wrapper. In a self-hosted Docker deployment (Coolify), AUTH_SECRET is a
// runtime env var that is NOT available at `npm run build` time. Next.js
// inlines process.env references at build time for the Edge runtime, so
// AUTH_SECRET would be baked as undefined. The Auth.js wrapper would then
// fail to decode JWTs and attach a Set-Cookie: delete header that wipes the
// session cookie — even for valid sessions. The full Node.js auth() in each
// page/action is the authoritative check; this middleware is a lightweight
// first gate based on cookie presence only.
export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Assets + auth API: never gated.
  if (ALWAYS_ALLOW.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Build redirect base from APP_URL so reverse-proxy doesn't leak the
  // internal container hostname into redirect targets.
  const appOrigin =
    (process.env.APP_URL ?? "").replace(/\/$/, "") || new URL(req.url).origin;

  // 2. Public content: pass through; the page self-selects logged-out vs
  //    logged-in content.
  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 3. Everything else requires a session cookie.
  //    The Node.js auth() in each page makes the authoritative session check
  //    (validates JWT, sessionVersion, revocation). The middleware is a fast
  //    first gate: if no session cookie exists at all, redirect to login now
  //    rather than let the page waste a round-trip to discover the same thing.
  if (!hasAuthSessionCookie(req)) {
    const loginUrl = new URL("/login", appOrigin);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie present — pass to the Node.js page handler for the real auth check.
  // Forward x-pathname so pages can reconstruct the ?next= parameter when they
  // redirect to /login themselves.
  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  // Apply to all routes except static assets
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
