// P27-01/02/03 — Google Contacts OAuth connector.
//
// Plugs Google into the existing sync infrastructure as a new SyncProvider:
// OAuth flow + encrypted token storage/refresh (P27-01), People API fetch
// plumbing with syncToken incremental sync + 410 fallback (P27-01), field
// mapping + contact persistence (P27-02), and conflict detection/resolution
// with policy enforcement + tombstone handling (P27-03).
import { auth as googleAuth, people, type people_v1 } from "@googleapis/people";

import type { ConflictPolicy, Prisma, SyncDirection } from "../../generated/prisma";
import { env } from "~/env";
import { emitEvent } from "~/lib/activity";
import { PHOTO_SYNC_ENABLED } from "~/lib/photo-sync-flags";
import { db } from "~/server/db";
import { parsePhotoShadow, type PushSeed } from "~/server/contact-photo-sync";
import { runPhotoPass, type PhotoPassLink, type PhotoPassTally } from "~/server/sync-photo-pass";
import {
  parseContactDateEntries,
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";
import {
  buildGoogleUpdatePersonFields,
  type GoogleContactSource,
  mapContactToGooglePerson,
  mapGooglePersonToContact,
} from "~/server/google-sync-mapping";
import type { ValueEntry } from "~/server/sync-contact-mapping";
import type { ContactConflictSnapshotInput } from "~/server/sync-conflict-snapshot";
import {
  buildDeletionHoldPayload,
  DeletionThresholdError,
  exceedsDeletionThreshold,
} from "~/server/sync-deletion-guard";
import {
  googleUpdateFieldsFor,
  stripExcludedPortableFields,
} from "~/server/sync-field-exclusions";
import { buildExportLabelFilterWhere } from "~/server/sync-settings";
import {
  addImportBatch,
  applyRemoteToContact,
  emptyImportBatch,
  type ImportBatchSummary,
  type ImportDeletionGuard,
  type ImportEngineAccount,
  importRemoteContactBatch,
  isConflictQueueFull,
  isLocalChanged,
  openMutationConflict,
  parseStoredAddressEntries,
  recordAutoResolved,
  recordSyncLinkError,
  type RemoteContactItem,
} from "~/server/sync-import-engine";
import {
  buildProviderCapabilityDiagnostics,
  buildProviderSupportedContactShadow,
  resolveSyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";
import {
  decryptGoogleSyncCredential,
  encryptGoogleSyncCredential,
  type GoogleSyncCredentialPayload,
} from "~/server/sync-credentials";

// Use the OAuth2 client type from @googleapis/people's own auth namespace so it
// matches what people({ auth }) expects (importing OAuth2Client from the
// top-level google-auth-library is a structurally-distinct duplicate).
type GoogleOAuthClient = InstanceType<typeof googleAuth.OAuth2>;

// OAuth scopes: contacts (read & write) + email for the connected-account label.
export const GOOGLE_CONTACTS_SCOPES = [
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/userinfo.email",
];

// personFields requested on every People API call. Consumed by P27-02's mapper.
export const GOOGLE_PERSON_FIELDS =
  "names,nicknames,emailAddresses,phoneNumbers,organizations,addresses,birthdays,urls,biographies,relations,metadata";

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
  return new googleAuth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
};

// OAuth state signing is shared across connectors — re-exported for the Google
// connect/callback routes that import it from here.
export { encodeOAuthState, decodeOAuthState } from "~/server/sync-oauth-state";

// ── Authenticated client per account (with refresh) ──────────────────────────

type GoogleSyncAccount = { id: string; credentialReference: string | null };

// Account context the import path needs to persist contacts + links + events
// and resolve conflicts.
export type GoogleImportAccount = GoogleSyncAccount & {
  userId: string;
  label: string;
  lastSyncCursor: string | null;
  conflictPolicy: ConflictPolicy;
  // Drives the push phase: only TWO_WAY / EXPORT_ONLY accounts push local edits.
  syncDirection: SyncDirection;
  // P39-02: deletion-safety guard shared across the run's import batches and
  // the push-delete phase. Omitted = threshold disabled or bypassed once.
  deletionGuard?: ImportDeletionGuard;
  // P39-03: normalized field-exclusion tokens (see sync-field-exclusions.ts).
  excludedFields?: Set<string>;
  // P39-04: label ids gating NEW outbound pushes (empty/omitted = push all).
  exportLabelFilter?: string[];
};

// Whole-import result the runner records; queueFull drives the auto-pause.
export type GoogleImportSummary = ImportBatchSummary & { queueFull: boolean };

// Full sync result: inbound import tallies + outbound push tallies, both
// recorded on the SyncJob so the UI can show each side separately.
export type GoogleSyncResult = GoogleImportSummary & {
  pushedCreated: number;
  pushedUpdated: number;
  pushedDeleted: number;
  // P49A-01 (A-07): contacts whose push failed this run (error recorded on
  // the link); the rest of the run carried on.
  pushFailed: number;
};

// Outbound tallies from the push phase.
export type GooglePushTally = {
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
  failed: number;
};

// Engine account context for Google (adds source/provider provenance).
const toEngineAccount = (account: GoogleImportAccount): ImportEngineAccount => ({
  id: account.id,
  userId: account.userId,
  label: account.label,
  conflictPolicy: account.conflictPolicy,
  capabilityProfile: resolveSyncProviderCapabilityProfile({ provider: "GOOGLE" }),
  sourceType: "SYNC_GOOGLE",
  providerName: "Google",
  deletionGuard: account.deletionGuard,
  excludedFields: account.excludedFields,
});

const GOOGLE_CAPABILITY_PROFILE = resolveSyncProviderCapabilityProfile({
  provider: "GOOGLE",
});

const normaliseGoogleError = (error: unknown): GoogleSyncError => {
  if (error instanceof GoogleSyncError) return error;
  const status = googleErrorStatus(error);
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

// People API client for an account. Tests replace the factory so no OAuth
// client, credential or network is involved; production never sets it.
type GooglePeopleApi = people_v1.People;
type GooglePeopleApiFactory = (account: GoogleSyncAccount) => Promise<GooglePeopleApi>;
let peopleApiFactoryOverride: GooglePeopleApiFactory | null = null;

/** Test seam: route every People API call through a stub (null restores). */
export const __setGooglePeopleApiFactoryForTests = (factory: GooglePeopleApiFactory | null) => {
  peopleApiFactoryOverride = factory;
};

const getPeopleApi = async (account: GoogleSyncAccount): Promise<GooglePeopleApi> => {
  if (peopleApiFactoryOverride) return peopleApiFactoryOverride(account);
  const { client } = await getGoogleClientForAccount(account);
  return people({ version: "v1", auth: client });
};

// ── Google API error classification (P49A-01 / A-22) ─────────────────────────
// The People API reports some preconditions as 400 FAILED_PRECONDITION rather
// than 410/409/412: an expired syncToken ("Sync token is expired. Clear local
// cache and retry call without the sync token.", reason EXPIRED_SYNC_TOKEN) and
// a stale person etag on update ("Request person.etag is different than the
// current person.etag..."). Classify defensively from every place gaxios may
// carry the status, reason and message.

const googleErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };
  for (const candidate of [e.response?.status, e.status, e.code]) {
    if (typeof candidate === "number") return candidate;
    if (typeof candidate === "string" && /^\d{3}$/.test(candidate)) return Number(candidate);
  }
  return undefined;
};

