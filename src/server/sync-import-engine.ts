// Shared conflict-aware import engine for OAuth sync connectors (Google P27-03,
// Microsoft P27-06). Connectors normalise each remote record into a
// RemoteContactItem and hand a batch to importRemoteContactBatch; the engine
// owns create/update, conflict detection (etag vs stored remoteETag, local
// updatedAt vs link lastSyncedAt), policy enforcement (SERVER_WINS /
// DEVICE_WINS / MANUAL), tombstone handling, and SyncConflict bookkeeping.
import type { ConflictPolicy, Prisma, SourceType } from "../../generated/prisma";

import { emitEvent } from "~/lib/activity";
import {
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";
import { db } from "~/server/db";
import {
  buildLocalConflictSnapshot,
  type ContactConflictSnapshotInput,
  contactConflictSelect,
} from "~/server/sync-conflict-snapshot";
import {
  type MappedContact,
  mappedContactToPortableContact,
  mappedContactToWriteData,
} from "~/server/sync-contact-mapping";
import { MANUAL_CONFLICT_QUEUE_LIMIT } from "~/server/sync-health";
import {
  buildProviderCapabilityDiagnostics,
  buildProviderSupportedContactShadow,
  type ProviderCapabilityDiagnostics,
  providerSupportedShadowsEqual,
  type SyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";

export type ImportEngineAccount = {
  id: string;
  userId: string;
  label: string;
  conflictPolicy: ConflictPolicy;
  capabilityProfile: SyncProviderCapabilityProfile;
  // Source/mutation provenance stamped on imported contacts.
  sourceType: Extract<SourceType, "SYNC_GOOGLE" | "SYNC_MICROSOFT">;
  // Human provider name used in conflict resolution notes ("Google", "Outlook").
  providerName: string;
};

const parseValueEntries = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as { value?: unknown }).value !== "string"
        ) {
          return [];
        }

        return [
          {
            label:
              typeof (entry as { label?: unknown }).label === "string"
                ? (entry as { label: string }).label
                : "Other",
            value: (entry as { value: string }).value,
            isPrimary: (entry as { isPrimary?: unknown }).isPrimary === true,
          },
        ];
      })
    : [];

const parseAddressEntries = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as { formatted?: unknown }).formatted !== "string"
        ) {
          return [];
        }

        return [
          {
            label:
              typeof (entry as { label?: unknown }).label === "string"
                ? (entry as { label: string }).label
                : "Other",
            formatted: (entry as { formatted: string }).formatted,
            isPrimary: (entry as { isPrimary?: unknown }).isPrimary === true,
            ...(typeof (entry as { countryOrRegion?: unknown }).countryOrRegion === "string"
              ? { countryOrRegion: (entry as { countryOrRegion: string }).countryOrRegion }
              : {}),
            ...(typeof (entry as { streetLine1?: unknown }).streetLine1 === "string"
              ? { streetLine1: (entry as { streetLine1: string }).streetLine1 }
              : {}),
            ...(typeof (entry as { streetLine2?: unknown }).streetLine2 === "string"
              ? { streetLine2: (entry as { streetLine2: string }).streetLine2 }
              : {}),
            ...(typeof (entry as { cityOrTown?: unknown }).cityOrTown === "string"
              ? { cityOrTown: (entry as { cityOrTown: string }).cityOrTown }
              : {}),
            ...(typeof (entry as { stateOrProvince?: unknown }).stateOrProvince === "string"
              ? { stateOrProvince: (entry as { stateOrProvince: string }).stateOrProvince }
              : {}),
            ...(typeof (entry as { postcode?: unknown }).postcode === "string"
              ? { postcode: (entry as { postcode: string }).postcode }
              : {}),
            ...(typeof (entry as { poBox?: unknown }).poBox === "string"
              ? { poBox: (entry as { poBox: string }).poBox }
              : {}),
          },
        ];
      })
    : [];

const linkedContactToPortable = (
  contact: NonNullable<LinkedContact["contact"]>,
) => ({
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
  address: contact.address,
  postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
  addressEntries: parseAddressEntries(contact.addressEntries),
  notes: contact.notes,
});

const capabilityDiagnosticsToEventPayload = (
  diagnostics: ProviderCapabilityDiagnostics | null,
) =>
  diagnostics
    ? {
        unsupportedFieldFamilies: diagnostics.unsupportedFieldFamilies,
        unsupportedFieldCount: diagnostics.unsupportedFieldCount,
      }
    : {};

// One normalised remote record. `mapped` is null to skip (unmappable); `deleted`
// flags a tombstone; `remoteSnapshot` is the raw remote object stored on
// conflict rows.
export type RemoteContactItem = {
  remoteUid: string;
  etag: string | null;
  deleted: boolean;
  mapped: MappedContact | null;
  remoteSnapshot: Prisma.InputJsonValue;
};

