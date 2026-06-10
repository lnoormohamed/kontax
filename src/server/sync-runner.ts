import type { Prisma } from "../../generated/prisma";
import {
  CardDavPreflightError,
  fetchCardDavAddressBookCards,
  fetchCardDavAddressBookIndex,
} from "~/server/carddav";
import { parseContactPostalAddresses, parseContactStringArray } from "~/server/contact-portability";
import { db } from "~/server/db";
import { emitEvent } from "~/lib/activity";
import {
  AUTO_PAUSE_FAILURE_STREAK,
  getConsecutiveFailureStreak,
  getSyncErrorSupportBucket,
} from "~/server/sync-health";
import { decryptSyncCredentialPayload } from "~/server/sync-credentials";

const createRetrySchedule = (attemptNumber: number) => {
  const backoffMinutes = [5, 15, 60, 180, 720];
  const minutes = backoffMinutes[Math.min(Math.max(attemptNumber, 1), backoffMinutes.length) - 1]!;
  return new Date(Date.now() + minutes * 60 * 1000);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const buildLocalConflictSnapshot = (contact: {
  id: string;
  syncUid: string;
  syncVersion: number;
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  namePrefix: string | null;
  nameSuffix: string | null;
  nickname: string | null;
  email: string | null;
  emailAddresses: unknown;
  phone: string | null;
  phoneNumbers: unknown;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  birthday: string | null;
  address: string | null;
  postalAddresses: unknown;
  notes: string | null;
}) => ({
  id: contact.id,
  syncUid: contact.syncUid,
  syncVersion: contact.syncVersion,
  fullName: contact.fullName,
  firstName: contact.firstName,
  middleName: contact.middleName,
  lastName: contact.lastName,
  namePrefix: contact.namePrefix,
  nameSuffix: contact.nameSuffix,
  nickname: contact.nickname,
  email: contact.email,
  emailAddresses: parseContactStringArray(contact.emailAddresses),
  phone: contact.phone,
  phoneNumbers: parseContactStringArray(contact.phoneNumbers),
  company: contact.company,
  jobTitle: contact.jobTitle,
  website: contact.website,
  birthday: contact.birthday,
  address: contact.address,
  postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
  notes: contact.notes,
});

const buildContactWriteDataFromRemoteSnapshot = (snapshot: unknown) => {
  if (!isRecord(snapshot)) {
    throw new Error("Remote sync snapshot is missing or invalid.");
  }

  const fullName = typeof snapshot.fullName === "string" ? snapshot.fullName.trim() : "";

  if (!fullName) {
    throw new Error("Remote sync snapshot does not contain a valid contact name.");
  }

  const emailAddresses = Array.isArray(snapshot.emailAddresses)
    ? snapshot.emailAddresses.filter((value): value is string => typeof value === "string")
    : [];
  const phoneNumbers = Array.isArray(snapshot.phoneNumbers)
    ? snapshot.phoneNumbers.filter((value): value is string => typeof value === "string")
    : [];

  return {
    fullName,
    firstName: typeof snapshot.firstName === "string" ? snapshot.firstName : null,
    middleName: typeof snapshot.middleName === "string" ? snapshot.middleName : null,
    lastName: typeof snapshot.lastName === "string" ? snapshot.lastName : null,
    namePrefix: typeof snapshot.namePrefix === "string" ? snapshot.namePrefix : null,
    nameSuffix: typeof snapshot.nameSuffix === "string" ? snapshot.nameSuffix : null,
    nickname: typeof snapshot.nickname === "string" ? snapshot.nickname : null,
    email: emailAddresses[0] ?? (typeof snapshot.email === "string" ? snapshot.email : null),
    emailAddresses: emailAddresses.length > 0 ? emailAddresses : undefined,
    emailEntries: Array.isArray(snapshot.emailEntries) ? snapshot.emailEntries : undefined,
    phone: phoneNumbers[0] ?? (typeof snapshot.phone === "string" ? snapshot.phone : null),
    phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
    phoneEntries: Array.isArray(snapshot.phoneEntries) ? snapshot.phoneEntries : undefined,
    company: typeof snapshot.company === "string" ? snapshot.company : null,
    jobTitle: typeof snapshot.jobTitle === "string" ? snapshot.jobTitle : null,
    website: typeof snapshot.website === "string" ? snapshot.website : null,
    websiteEntries: Array.isArray(snapshot.websiteEntries) ? snapshot.websiteEntries : undefined,
    birthday: typeof snapshot.birthday === "string" ? snapshot.birthday : null,
    address: typeof snapshot.address === "string" ? snapshot.address : null,
    postalAddresses: Array.isArray(snapshot.postalAddresses) ? snapshot.postalAddresses : undefined,
    addressEntries: Array.isArray(snapshot.addressEntries) ? snapshot.addressEntries : undefined,
    notes: typeof snapshot.notes === "string" ? snapshot.notes : null,
  };
};

const getFailureStatus = (
  accountStatus: "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR",
  errorCode: string,
) => {
  if (
    errorCode === "CARDDAV_AUTH_FAILED" ||
    errorCode === "CREDENTIALS_MISSING" ||
    errorCode === "CREDENTIALS_UNREADABLE"
  ) {
    return "NEEDS_REAUTH";
  }

  return accountStatus === "PAUSED" ? "PAUSED" : "ERROR";
};

const markJobFailed = async ({
  jobId,
  syncAccountId,
  _syncDirection,
  attemptCount,
  maxAttempts,
  accountStatus,
  errorCode,
  errorSummary,
}: {
  jobId: string;
  syncAccountId: string;
  _syncDirection: "TWO_WAY" | "IMPORT_ONLY" | "EXPORT_ONLY";
  attemptCount: number;
  maxAttempts: number;
  accountStatus: "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR";
  errorCode: string;
  errorSummary: string;
}) => {
  const now = new Date();
  const baseFailureStatus = getFailureStatus(accountStatus, errorCode);
  const recentJobs = await db.syncJob.findMany({
    where: {
      syncAccountId,
      id: {
        not: jobId,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: AUTO_PAUSE_FAILURE_STREAK - 1,
    select: {
      status: true,
      errorCode: true,
    },
  });
  const failureStreak = getConsecutiveFailureStreak([
    {
      status: "FAILED",
      errorCode,
    },
    ...recentJobs.map((job) => ({
      status: job.status,
      errorCode: job.errorCode,
    })),
  ]);
  const supportBucket = getSyncErrorSupportBucket(errorCode);
  const shouldAutoPause =
    baseFailureStatus === "ERROR" &&
    failureStreak >= AUTO_PAUSE_FAILURE_STREAK &&
    supportBucket !== "authentication";
  const finalStatus = shouldAutoPause ? "PAUSED" : baseFailureStatus;
  const finalErrorSummary = shouldAutoPause
    ? `${errorSummary} Kontax paused this sync account after ${failureStreak} consecutive ${supportBucket} failures so it does not keep retrying unattended.`
    : errorSummary;

  await db.$transaction([
    db.syncJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        completedAt: now,
        leaseExpiresAt: null,
        nextRetryAt:
          attemptCount < maxAttempts && !shouldAutoPause
            ? createRetrySchedule(attemptCount + 1)
            : null,
        errorCode,
        errorSummary: finalErrorSummary,
      },
    }),
    db.syncAccount.update({
      where: { id: syncAccountId },
      data: {
        status: finalStatus,
        lastErrorAt: now,
        lastErrorCode: errorCode,
        lastErrorMessage: finalErrorSummary,
      },
    }),
  ]);
};