// Every status/reason/message string the error carries, joined for matching.
const googleErrorText = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null) return "";
  const e = error as {
    message?: unknown;
    errors?: Array<{ reason?: unknown; message?: unknown }>;
    response?: {
      data?: {
        error?: {
          status?: unknown;
          message?: unknown;
          details?: Array<{ reason?: unknown }>;
          errors?: Array<{ reason?: unknown; message?: unknown }>;
        };
      };
    };
  };
  const apiError = e.response?.data?.error;
  const parts: unknown[] = [
    e.message,
    apiError?.status,
    apiError?.message,
    ...(apiError?.details ?? []).map((d) => d?.reason),
    ...(apiError?.errors ?? []).flatMap((d) => [d?.reason, d?.message]),
    ...(Array.isArray(e.errors) ? e.errors : []).flatMap((d) => [d?.reason, d?.message]),
  ];
  return parts.filter((p): p is string => typeof p === "string").join(" | ");
};

// A 400 counts only when its status/reason/message names the precondition —
// either Google's FAILED_PRECONDITION status or the specific wording — so an
// ordinary INVALID_ARGUMENT 400 is never mistaken for one.
const isPrecondition400 = (error: unknown, wording: RegExp): boolean => {
  if (googleErrorStatus(error) !== 400) return false;
  const text = googleErrorText(error);
  if (!wording.test(text)) return false;
  return /FAILED_PRECONDITION|failedPrecondition|expired|different|stale|mismatch/i.test(text);
};

/** Expired/invalid syncToken: the only recovery is a full re-sync. */
export const isGoogleExpiredSyncTokenError = (error: unknown): boolean => {
  if (googleErrorStatus(error) === 410) return true;
  if (googleErrorStatus(error) === 400 && /EXPIRED_SYNC_TOKEN/i.test(googleErrorText(error))) {
    return true;
  }
  return isPrecondition400(error, /sync\s*token/i);
};

/** The person changed on Google since our etag: refetch + conflict path. */
export const isGoogleStaleEtagError = (error: unknown): boolean => {
  const status = googleErrorStatus(error);
  if (status === 409 || status === 412) return true;
  return isPrecondition400(error, /etag/i);
};

// Failures that are about the whole account (credentials, quota) rather than
// one contact. Per-contact push isolation re-throws these so the run stops and
// the runner can flag the account.
const isAccountLevelGoogleError = (error: GoogleSyncError) =>
  error.code === "GOOGLE_AUTH_FAILED" ||
  error.code === "GOOGLE_QUOTA_EXCEEDED" ||
  error.code === "CREDENTIALS_MISSING" ||
  error.code === "CREDENTIALS_UNREADABLE";

// ── Contact processing (P27-02 mapping + P27-03/06 conflicts) ────────────────
// Normalise each Person into a RemoteContactItem and hand the batch to the
// shared import engine, which owns create/update/conflict/tombstone logic.
export const processGoogleContacts = async (
  connections: people_v1.Schema$Person[],
  account: GoogleImportAccount,
): Promise<ImportBatchSummary> => {
  const items: RemoteContactItem[] = [];
  for (const person of connections) {
    const remoteUid = person.resourceName;
    if (!remoteUid) continue;
    items.push({
      remoteUid,
      etag: person.etag ?? null,
      deleted: Boolean(person.metadata?.deleted),
      mapped: mapGooglePersonToContact(person),
      remoteSnapshot: person as Prisma.InputJsonValue,
    });
  }
  return importRemoteContactBatch(toEngineAccount(account), items);
};

