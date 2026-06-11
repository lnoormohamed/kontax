import NextAuth from "next-auth";
import { type NextRequest, NextResponse } from "next/server";

import { authConfigEdge } from "~/server/auth/config.edge";

const { auth } = NextAuth(authConfigEdge);

// Static assets + auth endpoints — always allowed, bypass all session gating
// (these must load even for restricted sessions, e.g. CSS/JS for the 2FA page).
const ALWAYS_ALLOW = ["/_next", "/favicon.ico", "/api/auth"];

// Public content pages — viewable while logged out. The page component itself
// decides what to render based on session (e.g. "/" shows the marketing landing
// when logged out, the dashboard when logged in). "/" is matched exactly because
// it cannot be a startsWith prefix (that would match every route).
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",          // P18-05
  "/reset-password",           // P18-05
  "/verify-email",
  "/account-deleted",          // P18-09
  "/share/",        // vCard share public links (P12-02) — trailing slash so it
                    // matches /share/<token> but NOT the authenticated /shares page
  "/pricing",       // marketing
  "/privacy",       // legal
  "/terms",         // legal
  "/api/register",       // Account creation
  "/api/cron",           // Protected separately by CRON_SECRET
  "/api/stripe/webhook", // Authenticated by Stripe signature, not session
];

// Only the TOTP challenge page is reachable with a pendingTotp session (P18-07)
const TOTP_ALLOWED_PATHS = ["/login/verify-2fa", "/api/auth"];

// Only the recovery page is reachable during the deletion grace period (P18-09)
const PENDING_DELETION_ALLOWED_PATHS = ["/account-pending-deletion", "/api/auth"];

export default auth((req: NextRequest & { auth: { user?: { id?: string }; pendingTotp?: boolean; pendingDeletion?: boolean } | null }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // 1. Assets + auth API: never gated.
  if (ALWAYS_ALLOW.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Restricted authenticated sessions are gated everywhere (checked before
  //    public routes) so they cannot reach app content via "/" or a public page.
  if (session?.pendingTotp) {
    if (!TOTP_ALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/login/verify-2fa", req.url));
    }
    return NextResponse.next();
  }
  if (session?.pendingDeletion) {
    if (!PENDING_DELETION_ALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/account-pending-deletion", req.url));
    }
    return NextResponse.next();
  }

  // 3. Public content: pass through; the page self-selects logged-out vs
  //    logged-in content. "/" is now a normal public marketing page (P18-12).
  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 4. Everything else requires a session.
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Apply to all routes except static assets
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
