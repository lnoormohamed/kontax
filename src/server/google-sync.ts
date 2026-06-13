// P27-01 — Google Contacts OAuth connector.
//
// Plugs Google into the existing sync infrastructure as a new SyncProvider.
// This slice covers the OAuth flow, encrypted token storage + automatic
// refresh, and the People API fetch plumbing (full import, syncToken-based
// incremental sync, 410 fallback). Turning fetched People into Contact rows is
// field mapping (P27-02) — processGoogleContacts is a typed stub here.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { google, type people_v1 } from "googleapis";

// Use the OAuth2 client type that google.auth.OAuth2 actually produces. The
// standalone `google-auth-library` export is a structurally-distinct duplicate
// of the copy bundled under googleapis-common, so importing it causes type
// mismatches when passed to google.people({ auth }).
type GoogleOAuthClient = InstanceType<typeof google.auth.OAuth2>;

import { emitEvent } from "~/lib/activity";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  type GoogleMappedContact,
  mapGooglePersonToContact,
} from "~/server/google-sync-mapping";
import {
  decryptGoogleSyncCredential,
  encryptGoogleSyncCredential,
  type GoogleSyncCredentialPayload,
} from "~/server/sync-credentials";

// OAuth scopes: contacts (read & write) + email for the connected-account label.
export const GOOGLE_CONTACTS_SCOPES = [
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/userinfo.email",
];

// personFields requested on every People API call. Consumed by P27-02's mapper.
export const GOOGLE_PERSON_FIELDS =
  "names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,urls,biographies,relations,metadata";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000; // refresh 60s before expiry

export const isGoogleSyncConfigured = () =>
  Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);

export class GoogleSyncConfigError extends Error {
  constructor(message = "Google sync is not configured on this deployment.") {
    super(message);
    this.name = "GoogleSyncConfigError";
  }
}

// Errors thrown by the connector carry a stable code the runner maps to sync
// account status (NEEDS_REAUTH / ERROR) and surfaces to the UI.
export class GoogleSyncError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GoogleSyncError";
    this.code = code;
  }
}