// Attach the queue-full flag (drives the runner's auto-pause) by counting the
// account's OPEN manual conflicts after the import settles.
const finalizeImportSummary = async (
  account: GoogleImportAccount,
  batch: ImportBatchSummary,
): Promise<GoogleImportSummary> => {
  return { ...batch, queueFull: await isConflictQueueFull(account.id) };
};

// ── Connection paging (shared by full + incremental) ─────────────────────────

// Internal signal: the stored syncToken is no longer accepted by Google.
class GoogleSyncTokenExpiredError extends Error {
  constructor() {
    super("Google sync token expired; a full re-sync is required.");
    this.name = "GoogleSyncTokenExpiredError";
  }
}

// P49A-01 (A-04): walk EVERY page of a connections.list stream, importing each
// page as it arrives. Only the final page carries nextSyncToken, so the caller
// persists the cursor once, after the loop; a mid-stream failure leaves the
// old cursor in place and the next run replays the stream (imports are
// idempotent by etag). Only the list call is error-mapped, so import-side
// errors (e.g. DeletionThresholdError) propagate untouched.
const walkGoogleConnections = async (
  account: GoogleImportAccount,
  peopleApi: GooglePeopleApi,
  syncToken: string | undefined,
): Promise<{ batch: ImportBatchSummary; nextSyncToken: string | null }> => {
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  let batch = emptyImportBatch();

  do {
    let data: people_v1.Schema$ListConnectionsResponse;
    try {
      const response = await peopleApi.people.connections.list({
        resourceName: "people/me",
        pageSize: 1000,
        personFields: GOOGLE_PERSON_FIELDS,
        // Google requires every page request to repeat the original params.
        ...(syncToken ? { syncToken } : {}),
        ...(pageToken ? { pageToken } : {}),
        requestSyncToken: true,
      });
      data = response.data;
    } catch (error) {
      if (syncToken && isGoogleExpiredSyncTokenError(error)) {
        throw new GoogleSyncTokenExpiredError();
      }
      throw normaliseGoogleError(error);
    }

    batch = addImportBatch(batch, await processGoogleContacts(data.connections ?? [], account));
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken) nextSyncToken = data.nextSyncToken ?? null;
  } while (pageToken);

  return { batch, nextSyncToken };
};

// ── Full import ──────────────────────────────────────────────────────────────

