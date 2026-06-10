import { Prisma } from "../../generated/prisma";
import { emitEvent } from "~/lib/activity";
import type { db } from "~/server/db";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

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

// Is this user on a plan that can hold a live share? (mirrors liveShareEnabled)
const recipientCanLiveSync = async (tx: Tx, userId: string) => {
  const sub = await tx.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
    orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
    select: { plan: true },
  });
  return PAID_PLANS.has(sub?.plan ?? "FREE");
};

/**
 * Propagate an owner's contact edit to every active LIVE_SYNC recipient copy
 * (P12-04). Mutation-triggered (called inside the owner's update transaction) —
 * no polling. Pushes the shared fields (not the recipient's private notes),
 * stamps `lastPushedAt`, and logs a SYNC_PUSHED event on the recipient's side.
 * If a recipient has since downgraded to Free, their live link is converted to a
 * static copy and skipped (lazy downgrade handling).
 */
export const propagateLiveShares = async (tx: Tx, ownerUserId: string, contactId: string) => {
  const shares = await tx.contactShare.findMany({
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

  const src = await tx.contact.findUnique({
    where: { id: contactId },
    select: LIVE_FIELD_SELECT,
  });
  if (!src) {
    return;
  }

  const owner = await tx.user.findUnique({
    where: { id: ownerUserId },
    select: { name: true, email: true },
  });
  const ownerName = owner?.name?.trim() ?? "";
  const ownerLabel = ownerName.length > 0 ? ownerName : (owner?.email ?? "A Kontax user");

  for (const share of shares) {
    const recipientUserId = share.recipientUserId!;
    const recipientContactId = share.recipientContactId!;

    // Downgrade handling: a now-Free recipient can't hold a live link → convert.
    if (!(await recipientCanLiveSync(tx, recipientUserId))) {
      await tx.contactShare.update({
        where: { id: share.id },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      await tx.contact.update({
        where: { id: recipientContactId },
        data: { sourceType: "SHARED_STATIC", lastMutatedBy: "SHARED_STATIC" },
      });
      continue;
    }

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
      data: { lastPushedAt: new Date() },
    });

    await emitEvent(tx, {
      userId: recipientUserId,
      contactId: recipientContactId,
      eventType: "SYNC_PUSHED",
      actor: "SHARE",
      actorDetail: ownerLabel,
      payload: {},
    });
  }
};

export { LIVE_FIELD_SELECT };
