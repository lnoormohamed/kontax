// P27-01/02/03 — Google Contacts OAuth connector.
//
// Plugs Google into the existing sync infrastructure as a new SyncProvider:
// OAuth flow + encrypted token storage/refresh (P27-01), People API fetch
// plumbing with syncToken incremental sync + 410 fallback (P27-01), field
// mapping + contact persistence (P27-02), and conflict detection/resolution
// with policy enforcement + tombstone handling (P27-03).
import { google, type people_v1 } from "googleapis";

import type { ConflictPolicy, Prisma } from "../../generated/prisma";
import { emitEvent } from "~/lib/activity";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  type GoogleContactSource,
  type GoogleMappedContact,
  mapContactToGooglePerson,
  mapGooglePersonToContact,
} from "~/server/google-sync-mapping";
import {
  buildLocalConflictSnapshot,
  type ContactConflictSnapshotInput,
  contactConflictSelect,
} from "~/server/sync-conflict-snapshot";
import { MANUAL_CONFLICT_QUEUE_LIMIT } from "~/server/sync-health";
import {
  decryptGoogleSyncCredential,
  encryptGoogleSyncCredential,
  type GoogleSyncCredentialPayload,
} from "~/server/sync-credentials";

// Use the OAuth2 client type that google.auth.OAuth2 actually produces. The
// standalone `google-auth-library` export is a structurally-distinct duplicate
// of the copy bundled under googleapis-common, so importing it causes type
// mismatches when passed to google.people({ auth }).
type GoogleOAuthClient = InstanceType<typeof google.auth.OAuth2>;

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
  return new google.auth.OAuth2(
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
};

// Per-page tally returned by processGoogleContacts.
export type GoogleBatchSummary = {
  created: number;
  updated: number;
  deleted: number;
  conflicts: number; // OPEN (MANUAL-policy) conflicts created this batch
};

// Whole-import result the runner records; queueFull drives the auto-pause.
export type GoogleImportSummary = GoogleBatchSummary & { queueFull: boolean };

const emptyBatch = (): GoogleBatchSummary => ({
  created: 0,
  updated: 0,
  deleted: 0,
  conflicts: 0,
});

const addBatch = (a: GoogleBatchSummary, b: GoogleBatchSummary): GoogleBatchSummary => ({
  created: a.created + b.created,
  updated: a.updated + b.updated,
  deleted: a.deleted + b.deleted,
  conflicts: a.conflicts + b.conflicts,
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

// ── Contact processing (P27-02 mapping + P27-03 conflicts) ───────────────────
// Maps each Person to the canonical contact write shape and persists it, keyed
// on SyncContactLink.remoteUid = Google resourceName. Conflict detection
// compares the stored remoteETag against the current Google etag and the local
// contact's updatedAt against the link's lastSyncedAt, then applies the
// connection's ConflictPolicy (SERVER_WINS / DEVICE_WINS / MANUAL).

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

// Did the local contact change since we last synced this link?
const isLocalChanged = (
  lastSyncedAt: Date | null,
  contactUpdatedAt: Date | undefined,
): boolean =>
  lastSyncedAt == null || (contactUpdatedAt?.getTime() ?? 0) > lastSyncedAt.getTime();

// Apply a remote Person over the linked local contact (remote-wins path).
const applyRemoteToContact = async (
  account: GoogleImportAccount,
  linkId: string,
  contactId: string,
  data: ReturnType<typeof contactWriteData>,
  resourceName: string,
  etag: string | null,
  now: Date,
) => {
  await db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: contactId },
      data: {
        ...data,
        lastMutatedBy: "SYNC_GOOGLE",
        lastMutatedByDetail: account.label,
        syncVersion: { increment: 1 },
      },
    });
    await tx.syncContactLink.update({
      where: { id: linkId },
      data: {
        remoteHref: resourceName,
        remoteETag: etag,
        remoteDeletedAt: null,
        tombstonedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastSyncedAt: now,
      },
    });
    await emitEvent(tx, {
      userId: account.userId,
      contactId,
      eventType: "SYNC_PULLED",
      actor: "SYNC",
      actorDetail: account.label,
      payload: { syncAccountId: account.id, syncAccountLabel: account.label },
    });
  });
};

type LinkedContact = {
  id: string;
  contactId: string;
  remoteETag: string | null;
  lastSyncedAt: Date | null;
  contact: Prisma.ContactGetPayload<{ select: typeof contactConflictSelect }> | null;
};

