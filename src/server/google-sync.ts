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
import { db } from "~/server/db";
import {
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";
import {
  type GoogleContactSource,
  mapContactToGooglePerson,
  mapGooglePersonToContact,
} from "~/server/google-sync-mapping";
import type { ValueEntry } from "~/server/sync-contact-mapping";
import type { ContactConflictSnapshotInput } from "~/server/sync-conflict-snapshot";
import {
  addImportBatch,
  applyRemoteToContact,
  emptyImportBatch,
  type ImportBatchSummary,
  type ImportEngineAccount,
  importRemoteContactBatch,
  isConflictQueueFull,
  isLocalChanged,
  openMutationConflict,
  recordAutoResolved,
  type RemoteContactItem,
} from "~/server/sync-import-engine";
import {
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
  "names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,urls,biographies,relations,metadata";

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
};

// Whole-import result the runner records; queueFull drives the auto-pause.
export type GoogleImportSummary = ImportBatchSummary & { queueFull: boolean };

// Full sync result: inbound import tallies + outbound push tallies, both
// recorded on the SyncJob so the UI can show each side separately.
export type GoogleSyncResult = GoogleImportSummary & {
  pushedCreated: number;
  pushedUpdated: number;
  pushedDeleted: number;
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
});

const GOOGLE_CAPABILITY_PROFILE = resolveSyncProviderCapabilityProfile({
  provider: "GOOGLE",
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

// ── Full import ──────────────────────────────────────────────────────────────

export const googleFullImport = async (
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> => {
  const { client } = await getGoogleClientForAccount(account);
  const peopleApi = people({ version: "v1", auth: client });

  let pageToken: string | undefined;
  let syncToken: string | undefined;
  let batch = emptyImportBatch();

  try {
    do {
      const response = await peopleApi.people.connections.list({
        resourceName: "people/me",
        pageSize: 1000,
        personFields: GOOGLE_PERSON_FIELDS,
        pageToken,
        requestSyncToken: true,
      });

      batch = addImportBatch(
        batch,
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

  return finalizeImportSummary(account, batch);
};

// ── Incremental sync (falls back to full import on 410 expired syncToken) ─────

export const googleIncrementalSync = async (
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> => {
  if (!account.lastSyncCursor) {
    return googleFullImport(account);
  }

  const { client } = await getGoogleClientForAccount(account);
  const peopleApi = people({ version: "v1", auth: client });

  let response: people_v1.Schema$ListConnectionsResponse;
  try {
    const result = await peopleApi.people.connections.list({
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

  const batch = await processGoogleContacts(response.connections ?? [], account);

  await db.syncAccount.update({
    where: { id: account.id },
    data: {
      lastSyncCursor: response.nextSyncToken ?? account.lastSyncCursor,
      lastSyncedAt: new Date(),
    },
  });

  return finalizeImportSummary(account, batch);
};

// ── Push phase (P27-03) ──────────────────────────────────────────────────────
// Pushes a local contact to Google. updatePersonFields excludes read-only
// fields (metadata/photos). On a 409/412 (remote changed since our etag) the
// push is treated as a conflict against the freshly-fetched remote version.
export const GOOGLE_UPDATE_PERSON_FIELDS =
  "names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,urls,biographies";

export type GooglePushContact = GoogleContactSource & ContactConflictSnapshotInput;

export type GooglePushLink = {
  id: string;
  contactId: string;
  remoteUid: string;
  remoteETag: string | null;
};

export type GooglePushResult =
  | { ok: true }
  | { ok: false; conflict: true; strategy: "KEEP_REMOTE" | "KEEP_LOCAL" | "MANUAL" };

export const pushGoogleContact = async (
  account: GoogleImportAccount,
  link: GooglePushLink,
  contact: GooglePushContact,
): Promise<GooglePushResult> => {
  const { client } = await getGoogleClientForAccount(account);
  const peopleApi = people({ version: "v1", auth: client });

  const body = mapContactToGooglePerson(contact);
  // Google requires the current etag in the body for optimistic concurrency.
  body.etag = link.remoteETag ?? undefined;

  try {
    const res = await peopleApi.people.updateContact({
      resourceName: link.remoteUid,
      updatePersonFields: GOOGLE_UPDATE_PERSON_FIELDS,
      requestBody: body,
    });
    const localShadow = buildGooglePushShadow(contact);
    await db.syncContactLink.update({
      where: { id: link.id },
      data: {
        remoteETag: res.data.etag ?? null,
        capabilityProfileId: GOOGLE_CAPABILITY_PROFILE.id,
        supportedFieldShadow: localShadow as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
      },
    });
    return { ok: true };
  } catch (error) {
    const status =
      (error as { code?: unknown }).code ??
      (error as { response?: { status?: unknown } }).response?.status;
    if (status !== 409 && status !== 412) {
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
    const res = await peopleApi.people.updateContact({
      resourceName: link.remoteUid,
      updatePersonFields: GOOGLE_UPDATE_PERSON_FIELDS,
      requestBody: retryBody,
    });
    const localShadow = buildGooglePushShadow(contact);
    await db.syncContactLink.update({
      where: { id: link.id },
      data: {
        remoteETag: res.data.etag ?? null,
        capabilityProfileId: GOOGLE_CAPABILITY_PROFILE.id,
        supportedFieldShadow: localShadow as Prisma.InputJsonValue,
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
  birthday: true,
  address: true,
  postalAddresses: true,
  notes: true,
} satisfies Prisma.ContactSelect;

type PushContactRow = Prisma.ContactGetPayload<{ select: typeof pushContactSelect }>;

const buildGooglePushContact = (c: PushContactRow): GooglePushContact => ({
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
  birthday: c.birthday,
  address: c.address,
  postalAddresses: c.postalAddresses,
  notes: c.notes,
});

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
      birthday: contact.birthday,
      address: contact.address,
      postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
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
  const { client } = await getGoogleClientForAccount(account);
  const peopleApi = people({ version: "v1", auth: client });
  let created: people_v1.Schema$Person;
  try {
    const res = await peopleApi.people.createContact({
      requestBody: mapContactToGooglePerson(buildGooglePushContact(contact)),
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
      supportedFieldShadow: buildGooglePushShadow(
        buildGooglePushContact(contact),
      ) as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
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
  const { client } = await getGoogleClientForAccount(account);
  const peopleApi = people({ version: "v1", auth: client });
  try {
    await peopleApi.people.deleteContact({ resourceName: link.remoteUid });
  } catch (error) {
    const status =
      (error as { code?: unknown }).code ??
      (error as { response?: { status?: unknown } }).response?.status;
    if (status !== 404) throw normaliseGoogleError(error);
  }
  const now = new Date();
  await db.syncContactLink.update({
    where: { id: link.id },
    data: { tombstonedAt: now, remoteDeletedAt: now, lastSyncedAt: now },
  });
};

export const pushLocalChangesToGoogle = async (
  account: GoogleImportAccount,
): Promise<{ created: number; updated: number; deleted: number; conflicts: number }> => {
  // Import-only accounts never push.
  if (account.syncDirection !== "TWO_WAY" && account.syncDirection !== "EXPORT_ONLY") {
    return { created: 0, updated: 0, deleted: 0, conflicts: 0 };
  }

  let created = 0;
  let updated = 0;
  let deleted = 0;
  let conflicts = 0;

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
      lastSyncedAt: true,
      contact: { select: pushContactSelect },
    },
  });
  for (const link of activeLinks) {
    if (!link.remoteUid) continue;
    if (!isLocalChanged(link.lastSyncedAt, link.contact.updatedAt)) continue;
    const result = await pushGoogleContact(
      account,
      {
        id: link.id,
        contactId: link.contactId,
        remoteUid: link.remoteUid,
        remoteETag: link.remoteETag,
      },
      buildGooglePushContact(link.contact),
    );
    if (result.ok) {
      updated += 1;
    } else {
      conflicts += 1;
    }
  }

  // 2) CREATES — user-created local contacts not yet on Google. Restricted to
  //    MANUAL contacts so we don't propagate contacts imported from other
  //    sources into Google.
  const unlinked = await db.contact.findMany({
    where: {
      userId: account.userId,
      archivedAt: null,
      syncTombstoneAt: null,
      lastMutatedBy: "MANUAL",
      syncLinks: { none: { syncAccountId: account.id } },
    },
    select: pushContactSelect,
  });
  for (const contact of unlinked) {
    if (await createGoogleContactRemote(account, contact)) {
      created += 1;
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
    select: { id: true, remoteUid: true },
  });
  for (const link of removedLinks) {
    if (!link.remoteUid) continue;
    await deleteGoogleContactRemote(account, { id: link.id, remoteUid: link.remoteUid });
    deleted += 1;
  }

  return { created, updated, deleted, conflicts };
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

  const push = outbound
    ? await pushLocalChangesToGoogle(account)
    : { created: 0, updated: 0, deleted: 0, conflicts: 0 };

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

  return {
    created: importSummary.created,
    updated: importSummary.updated,
    deleted: importSummary.deleted,
    conflicts: importSummary.conflicts + push.conflicts,
    // A push that opened a MANUAL conflict may have filled the queue.
    queueFull:
      push.conflicts > 0 ? await isConflictQueueFull(account.id) : importSummary.queueFull,
    pushedCreated: push.created,
    pushedUpdated: push.updated,
    pushedDeleted: push.deleted,
  };
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
