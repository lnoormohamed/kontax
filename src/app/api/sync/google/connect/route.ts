// P27-01 — GET /api/sync/google/connect
// Generates the Google OAuth consent URL and redirects the user to it.
import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { auth } from "~/server/auth";
import {
  GOOGLE_CONTACTS_SCOPES,
  createGoogleOAuthClient,
  encodeOAuthState,
  isGoogleSyncConfigured,
} from "~/server/google-sync";

const appUrl = () => env.APP_URL ?? "https://getkontax.com";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", appUrl()));
  }

  if (!isGoogleSyncConfigured()) {
    return NextResponse.redirect(new URL("/sync?error=google_unconfigured", appUrl()));
  }

  const client = createGoogleOAuthClient();
  const state = encodeOAuthState({ userId: session.user.id, returnTo: "/sync" });

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_CONTACTS_SCOPES,
    state,
    prompt: "consent", // forces a refresh token to be issued on every connect
    include_granted_scopes: true,
  });

  return NextResponse.redirect(authUrl);
}