// Resolve a Google-side tombstone (metadata.deleted) per the conflict policy.
const handleGoogleTombstone = async (
  account: GoogleImportAccount,
  link: LinkedContact,
  remoteUid: string,
  now: Date,
  summary: GoogleBatchSummary,
) => {
  const contact = link.contact;
  // Already archived or contact gone — just settle the link.
  if (!contact || contact.archivedAt) {
    await db.syncContactLink.update({
      where: { id: link.id },
      data: { remoteDeletedAt: now, tombstonedAt: now, lastSyncedAt: now },
    });
    return;
  }

  const localChanged = isLocalChanged(link.lastSyncedAt, contact.updatedAt);

  // MANUAL, or a delete-vs-local-edit clash under no auto-policy → review queue.
  if (account.conflictPolicy === "MANUAL") {
    await db.$transaction(async (tx) => {
      const conflict = await tx.syncConflict.create({
        data: {
          syncAccountId: account.id,
          syncContactLinkId: link.id,
          contactId: contact.id,
          conflictType: "DELETE_CONFLICT",
          status: "OPEN",
          localSyncVersion: contact.syncVersion,
          remoteETag: null,
          localSnapshot: buildLocalConflictSnapshot(contact),
          remoteSnapshot: { deleted: true, remoteUid },
          resolutionNotes: "Contact deleted on Google while it still exists in Kontax.",
        },
        select: { id: true },
      });
      await emitEvent(tx, {
        userId: account.userId,
        contactId: contact.id,
        eventType: "SYNC_CONFLICT_DETECTED",
        actor: "SYNC",
        actorDetail: account.label,
        payload: { conflictId: conflict.id, conflictType: "DELETE_CONFLICT" },
      });
    });
    summary.conflicts += 1;
    return;
  }

  // DEVICE_WINS keeps the locally-edited contact; the remote delete is ignored.
  if (account.conflictPolicy === "DEVICE_WINS" && localChanged) {
    await db.$transaction(async (tx) => {
      await tx.syncConflict.create({
        data: {
          syncAccountId: account.id,
          syncContactLinkId: link.id,
          contactId: contact.id,
          conflictType: "DELETE_CONFLICT",
          status: "AUTO_RESOLVED",
          resolutionStrategy: "KEEP_LOCAL",
          resolvedAt: now,
          localSyncVersion: contact.syncVersion,
          localSnapshot: buildLocalConflictSnapshot(contact),
          remoteSnapshot: { deleted: true },
          resolutionNotes: "Auto-resolved by Kontax-wins: remote delete ignored, local kept.",
        },
      });
      await tx.syncContactLink.update({
        where: { id: link.id },
        data: { remoteDeletedAt: now, tombstonedAt: now, lastSyncedAt: now },
      });
    });
    return;
  }

  // SERVER_WINS (or DEVICE_WINS with no local edit): apply the delete as an
  // archive (soft delete — never a hard delete).
  await db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: contact.id },
      data: {
        archivedAt: now,
        lastMutatedBy: "SYNC_GOOGLE",
        lastMutatedByDetail: account.label,
        syncVersion: { increment: 1 },
      },
    });
    await tx.syncContactLink.update({
      where: { id: link.id },
      data: { remoteDeletedAt: now, tombstonedAt: now, remoteETag: null, lastSyncedAt: now },
    });
    await emitEvent(tx, {
      userId: account.userId,
      contactId: contact.id,
      eventType: "CONTACT_DELETED",
      actor: "SYNC",
      actorDetail: account.label,
      payload: {
        fullName: contact.fullName,
        ...(contact.email ? { email: contact.email } : {}),
        ...(contact.phone ? { phone: contact.phone } : {}),
      },
    });
  });
  summary.deleted += 1;
};

// Record a MANUAL-policy local↔remote conflict for the review queue.
const openMutationConflict = async (
  account: GoogleImportAccount,
  link: LinkedContact,
  contact: ContactConflictSnapshotInput,
  person: people_v1.Schema$Person,
  etag: string | null,
) => {
  await db.$transaction(async (tx) => {
    const conflict = await tx.syncConflict.create({
      data: {
        syncAccountId: account.id,
        syncContactLinkId: link.id,
        contactId: contact.id,
        conflictType: "LOCAL_REMOTE_MUTATION",
        status: "OPEN",
        localSyncVersion: contact.syncVersion,
        remoteETag: etag,
        localSnapshot: buildLocalConflictSnapshot(contact),
        remoteSnapshot: person as Prisma.InputJsonValue,
        resolutionNotes: "Both Kontax and Google changed this contact since the last sync.",
      },
      select: { id: true },
    });
    await emitEvent(tx, {
      userId: account.userId,
      contactId: contact.id,
      eventType: "SYNC_CONFLICT_DETECTED",
      actor: "SYNC",
      actorDetail: account.label,
      payload: {
        conflictId: conflict.id,
        conflictType: "LOCAL_REMOTE_MUTATION",
        remoteETag: etag ?? undefined,
      },
    });
  });
};

