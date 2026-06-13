// P27-01 — GET /api/sync/google/callback
// Exchanges the OAuth code for tokens, resolves the connected Google account
// email, stores an encrypted SyncAccount, and queues the initial import.
import { NextResponse, type NextRequest } from "next/server";

import { google } from "googleapis";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  GOOGLE_CONTACTS_SCOPES,
  createGoogleOAuthClient,
  decodeOAuthState,
} from "~/server/google-sync";
import {
  decryptGoogleSyncCredential,
  encryptGoogleSyncCredential,
} from "~/server/sync-credentials";

const GOOGLE_BASE_URL = "https://people.googleapis.com/v1";

const redirectTo = (req: NextRequest, path: string) =>
  NextResponse.redirect(new URL(path, req.url));

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const oauthError = params.get("error");
  const code = params.get("code");
  const stateToken = params.get("state");

  // User denied consent on Google's screen.
  if (oauthError) {
    return redirectTo(req, "/sync?error=google_denied");
  }
  if (!code || !stateToken) {
    return redirectTo(req, "/sync?error=google_invalid");
  }

  let state: { userId: string; returnTo: string };
  try {
    state = decodeOAuthState(stateToken);
  } catch {
    return redirectTo(req, "/sync?error=google_state");
  }

  // Defense in depth: the signed-in user must match the user bound in state.
  const session = await auth();
  if (!session?.user?.id || session.user.id !== state.userId) {
    return redirectTo(req, "/login");
  }

  const client = createGoogleOAuthClient();

  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
  } catch {
    return redirectTo(req, "/sync?error=google_token");
  }
  client.setCredentials(tokens);

  if (!tokens.access_token) {
    return redirectTo(req, "/sync?error=google_token");
  }

  // Resolve the connected account email for the label and detail panel.
  let googleEmail = "";
  try {
    const people = google.people({ version: "v1", auth: client });
    const me = await people.people.get({
      resourceName: "people/me",
      personFields: "emailAddresses",
    });
    const emails = me.data.emailAddresses ?? [];
    googleEmail =
      emails.find((e) => e.metadata?.primary)?.value ?? emails[0]?.value ?? "";
  } catch {
    // Non-fatal — fall back to an empty email; the connection still works.
  }

  const label = googleEmail
    ? `Google Contacts (${googleEmail})`
    : "Google Contacts";

  // Reuse an existing connection for the same Google account if present, so a
  // reconnect refreshes credentials instead of hitting the unique constraint.
  const existing = await db.syncAccount.findFirst({
    where: {
      userId: state.userId,
      provider: "GOOGLE",
      remoteAccountId: googleEmail || undefined,
    },
    select: { id: true, credentialReference: true },
  });

  // Google only returns a refresh token on a fresh consent. Never overwrite a
  // good stored refresh token with undefined on reconnect.
  let refreshToken = tokens.refresh_token ?? "";
  if (!refreshToken && existing?.credentialReference) {
    try {
      refreshToken = decryptGoogleSyncCredential(existing.credentialReference).refreshToken;
    } catch {
      // fall through with empty refresh token
    }
  }

  const enc = encryptGoogleSyncCredential({
    provider: "GOOGLE",
    version: 1,
    accessToken: tokens.access_token,
    refreshToken,
    expiryDate: tokens.expiry_date ?? null,
    googleEmail,
    scope: tokens.scope ?? GOOGLE_CONTACTS_SCOPES.join(" "),
  });

  const now = new Date();
  const accountId = existing
    ? (await db.syncAccount.update({
        where: { id: existing.id },
        data: {
          label,
          status: "ACTIVE",
          credentialReference: enc.credentialReference,
          encryptionKeyRef: enc.encryptionKeyRef,
          credentialUpdatedAt: now,
          credentialLastValidatedAt: now,
          credentialRevokedAt: null,
          // Re-consent: clear the cursor so the next run does a full re-import.
          lastSyncCursor: null,
          lastErrorAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
        select: { id: true },
      })).id
    : (await db.syncAccount.create({
        data: {
          userId: state.userId,
          provider: "GOOGLE",
          status: "ACTIVE",
          syncDirection: "TWO_WAY",
          label,
          baseUrl: GOOGLE_BASE_URL,
          remoteAccountId: googleEmail || null,
          credentialReference: enc.credentialReference,
          encryptionKeyRef: enc.encryptionKeyRef,
          credentialVersion: 1,
          credentialUpdatedAt: now,
          credentialLastValidatedAt: now,
          connectionValidatedAt: now,
        },
        select: { id: true },
      })).id;

  // Queue the initial import so the runner imports contacts on its next tick.
  await db.syncJob.create({
    data: {
      syncAccountId: accountId,
      status: "QUEUED",
      trigger: "MANUAL",
      syncDirection: "TWO_WAY",
      attemptCount: 1,
      maxAttempts: 5,
      nextRetryAt: now,
      idempotencyKey: `${accountId}:google:connect:${Date.now()}`,
    },
  });

  return redirectTo(req, "/sync?connected=google");
}
