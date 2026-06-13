// P27-04 — Microsoft Outlook / Exchange OAuth connector.
//
// Plugs Microsoft Graph into the sync infrastructure as a new SyncProvider,
// mirroring the Google connector (P27-01). Uses @azure/msal-node for the OAuth
// flow + token refresh (via the serialized token cache + acquireTokenSilent)
// and plain fetch against Microsoft Graph for contacts. Incremental sync uses
// Graph's delta query; lastSyncCursor stores the delta link.
//
// Field mapping (mapGraphContactToKontax) is P27-05 — processMicrosoftContacts
// is a typed stub here. Conflict handling is P27-06.
import {
  type AuthenticationResult,
  ConfidentialClientApplication,
  type Configuration,
} from "@azure/msal-node";

import type { ConflictPolicy } from "../../generated/prisma";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  decryptMicrosoftSyncCredential,
  encryptMicrosoftSyncCredential,
  type MicrosoftSyncCredentialPayload,
} from "~/server/sync-credentials";

export const MICROSOFT_SCOPES = ["Contacts.ReadWrite", "User.Read", "offline_access"];

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// $select projection for contact reads. Consumed by P27-05's mapper.
export const MICROSOFT_CONTACT_FIELDS = [
  "id",
  "givenName",
  "surname",
  "displayName",
  "middleName",
  "title",
  "nickName",
  "jobTitle",
  "companyName",
  "department",
  "emailAddresses",
  "homePhones",
  "businessPhones",
  "mobilePhone",
  "homeAddress",
  "businessAddress",
  "otherAddress",
  "birthday",
  "personalNotes",
  "businessHomePage",
  "categories",
].join(",");

export const isMicrosoftSyncConfigured = () =>
  Boolean(
    env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET && env.MICROSOFT_REDIRECT_URI,
  );

export class MicrosoftSyncConfigError extends Error {
  constructor(message = "Microsoft sync is not configured on this deployment.") {
    super(message);
    this.name = "MicrosoftSyncConfigError";
  }
}

export class MicrosoftSyncError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MicrosoftSyncError";
    this.code = code;
  }
}

