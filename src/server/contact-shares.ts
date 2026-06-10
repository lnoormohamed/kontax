import { Prisma } from "../../generated/prisma";
import { emitEvent } from "~/lib/activity";
import { db } from "~/server/db";

// Fields pushed to a live recipient's copy on propagation. Excludes `notes`
// (the recipient's private notes stay local) and `isFavorite` / source columns
// (recipient-owned). The owner remains the source of truth for these.
const LIVE_FIELD_SELECT = {
  fullName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  phoneticFirstName: true,
  phoneticLastName: true,
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
  phoneticCompany: true,
  jobTitle: true,
  website: true,
  websiteEntries: true,
  birthday: true,
  address: true,
  postalAddresses: true,
  addressEntries: true,
  avatarUrl: true,
  labels: true,
  significantDates: true,
  relatedPeople: true,
  customFields: true,
} as const;

const jsonOrNull = (value: Prisma.InputJsonValue | null): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  value ?? Prisma.DbNull;

const PAID_PLANS = new Set(["PRO", "FAMILY", "TEAMS"]);

const recipientCanLiveSync = async (userId: string) => {
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
    orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: { plan: true },
  });
  return PAID_PLANS.has(sub?.plan ?? "FREE");
};

/**
 * Propagate an owner's contact change to every active LIVE_SYNC recipient copy
 * (P12-04 / P12-08). Mutation-triggered — call this AFTER the owner's write
 * transaction commits (not inside it), so a recipient-side failure can never
 * roll back the owner's own edit.
 *
 * Reliability (P12-08): each recipient is handled in its own isolated
 * transaction with try/catch. Failures are captured on the share
 * (`lastErrorAt`/`lastErrorCode`) and surfaced in the UI, never thrown. A locked
 * recipient account pauses that share (RECIPIENT_LOCKED) and retries on the next
 * propagation; success clears the error. Downgraded (Free) recipients are
 * converted to a static copy. Notes stay private.
 */
export const propagateLiveShares = async (ownerUserId: string, contactId: string) => {
  const shares = await db.contactShare.findMany({
    where: {
      ownerUserId,
      contactId,
      shareType: "LIVE_SYNC",
      status: "ACTIVE",
      recipientContactId: { not: null },
      recipientUserId: { not: null },
    },
    select: { id: true, recipientUserId: true, recipientContactId: true },
  });
  if (shares.length === 0) {
    return;
  }

  const src = await db.contact.findUnique({ where: { id: contactId }, select: LIVE_FIELD_SELECT });
  if (!src) {
    return;
  }

  const owner = await db.user.findUnique({
    where: { id: ownerUserId },
    select: { name: true, email: true },
  });
  const ownerName = owner?.name?.trim() ?? "";
  const ownerLabel = ownerName.length > 0 ? ownerName : (owner?.email ?? "A Kontax user");

  for (const share of shares) {
    const recipientUserId = share.recipientUserId!;
    const recipientContactId = share.recipientContactId!;

    try {
      // Downgrade handling: a now-Free recipient can't hold a live link → convert.
      if (!(await recipientCanLiveSync(recipientUserId))) {
        await db.$transaction([
          db.contactShare.update({
            where: { id: share.id },
            data: { status: "REVOKED", revokedAt: new Date() },
          }),
          db.contact.update({
            where: { id: recipientContactId },
            data: { sourceType: "SHARED_STATIC", lastMutatedBy: "SHARED_STATIC" },
          }),
        ]);
        continue;
      }

      // Recipient account locked/canceled → pause this share and retry later.
      const recipient = await db.user.findUnique({
        where: { id: recipientUserId },
        select: { lifecycleState: true },
      });
      if (recipient?.lifecycleState === "LOCKED" || recipient?.lifecycleState === "CANCELED") {
        await db.contactShare.update({
          where: { id: share.id },
          data: { lastErrorAt: new Date(), lastErrorCode: "RECIPIENT_LOCKED" },
        });
        continue;
      }

      await db.$transaction(async (tx) => {
        await tx.contact.update({
          where: { id: recipientContactId },
          data: {
            fullName: src.fullName,
            firstName: src.firstName,
            middleName: src.middleName,
            lastName: src.lastName,
            phoneticFirstName: src.phoneticFirstName,
            phoneticLastName: src.phoneticLastName,
            namePrefix: src.namePrefix,
            nameSuffix: src.nameSuffix,
            nickname: src.nickname,
            email: src.email,
            emailAddresses: jsonOrNull(src.emailAddresses),
            emailEntries: jsonOrNull(src.emailEntries),
            phone: src.phone,
            phoneNumbers: jsonOrNull(src.phoneNumbers),
            phoneEntries: jsonOrNull(src.phoneEntries),
            company: src.company,
            phoneticCompany: src.phoneticCompany,
            jobTitle: src.jobTitle,
            website: src.website,
            websiteEntries: jsonOrNull(src.websiteEntries),
            birthday: src.birthday,
            address: src.address,
            postalAddresses: jsonOrNull(src.postalAddresses),
            addressEntries: jsonOrNull(src.addressEntries),
            avatarUrl: src.avatarUrl,
            labels: jsonOrNull(src.labels),
            significantDates: jsonOrNull(src.significantDates),
            relatedPeople: jsonOrNull(src.relatedPeople),
            customFields: jsonOrNull(src.customFields),
            sourceType: "SHARED_LIVE",
            sourceDetail: ownerLabel,
            lastMutatedBy: "SHARED_LIVE",
            lastMutatedByDetail: ownerLabel,
            syncVersion: { increment: 1 },
          },
        });
        await tx.contactShare.update({
          where: { id: share.id },
          data: { lastPushedAt: new Date(), lastErrorAt: null, lastErrorCode: null },
        });
        await emitEvent(tx, {
          userId: recipientUserId,
          contactId: recipientContactId,
          eventType: "SYNC_PUSHED",
          actor: "SHARE",
          actorDetail: ownerLabel,
          payload: {},
        });
      });
    } catch (error) {
      console.error(`[live-share] propagation failed for share ${share.id}:`, error);
      try {
        await db.contactShare.update({
          where: { id: share.id },
          data: { lastErrorAt: new Date(), lastErrorCode: "PUSH_FAILED" },
        });
      } catch {
        // best-effort error stamp; ignore
      }
    }
  }
};

export { LIVE_FIELD_SELECT };