export const googleFullImport = async (
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> => {
  const peopleApi = await getPeopleApi(account);
  const { batch, nextSyncToken } = await walkGoogleConnections(account, peopleApi, undefined);

  await db.syncAccount.update({
    where: { id: account.id },
    data: { lastSyncCursor: nextSyncToken, lastSyncedAt: new Date() },
  });

  return finalizeImportSummary(account, batch);
};

// ── Incremental sync (falls back to full import on an expired syncToken) ─────

export const googleIncrementalSync = async (
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> => {
  if (!account.lastSyncCursor) {
    return googleFullImport(account);
  }

  const peopleApi = await getPeopleApi(account);

  let result: { batch: ImportBatchSummary; nextSyncToken: string | null };
  try {
    result = await walkGoogleConnections(account, peopleApi, account.lastSyncCursor);
  } catch (error) {
    // A-22: 410 GONE or 400 FAILED_PRECONDITION "sync token expired" — Google
    // requires a full re-sync without the token.
    if (error instanceof GoogleSyncTokenExpiredError) return googleFullImport(account);
    throw error;
  }

  // Never fall back to the previous cursor: replaying it would re-walk the
  // same stream forever. A stream that ends without a token (not expected
  // with requestSyncToken) clears the cursor so the next run is a full import.
  await db.syncAccount.update({
    where: { id: account.id },
    data: { lastSyncCursor: result.nextSyncToken, lastSyncedAt: new Date() },
  });

  return finalizeImportSummary(account, result.batch);
};

// ── Push phase (P27-03) ──────────────────────────────────────────────────────
// Pushes a local contact to Google. The update mask is derived per contact
// from the body plus intentional clears (P49A-01 / A-01, see
// buildGoogleUpdatePersonFields). On a stale etag (409/412, or 400
// FAILED_PRECONDITION naming the etag) the push is treated as a conflict
// against the freshly-fetched remote version.

export type GooglePushContact = GoogleContactSource & ContactConflictSnapshotInput;

export type GooglePushLink = {
  id: string;
  contactId: string;
  remoteUid: string;
  remoteETag: string | null;
  // Last-synced supported-field shadow: which families Google held at the last
  // sync, so a family the user emptied in Kontax is cleared on purpose.
  supportedFieldShadow?: unknown;
};

export type GooglePushResult =
  | { ok: true }
  | { ok: false; conflict: true; strategy: "KEEP_REMOTE" | "KEEP_LOCAL" | "MANUAL" };

export const pushGoogleContact = async (
  account: GoogleImportAccount,
  link: GooglePushLink,
  contact: GooglePushContact,
): Promise<GooglePushResult> => {
  const peopleApi = await getPeopleApi(account);

  // P39-03: excluded fields are stripped from the body AND withheld from the
  // update mask — Google keeps its current values for withheld families
  // instead of clearing them.
  const exclusions = account.excludedFields ?? new Set<string>();
  contact = stripExcludedPortableFields(contact, exclusions);

  const body = mapContactToGooglePerson(contact);
  const updatePersonFields = googleUpdateFieldsFor(
    buildGoogleUpdatePersonFields(body, link.supportedFieldShadow, contact),
    exclusions,
  );
  const localShadow = buildGooglePushShadow(contact);

  if (!updatePersonFields) {
    // Nothing to send or clear (every family empty or excluded): an empty
    // mask is rejected by Google, so just anchor the link.
    await db.syncContactLink.update({
      where: { id: link.id },
      data: { supportedFieldShadow: localShadow, lastSyncedAt: new Date() },
    });
    return { ok: true };
  }

  // Google requires the current etag in the body for optimistic concurrency.
  body.etag = link.remoteETag ?? undefined;

  try {
    const res = await peopleApi.people.updateContact({
      resourceName: link.remoteUid,
      updatePersonFields,
      requestBody: body,
    });
    await db.syncContactLink.update({
      where: { id: link.id },
      data: {
        remoteETag: res.data.etag ?? null,
        capabilityProfileId: GOOGLE_CAPABILITY_PROFILE.id,
        supportedFieldShadow: localShadow,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastSyncedAt: new Date(),
      },
    });
    return { ok: true };
  } catch (error) {
    // A-22: stale etag → refetch + conflict path below; anything else fails
    // this contact (the push loop records it and moves on).
    if (!isGoogleStaleEtagError(error)) {
      throw normaliseGoogleError(error);
    }
  }

  // Remote changed under us — fetch the latest and resolve by policy.
  let latest: people_v1.Schema$Person;
  try {
    const got = await peopleApi.people.get({
      resourceName: link.remoteUid,
      personFields: GOOGLE_PERSON_FIELDS,
    });
    latest = got.data;
  } catch (error) {
    throw normaliseGoogleError(error);
  }

  const now = new Date();
  const engineAccount = toEngineAccount(account);
  const latestEtag = latest.etag ?? null;
  const remoteSnapshot = latest as unknown as Prisma.InputJsonValue;

  if (account.conflictPolicy === "SERVER_WINS") {
    const mapped = mapGooglePersonToContact(latest);
    if (mapped) {
      await applyRemoteToContact(
        engineAccount,
        link.id,
        link.contactId,
        mapped,
        link.remoteUid,
        latestEtag,
        now,
      );
    }
    await recordAutoResolved(engineAccount, { id: link.id }, contact, remoteSnapshot, latestEtag, "KEEP_REMOTE", now);
    return { ok: false, conflict: true, strategy: "KEEP_REMOTE" };
  }

  if (account.conflictPolicy === "DEVICE_WINS") {
    // Kontax wins — retry the push with the fresh etag to overwrite remote.
    const retryBody = mapContactToGooglePerson(contact);
    retryBody.etag = latestEtag ?? undefined;
    let retried: people_v1.Schema$Person;
    try {
      const res = await peopleApi.people.updateContact({
        resourceName: link.remoteUid,
        updatePersonFields,
        requestBody: retryBody,
      });
      retried = res.data;
    } catch (error) {
      throw normaliseGoogleError(error);
    }
    await db.syncContactLink.update({
      where: { id: link.id },
      data: {
        remoteETag: retried.etag ?? null,
        capabilityProfileId: GOOGLE_CAPABILITY_PROFILE.id,
        supportedFieldShadow: localShadow,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastSyncedAt: now,
      },
    });
    await recordAutoResolved(engineAccount, { id: link.id }, contact, remoteSnapshot, latestEtag, "KEEP_LOCAL", now);
    return { ok: false, conflict: true, strategy: "KEEP_LOCAL" };
  }

  // MANUAL — surface for review; leave both sides as-is.
  await openMutationConflict(engineAccount, { id: link.id }, contact, remoteSnapshot, latestEtag);
  return { ok: false, conflict: true, strategy: "MANUAL" };
};

// ── Push phase wiring (P34D-03) ───────────────────────────────────────────────
// Finds contacts edited locally since the last sync and pushes them to Google.
// IMPORTANT ordering: this runs BEFORE the import. The import re-anchors a link's
// lastSyncedAt whenever a remote contact is unchanged (etag match), and a full
// import returns every contact — so importing first would mask pending local
// edits. Per-contact concurrency (etag) and conflict policy live in
// pushGoogleContact; here we only select dirty contacts and tally results.

const parseValueEntries = (value: unknown): ValueEntry[] =>
  Array.isArray(value)
    ? value
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as { value?: unknown }).value === "string",
        )
        .map((entry) => ({
          label: typeof entry.label === "string" ? entry.label : "",
          value: entry.value as string,
          isPrimary: entry.isPrimary === true,
        }))
    : [];

const pushContactSelect = {
  id: true,
  syncUid: true,
  syncVersion: true,
  updatedAt: true,
  fullName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  namePrefix: true,
  nameSuffix: true,
  nickname: true,
  email: true,
  emailAddresses: true,
  emailEntries: true,
  phone: true,
  phoneNumbers: true,
  phoneEntries: true,
  company: true,
  department: true,
  jobTitle: true,
  website: true,
  websiteEntries: true,
  birthday: true,
  significantDates: true,
  address: true,
  postalAddresses: true,
  addressEntries: true,
  notes: true,
} satisfies Prisma.ContactSelect;

