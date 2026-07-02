import { NextResponse } from "next/server";

import { auth } from "~/server/auth";

/**
 * P38-10 — impersonation state for the client-side banner.
 *
 * The banner used to be a server component in the ROOT layout that called
 * auth() on every request, which forced every route in the app to render
 * dynamically. Impersonation is a rare admin action, so the banner now
 * resolves its state here after hydration and the layout stays static.
 */
export async function GET() {
  const session = await auth();
  if (!session?.impersonatedBy) {
    return NextResponse.json({ active: false });
  }
  return NextResponse.json({
    active: true,
    email: session.user?.email ?? "user",
    expiresAt:
      typeof (session as { impersonationExpiresAt?: number }).impersonationExpiresAt === "number"
        ? (session as { impersonationExpiresAt: number }).impersonationExpiresAt
        : null,
  });
}
