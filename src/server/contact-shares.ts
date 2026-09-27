import { Prisma } from "../../generated/prisma";
import { emitEvent } from "~/lib/activity";
import { copyMultiValueWriteData } from "~/server/contact-multi-values";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  isPaymentGraceOver,
  subscriptionGrantsPlan,
} from "~/server/dav/plan-entitlements.mjs";
import { db } from "~/server/db";
import { markSyncLinksDirty } from "~/server/sync-dirty";

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

/** Share paused because the recipient's paid plan is unpaid past its grace (P49A-19). */
export const RECIPIENT_PAYMENT_LAPSED_CODE = "RECIPIENT_PAYMENT_LAPSED";

/**
 * Can this recipient hold a live share right now?
 *   · "live"   — a paid plan that grants (ACTIVE / TRIALING / PAST_DUE in grace);
 *   · "paused" — P49A-19 (Fable review): the only paid plan is PAST_DUE beyond
 *     the 3-day payment grace. Still a live Stripe subscription, so nothing
 *     irreversible happens: the share is paused like RECIPIENT_LOCKED and the
 *     next propagation after the payment goes through syncs it again. If
 *     Stripe finally cancels, applyDowngrade converts it to a static copy;
 *   · "free"   — no paid plan at all → converted to a static copy (downgrade).
 */
export const classifyLiveShareRecipient = (
  subs: Array<{ plan: string; status: string; graceEndsAt: Date | null }>,
  now = new Date(),
): "live" | "paused" | "free" => {
  const paid = subs.filter((sub) => PAID_PLANS.has(sub.plan));
  if (paid.some((sub) => subscriptionGrantsPlan(sub, now))) return "live";
  if (paid.some((sub) => isPaymentGraceOver(sub, now))) return "paused";
  return "free";
};

const recipientLiveShareState = async (userId: string) =>
  classifyLiveShareRecipient(
    await db.subscription.findMany({
      where: { userId, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
      select: { plan: true, status: true, graceEndsAt: true },
    }),
  );

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
      const recipientState = await recipientLiveShareState(recipientUserId);
      // P49A-19: payment lapsed but the subscription is still alive — pause,
      // never convert (paying must bring the live share back).
      if (recipientState === "paused") {
        await db.contactShare.update({
          where: { id: share.id },
          data: { lastErrorAt: new Date(), lastErrorCode: RECIPIENT_PAYMENT_LAPSED_CODE },
        });
        continue;
      }
      // Downgrade handling: a now-Free recipient can't hold a live link → convert.
      if (recipientState === "free") {
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
            // P49A-10: the owner's entries, legacy columns derived.
            ...copyMultiValueWriteData(src),
            company: src.company,
            phoneticCompany: src.phoneticCompany,
            jobTitle: src.jobTitle,
            birthday: src.birthday,
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
        // P49A-12 (A-17): the recipient's own sync providers receive the update.
        await markSyncLinksDirty(tx, recipientContactId);
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