type PushContactRow = Prisma.ContactGetPayload<{ select: typeof pushContactSelect }>;

export const buildGooglePushContact = (c: PushContactRow): GooglePushContact => ({
  id: c.id,
  syncUid: c.syncUid,
  syncVersion: c.syncVersion,
  fullName: c.fullName,
  firstName: c.firstName,
  middleName: c.middleName,
  lastName: c.lastName,
  namePrefix: c.namePrefix,
  nameSuffix: c.nameSuffix,
  nickname: c.nickname,
  email: c.email,
  emailAddresses: parseContactStringArray(c.emailAddresses),
  emailEntries: parseValueEntries(c.emailEntries),
  phone: c.phone,
  phoneNumbers: parseContactStringArray(c.phoneNumbers),
  phoneEntries: parseValueEntries(c.phoneEntries),
  company: c.company,
  department: c.department,
  jobTitle: c.jobTitle,
  website: c.website,
  websiteEntries: parseValueEntries(c.websiteEntries),
  birthday: c.birthday,
  address: c.address,
  postalAddresses: parseContactPostalAddresses(c.postalAddresses),
  addressEntries: parseStoredAddressEntries(c.addressEntries),
  notes: c.notes,
});

const buildGoogleCapabilityDiagnostics = (contact: PushContactRow) =>
  buildProviderCapabilityDiagnostics(
    {
      fullName: contact.fullName,
      firstName: contact.firstName,
      middleName: contact.middleName,
      lastName: contact.lastName,
      namePrefix: contact.namePrefix,
      nameSuffix: contact.nameSuffix,
      nickname: contact.nickname,
      email: contact.email,
      emailAddresses: parseContactStringArray(contact.emailAddresses),
      emailEntries: parseValueEntries(contact.emailEntries),
      phone: contact.phone,
      phoneNumbers: parseContactStringArray(contact.phoneNumbers),
      phoneEntries: parseValueEntries(contact.phoneEntries),
      company: contact.company,
      department: contact.department,
      jobTitle: contact.jobTitle,
      website: contact.website,
      birthday: contact.birthday,
      significantDates: parseContactDateEntries(contact.significantDates),
      address: contact.address,
      postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
      notes: contact.notes,
    },
    GOOGLE_CAPABILITY_PROFILE,
  );

const googleCapabilityDiagnosticsPayload = (contact: PushContactRow) => {
  const diagnostics = buildGoogleCapabilityDiagnostics(contact);
  return diagnostics
    ? {
        unsupportedFieldFamilies: diagnostics.unsupportedFieldFamilies,
        unsupportedFieldCount: diagnostics.unsupportedFieldCount,
      }
    : {};
};

const buildGooglePushShadow = (contact: GooglePushContact) =>
  buildProviderSupportedContactShadow(
    {
      fullName: contact.fullName,
      firstName: contact.firstName,
      middleName: contact.middleName,
      lastName: contact.lastName,
      namePrefix: contact.namePrefix,
      nameSuffix: contact.nameSuffix,
      nickname: contact.nickname,
      email: contact.email,
      emailAddresses: contact.emailAddresses,
      emailEntries: contact.emailEntries,
      phone: contact.phone,
      phoneNumbers: contact.phoneNumbers,
      phoneEntries: contact.phoneEntries,
      company: contact.company,
      department: contact.department,
      jobTitle: contact.jobTitle,
      website: contact.website,
      websiteEntries: contact.websiteEntries,
      birthday: contact.birthday,
      address: contact.address,
      postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
      addressEntries: contact.addressEntries,
      notes: contact.notes,
    },
    GOOGLE_CAPABILITY_PROFILE,
  );

// Create a brand-new Google contact for a local contact that has no link yet,
// then record the link so subsequent syncs treat it as updates, not creates.
const createGoogleContactRemote = async (
  account: GoogleImportAccount,
  contact: PushContactRow,
): Promise<boolean> => {
  const peopleApi = await getPeopleApi(account);
  let created: people_v1.Schema$Person;
  // P39-03: excluded fields never reach a freshly-created remote contact.
  const pushSource = stripExcludedPortableFields(
    buildGooglePushContact(contact),
    account.excludedFields ?? new Set<string>(),
  );
  try {
    const res = await peopleApi.people.createContact({
      requestBody: mapContactToGooglePerson(pushSource),
    });
    created = res.data;
  } catch (error) {
    throw normaliseGoogleError(error);
  }
  if (!created.resourceName) return false;
  await db.syncContactLink.create({
    data: {
      syncAccountId: account.id,
      contactId: contact.id,
      remoteHref: created.resourceName,
      remoteUid: created.resourceName,
      remoteETag: created.etag ?? null,
      capabilityProfileId: GOOGLE_CAPABILITY_PROFILE.id,
      supportedFieldShadow: buildGooglePushShadow(pushSource),
      lastSyncedAt: new Date(),
    },
  });
  await emitEvent(db, {
    userId: account.userId,
    contactId: contact.id,
    eventType: "SYNC_PUSHED",
    actor: "SYNC",
    actorDetail: account.label,
    payload: {
      syncAccountId: account.id,
      syncAccountLabel: account.label,
      ...googleCapabilityDiagnosticsPayload(contact),
    },
  });
  return true;
};

