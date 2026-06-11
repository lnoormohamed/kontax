import NextAuth from "next-auth";
import { type NextRequest, NextResponse } from "next/server";

import { authConfigEdge } from "~/server/auth/config.edge";

const { auth } = NextAuth(authConfigEdge);

// Routes that never require authentication
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",          // P18-05
  "/reset-password",           // P18-05
  "/verify-email",
  "/account-deleted",          // P18-09
  "/share",         // vCard share public links (P12-02)
  "/api/auth",      // NextAuth endpoints
  "/api/register",  // Account creation
  "/api/cron",      // Protected separately by CRON_SECRET
  "/_next",
  "/favicon.ico",
];

// Only the TOTP challenge page is reachable with a pendingTotp session (P18-07)
const TOTP_ALLOWED_PATHS = ["/login/verify-2fa", "/api/auth"];

// Only the recovery page is reachable during the deletion grace period (P18-09)
const PENDING_DELETION_ALLOWED_PATHS = ["/account-pending-deletion", "/api/auth"];

export default auth((req: NextRequest & { auth: { user?: { id?: string }; pendingTotp?: boolean; pendingDeletion?: boolean } | null }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // No session → redirect to login, preserving the intended destination
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // pendingTotp: password verified but TOTP code not yet submitted (P18-07)
  if (session.pendingTotp) {
    if (!TOTP_ALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/login/verify-2fa", req.url));
    }
    return NextResponse.next();
  }

  // pendingDeletion: account in 30-day grace period (P18-09)
  if (session.pendingDeletion) {
    if (!PENDING_DELETION_ALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/account-pending-deletion", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  // Apply to all routes except static assets
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
