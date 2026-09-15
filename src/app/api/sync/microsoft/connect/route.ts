// P27-04 — GET /api/sync/microsoft/connect
// Builds the Microsoft OAuth consent URL and redirects the user to it.
import { NextResponse, type NextRequest } from "next/server";

import { getAppUrl } from "~/lib/site-url";
import { isSessionError, requireUserId } from "~/server/auth/require-session";
import {
  MICROSOFT_SCOPES,
  createMsalClient,
  isMicrosoftSyncConfigured,
  microsoftRedirectUri,
} from "~/server/microsoft-sync";
import { encodeOAuthState } from "~/server/sync-oauth-state";

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

  if (!isMicrosoftSyncConfigured()) {
    return NextResponse.redirect(new URL("/sync?error=microsoft_unconfigured", appUrl()));
  }

  const cca = createMsalClient();
  const state = encodeOAuthState({ userId, returnTo: "/sync" });

  const authUrl = await cca.getAuthCodeUrl({
    scopes: MICROSOFT_SCOPES,
    redirectUri: microsoftRedirectUri(),
    state,
    prompt: "select_account",
  });

  return NextResponse.redirect(authUrl);
}
