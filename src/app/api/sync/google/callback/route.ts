// P27-01 — GET /api/sync/google/callback
// Exchanges the OAuth code for tokens, resolves the connected Google account
// email, stores an encrypted SyncAccount, and queues the initial import.
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { assertCanCreateSyncAccount, assertHasAvailableSyncAccountSlot } from "~/server/billing";
import { db } from "~/server/db";
import { SYNC_ACCOUNT_MUTABLE_STATUSES } from "~/lib/sync-account-status";
import {
  createSyncConnectionId,
  emitSyncConnectionLifecycleEvent,
  reconnectExistingSyncAccount,
} from "~/server/sync-lineage";
import { env } from "~/env";
import { people } from "@googleapis/people";

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

const redirectTo = (_req: NextRequest, path: string) =>
  NextResponse.redirect(new URL(path, env.APP_URL ?? "https://getkontax.com"));

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

  // Resolve the connected account email via the userinfo endpoint.
  // Resolve the connected account email via the userinfo endpoint (requires
  // the userinfo.email scope we request on connect). Fall back to the People
  // API emailAddresses field if userinfo fails for any reason.
  let googleEmail = "";
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (res.ok) {
      const info = await res.json() as { email?: string };
      googleEmail = info.email ?? "";
    } else {
      console.error("[google/callback] userinfo HTTP", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[google/callback] userinfo fetch failed:", err);
  }

  // Fallback: try the People API if userinfo didn't yield an email.
  if (!googleEmail) {
    try {
      const peopleApi = people({ version: "v1", auth: client });
      const me = await peopleApi.people.get({
        resourceName: "people/me",
        personFields: "emailAddresses",
      });
      const emails = me.data.emailAddresses ?? [];
      googleEmail =
        emails.find((em) => em.metadata?.primary)?.value ?? emails[0]?.value ?? "";
      if (googleEmail) console.log("[google/callback] email resolved via People API fallback:", googleEmail);
    } catch (err) {
      console.error("[google/callback] People API fallback failed:", err);
    }
  }

  const label = googleEmail
    ? `Google Contacts (${googleEmail})`
    : "Google Contacts";

  // Reuse an existing connection only when the email matches — so reconnecting
  // personal@gmail.com refreshes credentials but connecting work@gmail.com
  // creates a separate account. When email resolution failed (non-fatal), fall
  // back to any Google account that also has no email stored (legacy rows).
  const existing = await db.syncAccount.findFirst({
    where: {
      userId: state.userId,
      provider: "GOOGLE",
      status: { in: [...SYNC_ACCOUNT_MUTABLE_STATUSES] },
      ...(googleEmail
        ? { remoteAccountId: googleEmail }
        : { OR: [{ remoteAccountId: null }, { remoteAccountId: "" }] }),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, credentialReference: true },
  });

  try {
    if (existing) {
      await assertHasAvailableSyncAccountSlot(state.userId, {
        excludingSyncAccountIds: [existing.id],
      });
    } else {
      await assertCanCreateSyncAccount(state.userId);
    }
  } catch {
    return redirectTo(req, "/sync?error=google_cap");
  }

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
  let accountId: string;
  try {
    accountId = await db.$transaction(async (tx) => {
      if (existing) {
        const reconnected = await reconnectExistingSyncAccount({
          client: tx,
          userId: state.userId,
          syncAccountId: existing.id,
          actor: "USER",
          data: {
            label,
            remoteAccountId: googleEmail || null,
            credentialReference: enc.credentialReference,
            encryptionKeyRef: enc.encryptionKeyRef,
            credentialUpdatedAt: now,
            credentialLastValidatedAt: now,
            connectionValidatedAt: now,
            // Re-consent: clear the cursor so the next run does a full re-import.
            lastSyncCursor: null,
          },
        });
        return reconnected.id;
      }

      const created = await tx.syncAccount.create({
        data: {
          userId: state.userId,
          connectionId: createSyncConnectionId(),
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
        select: { id: true, connectionId: true, provider: true, label: true },
      });

      await emitSyncConnectionLifecycleEvent(tx, {
        userId: state.userId,
        eventType: "SYNC_CONNECTION_CONNECTED",
        actor: "USER",
        seed: {
          syncAccountId: created.id,
          connectionId: created.connectionId!,
          provider: created.provider,
          label: created.label,
        },
      });

      return created.id;
    });
  } catch {
    // Most likely the @@unique([userId, baseUrl, label]) constraint when a second
    // Google account connects without a resolvable email (both get the same label).
    return redirectTo(req, "/sync?error=google_duplicate");
  }

  // P36-DB02: a brand-new connection holds its first sync until the user confirms
  // settings (completeSyncSetup queues it then). Reconnects of an already-set-up
  // account import immediately as before.
  if (existing) {
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

  return redirectTo(req, "/sync?connected=google&setup=1");
}