export const createGoogleOAuthClient = (): GoogleOAuthClient => {
  if (!isGoogleSyncConfigured()) {
    throw new GoogleSyncConfigError();
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
};

// ── OAuth state (CSRF + userId binding) ──────────────────────────────────────
// The `state` round-trips through Google's consent screen, so it must be
// tamper-proof. HMAC-SHA256 over { userId, returnTo, nonce, iat } with
// AUTH_SECRET, short TTL on verify.

type OAuthStatePayload = {
  userId: string;
  returnTo: string;
  nonce: string;
  iat: number;
};

const getStateSecret = () => {
  if (!env.AUTH_SECRET) {
    throw new GoogleSyncConfigError(
      "AUTH_SECRET must be set to sign Google OAuth state.",
    );
  }
  return env.AUTH_SECRET;
};

const signState = (body: string) =>
  createHmac("sha256", getStateSecret()).update(body).digest("base64url");

export const encodeOAuthState = (input: { userId: string; returnTo: string }) => {
  const payload: OAuthStatePayload = {
    userId: input.userId,
    returnTo: input.returnTo,
    nonce: randomBytes(16).toString("base64url"),
    iat: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signState(body)}`;
};

export const decodeOAuthState = (
  token: string,
): { userId: string; returnTo: string } => {
  const [body, sig] = token.split(".", 2);
  if (!body || !sig) {
    throw new GoogleSyncError("OAUTH_STATE_INVALID", "Malformed OAuth state.");
  }

  const expected = signState(body);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new GoogleSyncError("OAUTH_STATE_INVALID", "OAuth state signature mismatch.");
  }

  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as OAuthStatePayload;

  if (Date.now() - payload.iat > OAUTH_STATE_TTL_MS) {
    throw new GoogleSyncError("OAUTH_STATE_EXPIRED", "OAuth state has expired.");
  }

  return { userId: payload.userId, returnTo: payload.returnTo };
};

// ── Authenticated client per account (with refresh) ──────────────────────────

type GoogleSyncAccount = { id: string; credentialReference: string | null };

// Account context the import path needs to persist contacts + links + events.
export type GoogleImportAccount = GoogleSyncAccount & {
  userId: string;
  label: string;
  lastSyncCursor: string | null;
};

export type GoogleImportSummary = { created: number; updated: number; deleted: number };

const emptySummary = (): GoogleImportSummary => ({ created: 0, updated: 0, deleted: 0 });

const addSummary = (a: GoogleImportSummary, b: GoogleImportSummary): GoogleImportSummary => ({
  created: a.created + b.created,
  updated: a.updated + b.updated,
  deleted: a.deleted + b.deleted,
});

const normaliseGoogleError = (error: unknown): GoogleSyncError => {
  if (error instanceof GoogleSyncError) return error;
  const status =
    (typeof error === "object" && error !== null
      ? ((error as { code?: unknown }).code ??
        (error as { response?: { status?: unknown } }).response?.status)
      : undefined) as number | string | undefined;
  const message = error instanceof Error ? error.message : "Google sync failed.";

  if (
    status === 401 ||
    status === 403 ||
    /invalid_grant|invalid_token|unauthorized/i.test(message)
  ) {
    return new GoogleSyncError("GOOGLE_AUTH_FAILED", message);
  }
  if (status === 429) {
    return new GoogleSyncError("GOOGLE_QUOTA_EXCEEDED", message);
  }
  return new GoogleSyncError("GOOGLE_SYNC_FAILED", message);
};

// Returns an OAuth2Client with a valid (refreshed if needed) access token.
// Refreshed tokens are persisted back to the SyncAccount.
const getGoogleClientForAccount = async (account: GoogleSyncAccount) => {
  if (!account.credentialReference) {
    throw new GoogleSyncError(
      "CREDENTIALS_MISSING",
      "The Google sync account has no stored credentials.",
    );
  }

  let credential: GoogleSyncCredentialPayload;
  try {
    credential = decryptGoogleSyncCredential(account.credentialReference);
  } catch (error) {
    throw new GoogleSyncError(
      "CREDENTIALS_UNREADABLE",
      error instanceof Error ? error.message : "Stored Google credentials could not be decrypted.",
    );
  }

  const client = createGoogleOAuthClient();
  client.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken,
    expiry_date: credential.expiryDate ?? undefined,
    scope: credential.scope,
  });

  const expired =
    !credential.expiryDate ||
    Date.now() > credential.expiryDate - ACCESS_TOKEN_REFRESH_SKEW_MS;

  if (expired) {
    let refreshed;
    try {
      refreshed = await client.refreshAccessToken();
    } catch (error) {
      throw normaliseGoogleError(error);
    }
    const next = refreshed.credentials;
    const updated: GoogleSyncCredentialPayload = {
      ...credential,
      accessToken: next.access_token ?? credential.accessToken,
      // Google does not re-issue a refresh token on refresh — keep the stored one.
      refreshToken: next.refresh_token ?? credential.refreshToken,
      expiryDate: next.expiry_date ?? credential.expiryDate,
      scope: next.scope ?? credential.scope,
    };
    const enc = encryptGoogleSyncCredential(updated);
    await db.syncAccount.update({
      where: { id: account.id },
      data: {
        credentialReference: enc.credentialReference,
        encryptionKeyRef: enc.encryptionKeyRef,
        credentialUpdatedAt: new Date(),
        credentialLastValidatedAt: new Date(),
      },
    });
    client.setCredentials(next);
  }

  return { client, credential };
};

// ── Contact processing (P27-02) ──────────────────────────────────────────────
// Maps each Person to the canonical contact write shape and persists it,
// keyed on SyncContactLink.remoteUid = Google resourceName. This slice is the
// remote-wins import happy path; conflict detection (local-vs-remote etag
// comparison + SyncConflict rows) is layered on in P27-03.

// GoogleMappedContact → Prisma contact write data (mirrors the CardDAV create).
const contactWriteData = (m: GoogleMappedContact) => ({
  fullName: m.fullName,
  firstName: m.firstName,
  middleName: m.middleName,
  lastName: m.lastName,
  namePrefix: m.namePrefix,
  nameSuffix: m.nameSuffix,
  nickname: m.nickname,
  email: m.emailAddresses[0] ?? null,
  emailAddresses: m.emailAddresses.length > 0 ? m.emailAddresses : undefined,
  emailEntries: m.emailEntries.length > 0 ? m.emailEntries : undefined,
  phone: m.phoneNumbers[0] ?? null,
  phoneNumbers: m.phoneNumbers.length > 0 ? m.phoneNumbers : undefined,
  phoneEntries: m.phoneEntries.length > 0 ? m.phoneEntries : undefined,
  company: m.company,
  jobTitle: m.jobTitle,
  department: m.department,
  website: m.website,
  websiteEntries: m.websiteEntries.length > 0 ? m.websiteEntries : undefined,
  birthday: m.birthday,
  address: m.address,
  postalAddresses: m.postalAddresses.length > 0 ? m.postalAddresses : undefined,
  addressEntries: m.addressEntries.length > 0 ? m.addressEntries : undefined,
  notes: m.notes,
  relatedPeople: m.relatedPeople.length > 0 ? m.relatedPeople : undefined,
  customFields: m.customFields.length > 0 ? m.customFields : undefined,
});

export const processGoogleContacts = async (
  connections: people_v1.Schema$Person[],
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> => {
  const summary = emptySummary();
  const now = new Date();

  for (const person of connections) {
    const resourceName = person.resourceName;
    if (!resourceName) continue;
    const etag = person.etag ?? null;

    // Tombstone: mark the link deleted. Applying the local delete/archive per
    // conflict policy is P27-03.
    if (person.metadata?.deleted) {
      const res = await db.syncContactLink.updateMany({
        where: { syncAccountId: account.id, remoteUid: resourceName },
        data: { remoteDeletedAt: now, remoteETag: etag, lastSyncedAt: now },
      });
      if (res.count > 0) summary.deleted += 1;
      continue;
    }

    const mapped = mapGooglePersonToContact(person);
    if (!mapped) continue;
    const data = contactWriteData(mapped);

    const existing = await db.syncContactLink.findUnique({
      where: {
        syncAccountId_remoteUid: { syncAccountId: account.id, remoteUid: resourceName },
      },
      select: { id: true, contactId: true },
    });

    if (existing) {
      // Remote-wins update (conflict checks arrive in P27-03).
      await db.$transaction([
        db.contact.update({
          where: { id: existing.contactId },
          data: {
            ...data,
            lastMutatedBy: "SYNC_GOOGLE",
            lastMutatedByDetail: account.label,
            syncVersion: { increment: 1 },
          },
        }),
        db.syncContactLink.update({
          where: { id: existing.id },
          data: {
            remoteHref: resourceName,
            remoteETag: etag,
            remoteDeletedAt: null,
            tombstonedAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            lastSyncedAt: now,
          },
        }),
      ]);
      summary.updated += 1;
      continue;
    }

    // New contact. syncUid is left to default (cuid) — Google resourceName is
    // only unique within the account, so it lives on SyncContactLink.remoteUid,
    // not the globally-unique Contact.syncUid.
    await db.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          userId: account.userId,
          ...data,
          sourceType: "SYNC_GOOGLE",
          sourceDetail: account.label,
          lastMutatedBy: "SYNC_GOOGLE",
          lastMutatedByDetail: account.label,
        },
        select: { id: true },
      });

      await tx.syncContactLink.create({
        data: {
          syncAccountId: account.id,
          contactId: created.id,
          remoteHref: resourceName,
          remoteUid: resourceName,
          remoteETag: etag,
          lastSyncedAt: now,
        },
      });

      await emitEvent(tx, {
        userId: account.userId,
        contactId: created.id,
        eventType: "SYNC_PULLED",
        actor: "SYNC",
        actorDetail: account.label,
        payload: { syncAccountId: account.id, syncAccountLabel: account.label },
      });
    });
    summary.created += 1;
  }

  return summary;
};

// ── Full import ──────────────────────────────────────────────────────────────

export const googleFullImport = async (
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> => {
  const { client } = await getGoogleClientForAccount(account);
  const people = google.people({ version: "v1", auth: client });

  let pageToken: string | undefined;
  let syncToken: string | undefined;
  let summary = emptySummary();

  try {
    do {
      const response = await people.people.connections.list({
        resourceName: "people/me",
        pageSize: 1000,
        personFields: GOOGLE_PERSON_FIELDS,
        pageToken,
        requestSyncToken: true,
      });

      summary = addSummary(
        summary,
        await processGoogleContacts(response.data.connections ?? [], account),
      );
      pageToken = response.data.nextPageToken ?? undefined;
      syncToken = response.data.nextSyncToken ?? syncToken;
    } while (pageToken);
  } catch (error) {
    throw normaliseGoogleError(error);
  }

  await db.syncAccount.update({
    where: { id: account.id },
    data: { lastSyncCursor: syncToken ?? null, lastSyncedAt: new Date() },
  });

  return summary;
};

// ── Incremental sync (falls back to full import on 410 expired syncToken) ─────

export const googleIncrementalSync = async (
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> => {
  if (!account.lastSyncCursor) {
    return googleFullImport(account);
  }

  const { client } = await getGoogleClientForAccount(account);
  const people = google.people({ version: "v1", auth: client });

  let response: people_v1.Schema$ListConnectionsResponse;
  try {
    const result = await people.people.connections.list({
      resourceName: "people/me",
      personFields: GOOGLE_PERSON_FIELDS,
      syncToken: account.lastSyncCursor,
      requestSyncToken: true,
    });
    response = result.data;
  } catch (error) {
    const status =
      (error as { code?: unknown }).code ??
      (error as { response?: { status?: unknown } }).response?.status;
    if (status === 410) {
      // Expired syncToken — Google requires a full re-sync.
      return googleFullImport(account);
    }
    throw normaliseGoogleError(error);
  }

  const summary = await processGoogleContacts(response.connections ?? [], account);

  await db.syncAccount.update({
    where: { id: account.id },
    data: {
      lastSyncCursor: response.nextSyncToken ?? account.lastSyncCursor,
      lastSyncedAt: new Date(),
    },
  });

  return summary;
};

// Runner entrypoint: pick full vs incremental based on stored cursor.
export const runGoogleSync = async (
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> =>
  account.lastSyncCursor ? googleIncrementalSync(account) : googleFullImport(account);

// ── Disconnect (token revocation) — used by P27-07 ───────────────────────────

export const revokeGoogleToken = async (account: GoogleSyncAccount): Promise<void> => {
  if (!account.credentialReference) return;
  let credential: GoogleSyncCredentialPayload;
  try {
    credential = decryptGoogleSyncCredential(account.credentialReference);
  } catch {
    return; // nothing usable to revoke
  }
  const client = createGoogleOAuthClient();
  try {
    await client.revokeToken(credential.refreshToken || credential.accessToken);
  } catch {
    // Best-effort: a revoked/expired token may already be invalid at Google.
  }
};