const msalConfig = (): Configuration => {
  if (!isMicrosoftSyncConfigured()) {
    throw new MicrosoftSyncConfigError();
  }
  return {
    auth: {
      clientId: env.MICROSOFT_CLIENT_ID!,
      clientSecret: env.MICROSOFT_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID ?? "common"}`,
    },
  };
};

export const createMsalClient = () => new ConfidentialClientApplication(msalConfig());

export const microsoftRedirectUri = () => env.MICROSOFT_REDIRECT_URI!;

const normaliseMicrosoftError = (error: unknown): MicrosoftSyncError => {
  if (error instanceof MicrosoftSyncError) return error;
  const status =
    typeof error === "object" && error !== null
      ? ((error as { statusCode?: unknown }).statusCode ??
        (error as { status?: unknown }).status)
      : undefined;
  const message = error instanceof Error ? error.message : "Microsoft sync failed.";
  if (status === 401 || status === 403 || /invalid_grant|unauthorized|interaction_required/i.test(message)) {
    return new MicrosoftSyncError("MICROSOFT_AUTH_FAILED", message);
  }
  if (status === 429) {
    return new MicrosoftSyncError("MICROSOFT_QUOTA_EXCEEDED", message);
  }
  return new MicrosoftSyncError("MICROSOFT_SYNC_FAILED", message);
};

// ── account context ──────────────────────────────────────────────────────────

type MicrosoftSyncAccount = { id: string; credentialReference: string | null };

export type MicrosoftImportAccount = MicrosoftSyncAccount & {
  userId: string;
  label: string;
  lastSyncCursor: string | null;
  // Used by P27-06 conflict handling; ignored by the P27-04 stub.
  conflictPolicy: ConflictPolicy;
};

export type MicrosoftImportSummary = {
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
  queueFull: boolean;
};

const emptySummary = (): MicrosoftImportSummary => ({
  created: 0,
  updated: 0,
  deleted: 0,
  conflicts: 0,
  queueFull: false,
});

// ── token acquisition (refresh via MSAL token cache) ─────────────────────────

// Returns a valid Graph access token, refreshing via acquireTokenSilent and
// persisting the rotated token cache back to the SyncAccount when it changes.
const getMicrosoftAccessToken = async (account: MicrosoftSyncAccount): Promise<string> => {
  if (!account.credentialReference) {
    throw new MicrosoftSyncError(
      "CREDENTIALS_MISSING",
      "The Microsoft sync account has no stored credentials.",
    );
  }

  let credential: MicrosoftSyncCredentialPayload;
  try {
    credential = decryptMicrosoftSyncCredential(account.credentialReference);
  } catch (error) {
    throw new MicrosoftSyncError(
      "CREDENTIALS_UNREADABLE",
      error instanceof Error ? error.message : "Stored Microsoft credentials could not be decrypted.",
    );
  }

  const cca = createMsalClient();
  const cache = cca.getTokenCache();
  cache.deserialize(credential.cacheBlob);

  const msalAccount =
    (await cache.getAccountByHomeId(credential.homeAccountId)) ??
    (await cache.getAllAccounts())[0];
  if (!msalAccount) {
    throw new MicrosoftSyncError(
      "MICROSOFT_AUTH_FAILED",
      "No Microsoft account in the stored token cache. Reconnect to restore sync.",
    );
  }

  let result: AuthenticationResult | null;
  try {
    result = await cca.acquireTokenSilent({ account: msalAccount, scopes: MICROSOFT_SCOPES });
  } catch (error) {
    throw normaliseMicrosoftError(error);
  }
  if (!result?.accessToken) {
    throw new MicrosoftSyncError("MICROSOFT_AUTH_FAILED", "Failed to acquire a Microsoft access token.");
  }

  // Persist the (possibly rotated) cache.
  const nextBlob = cache.serialize();
  if (nextBlob !== credential.cacheBlob) {
    const enc = encryptMicrosoftSyncCredential({ ...credential, cacheBlob: nextBlob });
    await db.syncAccount.update({
      where: { id: account.id },
      data: {
        credentialReference: enc.credentialReference,
        encryptionKeyRef: enc.encryptionKeyRef,
        credentialUpdatedAt: new Date(),
        credentialLastValidatedAt: new Date(),
      },
    });
  }

  return result.accessToken;
};

// ── Graph fetch ──────────────────────────────────────────────────────────────

type GraphDeltaResponse = {
  value?: unknown[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

const graphGet = async (accessToken: string, url: string): Promise<GraphDeltaResponse> => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw normaliseMicrosoftError({ statusCode: res.status, message: body || res.statusText });
  }
  return (await res.json()) as GraphDeltaResponse;
};

// ── Contact processing (STUB — field mapping is P27-05) ──────────────────────
// P27-04 owns the OAuth + fetch + delta plumbing; mapGraphContactToKontax and
// the DB writes land in P27-05. This stub counts the page without persisting.
export const processMicrosoftContacts = async (
  contacts: unknown[],
  _account: MicrosoftImportAccount,
): Promise<MicrosoftImportSummary> => {
  // P27-05 will map each Graph contact to a Contact and upsert via
  // SyncContactLink (remoteUid = Graph id, remoteETag = @odata.etag).
  void contacts;
  return emptySummary();
};

// ── delta traversal (shared by full import + incremental) ────────────────────

// Walks all delta pages from startUrl, processing each page's contacts, and
// returns the final @odata.deltaLink for the next incremental sync.
const traverseDelta = async (
  account: MicrosoftImportAccount,
  startUrl: string,
): Promise<{ summary: MicrosoftImportSummary; deltaLink: string | null }> => {
  const accessToken = await getMicrosoftAccessToken(account);
  let summary = emptySummary();
  let url: string | undefined = startUrl;
  let deltaLink: string | null = null;

  while (url) {
    const page = await graphGet(accessToken, url);
    const batch = await processMicrosoftContacts(page.value ?? [], account);
    summary = {
      created: summary.created + batch.created,
      updated: summary.updated + batch.updated,
      deleted: summary.deleted + batch.deleted,
      conflicts: summary.conflicts + batch.conflicts,
      queueFull: summary.queueFull || batch.queueFull,
    };
    if (page["@odata.nextLink"]) {
      url = page["@odata.nextLink"];
    } else {
      deltaLink = page["@odata.deltaLink"] ?? null;
      url = undefined;
    }
  }

  return { summary, deltaLink };
};

// ── full import ──────────────────────────────────────────────────────────────
// Uses the delta endpoint from scratch: the first delta call returns every
// contact paginated and ends with a deltaLink, so initial and incremental sync
// share one mechanism (and we avoid double-fetching to seed the delta link).

export const microsoftFullImport = async (
  account: MicrosoftImportAccount,
): Promise<MicrosoftImportSummary> => {
  const startUrl = `${GRAPH_BASE}/me/contacts/delta?$select=${encodeURIComponent(MICROSOFT_CONTACT_FIELDS)}`;
  const { summary, deltaLink } = await traverseDelta(account, startUrl);

  await db.syncAccount.update({
    where: { id: account.id },
    data: { lastSyncCursor: deltaLink, lastSyncedAt: new Date() },
  });

  return summary;
};

// ── incremental sync (resumes from the stored delta link) ─────────────────────

export const microsoftIncrementalSync = async (
  account: MicrosoftImportAccount,
): Promise<MicrosoftImportSummary> => {
  if (!account.lastSyncCursor) {
    return microsoftFullImport(account);
  }

  // A 410 Gone on a stale delta link means a full re-sync is required.
  let result: { summary: MicrosoftImportSummary; deltaLink: string | null };
  try {
    result = await traverseDelta(account, account.lastSyncCursor);
  } catch (error) {
    if (error instanceof MicrosoftSyncError && /\b410\b/.test(error.message)) {
      return microsoftFullImport(account);
    }
    throw error;
  }

  await db.syncAccount.update({
    where: { id: account.id },
    data: {
      lastSyncCursor: result.deltaLink ?? account.lastSyncCursor,
      lastSyncedAt: new Date(),
    },
  });

  return result.summary;
};

// Runner entrypoint: pick full vs incremental based on stored cursor.
export const runMicrosoftSync = async (
  account: MicrosoftImportAccount,
): Promise<MicrosoftImportSummary> =>
  account.lastSyncCursor ? microsoftIncrementalSync(account) : microsoftFullImport(account);

// ── connected-account email (used by the callback) ───────────────────────────

export const fetchMicrosoftProfileEmail = async (accessToken: string): Promise<string> => {
  try {
    const res = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return data.mail ?? data.userPrincipalName ?? "";
  } catch {
    return "";
  }
};

// ── disconnect (P27-07) ───────────────────────────────────────────────────────
// Microsoft has no programmatic delegated-token revocation endpoint equivalent
// to Google's. Dropping the stored token cache (done by the disconnect action
// deleting the SyncAccount) is the effective revocation; the user can also
// revoke app access from their Microsoft account portal. This hook exists for
// symmetry with revokeGoogleToken and is intentionally a no-op.
export const revokeMicrosoftToken = async (_account: MicrosoftSyncAccount): Promise<void> => {
  // No-op: see note above.
};