export type ImportBatchSummary = {
  created: number;
  updated: number;
  deleted: number;
  conflicts: number;
};

export const emptyImportBatch = (): ImportBatchSummary => ({
  created: 0,
  updated: 0,
  deleted: 0,
  conflicts: 0,
});

export const addImportBatch = (a: ImportBatchSummary, b: ImportBatchSummary): ImportBatchSummary => ({
  created: a.created + b.created,
  updated: a.updated + b.updated,
  deleted: a.deleted + b.deleted,
  conflicts: a.conflicts + b.conflicts,
});

export const linkedContactSelect = {
  id: true,
  contactId: true,
  remoteETag: true,
  capabilityProfileId: true,
  supportedFieldShadow: true,
  lastSyncedAt: true,
  contact: {
    select: {
      ...contactConflictSelect,
      emailEntries: true,
      phoneEntries: true,
      department: true,
      websiteEntries: true,
      addressEntries: true,
    },
  },
} as const;

export type LinkedContact = Prisma.SyncContactLinkGetPayload<{
  select: typeof linkedContactSelect;
}>;

// Did the local contact change since we last synced this link?
export const isLocalChanged = (
  lastSyncedAt: Date | null,
  contactUpdatedAt: Date | undefined,
): boolean =>
  lastSyncedAt == null || (contactUpdatedAt?.getTime() ?? 0) > lastSyncedAt.getTime();

// Apply a mapped remote contact over the linked local contact (remote-wins).
export const applyRemoteToContact = async (
  account: ImportEngineAccount,
  linkId: string,
  contactId: string,
  mapped: MappedContact,
  remoteUid: string,
  etag: string | null,
  now: Date,
  capabilityDiagnostics: ProviderCapabilityDiagnostics | null = null,
) => {
  const data = mappedContactToWriteData(mapped);
  const supportedFieldShadow = buildProviderSupportedContactShadow(
    mappedContactToPortableContact(mapped),
    account.capabilityProfile,
  );
  await db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: contactId },
      data: {
        ...data,
        lastMutatedBy: account.sourceType,
        lastMutatedByDetail: account.label,
        syncVersion: { increment: 1 },
      },
    });
    await tx.syncContactLink.update({
      where: { id: linkId },
      data: {
        remoteHref: remoteUid,
        remoteETag: etag,
        capabilityProfileId: account.capabilityProfile.id,
        supportedFieldShadow: supportedFieldShadow as Prisma.InputJsonValue,
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
      payload: {
        syncAccountId: account.id,
        syncAccountLabel: account.label,
        ...capabilityDiagnosticsToEventPayload(capabilityDiagnostics),
      },
    });
  });
};

// Record a MANUAL-policy local↔remote mutation conflict for the review queue.
export const openMutationConflict = async (
  account: ImportEngineAccount,
  link: { id: string },
  contact: ContactConflictSnapshotInput,
  remoteSnapshot: Prisma.InputJsonValue,
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
        remoteSnapshot,
        resolutionNotes: `Both Kontax and ${account.providerName} changed this contact since the last sync.`,
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
export const recordAutoResolved = async (
  account: ImportEngineAccount,
  link: { id: string },
  contact: ContactConflictSnapshotInput,
  remoteSnapshot: Prisma.InputJsonValue,
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
      remoteSnapshot,
      resolutionNotes:
        strategy === "KEEP_REMOTE"
          ? `Auto-resolved by Server-wins: ${account.providerName}'s change applied.`
          : "Auto-resolved by Kontax-wins: local change kept.",
    },
  });
};