// Delete a contact on Google that was removed locally, then tombstone the link.
// A 404 (already gone remotely) is treated as success.
const deleteGoogleContactRemote = async (
  account: GoogleImportAccount,
  link: { id: string; remoteUid: string },
): Promise<void> => {
  const peopleApi = await getPeopleApi(account);
  try {
    await peopleApi.people.deleteContact({ resourceName: link.remoteUid });
  } catch (error) {
    if (googleErrorStatus(error) !== 404) throw normaliseGoogleError(error);
  }
  const now = new Date();
  await db.syncContactLink.update({
    where: { id: link.id },
    data: { tombstonedAt: now, remoteDeletedAt: now, lastSyncedAt: now },
  });
};

// P49A-01 (A-07): one contact's push failure must not abort the run (push
// runs before import, so a throw here used to starve the import too). A
// per-contact failure is recorded on its link (when it has one) and the loop
// carries on; account-level failures — credentials, quota, missing config,
// the deletion-safety hold — are re-thrown so the runner still stops and
// flags the account.
const isolateGooglePushFailure = async (
  error: unknown,
  target: { op: "update" | "create" | "delete"; linkId?: string; contactId: string },
): Promise<void> => {
  if (error instanceof DeletionThresholdError || error instanceof GoogleSyncConfigError) {
    throw error;
  }
  const failure = normaliseGoogleError(error);
  if (isAccountLevelGoogleError(failure)) throw failure;
  console.error(
    `[sync] Google ${target.op} failed for ${target.linkId ? `link ${target.linkId}` : `contact ${target.contactId}`} (${failure.code}):`,
    failure.message,
  );
  if (target.linkId) {
    await recordSyncLinkError(target.linkId, failure.code, failure.message);
  }
};

export const pushLocalChangesToGoogle = async (
  account: GoogleImportAccount,
): Promise<GooglePushTally> => {
  // Import-only accounts never push.
  if (account.syncDirection !== "TWO_WAY" && account.syncDirection !== "EXPORT_ONLY") {
    return { created: 0, updated: 0, deleted: 0, conflicts: 0, failed: 0 };
  }

  let created = 0;
  let updated = 0;
  let deleted = 0;
  let conflicts = 0;
  let failed = 0;

  // 1) UPDATES — active, locally-edited contacts already linked to Google.
  //    Only genuine user edits (lastMutatedBy = MANUAL): a contact whose last
  //    write was a sync re-import (SYNC_*) must NOT be pushed back, or we get a
  //    feedback loop (push -> Google normalises -> re-import bumps updatedAt ->
  //    looks "dirty" -> push again, forever).
  const activeLinks = await db.syncContactLink.findMany({
    where: {
      syncAccountId: account.id,
      tombstonedAt: null,
      remoteUid: { not: null },
      contact: { archivedAt: null, syncTombstoneAt: null, lastMutatedBy: "MANUAL" },
    },
    select: {
      id: true,
      contactId: true,
      remoteUid: true,
      remoteETag: true,
      supportedFieldShadow: true,
      lastSyncedAt: true,
      contact: { select: pushContactSelect },
    },
  });
  for (const link of activeLinks) {
    if (!link.remoteUid) continue;
    if (!isLocalChanged(link.lastSyncedAt, link.contact.updatedAt)) continue;
    let result: GooglePushResult;
    try {
      result = await pushGoogleContact(
        account,
        {
          id: link.id,
          contactId: link.contactId,
          remoteUid: link.remoteUid,
          remoteETag: link.remoteETag,
          supportedFieldShadow: link.supportedFieldShadow,
        },
        buildGooglePushContact(link.contact),
      );
    } catch (error) {
      await isolateGooglePushFailure(error, {
        op: "update",
        linkId: link.id,
        contactId: link.contactId,
      });
      failed += 1;
      continue;
    }
    if (result.ok) {
      await emitEvent(db, {
        userId: account.userId,
        contactId: link.contactId,
        eventType: "SYNC_PUSHED",
        actor: "SYNC",
        actorDetail: account.label,
        payload: {
          syncAccountId: account.id,
          syncAccountLabel: account.label,
          ...googleCapabilityDiagnosticsPayload(link.contact),
        },
      });
      updated += 1;
    } else {
      conflicts += 1;
    }
  }

  // 2) CREATES — user-created local contacts not yet on Google. Restricted to
  //    MANUAL contacts so we don't propagate contacts imported from other
  //    sources into Google. P39-04: the export label filter gates these new
  //    pushes only — linked contacts keep syncing regardless of labels.
  const exportLabelWhere = await buildExportLabelFilterWhere(
    account.userId,
    account.exportLabelFilter ?? [],
  );
  const unlinked = await db.contact.findMany({
    where: {
      userId: account.userId,
      archivedAt: null,
      syncTombstoneAt: null,
      lastMutatedBy: "MANUAL",
      syncLinks: { none: { syncAccountId: account.id } },
      ...(exportLabelWhere ? { AND: [exportLabelWhere] } : {}),
    },
    select: pushContactSelect,
  });
  for (const contact of unlinked) {
    try {
      if (await createGoogleContactRemote(account, contact)) {
        created += 1;
      }
    } catch (error) {
      // No link exists yet to carry the error; the next run retries the create.
      await isolateGooglePushFailure(error, { op: "create", contactId: contact.id });
      failed += 1;
    }
  }

  // 3) DELETES — contacts removed locally but still present on Google.
  //    remoteDeletedAt = null excludes contacts that were tombstoned *because*
  //    Google deleted them (those are already gone remotely).
  const removedLinks = await db.syncContactLink.findMany({
    where: {
      syncAccountId: account.id,
      tombstonedAt: null,
      remoteUid: { not: null },
      remoteDeletedAt: null,
      contact: { OR: [{ archivedAt: { not: null } }, { syncTombstoneAt: { not: null } }] },
    },
    select: {
      id: true,
      remoteUid: true,
      contact: { select: { id: true, fullName: true, book: { select: { name: true } } } },
    },
  });

  // P39-02: deletion-safety threshold — the outbound delete list is known in
  // full before any remote delete runs, so the guard aborts before the first.
  if (account.deletionGuard) {
    const guard = account.deletionGuard;
    guard.candidates.push(
      ...removedLinks
        .filter((link) => link.remoteUid)
        .map((link) => ({
          linkId: link.id,
          contactId: link.contact?.id ?? "",
          name: link.contact?.fullName ?? "Unknown contact",
          bookName: link.contact?.book?.name ?? "Personal",
          bookDetail: link.contact?.book ? null : "default",
          direction: "outbound" as const,
        })),
    );
    const outbound = guard.candidates.filter((c) => c.direction === "outbound").length;
    if (exceedsDeletionThreshold({ inbound: 0, outbound }, guard.threshold)) {
      throw new DeletionThresholdError(buildDeletionHoldPayload(guard.candidates, guard.threshold));
    }
  }

  for (const link of removedLinks) {
    if (!link.remoteUid) continue;
    try {
      await deleteGoogleContactRemote(account, { id: link.id, remoteUid: link.remoteUid });
      deleted += 1;
    } catch (error) {
      await isolateGooglePushFailure(error, {
        op: "delete",
        linkId: link.id,
        contactId: link.contact?.id ?? "",
      });
      failed += 1;
    }
  }

  return { created, updated, deleted, conflicts, failed };
};

