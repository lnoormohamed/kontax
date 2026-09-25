"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { emitEvent } from "~/lib/activity";
import { projectContactForSharing, resolveEffectiveSharingPolicy } from "~/lib/sharing-policy";
import { requireUserId } from "~/server/auth/require-session";
import {
  assertCanCreateContactsTx,
  assertCanLiveShare,
  assertCanStaticShare,
  getUserBillingContext,
  lockUserForPlanCheck,
} from "~/server/billing";
import {
  shareDisplayToken,
  shareTokenColumns,
  shareTokenDisplaySelect,
} from "~/server/capability-tokens";
import ShareInvite from "~/emails/share-invite";
import { db } from "~/server/db";
import { appUrl, sendEmail } from "~/server/email";
import { createNotification } from "~/server/notifications";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";
import { renderEmail } from "~/server/render-email";

// Notify the recipient by email (P12-06 / P20-06). No-op when SES isn't
// configured. Renders the React Email share-invite template.
const sendShareInviteEmail = async (opts: {
  recipientEmail: string;
  ownerName: string;
  contactName: string;
  recipientExists: boolean;
  live: boolean;
}) => {
  const dest = opts.recipientExists
    ? `${appUrl()}/shares`
    : `${appUrl()}/register`;
  const { html, text } = await renderEmail(
    ShareInvite({
      recipientExists: opts.recipientExists,
      senderName: opts.ownerName,
      contactName: opts.contactName,
      shareType: opts.live ? "Live · syncs both ways" : "One-time copy",
      live: opts.live,
      actionUrl: dest,
    }),
  );
  // P48-17: the sender's display name is arbitrary, user-controlled text (up
  // to 120 chars) — it used to sit directly in the email Subject header,
  // letting any account use Kontax's transactional sender as a relay for
  // attacker-chosen subject lines. The name still appears, but only in the
  // rendered HTML/text body (see ShareInvite's heading), where it renders as
  // plain content rather than a mail header.
  await sendEmail({
    to: opts.recipientEmail,
    subject: "Someone shared a contact with you on Kontax",
    html,
    text,
  });
};

const FREE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Unchanged entropy (P48-18 only changes how the token is stored).
const newShareToken = () => randomBytes(24).toString("base64url");

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

// Fields copied into the static-share snapshot and used to recreate the
// recipient's independent copy on acceptance. `notes` is deliberately absent
// (P48-07): live shares already exclude it (LIVE_FIELD_SELECT,
// contact-shares.ts), and both static and live-share snapshots project
// through projectContactForSharing before persisting, which drops it
// unconditionally regardless of this select.
const SNAPSHOT_SELECT = {
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
  labels: true,
  significantDates: true,
  relatedPeople: true,
  customFields: true,
} as const;

// P48-07: a static/live Kontax-to-Kontax share is a deliberate one-to-one
// grant, not a book membership — there's no GroupMember/GroupAddressBook
// policy to resolve, so projectContactForSharing's "static-share"/"live-share"
// branch is used, which ignores this policy value entirely and only ever
// drops `notes`. Kept as a named constant so the intent is explicit at the
// call site rather than a bare `resolveEffectiveSharingPolicy(null, null)`.
const PERSONAL_SHARE_POLICY = resolveEffectiveSharingPolicy(null, null);

// ── P12-02: vCard share link (all plans) ─────────────────────────────────────

export const createVcardShareLink = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const contactId = str(formData, "contactId");
  if (!contactId) {
    throw new Error("Missing contact.");
  }

  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!contact) {
    throw new Error("Contact not found.");
  }

  // Free links expire after 7 days; paid plans default to no expiry.
  const billing = await getUserBillingContext(userId);
  const expiresAt =
    billing.plan === "FREE" ? new Date(Date.now() + FREE_LINK_TTL_MS) : null;

  const singleUse = str(formData, "singleUse") === "true";

  await db.contactShare.create({
    data: {
      ownerUserId: userId,
      contactId,
      shareType: "VCARD_LINK",
      // P48-18: stored as sha256 hash + encrypted display copy, never plaintext.
      ...shareTokenColumns(newShareToken()),
      status: "ACTIVE",
      expiresAt,
      maxDownloads: singleUse ? 1 : null,
    },
  });

  revalidatePath(`/contacts/${contactId}`);
};