// Resolve a remote tombstone per the conflict policy.
const handleTombstone = async (
  account: ImportEngineAccount,
  link: LinkedContact,
  remoteUid: string,
  now: Date,
  summary: ImportBatchSummary,
) => {
  const contact = link.contact;
  if (!contact || contact.archivedAt) {
    await db.syncContactLink.update({
      where: { id: link.id },
      data: { remoteDeletedAt: now, tombstonedAt: now, lastSyncedAt: now },
    });
    return;
  }

  const localChanged = isLocalChanged(link.lastSyncedAt, contact.updatedAt);

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
          resolutionNotes: `Contact deleted on ${account.providerName} while it still exists in Kontax.`,
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

  // DEVICE_WINS keeps a locally-edited contact; the remote delete is ignored.
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
        lastMutatedBy: account.sourceType,
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

// Create a brand-new local contact + link from a remote item. syncUid is left
// to default (cuid) — the remote id is only unique within the account, so it
// lives on SyncContactLink.remoteUid, not the globally-unique Contact.syncUid.
const createContact = async (
  account: ImportEngineAccount,
  item: RemoteContactItem,
  mapped: MappedContact,
  now: Date,
) => {
  const data = mappedContactToWriteData(mapped);
  const supportedFieldShadow = buildProviderSupportedContactShadow(
    mappedContactToPortableContact(mapped),
    account.capabilityProfile,
  );
  await db.$transaction(async (tx) => {
    const created = await tx.contact.create({
      data: {
        userId: account.userId,
        ...data,
        sourceType: account.sourceType,
        sourceDetail: account.label,
        lastMutatedBy: account.sourceType,
        lastMutatedByDetail: account.label,
      },
      select: { id: true },
    });
    await tx.syncContactLink.create({
      data: {
        syncAccountId: account.id,
        contactId: created.id,
        remoteHref: item.remoteUid,
        remoteUid: item.remoteUid,
        remoteETag: item.etag,
        capabilityProfileId: account.capabilityProfile.id,
        supportedFieldShadow: supportedFieldShadow as Prisma.InputJsonValue,
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
};

// Process a batch of normalised remote items: create / update / conflict /
// tombstone according to link state and the conflict policy.
export const importRemoteContactBatch = async (
  account: ImportEngineAccount,
  items: RemoteContactItem[],
): Promise<ImportBatchSummary> => {
  const summary = emptyImportBatch();
  const now = new Date();

  for (const item of items) {
    if (!item.remoteUid) continue;

    const link: LinkedContact | null = await db.syncContactLink.findUnique({
      where: {
        syncAccountId_remoteUid: { syncAccountId: account.id, remoteUid: item.remoteUid },
      },
      select: linkedContactSelect,
    });

    // Tombstone.
    if (item.deleted) {
      if (link) await handleTombstone(account, link, item.remoteUid, now, summary);
      continue;
    }

    if (!item.mapped) continue;

    // New contact.
    if (!link) {
      await createContact(account, item, item.mapped, now);
      summary.created += 1;
      continue;
    }
    // Defensive: link row without a contact shouldn't occur (cascade delete),
    // skip rather than risk a duplicate-link unique violation.
    if (!link.contact) continue;

    const remoteChanged = item.etag !== link.remoteETag;
    const localChanged = isLocalChanged(link.lastSyncedAt, link.contact.updatedAt);
    const localSupportedShadow = buildProviderSupportedContactShadow(
      linkedContactToPortable(link.contact),
      account.capabilityProfile,
    );
    const remoteSupportedShadow = buildProviderSupportedContactShadow(
      mappedContactToPortableContact(item.mapped),
      account.capabilityProfile,
    );
    const supportedFieldsDiffer = !providerSupportedShadowsEqual(
      localSupportedShadow,
      remoteSupportedShadow,
    );
    const localSupportedChanged = localChanged && supportedFieldsDiffer;
    const remoteSupportedChanged = remoteChanged && supportedFieldsDiffer;

    if (remoteSupportedChanged && localSupportedChanged) {
      if (account.conflictPolicy === "SERVER_WINS") {
        await applyRemoteToContact(
          account,
          link.id,
          link.contactId,
          item.mapped,
          item.remoteUid,
          item.etag,
          now,
          buildProviderCapabilityDiagnostics(
            linkedContactToPortable(link.contact),
            account.capabilityProfile,
          ),
        );
        await recordAutoResolved(account, link, link.contact, item.remoteSnapshot, item.etag, "KEEP_REMOTE", now);
        summary.updated += 1;
      } else if (account.conflictPolicy === "DEVICE_WINS") {
        // Keep local; a future push carries it. Do not apply remote or advance etag.
        await recordAutoResolved(account, link, link.contact, item.remoteSnapshot, item.etag, "KEEP_LOCAL", now);
      } else {
        await openMutationConflict(account, link, link.contact, item.remoteSnapshot, item.etag);
        summary.conflicts += 1;
      }
      continue;
    }

    if (remoteSupportedChanged) {
      await applyRemoteToContact(
        account,
        link.id,
        link.contactId,
        item.mapped,
        item.remoteUid,
        item.etag,
        now,
        buildProviderCapabilityDiagnostics(
          linkedContactToPortable(link.contact),
          account.capabilityProfile,
        ),
      );
      summary.updated += 1;
      continue;
    }

    // No remote change — anchor the link's sync marker to this pull.
    await db.syncContactLink.update({
      where: { id: link.id },
      data: {
        remoteETag: item.etag,
        capabilityProfileId: account.capabilityProfile.id,
        supportedFieldShadow: remoteSupportedShadow as Prisma.InputJsonValue,
        lastSyncedAt: now,
      },
    });
  }

  return summary;
};

// queueFull flag (drives the runner auto-pause): true when the account's OPEN
// manual conflicts reach the limit.
export const isConflictQueueFull = async (syncAccountId: string): Promise<boolean> => {
  const open = await db.syncConflict.count({
    where: { syncAccountId, status: "OPEN" },
  });
  return open >= MANUAL_CONFLICT_QUEUE_LIMIT;
};