// Write an AUTO_RESOLVED audit row for a policy-resolved mutation conflict.
const recordAutoResolved = async (
  account: GoogleImportAccount,
  link: LinkedContact,
  contact: ContactConflictSnapshotInput,
  person: people_v1.Schema$Person,
  etag: string | null,
  strategy: "KEEP_REMOTE" | "KEEP_LOCAL",
  now: Date,
) => {
  await db.syncConflict.create({
    data: {
      syncAccountId: account.id,
      syncContactLinkId: link.id,
      contactId: contact.id,
      conflictType: "LOCAL_REMOTE_MUTATION",
      status: "AUTO_RESOLVED",
      resolutionStrategy: strategy,
      resolvedAt: now,
      localSyncVersion: contact.syncVersion,
      remoteETag: etag,
      localSnapshot: buildLocalConflictSnapshot(contact),
      remoteSnapshot: person as Prisma.InputJsonValue,
      resolutionNotes:
        strategy === "KEEP_REMOTE"
          ? "Auto-resolved by Server-wins: Google's change applied."
          : "Auto-resolved by Kontax-wins: local change kept.",
    },
  });
};

export const processGoogleContacts = async (
  connections: people_v1.Schema$Person[],
  account: GoogleImportAccount,
): Promise<GoogleBatchSummary> => {
  const summary = emptyBatch();
  const now = new Date();

  for (const person of connections) {
    const resourceName = person.resourceName;
    if (!resourceName) continue;
    const etag = person.etag ?? null;

    const link: LinkedContact | null = await db.syncContactLink.findUnique({
      where: {
        syncAccountId_remoteUid: { syncAccountId: account.id, remoteUid: resourceName },
      },
      select: {
        id: true,
        contactId: true,
        remoteETag: true,
        lastSyncedAt: true,
        contact: { select: contactConflictSelect },
      },
    });

    // Tombstone (incremental-sync delete marker).
    if (person.metadata?.deleted) {
      if (link) await handleGoogleTombstone(account, link, resourceName, now, summary);
      continue;
    }

    const mapped = mapGooglePersonToContact(person);
    if (!mapped) continue;
    const data = contactWriteData(mapped);

    // New contact — create it. syncUid is left to default (cuid): Google
    // resourceName is only unique within the account, so it lives on
    // SyncContactLink.remoteUid, not the globally-unique Contact.syncUid.
    if (!link?.contact) {
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
      continue;
    }

    const remoteChanged = etag !== link.remoteETag;
    const localChanged = isLocalChanged(link.lastSyncedAt, link.contact.updatedAt);

    if (remoteChanged && localChanged) {
      // Both sides changed — resolve by policy.
      if (account.conflictPolicy === "SERVER_WINS") {
        await applyRemoteToContact(account, link.id, link.contactId, data, resourceName, etag, now);
        await recordAutoResolved(account, link, link.contact, person, etag, "KEEP_REMOTE", now);
        summary.updated += 1;
      } else if (account.conflictPolicy === "DEVICE_WINS") {
        // Keep the local edit; a future push carries it to Google. Do not apply
        // the remote snapshot or advance the link etag.
        await recordAutoResolved(account, link, link.contact, person, etag, "KEEP_LOCAL", now);
      } else {
        // MANUAL — surface for review; apply neither side.
        await openMutationConflict(account, link, link.contact, person, etag);
        summary.conflicts += 1;
      }
      continue;
    }

    if (remoteChanged) {
      // Only remote changed — apply it.
      await applyRemoteToContact(account, link.id, link.contactId, data, resourceName, etag, now);
      summary.updated += 1;
      continue;
    }

    // No remote change (etag matches). Refresh the link's sync marker so the
    // local-change window is anchored to this successful pull.
    await db.syncContactLink.update({
      where: { id: link.id },
      data: { remoteETag: etag, lastSyncedAt: now },
    });
  }

  return summary;
};

