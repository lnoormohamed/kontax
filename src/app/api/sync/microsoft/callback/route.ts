// P27-04 — GET /api/sync/microsoft/callback
// Exchanges the OAuth code for tokens (storing the MSAL token cache), resolves
// the connected account email, upserts the SyncAccount, and queues the import.
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env";
import {
  MICROSOFT_SCOPES,
  createMsalClient,
  fetchMicrosoftProfileEmail,
  microsoftRedirectUri,
} from "~/server/microsoft-sync";
import { encryptMicrosoftSyncCredential } from "~/server/sync-credentials";
import { decodeOAuthState } from "~/server/sync-oauth-state";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

const redirectTo = (_req: NextRequest, path: string) =>
  NextResponse.redirect(new URL(path, env.APP_URL ?? "https://getkontax.com"));

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const oauthError = params.get("error");
  const code = params.get("code");
  const stateToken = params.get("state");

  if (oauthError) {
    return redirectTo(req, "/sync?error=microsoft_denied");
  }
  if (!code || !stateToken) {
    return redirectTo(req, "/sync?error=microsoft_invalid");
  }

  let state: { userId: string; returnTo: string };
  try {
    state = decodeOAuthState(stateToken);
  } catch {
    return redirectTo(req, "/sync?error=microsoft_state");
  }

  const session = await auth();
  if (!session?.user?.id || session.user.id !== state.userId) {
    return redirectTo(req, "/login");
  }

  const cca = createMsalClient();

  let tokenResponse;
  try {
    tokenResponse = await cca.acquireTokenByCode({
      code,
      scopes: MICROSOFT_SCOPES,
      redirectUri: microsoftRedirectUri(),
    });
  } catch {
    return redirectTo(req, "/sync?error=microsoft_token");
  }

  if (!tokenResponse?.accessToken) {
    return redirectTo(req, "/sync?error=microsoft_token");
  }

  const microsoftEmail = await fetchMicrosoftProfileEmail(tokenResponse.accessToken);
  const homeAccountId = tokenResponse.account?.homeAccountId ?? "";
  // The cache now holds the refresh token from the code exchange.
  const cacheBlob = cca.getTokenCache().serialize();
  const scope =
    tokenResponse.scopes && tokenResponse.scopes.length > 0
      ? tokenResponse.scopes.join(" ")
      : MICROSOFT_SCOPES.join(" ");

  const label = microsoftEmail ? `Outlook (${microsoftEmail})` : "Outlook";

  const enc = encryptMicrosoftSyncCredential({
    provider: "MICROSOFT",
    version: 1,
    cacheBlob,
    homeAccountId,
    microsoftEmail,
    scope,
  });

  // Reuse an existing connection for the same Microsoft account on reconnect.
  // Only match when we resolved an email — an undefined remoteAccountId filter is
  // dropped by Prisma and would return an arbitrary Microsoft account.
  const existing = microsoftEmail
    ? await db.syncAccount.findFirst({
        where: { userId: state.userId, provider: "MICROSOFT", remoteAccountId: microsoftEmail },
        select: { id: true },
      })
    : null;

  const now = new Date();
  let accountId: string;
  try {
    accountId = existing
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
            provider: "MICROSOFT",
            status: "ACTIVE",
            syncDirection: "TWO_WAY",
            label,
            baseUrl: GRAPH_BASE_URL,
            remoteAccountId: microsoftEmail || null,
            credentialReference: enc.credentialReference,
            encryptionKeyRef: enc.encryptionKeyRef,
            credentialVersion: 1,
            credentialUpdatedAt: now,
            credentialLastValidatedAt: now,
            connectionValidatedAt: now,
          },
          select: { id: true },
        })).id;
  } catch {
    return redirectTo(req, "/sync?error=microsoft_duplicate");
  }

  await db.syncJob.create({
    data: {
      syncAccountId: accountId,
      status: "QUEUED",
      trigger: "MANUAL",
      syncDirection: "TWO_WAY",
      attemptCount: 1,
      maxAttempts: 5,
      nextRetryAt: now,
      idempotencyKey: `${accountId}:microsoft:connect:${Date.now()}`,
    },
  });

  return redirectTo(req, "/sync?connected=microsoft");
}