// P48-18: the sharing panel shows "Regenerate link" for an active link whose
// display copy can no longer be decrypted (key retired). This revokes that link
// and issues a replacement with the same single-use setting and the plan's
// current expiry — an explicit, user-initiated rotation.
export const regenerateVcardShareLink = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const shareId = str(formData, "shareId");
  const contactId = str(formData, "contactId");

  const billing = await getUserBillingContext(userId);
  const expiresAt =
    billing.plan === "FREE" ? new Date(Date.now() + FREE_LINK_TTL_MS) : null;

  const replaced = await db.$transaction(async (tx) => {
    const share = await tx.contactShare.findFirst({
      where: { id: shareId, ownerUserId: userId, shareType: "VCARD_LINK", status: "ACTIVE" },
      select: { id: true, contactId: true, maxDownloads: true },
    });
    if (!share?.contactId) return null;

    // Compare-and-set on ACTIVE: of two concurrent regenerates only one revokes
    // the link, so only one replacement is ever created.
    const revoked = await tx.contactShare.updateMany({
      where: { id: share.id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    if (revoked.count !== 1) return null;
    await tx.contactShare.create({
      data: {
        ownerUserId: userId,
        contactId: share.contactId,
        shareType: "VCARD_LINK",
        ...shareTokenColumns(newShareToken()),
        status: "ACTIVE",
        expiresAt,
        maxDownloads: share.maxDownloads,
      },
    });
    return share.contactId;
  });

  const target = replaced ?? contactId;
  if (target) revalidatePath(`/contacts/${target}`);
};

// P28-06: return a usable vCard share URL for the QR modal — reusing the
// contact's existing non-expired link if there is one, otherwise creating a new
// one (plan-based expiry, same as createVcardShareLink). Returns the absolute
// /share/{token} URL plus the link's expiry so the modal can surface it.
export const getOrCreateVcardShareLink = async (
  contactId: string,
): Promise<{ url: string; expiresAt: string | null }> => {
  const userId = await requireUserId({ write: true });

  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!contact) {
    throw new Error("Contact not found.");
  }

  // P48-18: reuse an existing active link by decrypting its display copy (or,
  // for a not-yet-backfilled row, its legacy plaintext token). Newest first;
  // the first one we can show wins.
  const existing = await db.contactShare.findMany({
    where: {
      contactId,
      ownerUserId: userId,
      shareType: "VCARD_LINK",
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { ...shareTokenDisplaySelect, expiresAt: true },
  });

  for (const share of existing) {
    const display = shareDisplayToken(share);
    if (display.status === "ok") {
      return {
        url: `${appUrl()}/share/${display.token}`,
        expiresAt: share.expiresAt?.toISOString() ?? null,
      };
    }
  }

  // An active link exists but none can be displayed: never mint a second
  // active link behind the user's back — they regenerate it explicitly from
  // the sharing panel.
  if (existing.some((share) => shareDisplayToken(share).status === "unavailable")) {
    throw new Error(
      'This contact\'s share link can\'t be displayed any more. Open the Sharing tab and choose "Regenerate link".',
    );
  }

  const billing = await getUserBillingContext(userId);
  const expiresAt = billing.plan === "FREE" ? new Date(Date.now() + FREE_LINK_TTL_MS) : null;
  const token = newShareToken();

  await db.contactShare.create({
    data: {
      ownerUserId: userId,
      contactId,
      shareType: "VCARD_LINK",
      ...shareTokenColumns(token),
      status: "ACTIVE",
      expiresAt,
    },
  });
  revalidatePath(`/contacts/${contactId}`);

  return { url: `${appUrl()}/share/${token}`, expiresAt: expiresAt?.toISOString() ?? null };
};

export const revokeShare = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const shareId = str(formData, "shareId");
  const contactId = str(formData, "contactId");

  await db.$transaction(async (tx) => {
    const share = await tx.contactShare.findFirst({
      where: { id: shareId, ownerUserId: userId, status: "ACTIVE" },
      select: { id: true, shareType: true, recipientContactId: true },
    });
    if (!share) {
      return;
    }
    await tx.contactShare.update({
      where: { id: share.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    // Revoking a live share leaves the recipient with a frozen static copy.
    if (share.shareType === "LIVE_SYNC" && share.recipientContactId) {
      await tx.contact.update({
        where: { id: share.recipientContactId },
        data: { sourceType: "SHARED_STATIC", lastMutatedBy: "SHARED_STATIC" },
      });
    }
  });

  if (contactId) {
    revalidatePath(`/contacts/${contactId}`);
  }
};

// ── P12-03: static Kontax-to-Kontax share (Pro and above) ────────────────────

export const createStaticShare = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  await assertCanStaticShare(userId); // Pro+ gate

  const contactId = str(formData, "contactId");
  const recipientEmail = str(formData, "recipientEmail").toLowerCase();
  if (!contactId || !recipientEmail) {
    throw new Error("Enter a recipient email.");
  }

  // P48-17: share invites were unlimited — 20 recipients/hour caps Kontax's
  // use as an open outbound-email relay.
  const rl = await checkRateLimit(rateLimiters.shareEmail, `user:${userId}`);
  if (!rl.allowed) {
    throw new Error("You've sent a lot of share invites recently. Try again in a bit.");
  }

  const [contact, owner, recipient] = await Promise.all([
    db.contact.findFirst({
      where: { id: contactId, userId },
      select: SNAPSHOT_SELECT,
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    db.user.findUnique({
      where: { email: recipientEmail },
      select: { id: true },
    }),
  ]);
  if (!contact) {
    throw new Error("Contact not found.");
  }
  if (recipient?.id === userId) {
    throw new Error("You can't share a contact with yourself.");
  }

  const trimmedOwnerName = owner?.name?.trim() ?? "";
  const ownerName =
    trimmedOwnerName.length > 0
      ? trimmedOwnerName
      : (owner?.email ?? "A Kontax user");

  // P48-07: notes never travel into a share snapshot.
  const projected = projectContactForSharing(contact, PERSONAL_SHARE_POLICY, "static-share");

  const share = await db.contactShare.create({
    data: {
      ownerUserId: userId,
      contactId,
      shareType: "STATIC_COPY",
      status: "ACTIVE",
      recipientUserId: recipient?.id ?? null,
      recipientEmail,
      // Snapshot the contact at share time so it's deliverable even if the owner
      // later edits/archives/deletes the original (P12-03 risk note).
      snapshot: { ...projected, ownerName },
    },
    select: { id: true, expiresAt: true },
  });

  await sendShareInviteEmail({
    recipientEmail,
    ownerName,
    contactName: contact.fullName ?? "a contact",
    recipientExists: Boolean(recipient?.id),
    live: false,
  });

  // P22-DB05: in-app SHARING notification for registered recipients.
  // P46-DB03: link to the invite so the feed can derive its live/expired/accepted
  // state at read time; expiresAt is the display hint.
  if (recipient?.id) {
    await createNotification({
      userId: recipient.id,
      category: "SHARING",
      title: `${ownerName} shared a contact`,
      body: `"${contact.fullName ?? "A contact"}" was shared with you — accept it in Shared with me.`,
      actionUrl: "/settings/sharing/shared",
      contactShareId: share.id,
      expiresAt: share.expiresAt,
    });
  }

  revalidatePath(`/contacts/${contactId}`);
};

type ShareSnapshot = {
  ownerName?: string;
  fullName?: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  phoneticFirstName?: string | null;
  phoneticLastName?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
  nickname?: string | null;
  email?: string | null;
  emailAddresses?: unknown;
  emailEntries?: unknown;
  phone?: string | null;
  phoneNumbers?: unknown;
  phoneEntries?: unknown;
  company?: string | null;
  phoneticCompany?: string | null;
  jobTitle?: string | null;
  website?: string | null;
  websiteEntries?: unknown;
  birthday?: string | null;
  address?: string | null;
  postalAddresses?: unknown;
  addressEntries?: unknown;
  labels?: unknown;
  significantDates?: unknown;
  relatedPeople?: unknown;
  customFields?: unknown;
  notes?: string | null;
};

export const acceptStaticShare = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const shareId = str(formData, "shareId");
  let newContactId = "";

  await db.$transaction(async (tx) => {
    const share = await tx.contactShare.findFirst({
      where: {
        id: shareId,
        recipientUserId: userId,
        shareType: "STATIC_COPY",
        status: "ACTIVE",
        recipientContactId: null,
      },
      select: { id: true, snapshot: true },
    });
    if (!share?.snapshot) {
      throw new Error("Share not found or already handled.");
    }

    // P48-17: this acceptance path created a contact for the recipient with
    // no plan-cap check at all — a Free-plan recipient at their contact limit
    // could accept unlimited shares. Lock + re-check inside this same
    // transaction (already wrapping the whole accept flow).
    await lockUserForPlanCheck(tx, userId);
    await assertCanCreateContactsTx(tx, userId);

    const snap = share.snapshot as ShareSnapshot;
    const { ownerName, ...fields } = snap;

    const created = await tx.contact.create({
      data: {
        userId,
        fullName: fields.fullName ?? "Shared contact",
        firstName: fields.firstName ?? null,
        middleName: fields.middleName ?? null,
        lastName: fields.lastName ?? null,
        phoneticFirstName: fields.phoneticFirstName ?? null,
        phoneticLastName: fields.phoneticLastName ?? null,
        namePrefix: fields.namePrefix ?? null,
        nameSuffix: fields.nameSuffix ?? null,
        nickname: fields.nickname ?? null,
        email: fields.email ?? null,
        emailAddresses: (fields.emailAddresses ?? undefined) as never,
        emailEntries: (fields.emailEntries ?? undefined) as never,
        phone: fields.phone ?? null,
        phoneNumbers: (fields.phoneNumbers ?? undefined) as never,
        phoneEntries: (fields.phoneEntries ?? undefined) as never,
        company: fields.company ?? null,
        phoneticCompany: fields.phoneticCompany ?? null,
        jobTitle: fields.jobTitle ?? null,
        website: fields.website ?? null,
        websiteEntries: (fields.websiteEntries ?? undefined) as never,
        birthday: fields.birthday ?? null,
        address: fields.address ?? null,
        postalAddresses: (fields.postalAddresses ?? undefined) as never,
        addressEntries: (fields.addressEntries ?? undefined) as never,
        labels: (fields.labels ?? undefined) as never,
        significantDates: (fields.significantDates ?? undefined) as never,
        relatedPeople: (fields.relatedPeople ?? undefined) as never,
        customFields: (fields.customFields ?? undefined) as never,
        notes: fields.notes ?? null,
        sourceType: "SHARED_STATIC",
        sourceDetail: ownerName ?? null,
        lastMutatedBy: "SHARED_STATIC",
        lastMutatedByDetail: ownerName ?? null,
      },
      select: { id: true },
    });

    await tx.contactShare.update({
      where: { id: share.id },
      data: { recipientContactId: created.id },
    });

    await emitEvent(tx, {
      userId,
      contactId: created.id,
      eventType: "CONTACT_SHARE_RECEIVED",
      actor: "SHARE",
      actorDetail: ownerName ?? null,
      payload: { recipientHint: ownerName ?? undefined },
    });

    newContactId = created.id;
  });

  revalidatePath("/settings/sharing/shared");
  revalidatePath("/contacts");
  if (newContactId) {
    redirect(`/contacts/${newContactId}`);
  }
};

export const declineStaticShare = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const shareId = str(formData, "shareId");

  await db.contactShare.updateMany({
    where: {
      id: shareId,
      recipientUserId: userId,
      status: "ACTIVE",
      recipientContactId: null,
    },
    data: { status: "DECLINED" },
  });

  revalidatePath("/settings/sharing/shared");
};

// ── P12-04: live Kontax-to-Kontax share (Pro+, both parties) ─────────────────

export const createLiveShare = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  await assertCanLiveShare(userId); // Pro+ gate (sender)

  const contactId = str(formData, "contactId");
  const recipientEmail = str(formData, "recipientEmail").toLowerCase();
  if (!contactId || !recipientEmail) {
    throw new Error("Enter a recipient email.");
  }

  // P48-17: share invites were unlimited — 20 recipients/hour caps Kontax's
  // use as an open outbound-email relay.
  const rl = await checkRateLimit(rateLimiters.shareEmail, `user:${userId}`);
  if (!rl.allowed) {
    throw new Error("You've sent a lot of share invites recently. Try again in a bit.");
  }

  const [contact, owner, recipient] = await Promise.all([
    db.contact.findFirst({
      where: { id: contactId, userId },
      select: { ...SNAPSHOT_SELECT, sourceType: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    db.user.findUnique({
      where: { email: recipientEmail },
      select: { id: true },
    }),
  ]);
  if (!contact) {
    throw new Error("Contact not found.");
  }
  if (recipient?.id === userId) {
    throw new Error("You can't share a contact with yourself.");
  }
  const { sourceType: contactSourceType, ...snapshotFields } = contact;
  // Circular-share guard: don't live-share a contact that is itself a live copy
  // received from someone else (prevents A→B→A loops).
  if (contactSourceType === "SHARED_LIVE") {
    throw new Error(
      "This contact is a live share received from someone else and can't be re-shared live.",
    );
  }

  const trimmedOwnerName = owner?.name?.trim() ?? "";
  const ownerName =
    trimmedOwnerName.length > 0
      ? trimmedOwnerName
      : (owner?.email ?? "A Kontax user");

  // P48-07: notes never travel into the initial live-share snapshot — matches
  // LIVE_FIELD_SELECT (contact-shares.ts), which every subsequent propagation uses.
  const projected = projectContactForSharing(snapshotFields, PERSONAL_SHARE_POLICY, "live-share");

  const share = await db.contactShare.create({
    data: {
      ownerUserId: userId,
      contactId,
      shareType: "LIVE_SYNC",
      status: "ACTIVE",
      recipientUserId: recipient?.id ?? null,
      recipientEmail,
      snapshot: { ...projected, ownerName },
    },
    select: { id: true, expiresAt: true },
  });

  await sendShareInviteEmail({
    recipientEmail,
    ownerName,
    contactName: projected.fullName ?? "a contact",
    recipientExists: Boolean(recipient?.id),
    live: true,
  });

  // P22-DB05: in-app SHARING notification for registered recipients.
  // P46-DB03: link to the invite for read-time validity derivation.
  if (recipient?.id) {
    await createNotification({
      userId: recipient.id,
      category: "SHARING",
      title: `${ownerName} shared a contact`,
      body: `"${snapshotFields.fullName ?? "A contact"}" was shared with you — accept it in Shared with me.`,
      actionUrl: "/settings/sharing/shared",
      contactShareId: share.id,
      expiresAt: share.expiresAt,
    });
  }

  revalidatePath(`/contacts/${contactId}`);
};

export const acceptLiveShare = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const shareId = str(formData, "shareId");

  // Recipient must also be on a paid plan; otherwise the live share falls back
  // to a static copy (P12-04). assertCanLiveShare throws for Free.
  let recipientPaid = true;
  try {
    await assertCanLiveShare(userId);
  } catch {
    recipientPaid = false;
  }
  let newContactId = "";

  await db.$transaction(async (tx) => {
    const share = await tx.contactShare.findFirst({
      where: {
        id: shareId,
        recipientUserId: userId,
        shareType: "LIVE_SYNC",
        status: "ACTIVE",
        recipientContactId: null,
      },
      select: { id: true, snapshot: true },
    });
    if (!share?.snapshot) {
      throw new Error("Share not found or already handled.");
    }

    // P48-17: see acceptStaticShare — same missing plan-cap check.
    await lockUserForPlanCheck(tx, userId);
    await assertCanCreateContactsTx(tx, userId);

    const snap = share.snapshot as ShareSnapshot;
    const { ownerName, ...fields } = snap;
    const live = recipientPaid;

    const created = await tx.contact.create({
      data: {
        userId,
        fullName: fields.fullName ?? "Shared contact",
        firstName: fields.firstName ?? null,
        middleName: fields.middleName ?? null,
        lastName: fields.lastName ?? null,
        phoneticFirstName: fields.phoneticFirstName ?? null,
        phoneticLastName: fields.phoneticLastName ?? null,
        namePrefix: fields.namePrefix ?? null,
        nameSuffix: fields.nameSuffix ?? null,
        nickname: fields.nickname ?? null,
        email: fields.email ?? null,
        emailAddresses: (fields.emailAddresses ?? undefined) as never,
        emailEntries: (fields.emailEntries ?? undefined) as never,
        phone: fields.phone ?? null,
        phoneNumbers: (fields.phoneNumbers ?? undefined) as never,
        phoneEntries: (fields.phoneEntries ?? undefined) as never,
        company: fields.company ?? null,
        phoneticCompany: fields.phoneticCompany ?? null,
        jobTitle: fields.jobTitle ?? null,
        website: fields.website ?? null,
        websiteEntries: (fields.websiteEntries ?? undefined) as never,
        birthday: fields.birthday ?? null,
        address: fields.address ?? null,
        postalAddresses: (fields.postalAddresses ?? undefined) as never,
        addressEntries: (fields.addressEntries ?? undefined) as never,
        labels: (fields.labels ?? undefined) as never,
        significantDates: (fields.significantDates ?? undefined) as never,
        relatedPeople: (fields.relatedPeople ?? undefined) as never,
        customFields: (fields.customFields ?? undefined) as never,
        notes: fields.notes ?? null,
        sourceType: live ? "SHARED_LIVE" : "SHARED_STATIC",
        sourceDetail: ownerName ?? null,
        lastMutatedBy: live ? "SHARED_LIVE" : "SHARED_STATIC",
        lastMutatedByDetail: ownerName ?? null,
      },
      select: { id: true },
    });

    await tx.contactShare.update({
      where: { id: share.id },
      data: {
        recipientContactId: created.id,
        // Free recipient → the link degrades to a static copy; the owner sees it.
        shareType: live ? "LIVE_SYNC" : "STATIC_COPY",
        lastPushedAt: live ? new Date() : null,
      },
    });

    await emitEvent(tx, {
      userId,
      contactId: created.id,
      eventType: "CONTACT_SHARE_RECEIVED",
      actor: "SHARE",
      actorDetail: ownerName ?? null,
      payload: { recipientHint: ownerName ?? undefined },
    });

    newContactId = created.id;
  });

  revalidatePath("/settings/sharing/shared");
  revalidatePath("/contacts");
  if (newContactId) {
    redirect(`/contacts/${newContactId}`);
  }
};

// Recipient unlinks a live contact: the share is revoked and their copy freezes
// into an independent static record.
export const unlinkLiveShare = async (formData: FormData) => {
  const userId = await requireUserId({ write: true });
  const contactId = str(formData, "contactId");

  await db.$transaction(async (tx) => {
    const share = await tx.contactShare.findFirst({
      where: {
        recipientUserId: userId,
        recipientContactId: contactId,
        shareType: "LIVE_SYNC",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!share) {
      return;
    }
    await tx.contactShare.update({
      where: { id: share.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await tx.contact.update({
      where: { id: contactId },
      data: { sourceType: "SHARED_STATIC", lastMutatedBy: "SHARED_STATIC" },
    });
  });

  revalidatePath(`/contacts/${contactId}`);
};
