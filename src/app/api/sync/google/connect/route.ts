// P27-01 — GET /api/sync/google/connect
// Generates the Google OAuth consent URL and redirects the user to it.
import { NextResponse, type NextRequest } from "next/server";

import { getAppUrl } from "~/lib/site-url";
import { isSessionError, requireUserId } from "~/server/auth/require-session";
import {
  GOOGLE_CONTACTS_SCOPES,
  createGoogleOAuthClient,
  encodeOAuthState,
  isGoogleSyncConfigured,
} from "~/server/google-sync";

// P48-16: one shared APP_URL resolver (localhost in dev, throws in production).
const appUrl = () => getAppUrl();

export async function GET(_req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) {
      const dest = err.code === "UNAUTHENTICATED" ? "/login" : "/sync?error=read_only_session";
      return NextResponse.redirect(new URL(dest, appUrl()));
    }
    throw err;
  }

  if (!isGoogleSyncConfigured()) {
    return NextResponse.redirect(new URL("/sync?error=google_unconfigured", appUrl()));
  }

  const client = createGoogleOAuthClient();
  const state = encodeOAuthState({ userId, returnTo: "/sync" });

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_CONTACTS_SCOPES,
    state,
    prompt: "consent", // forces a refresh token to be issued on every connect
    include_granted_scopes: true,
  });

  return NextResponse.redirect(authUrl);
}