// Attach the queue-full flag (drives the runner's auto-pause) by counting the
// account's OPEN manual conflicts after the import settles.
const finalizeImportSummary = async (
  account: GoogleImportAccount,
  batch: GoogleBatchSummary,
): Promise<GoogleImportSummary> => {
  const openConflicts = await db.syncConflict.count({
    where: { syncAccountId: account.id, status: "OPEN" },
  });
  return { ...batch, queueFull: openConflicts >= MANUAL_CONFLICT_QUEUE_LIMIT };
};

// ── Full import ──────────────────────────────────────────────────────────────

export const googleFullImport = async (
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> => {
  const { client } = await getGoogleClientForAccount(account);
  const people = google.people({ version: "v1", auth: client });

  let pageToken: string | undefined;
  let syncToken: string | undefined;
  let batch = emptyBatch();

  try {
    do {
      const response = await people.people.connections.list({
        resourceName: "people/me",
        pageSize: 1000,
        personFields: GOOGLE_PERSON_FIELDS,
        pageToken,
        requestSyncToken: true,
      });

      batch = addBatch(
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

// Runner entrypoint: pick full vs incremental based on stored cursor.
export const runGoogleSync = async (
  account: GoogleImportAccount,
): Promise<GoogleImportSummary> =>
  account.lastSyncCursor ? googleIncrementalSync(account) : googleFullImport(account);

// ── Push phase (P27-03) ──────────────────────────────────────────────────────
// Pushes a local contact to Google. updatePersonFields excludes read-only
// fields (metadata/photos). On a 409/412 (remote changed since our etag) the
// push is treated as a conflict against the freshly-fetched remote version.
//
// NOTE: no provider has push scheduling wired into the runner yet (CardDAV is
// pull-only too). This is the connector capability a future push-scheduling
// ticket invokes; it is unit-callable but not yet driven by runQueuedSyncJobs.
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
  const people = google.people({ version: "v1", auth: client });

  const body = mapContactToGooglePerson(contact);
  // Google requires the current etag in the body for optimistic concurrency.
  body.etag = link.remoteETag ?? undefined;

  try {
    const res = await people.people.updateContact({
      resourceName: link.remoteUid,
      updatePersonFields: GOOGLE_UPDATE_PERSON_FIELDS,
      requestBody: body,
    });
    await db.syncContactLink.update({
      where: { id: link.id },
      data: { remoteETag: res.data.etag ?? null, lastSyncedAt: new Date() },
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
    const got = await people.people.get({
      resourceName: link.remoteUid,
      personFields: GOOGLE_PERSON_FIELDS,
    });
    latest = got.data;
  } catch (error) {
    throw normaliseGoogleError(error);
  }

  const now = new Date();
  // The conflict helpers take the local snapshot separately, so link.contact is
  // unused here and left null.
  const linkedContact: LinkedContact = {
    id: link.id,
    contactId: link.contactId,
    remoteETag: link.remoteETag,
    lastSyncedAt: null,
    contact: null,
  };
  const latestEtag = latest.etag ?? null;

  if (account.conflictPolicy === "SERVER_WINS") {
    const mapped = mapGooglePersonToContact(latest);
    if (mapped) {
      await applyRemoteToContact(
        account,
        link.id,
        link.contactId,
        contactWriteData(mapped),
        link.remoteUid,
        latestEtag,
        now,
      );
    }
    await recordAutoResolved(account, linkedContact, contact, latest, latestEtag, "KEEP_REMOTE", now);
    return { ok: false, conflict: true, strategy: "KEEP_REMOTE" };
  }

  if (account.conflictPolicy === "DEVICE_WINS") {
    // Kontax wins — retry the push with the fresh etag to overwrite remote.
    const retryBody = mapContactToGooglePerson(contact);
    retryBody.etag = latestEtag ?? undefined;
    const res = await people.people.updateContact({
      resourceName: link.remoteUid,
      updatePersonFields: GOOGLE_UPDATE_PERSON_FIELDS,
      requestBody: retryBody,
    });
    await db.syncContactLink.update({
      where: { id: link.id },
      data: { remoteETag: res.data.etag ?? null, lastSyncedAt: now },
    });
    await recordAutoResolved(account, linkedContact, contact, latest, latestEtag, "KEEP_LOCAL", now);
    return { ok: false, conflict: true, strategy: "KEEP_LOCAL" };
  }

  // MANUAL — surface for review; leave both sides as-is.
  await openMutationConflict(account, linkedContact, contact, latest, latestEtag);
  return { ok: false, conflict: true, strategy: "MANUAL" };
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