export const runQueuedSyncJobs = async ({ limit = 5 }: { limit?: number } = {}) => {
  const queuedJobs = await db.syncJob.findMany({
    where: {
      status: "QUEUED",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: [{ createdAt: "asc" }],
    take: Math.max(limit, 1),
    include: {
      syncAccount: {
        select: {
          id: true,
          userId: true,
          label: true,
          status: true,
          syncDirection: true,
          baseUrl: true,
          principalUrl: true,
          addressBookUrl: true,
          remoteAccountId: true,
          remoteCTag: true,
          credentialReference: true,
          credentialRevokedAt: true,
          // P14-06: when linked to a team book, sync operates on that book's
          // contacts (owned by the group owner) instead of personal contacts.
          teamLink: {
            select: {
              addressBookId: true,
              addressBook: { select: { name: true } },
              group: { select: { name: true, ownerId: true } },
            },
          },
        },
      },
    },
  });

  const summary = {
    processed: 0,
    succeeded: 0,
    partial: 0,
    failed: 0,
    skipped: 0,
  };

  for (const job of queuedJobs) {
    const leaseExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const claim = await db.syncJob.updateMany({
      where: {
        id: job.id,
        status: "QUEUED",
      },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        workerId: "manual-runner",
        leaseExpiresAt,
      },
    });

    if (claim.count === 0) {
      summary.skipped += 1;
      continue;
    }

    summary.processed += 1;

    if (job.syncAccount.status === "PAUSED") {
      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: "SYNC_ACCOUNT_PAUSED",
        errorSummary: "The queued sync job was skipped because the sync account is paused.",
      });
      summary.failed += 1;
      continue;
    }

    if (job.syncDirection === "EXPORT_ONLY") {
      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: "SYNC_DIRECTION_UNSUPPORTED",
        errorSummary:
          "EXPORT_ONLY is not available in the first live CardDAV sync slice yet. Use IMPORT_ONLY or TWO_WAY while Kontax runs bootstrap import sync.",
      });
      summary.failed += 1;
      continue;
    }

    if (
      !job.syncAccount.credentialReference ||
      job.syncAccount.credentialRevokedAt ||
      !job.syncAccount.addressBookUrl
    ) {
      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: "CREDENTIALS_MISSING",
        errorSummary:
          "The sync account is missing active encrypted credentials or an address book URL.",
      });
      summary.failed += 1;
      continue;
    }

    // P14-06: resolve the sync scope. Team-linked accounts operate on a team
    // book's contacts (owned by the group owner); personal accounts unchanged.
    const teamLink = job.syncAccount.teamLink;
    const scopeUserId = teamLink ? teamLink.group.ownerId : job.syncAccount.userId;
    const scopeLabel = teamLink
      ? `${job.syncAccount.label} · ${teamLink.group.name} · ${teamLink.addressBook.name}`
      : job.syncAccount.label;
    const contactScopeWhere = teamLink
      ? { groupContacts: { some: { groupAddressBookId: teamLink.addressBookId } } }
      : { userId: job.syncAccount.userId };

    let decryptedCredentials: ReturnType<typeof decryptSyncCredentialPayload>;

    try {
      decryptedCredentials = decryptSyncCredentialPayload(job.syncAccount.credentialReference);
    } catch (error) {
      const errorSummary =
        error instanceof Error
          ? error.message
          : "Stored CardDAV credentials could not be decrypted.";

      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode: "CREDENTIALS_UNREADABLE",
        errorSummary,
      });
      summary.failed += 1;
      continue;
    }

    try {
      const now = new Date();
      const remoteEntries = await fetchCardDavAddressBookIndex({
        addressBookUrl: job.syncAccount.addressBookUrl,
        credentials: {
          username: decryptedCredentials.username,
          password: decryptedCredentials.password,
        },
      });
      const remoteCards = await fetchCardDavAddressBookCards({
        addressBookUrl: job.syncAccount.addressBookUrl,
        credentials: {
          username: decryptedCredentials.username,
          password: decryptedCredentials.password,
        },
      });

      const remoteUids = remoteEntries.map((entry) => entry.uid);
      const existingContacts =
        remoteUids.length > 0
          ? await db.contact.findMany({
              where: {
                ...contactScopeWhere,
                syncUid: {
                  in: remoteUids,
                },
              },
              select: {
                id: true,
                syncUid: true,
                archivedAt: true,
              },
            })
          : [];
      const existingLinks = await db.syncContactLink.findMany({
        where: {
          syncAccountId: job.syncAccountId,
        },
        select: {
          id: true,
          remoteUid: true,
          remoteHref: true,
          remoteETag: true,
          lastSyncedAt: true,
          contactId: true,
          contact: {
            select: {
              id: true,
              syncUid: true,
              syncVersion: true,
              updatedAt: true,
              archivedAt: true,
              fullName: true,
              firstName: true,
              middleName: true,
              lastName: true,
              namePrefix: true,
              nameSuffix: true,
              nickname: true,
              email: true,
              emailAddresses: true,
              phone: true,
              phoneNumbers: true,
              company: true,
              jobTitle: true,
              website: true,
              birthday: true,
              address: true,
              postalAddresses: true,
              notes: true,
            },
          },
        },
      });
      const contactByUid = new Map(existingContacts.map((contact) => [contact.syncUid, contact]));
      const remoteEntryByUid = new Map(remoteEntries.map((entry) => [entry.uid, entry]));
      const remoteCardByUid = new Map(remoteCards.map((card) => [card.uid, card]));
      const linkedRemoteUids = new Set(
        existingLinks.map((link) => link.remoteUid ?? link.contact.syncUid),
      );
      const matchedEntries = remoteEntries.filter(
        (entry) => contactByUid.has(entry.uid) && !linkedRemoteUids.has(entry.uid),
      );
      const unmatchedCards = remoteCards.filter((card) => !contactByUid.has(card.uid));
      const conflictEntries: Array<{
        type: "LOCAL_REMOTE_MUTATION" | "DELETE_CONFLICT";
        linkId: string;
        contactId: string;
        localSyncVersion: number;
        remoteETag: string | null;
        localSnapshot: ReturnType<typeof buildLocalConflictSnapshot>;
        remoteSnapshot: unknown;
        resolutionNotes: string;
      }> = [];
      const remoteApplyCandidates: Array<{
        linkId: string;
        contactId: string;
        remoteETag: string | null;
        remoteSnapshot: unknown;
      }> = [];
      let deferredLocalChangesCount = 0;

      for (const link of existingLinks) {
        const remoteUid = link.remoteUid ?? link.contact.syncUid;
        const remoteEntry = remoteEntryByUid.get(remoteUid);
        const remoteCard = remoteCardByUid.get(remoteUid);
        const localChanged =
          link.lastSyncedAt == null || link.contact.updatedAt.getTime() > link.lastSyncedAt.getTime();
        const remoteChanged = remoteEntry != null && remoteEntry.etag !== link.remoteETag;

        if (!remoteEntry) {
          if (!link.contact.archivedAt) {
            conflictEntries.push({
              type: "DELETE_CONFLICT",
              linkId: link.id,
              contactId: link.contact.id,
              localSyncVersion: link.contact.syncVersion,
              remoteETag: link.remoteETag ?? null,
              localSnapshot: buildLocalConflictSnapshot(link.contact),
              remoteSnapshot: {
                deleted: true,
                remoteUid,
                remoteHref: link.remoteHref,
              },
              resolutionNotes:
                "Remote contact appears missing while the local contact is still active.",
            });
          }

          continue;
        }

        if (localChanged && remoteChanged && remoteCard) {
          conflictEntries.push({
            type: "LOCAL_REMOTE_MUTATION",
            linkId: link.id,
            contactId: link.contact.id,
            localSyncVersion: link.contact.syncVersion,
            remoteETag: remoteEntry.etag ?? null,
            localSnapshot: buildLocalConflictSnapshot(link.contact),
            remoteSnapshot: remoteCard,
            resolutionNotes:
              "Local and remote contact data both changed since the last healthy sync point.",
          });
          continue;
        }

        if (localChanged) {
          deferredLocalChangesCount += 1;
          continue;
        }

        if (remoteChanged && remoteCard) {
          remoteApplyCandidates.push({
            linkId: link.id,
            contactId: link.contact.id,
            remoteETag: remoteEntry.etag ?? null,
            remoteSnapshot: remoteCard,
          });
        }
      }

      await db.$transaction(async (tx) => {
        for (const entry of matchedEntries) {
          const contact = contactByUid.get(entry.uid)!;

          await tx.syncContactLink.upsert({
            where: {
              syncAccountId_contactId: {
                syncAccountId: job.syncAccountId,
                contactId: contact.id,
              },
            },
            create: {
              syncAccountId: job.syncAccountId,
              contactId: contact.id,
              remoteHref: entry.href,
              remoteUid: entry.uid,
              remoteETag: entry.etag,
              lastSyncedAt: now,
            },
            update: {
              remoteHref: entry.href,
              remoteUid: entry.uid,
              remoteETag: entry.etag,
              remoteDeletedAt: null,
              tombstonedAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastSyncedAt: now,
            },
          });
        }

        for (const card of unmatchedCards) {
          const createdContact = await tx.contact.create({
            data: {
              userId: scopeUserId,
              syncUid: card.uid,
              fullName: card.fullName,
              firstName: card.firstName,
              middleName: card.middleName,
              lastName: card.lastName,
              namePrefix: card.namePrefix,
              nameSuffix: card.nameSuffix,
              nickname: card.nickname,
              email: card.emailAddresses[0] ?? null,
              emailAddresses: card.emailAddresses.length > 0 ? card.emailAddresses : undefined,
              emailEntries: card.emailEntries.length > 0 ? card.emailEntries : undefined,
              phone: card.phoneNumbers[0] ?? null,
              phoneNumbers: card.phoneNumbers.length > 0 ? card.phoneNumbers : undefined,
              phoneEntries: card.phoneEntries.length > 0 ? card.phoneEntries : undefined,
              company: card.company,
              jobTitle: card.jobTitle,
              website: card.website,
              websiteEntries: card.websiteEntries.length > 0 ? card.websiteEntries : undefined,
              birthday: card.birthday,
              address: card.address,
              postalAddresses:
                card.postalAddresses.length > 0 ? card.postalAddresses : undefined,
              addressEntries: card.addressEntries.length > 0 ? card.addressEntries : undefined,
              notes: card.notes,
              sourceType: "SYNC_CARDDAV",
              sourceDetail: scopeLabel,
              lastMutatedBy: "SYNC_CARDDAV",
              lastMutatedByDetail: scopeLabel,
            },
            select: {
              id: true,
            },
          });

          // P14-06: link a team-synced contact into the team book.
          if (teamLink) {
            await tx.groupContact.create({
              data: {
                groupAddressBookId: teamLink.addressBookId,
                contactId: createdContact.id,
                addedByUserId: job.syncAccount.userId,
              },
            });
          }

          const remoteEntry = remoteEntryByUid.get(card.uid);

          await tx.syncContactLink.create({
            data: {
              syncAccountId: job.syncAccountId,
              contactId: createdContact.id,
              remoteHref: remoteEntry?.href ?? card.href,
              remoteUid: card.uid,
              remoteETag: remoteEntry?.etag ?? card.etag,
              lastSyncedAt: now,
            },
          });

          await emitEvent(tx, {
            userId: job.syncAccount.userId,
            contactId: createdContact.id,
            eventType: "SYNC_PULLED",
            actor: "SYNC",
            actorDetail: scopeLabel,
            payload: { syncAccountId: job.syncAccountId, syncAccountLabel: job.syncAccount.label },
          });
        }

        for (const remoteApply of remoteApplyCandidates) {
          await tx.contact.update({
            where: {
              id: remoteApply.contactId,
            },
            data: {
              ...buildContactWriteDataFromRemoteSnapshot(remoteApply.remoteSnapshot),
              lastMutatedBy: "SYNC_CARDDAV",
              lastMutatedByDetail: job.syncAccount.label,
              syncVersion: {
                increment: 1,
              },
            },
          });

          await tx.syncContactLink.update({
            where: {
              id: remoteApply.linkId,
            },
            data: {
              remoteETag: remoteApply.remoteETag,
              remoteDeletedAt: null,
              tombstonedAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastSyncedAt: now,
            },
          });

          await emitEvent(tx, {
            userId: job.syncAccount.userId,
            contactId: remoteApply.contactId,
            eventType: "SYNC_PULLED",
            actor: "SYNC",
            actorDetail: scopeLabel,
            payload: { syncAccountId: job.syncAccountId, syncAccountLabel: job.syncAccount.label },
          });
        }

        for (const conflictEntry of conflictEntries) {
          await tx.syncConflict.create({
            data: {
              syncAccountId: job.syncAccountId,
              syncContactLinkId: conflictEntry.linkId,
              contactId: conflictEntry.contactId,
              conflictType: conflictEntry.type,
              status: "OPEN",
              localSyncVersion: conflictEntry.localSyncVersion,
              remoteETag: conflictEntry.remoteETag,
              localSnapshot: conflictEntry.localSnapshot,
              remoteSnapshot: conflictEntry.remoteSnapshot as Prisma.InputJsonValue,
              resolutionNotes: conflictEntry.resolutionNotes,
            },
          });

          await emitEvent(tx, {
            userId: job.syncAccount.userId,
            contactId: conflictEntry.contactId,
            eventType: "SYNC_CONFLICT_DETECTED",
            actor: "SYNC",
            actorDetail: scopeLabel,
            payload: {
              conflictType: conflictEntry.type,
              remoteETag: conflictEntry.remoteETag ?? undefined,
            },
          });
        }

        await tx.syncJob.update({
          where: { id: job.id },
          data: {
            status: conflictEntries.length > 0 ? "PARTIAL" : "SUCCEEDED",
            completedAt: new Date(),
            leaseExpiresAt: null,
            nextRetryAt: null,
            createdCount: unmatchedCards.length,
            updatedCount: matchedEntries.length + remoteApplyCandidates.length,
            deletedCount: 0,
            conflictCount: conflictEntries.length,
            skippedCount: deferredLocalChangesCount,
            cursorBefore: job.syncAccount.remoteCTag ?? job.cursorBefore ?? job.syncAccount.addressBookUrl,
            cursorAfter: String(remoteEntries.length),
            errorCode: conflictEntries.length > 0 ? "SYNC_CONFLICTS_OPEN" : null,
            errorSummary:
              unmatchedCards.length > 0 ||
              remoteApplyCandidates.length > 0 ||
              deferredLocalChangesCount > 0 ||
              conflictEntries.length > 0
                ? `Bootstrap import synced ${unmatchedCards.length} new remote contacts, refreshed ${
                    matchedEntries.length + remoteApplyCandidates.length
                  } linked contacts, deferred ${deferredLocalChangesCount} local-only changes, and opened ${
                    conflictEntries.length
                  } sync conflicts. Remote writes remain disabled in this first live sync slice.`
                : `Bootstrap import indexed ${matchedEntries.length} remote contacts and refreshed local sync links without remote writes.`,
          },
        });

        await tx.syncAccount.update({
          where: { id: job.syncAccountId },
          data: {
            status: job.syncAccount.status === "PAUSED" ? "PAUSED" : "ACTIVE",
            remoteCTag: String(remoteEntries.length),
            lastSyncCursor: String(remoteEntries.length),
            lastSyncedAt: now,
            lastSucceededAt: now,
            lastErrorAt: conflictEntries.length > 0 ? now : null,
            lastErrorCode: conflictEntries.length > 0 ? "SYNC_CONFLICTS_OPEN" : null,
            lastErrorMessage:
              conflictEntries.length > 0
                ? `${conflictEntries.length} sync conflicts need review before the account is fully healthy again.`
                : null,
          },
        });
      });

      if (conflictEntries.length > 0) {
        summary.partial += 1;
      } else {
        summary.succeeded += 1;
      }
    } catch (error) {
      const errorCode =
        error instanceof CardDavPreflightError ? error.code : "CARDDAV_SYNC_FAILED";
      const errorSummary =
        error instanceof Error
          ? error.message
          : "CardDAV sync execution failed before Kontax could refresh local state.";

      await markJobFailed({
        jobId: job.id,
        syncAccountId: job.syncAccountId,
        _syncDirection: job.syncDirection,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        accountStatus: job.syncAccount.status,
        errorCode,
        errorSummary,
      });
      summary.failed += 1;
    }
  }

  return summary;
};