// Runner entrypoint. Push local changes FIRST (the import re-anchors
// lastSyncedAt for unchanged contacts, which would otherwise mask local edits),
// then pull. Direction gates which half runs. Inbound + outbound tallies are
// reported separately so the UI can show each side.
export const runGoogleSync = async (
  account: GoogleImportAccount,
): Promise<GoogleSyncResult> => {
  const outbound =
    account.syncDirection === "TWO_WAY" || account.syncDirection === "EXPORT_ONLY";
  const inbound =
    account.syncDirection === "TWO_WAY" || account.syncDirection === "IMPORT_ONLY";

  const push: GooglePushTally = outbound
    ? await pushLocalChangesToGoogle(account)
    : { created: 0, updated: 0, deleted: 0, conflicts: 0, failed: 0 };

  const importSummary: GoogleImportSummary = inbound
    ? account.lastSyncCursor
      ? await googleIncrementalSync(account)
      : await googleFullImport(account)
    : {
        created: 0,
        updated: 0,
        deleted: 0,
        conflicts: 0,
        queueFull: await isConflictQueueFull(account.id),
      };

  // P44-03/04: photo pass (flag-gated). Failures never fail the sync.
  const photoTally = PHOTO_SYNC_ENABLED
    ? await runGooglePhotoPass(account, { inbound, outbound })
    : { pulled: 0, pushed: 0, deletedLocal: 0, deletedRemote: 0, conflicts: 0 };

  return {
    created: importSummary.created,
    updated: importSummary.updated + photoTally.pulled + photoTally.deletedLocal,
    deleted: importSummary.deleted,
    conflicts: importSummary.conflicts + push.conflicts,
    // A push that opened a MANUAL conflict may have filled the queue.
    queueFull:
      push.conflicts > 0 ? await isConflictQueueFull(account.id) : importSummary.queueFull,
    pushedCreated: push.created,
    pushedUpdated: push.updated + photoTally.pushed + photoTally.deletedRemote,
    pushedDeleted: push.deleted,
    pushFailed: push.failed,
  };
};

/**
 * P44-03/04 Google photo pass: reconcile every linked contact's photo via the
 * dedicated photo endpoint (getBatchGet to read, updateContactPhoto to write —
 * no full-contact PUT, so no field-wipe hazard). See docs/adr/0001.
 */
