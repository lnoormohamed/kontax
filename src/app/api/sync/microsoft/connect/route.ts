// P27-04 — GET /api/sync/microsoft/connect
// Builds the Microsoft OAuth consent URL and redirects the user to it.
import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { auth } from "~/server/auth";
import {
  MICROSOFT_SCOPES,
  createMsalClient,
  isMicrosoftSyncConfigured,
  microsoftRedirectUri,
} from "~/server/microsoft-sync";
import { encodeOAuthState } from "~/server/sync-oauth-state";

const appUrl = () => env.APP_URL ?? "https://kontax.vexon.co";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", appUrl()));
  }

  if (!isMicrosoftSyncConfigured()) {
    return NextResponse.redirect(new URL("/sync?error=microsoft_unconfigured", appUrl()));
  }

  const cca = createMsalClient();
  const state = encodeOAuthState({ userId: session.user.id, returnTo: "/sync" });

  const authUrl = await cca.getAuthCodeUrl({
    scopes: MICROSOFT_SCOPES,
    redirectUri: microsoftRedirectUri(),
    state,
    prompt: "select_account",
  });

  return NextResponse.redirect(authUrl);
}
