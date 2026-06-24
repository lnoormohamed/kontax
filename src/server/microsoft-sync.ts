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

import type { ConflictPolicy, Prisma, SyncDirection } from "../../generated/prisma";
import { env } from "~/env";
import { emitEvent } from "~/lib/activity";
import { db } from "~/server/db";
import {
  parseContactDateEntries,
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";
import {
  type GraphContact,
  type GraphContactSource,
  mapGraphContactToKontax,
  mapKontaxContactToGraph,
} from "~/server/microsoft-sync-mapping";
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
  buildProviderCapabilityDiagnostics,
  buildProviderSupportedContactShadow,
  resolveSyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";
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
  // 410 Gone = the stored delta link is stale; the caller must do a full re-sync.
  // Carry it as a stable code since the HTTP status is otherwise lost here.
  if (status === 410) {
    return new MicrosoftSyncError("MICROSOFT_DELTA_EXPIRED", message);
  }
  return new MicrosoftSyncError("MICROSOFT_SYNC_FAILED", message);
};

// ── account context ──────────────────────────────────────────────────────────

type MicrosoftSyncAccount = { id: string; credentialReference: string | null };

export type MicrosoftImportAccount = MicrosoftSyncAccount & {
  userId: string;
  label: string;
  lastSyncCursor: string | null;
  conflictPolicy: ConflictPolicy;
  // Drives the push phase: only TWO_WAY / EXPORT_ONLY accounts push local edits.
  syncDirection: SyncDirection;
};

// Whole-import result the runner records; queueFull drives the auto-pause.
export type MicrosoftImportSummary = ImportBatchSummary & { queueFull: boolean };

// Full sync result: inbound import + outbound push tallies, recorded separately.
export type MicrosoftSyncResult = MicrosoftImportSummary & {
  pushedCreated: number;
  pushedUpdated: number;
  pushedDeleted: number;
};

// Engine account context for Microsoft (adds source/provider provenance).
const toEngineAccount = (account: MicrosoftImportAccount): ImportEngineAccount => ({
  id: account.id,
  userId: account.userId,
  label: account.label,
  conflictPolicy: account.conflictPolicy,
  capabilityProfile: resolveSyncProviderCapabilityProfile({ provider: "MICROSOFT" }),
  sourceType: "SYNC_MICROSOFT",
  providerName: "Outlook",
});

