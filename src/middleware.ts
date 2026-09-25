import { type NextRequest, NextResponse } from "next/server";

import { isProductionRuntime } from "~/lib/site-url";
import { isAlwaysAllowed, isPublicPath } from "~/server/public-paths";

const hasAuthSessionCookie = (req: NextRequest) =>
  req.cookies
    .getAll()
    .some(({ name }) => name.includes("authjs.session-token"));

// P50A-01: staging (kontax.vexon.co) and any other non-production deploy must
// never be indexed, even if robots.txt is somehow bypassed or cached stale —
// belt-and-braces alongside robots.ts's `Disallow: /`. Applied to every
// response this middleware returns; production responses are untouched.
// Same production check as robots.ts / src/lib/site-url.ts.
const applyRobotsTag = (res: NextResponse): NextResponse => {
  if (!isProductionRuntime()) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
};

// SEC-02: public contact cards (/u/*) render user-controlled JSON-LD (display
// name, company, etc.). They are the one surface where a non-nonced inline
// <script> would be attacker-influenced. Serve them an ADDITIONAL, stricter
// nonce-based script-src on top of the global CSP set in next.config.js. The
// browser enforces both policies, so a non-nonced inline script is blocked by
// this policy even though the global one still allows 'unsafe-inline' elsewhere.
//
// The nonce is set on the REQUEST CSP header so Next.js applies it to its own
// inline hydration scripts (this only works because /u/[username] is already
// dynamically rendered — it calls auth() and headers()). Our JsonLd <script>
// reads the nonce from the x-nonce request header and sets it explicitly.
//
// Directives below mirror next.config.js — keep them in sync — with script-src
// swapped for the nonce form. All other directives must be present so the page
// still renders under the intersection of the two policies.
// P46-02: keep the img-src in sync with next.config.js — legacy media host plus
// the deploy's configured media host (NEXT_PUBLIC_MEDIA_HOST), so Kontax-hosted
// avatars load directly instead of being CSP-blocked.
const MEDIA_HOST_ORIGIN = (() => {
  try {
    return process.env.NEXT_PUBLIC_MEDIA_HOST
      ? new URL(process.env.NEXT_PUBLIC_MEDIA_HOST).origin
      : null;
  } catch {
    return null;
  }
})();
const IMG_SRC = [
  "img-src 'self' data: blob: https://media.getkontax.com",
  MEDIA_HOST_ORIGIN && MEDIA_HOST_ORIGIN !== "https://media.getkontax.com" ? MEDIA_HOST_ORIGIN : "",
]
  .filter(Boolean)
  .join(" ");

const withStrictCardCsp = (req: NextRequest): NextResponse => {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    IMG_SRC,
    "font-src 'self'",
    "connect-src 'self' https://api.stripe.com https://checkout.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
};

// The middleware intentionally does NOT use the NextAuth edge wrapper. In a
// self-hosted Docker deployment (Coolify), AUTH_SECRET is a runtime env var
// that is NOT available at `npm run build` time. Next.js inlines process.env
// references at build time for the Edge runtime, so AUTH_SECRET would be baked
// as undefined. The Auth.js wrapper would then fail to decode JWTs and attach a
// Set-Cookie: delete header that wipes the session cookie — even for valid
// sessions. The full Node.js auth() in each page/action is the authoritative
// check; this middleware is a lightweight first gate based on cookie presence
// only.
//
// P48-01: because this gate cannot see JWT claims, 2FA enforcement lives in
// `src/server/auth/index.ts` — `auth()` returns null for password-only sessions
// that still owe a TOTP challenge, and `/login` routes them to `/login/verify-2fa`.
export default function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";

  // Rewrite api.getkontax.com/v1/... → /api/v1/... internally.
  // Route handlers own auth for API requests; middleware auth below is skipped.
  if (host.startsWith("api.")) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith("/api/")) {
      url.pathname = `/api${url.pathname}`;
    }
    return applyRobotsTag(NextResponse.rewrite(url));
  }

  const { pathname } = req.nextUrl;

  // 1. Assets + auth API: never gated.
  if (isAlwaysAllowed(pathname)) {
    return applyRobotsTag(NextResponse.next());
  }

  // Build redirect base from APP_URL so reverse-proxy doesn't leak the
  // internal container hostname into redirect targets.
  const appOrigin =
    (process.env.APP_URL ?? "").replace(/\/$/, "") || new URL(req.url).origin;

  // 2. Public content: pass through; the page self-selects logged-out vs
  //    logged-in content.
  if (isPublicPath(pathname)) {
    // Public user cards get the stricter nonce-based CSP (SEC-02).
    if (pathname.startsWith("/u/")) {
      return applyRobotsTag(withStrictCardCsp(req));
    }
    return applyRobotsTag(NextResponse.next());
  }

  // 3. Everything else requires a session cookie.
  //    The Node.js auth() in each page makes the authoritative session check
  //    (validates JWT, sessionVersion, revocation). The middleware is a fast
  //    first gate: if no session cookie exists at all, redirect to login now
  //    rather than let the page waste a round-trip to discover the same thing.
  if (!hasAuthSessionCookie(req)) {
    const loginUrl = new URL("/login", appOrigin);
    loginUrl.searchParams.set("next", pathname);
    return applyRobotsTag(NextResponse.redirect(loginUrl));
  }

  // Cookie present — pass to the Node.js page handler for the real auth check.
  // Forward x-pathname so pages can reconstruct the ?next= parameter when they
  // redirect to /login themselves.
  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return applyRobotsTag(res);
}

export const config = {
  // Apply to all routes except static assets
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