const runGooglePhotoPass = async (
  account: GoogleImportAccount,
  dir: { inbound: boolean; outbound: boolean },
): Promise<PhotoPassTally> => {
  const photoExcluded = account.excludedFields?.has("PHOTO") ?? false;
  const cap = { canPull: dir.inbound && !photoExcluded, canPush: dir.outbound && !photoExcluded };
  if (!cap.canPull && !cap.canPush) {
    return { pulled: 0, pushed: 0, deletedLocal: 0, deletedRemote: 0, conflicts: 0 };
  }

  const links = await db.syncContactLink.findMany({
    where: { syncAccountId: account.id, remoteUid: { not: null }, tombstonedAt: null },
    select: {
      id: true,
      remoteUid: true,
      contactId: true,
      photoShadow: true,
      contact: { select: { avatarUrl: true } },
    },
  });
  if (links.length === 0) {
    return { pulled: 0, pushed: 0, deletedLocal: 0, deletedRemote: 0, conflicts: 0 };
  }

  const resourceNames = links.map((l) => l.remoteUid).filter((u): u is string => u != null);
  const remotePhotos = await fetchGoogleRemotePhotos(account, resourceNames);

  const passLinks: PhotoPassLink[] = links
    .filter((l): l is typeof l & { remoteUid: string } => l.remoteUid != null)
    .map((link) => {
      const rn = link.remoteUid;
      const remote = remotePhotos.get(rn) ?? { hasPhoto: false, url: null, signal: null };
      return {
        linkId: link.id,
        contactId: link.contactId,
        avatarUrl: link.contact.avatarUrl ?? null,
        shadow: parsePhotoShadow(link.photoShadow),
        signalKind: "resourceIdentifier" as const,
        remote: { hasPhoto: remote.hasPhoto, signal: remote.signal },
        loadRemoteBytes: async () => (remote.url ? fetchGooglePhotoBytes(remote.url) : null),
        pushCanonical: async (b64: string): Promise<PushSeed> => {
          const res = await pushGooglePhoto(account, rn, b64);
          return { remoteSignal: res.signal, remoteCanonicalHash: null, remoteETag: res.etag };
        },
        deleteRemote: async () => {
          await deleteGooglePhoto(account, rn);
        },
      };
    });

  return runPhotoPass(
    db,
    { userId: account.userId, syncAccountId: account.id, syncAccountLabel: account.label },
    cap,
    passLinks,
  );
};

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
  const token = credential.refreshToken.length > 0 ? credential.refreshToken : credential.accessToken;
  try {
    await client.revokeToken(token);
  } catch {
    // Best-effort: a revoked/expired token may already be invalid at Google.
  }
};

// ── P44-03/04 photo transport ────────────────────────────────────────────────
// Google keeps photos on a dedicated endpoint, not a contact field (which is
// why GOOGLE_PERSON_FIELDS omits them). The change-detection signal is the
// photo resource URL with its volatile size suffix (=sNN) stripped — stable on
// no-op re-pull per P44-01. `=s0` returns the full original for storage.
export type GoogleRemotePhoto = { hasPhoto: boolean; url: string | null; signal: string | null };

const GOOGLE_PHOTO_PERSON_FIELDS = "photos,metadata";
const stripGooglePhotoSize = (url: string): string => url.replace(/=s\d+(-c)?$/i, "");
const googlePhotoFullUrl = (url: string): string => `${stripGooglePhotoSize(url)}=s0`;

/**
 * Batch-fetch remote photo state for up to any number of contacts (People API
 * getBatchGet caps at 200 resource names per call). Returns a map keyed by
 * resource name; contacts with only Google's default silhouette map to
 * `hasPhoto: false`.
 */
export const fetchGoogleRemotePhotos = async (
  account: GoogleSyncAccount,
  resourceNames: string[],
): Promise<Map<string, GoogleRemotePhoto>> => {
  const out = new Map<string, GoogleRemotePhoto>();
  if (resourceNames.length === 0) return out;
  const peopleApi = await getPeopleApi(account);
  for (let i = 0; i < resourceNames.length; i += 200) {
    const chunk = resourceNames.slice(i, i + 200);
    const res = await peopleApi.people.getBatchGet({
      resourceNames: chunk,
      personFields: GOOGLE_PHOTO_PERSON_FIELDS,
    });
    for (const r of res.data.responses ?? []) {
      const rn = r.requestedResourceName ?? r.person?.resourceName ?? null;
      if (!rn) continue;
      const photo = (r.person?.photos ?? []).find((p) => !p.default) ?? null;
      const url = photo?.url ?? null;
      out.set(
        rn,
        url
          ? { hasPhoto: true, url, signal: stripGooglePhotoSize(url) }
          : { hasPhoto: false, url: null, signal: null },
      );
    }
  }
  return out;
};

/** Fetch the full-resolution bytes behind a People API photo URL. */
export const fetchGooglePhotoBytes = async (url: string): Promise<Buffer | null> => {
  try {
    const res = await fetch(googlePhotoFullUrl(url));
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
};

/**
 * Upload a canonical JPEG as the contact's photo. Returns the new person etag
 * and the new photo signal (resource URL, size-suffix stripped) read back from
 * the response — this is the shadow seed that suppresses the next-pull echo.
 */
export const pushGooglePhoto = async (
  account: GoogleSyncAccount,
  resourceName: string,
  base64Jpeg: string,
): Promise<{ etag: string | null; signal: string | null }> => {
  const peopleApi = await getPeopleApi(account);
  const res = await peopleApi.people.updateContactPhoto({
    resourceName,
    requestBody: { photoBytes: base64Jpeg, personFields: GOOGLE_PHOTO_PERSON_FIELDS },
  });
  const url = (res.data.person?.photos ?? []).find((p) => !p.default)?.url ?? null;
  return { etag: res.data.person?.etag ?? null, signal: url ? stripGooglePhotoSize(url) : null };
};

/** Remove the contact's photo. Returns the new person etag. */
export const deleteGooglePhoto = async (
  account: GoogleSyncAccount,
  resourceName: string,
): Promise<{ etag: string | null }> => {
  const peopleApi = await getPeopleApi(account);
  const res = await peopleApi.people.deleteContactPhoto({
    resourceName,
    personFields: GOOGLE_PHOTO_PERSON_FIELDS,
  });
  return { etag: res.data.person?.etag ?? null };
};