const MICROSOFT_CAPABILITY_PROFILE = resolveSyncProviderCapabilityProfile({
  provider: "MICROSOFT",
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

// ── Contact processing (P27-05 mapping + P27-06 conflicts) ───────────────────
// Normalise each Graph contact into a RemoteContactItem and hand the batch to
// the shared import engine, which owns create/update/conflict/tombstone logic.
export const processMicrosoftContacts = async (
  contacts: unknown[],
  account: MicrosoftImportAccount,
): Promise<ImportBatchSummary> => {
  const items: RemoteContactItem[] = [];
  for (const raw of contacts) {
    const contact = raw as GraphContact;
    const remoteUid = contact.id;
    if (!remoteUid) continue;
    items.push({
      remoteUid,
      etag: contact["@odata.etag"] ?? null,
      deleted: Boolean(contact["@removed"]),
      mapped: mapGraphContactToKontax(contact),
      remoteSnapshot: contact,
    });
  }
  return importRemoteContactBatch(toEngineAccount(account), items);
};

// ── delta traversal (shared by full import + incremental) ────────────────────

// Walks all delta pages from startUrl, processing each page's contacts, and
// returns the final @odata.deltaLink for the next incremental sync.
const traverseDelta = async (
  account: MicrosoftImportAccount,
  startUrl: string,
): Promise<{ summary: ImportBatchSummary; deltaLink: string | null }> => {
  let summary = emptyImportBatch();
  let url: string | undefined = startUrl;
  let deltaLink: string | null = null;

  while (url) {
    // Re-acquire per page so a long multi-page import can't fail on an expired
    // token mid-traversal. acquireTokenSilent serves the cached token until it
    // nears expiry, so this is cheap.
    const accessToken = await getMicrosoftAccessToken(account);
    const page = await graphGet(accessToken, url);
    summary = addImportBatch(summary, await processMicrosoftContacts(page.value ?? [], account));
    if (page["@odata.nextLink"]) {
      url = page["@odata.nextLink"];
    } else {
      deltaLink = page["@odata.deltaLink"] ?? null;
      url = undefined;
    }
  }

  return { summary, deltaLink };
};

// Attach the queue-full flag by counting OPEN manual conflicts post-import.
const finalizeImportSummary = async (
  account: MicrosoftImportAccount,
  batch: ImportBatchSummary,
): Promise<MicrosoftImportSummary> => {
  return { ...batch, queueFull: await isConflictQueueFull(account.id) };
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

  return finalizeImportSummary(account, summary);
};

// ── incremental sync (resumes from the stored delta link) ─────────────────────

export const microsoftIncrementalSync = async (
  account: MicrosoftImportAccount,
): Promise<MicrosoftImportSummary> => {
  if (!account.lastSyncCursor) {
    return microsoftFullImport(account);
  }

  // A 410 Gone on a stale delta link means a full re-sync is required.
  let result: { summary: ImportBatchSummary; deltaLink: string | null };
  try {
    result = await traverseDelta(account, account.lastSyncCursor);
  } catch (error) {
    if (error instanceof MicrosoftSyncError && error.code === "MICROSOFT_DELTA_EXPIRED") {
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

  return finalizeImportSummary(account, result.summary);
};

// ── Push phase (P27-06) ──────────────────────────────────────────────────────
// PATCH /me/contacts/{id} with an If-Match etag header. A 412 Precondition
// Failed means the remote changed since our etag → fetch the latest and resolve
// by policy. Not yet wired into the runner (no provider has push scheduling).
export type MicrosoftPushContact = GraphContactSource & ContactConflictSnapshotInput;

export type MicrosoftPushLink = {
  id: string;
  contactId: string;
  remoteUid: string;
  remoteETag: string | null;
};

export type MicrosoftPushResult =
  | { ok: true }
  | { ok: false; conflict: true; strategy: "KEEP_REMOTE" | "KEEP_LOCAL" | "MANUAL" };

const graphPatchContact = async (
  accessToken: string,
  remoteUid: string,
  ifMatch: string,
  body: string,
): Promise<{ etag: string | null } | { status: number; message: string }> => {
  const res = await fetch(`${GRAPH_BASE}/me/contacts/${remoteUid}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "If-Match": ifMatch,
    },
    body,
  });
  if (!res.ok) {
    return { status: res.status, message: await res.text().catch(() => "") };
  }
  const updated = (await res.json()) as { "@odata.etag"?: string };
  return { etag: updated["@odata.etag"] ?? null };
};

export const pushMicrosoftContact = async (
  account: MicrosoftImportAccount,
  link: MicrosoftPushLink,
  contact: MicrosoftPushContact,
): Promise<MicrosoftPushResult> => {
  const accessToken = await getMicrosoftAccessToken(account);
  const body = JSON.stringify(mapKontaxContactToGraph(contact));

  const patched = await graphPatchContact(accessToken, link.remoteUid, link.remoteETag ?? "*", body);
  if ("etag" in patched) {
    const localShadow = buildMicrosoftPushShadow(contact);
    await db.syncContactLink.update({
      where: { id: link.id },
      data: {
        remoteETag: patched.etag,
        capabilityProfileId: MICROSOFT_CAPABILITY_PROFILE.id,
        supportedFieldShadow: localShadow as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
      },
    });
    return { ok: true };
  }
  if (patched.status !== 412) {
    throw normaliseMicrosoftError({ statusCode: patched.status, message: patched.message });
  }

  // 412 — remote changed under us. Fetch the latest and resolve by policy.
  const latestRes = await fetch(
    `${GRAPH_BASE}/me/contacts/${link.remoteUid}?$select=${encodeURIComponent(MICROSOFT_CONTACT_FIELDS)}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
  );
  if (!latestRes.ok) {
    throw normaliseMicrosoftError({
      statusCode: latestRes.status,
      message: await latestRes.text().catch(() => ""),
    });
  }
  const latest = (await latestRes.json()) as GraphContact;

  const now = new Date();
  const engineAccount = toEngineAccount(account);
  const latestEtag = latest["@odata.etag"] ?? null;
  const remoteSnapshot = latest as unknown as Prisma.InputJsonValue;

  if (account.conflictPolicy === "SERVER_WINS") {
    const mapped = mapGraphContactToKontax(latest);
    if (mapped) {
      await applyRemoteToContact(engineAccount, link.id, link.contactId, mapped, link.remoteUid, latestEtag, now);
    }
    await recordAutoResolved(engineAccount, { id: link.id }, contact, remoteSnapshot, latestEtag, "KEEP_REMOTE", now);
    return { ok: false, conflict: true, strategy: "KEEP_REMOTE" };
  }

  if (account.conflictPolicy === "DEVICE_WINS") {
    // Kontax wins — retry the PATCH with the fresh etag to overwrite remote.
    const retry = await graphPatchContact(accessToken, link.remoteUid, latestEtag ?? "*", body);
    if (!("etag" in retry)) {
      throw normaliseMicrosoftError({ statusCode: retry.status, message: retry.message });
    }
    const localShadow = buildMicrosoftPushShadow(contact);
    await db.syncContactLink.update({
      where: { id: link.id },
      data: {
        remoteETag: retry.etag,
        capabilityProfileId: MICROSOFT_CAPABILITY_PROFILE.id,
        supportedFieldShadow: localShadow as Prisma.InputJsonValue,
        lastSyncedAt: now,
      },
    });
    await recordAutoResolved(engineAccount, { id: link.id }, contact, remoteSnapshot, latestEtag, "KEEP_LOCAL", now);
    return { ok: false, conflict: true, strategy: "KEEP_LOCAL" };
  }

  await openMutationConflict(engineAccount, { id: link.id }, contact, remoteSnapshot, latestEtag);
  return { ok: false, conflict: true, strategy: "MANUAL" };
};

// ── Push phase wiring (P34D-03) ───────────────────────────────────────────────
// Mirrors the Google connector: create/update/delete local changes on Outlook,
// pushed BEFORE the import (the import re-anchors lastSyncedAt for unchanged
// contacts, which would otherwise mask local edits). NOTE: this connector cannot
// be run/verified until Microsoft OAuth is configured (Azure app registration).

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
  website: true,
  websiteEntries: true,
  company: true,
  department: true,
  jobTitle: true,
  birthday: true,
  significantDates: true,
  address: true,
  postalAddresses: true,
  notes: true,
} satisfies Prisma.ContactSelect;

type PushContactRow = Prisma.ContactGetPayload<{ select: typeof pushContactSelect }>;

const buildMicrosoftPushContact = (c: PushContactRow): MicrosoftPushContact => ({
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
  websiteEntries: parseValueEntries(c.websiteEntries),
  company: c.company,
  department: c.department,
  jobTitle: c.jobTitle,
  website: c.website,
  birthday: c.birthday,
  address: c.address,
  postalAddresses: c.postalAddresses,
  notes: c.notes,
});

const buildMicrosoftCapabilityDiagnostics = (contact: PushContactRow) =>
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
      websiteEntries: parseValueEntries(contact.websiteEntries),
      birthday: contact.birthday,
      significantDates: parseContactDateEntries(contact.significantDates),
      address: contact.address,
      postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
      notes: contact.notes,
    },
    MICROSOFT_CAPABILITY_PROFILE,
  );

const microsoftCapabilityDiagnosticsPayload = (contact: PushContactRow) => {
  const diagnostics = buildMicrosoftCapabilityDiagnostics(contact);
  return diagnostics
    ? {
        unsupportedFieldFamilies: diagnostics.unsupportedFieldFamilies,
        unsupportedFieldCount: diagnostics.unsupportedFieldCount,
      }
    : {};
};

const buildMicrosoftPushShadow = (contact: MicrosoftPushContact) =>
  buildProviderSupportedContactShadow(
    {
      fullName: contact.fullName ?? "",
      firstName: contact.firstName,
      middleName: contact.middleName,
      lastName: contact.lastName,
      namePrefix: contact.namePrefix,
      nameSuffix: contact.nameSuffix,
      nickname: contact.nickname ?? null,
      email: contact.email ?? null,
      emailAddresses:
        contact.emailEntries?.map((entry) => entry.value) ?? contact.emailAddresses ?? [],
      emailEntries: contact.emailEntries ?? [],
      phone: contact.phone ?? null,
      phoneNumbers: contact.phoneEntries?.map((entry) => entry.value) ?? [],
      phoneEntries: contact.phoneEntries ?? [],
      company: contact.company ?? null,
      department: contact.department ?? null,
      jobTitle: contact.jobTitle ?? null,
      website: contact.website ?? null,
      websiteEntries: contact.websiteEntries ?? [],
      birthday: contact.birthday ?? null,
      address: contact.address ?? null,
      postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
      notes: contact.notes ?? null,
    },
    MICROSOFT_CAPABILITY_PROFILE,
  );

// Create a brand-new Outlook contact, then link it.
const createMicrosoftContactRemote = async (
  account: MicrosoftImportAccount,
  contact: PushContactRow,
): Promise<boolean> => {
  const accessToken = await getMicrosoftAccessToken(account);
  const res = await fetch(`${GRAPH_BASE}/me/contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(mapKontaxContactToGraph(buildMicrosoftPushContact(contact))),
  });
  if (!res.ok) {
    throw normaliseMicrosoftError({ statusCode: res.status, message: await res.text().catch(() => "") });
  }
  const created = (await res.json()) as { id?: string; "@odata.etag"?: string };
  if (!created.id) return false;
  await db.syncContactLink.create({
    data: {
      syncAccountId: account.id,
      contactId: contact.id,
      remoteHref: created.id,
      remoteUid: created.id,
      remoteETag: created["@odata.etag"] ?? null,
      capabilityProfileId: MICROSOFT_CAPABILITY_PROFILE.id,
      supportedFieldShadow: buildMicrosoftPushShadow(
        buildMicrosoftPushContact(contact),
      ) as Prisma.InputJsonValue,
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
      ...microsoftCapabilityDiagnosticsPayload(contact),
    },
  });
  return true;
};

// Delete an Outlook contact removed locally, then tombstone the link. A 404
// (already gone remotely) is treated as success.
const deleteMicrosoftContactRemote = async (
  account: MicrosoftImportAccount,
  link: { id: string; remoteUid: string },
): Promise<void> => {
  const accessToken = await getMicrosoftAccessToken(account);
  const res = await fetch(`${GRAPH_BASE}/me/contacts/${link.remoteUid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw normaliseMicrosoftError({ statusCode: res.status, message: await res.text().catch(() => "") });
  }
  const now = new Date();
  await db.syncContactLink.update({
    where: { id: link.id },
    data: { tombstonedAt: now, remoteDeletedAt: now, lastSyncedAt: now },
  });
};

export const pushLocalChangesToMicrosoft = async (
  account: MicrosoftImportAccount,
): Promise<{ created: number; updated: number; deleted: number; conflicts: number }> => {
  if (account.syncDirection !== "TWO_WAY" && account.syncDirection !== "EXPORT_ONLY") {
    return { created: 0, updated: 0, deleted: 0, conflicts: 0 };
  }

  let created = 0;
  let updated = 0;
  let deleted = 0;
  let conflicts = 0;

  // 1) UPDATES — active, locally-edited contacts already linked. Only genuine
  //    user edits (lastMutatedBy = MANUAL) to avoid the push/import feedback loop.
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
    const result = await pushMicrosoftContact(
      account,
      {
        id: link.id,
        contactId: link.contactId,
        remoteUid: link.remoteUid,
        remoteETag: link.remoteETag,
      },
      buildMicrosoftPushContact(link.contact),
    );
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
          ...microsoftCapabilityDiagnosticsPayload(link.contact),
        },
      });
      updated += 1;
    } else {
      conflicts += 1;
    }
  }

  // 2) CREATES — user-created local contacts not yet on Outlook.
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
    if (await createMicrosoftContactRemote(account, contact)) {
      created += 1;
    }
  }

  // 3) DELETES — contacts removed locally but still present on Outlook.
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
    await deleteMicrosoftContactRemote(account, { id: link.id, remoteUid: link.remoteUid });
    deleted += 1;
  }

  return { created, updated, deleted, conflicts };
};

// Runner entrypoint. Push local changes first, then pull; direction gates each
// half. Inbound + outbound tallies are reported separately.
export const runMicrosoftSync = async (
  account: MicrosoftImportAccount,
): Promise<MicrosoftSyncResult> => {
  const outbound =
    account.syncDirection === "TWO_WAY" || account.syncDirection === "EXPORT_ONLY";
  const inbound =
    account.syncDirection === "TWO_WAY" || account.syncDirection === "IMPORT_ONLY";

  const push = outbound
    ? await pushLocalChangesToMicrosoft(account)
    : { created: 0, updated: 0, deleted: 0, conflicts: 0 };

  const importSummary: MicrosoftImportSummary = inbound
    ? account.lastSyncCursor
      ? await microsoftIncrementalSync(account)
      : await microsoftFullImport(account)
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
    queueFull:
      push.conflicts > 0 ? await isConflictQueueFull(account.id) : importSummary.queueFull,
    pushedCreated: push.created,
    pushedUpdated: push.updated,
    pushedDeleted: push.deleted,
  };
};

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
