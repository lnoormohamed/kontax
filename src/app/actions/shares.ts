"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { emitEvent } from "~/lib/activity";
import { auth } from "~/server/auth";
import {
  assertCanLiveShare,
  assertCanStaticShare,
  getUserBillingContext,
} from "~/server/billing";
import { db } from "~/server/db";
import { appUrl, sendEmail } from "~/server/email";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Notify the recipient by email (P12-06). No-op when SES isn't configured.
const sendShareInviteEmail = async (opts: {
  recipientEmail: string;
  ownerName: string;
  contactName: string;
  recipientExists: boolean;
  live: boolean;
}) => {
  const dest = opts.recipientExists ? `${appUrl()}/shares` : `${appUrl()}/register`;
  const kind = opts.live ? "a live-synced contact" : "a contact";
  const cta = opts.recipientExists
    ? "Review it in Kontax"
    : "Create your free Kontax account to accept";
  const subject = `${opts.ownerName} shared a contact with you on Kontax`;
  const text = `${opts.ownerName} shared ${kind} (${opts.contactName}) with you on Kontax.\n\n${cta}: ${dest}`;
  const html =
    `<p>${escapeHtml(opts.ownerName)} shared ${kind} — <strong>${escapeHtml(opts.contactName)}</strong> — with you on Kontax.</p>` +
    `<p><a href="${dest}">${cta}</a></p>`;
  await sendEmail({ to: opts.recipientEmail, subject, html, text });
};

const FREE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const requireUserId = async () => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("You need to be signed in.");
  }
  return session.user.id;
};

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

// Fields copied into the static-share snapshot and used to recreate the
// recipient's independent copy on acceptance.
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
  notes: true,
} as const;

// ── P12-02: vCard share link (all plans) ─────────────────────────────────────

export const createVcardShareLink = async (formData: FormData) => {
  const userId = await requireUserId();
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
  const expiresAt = billing.plan === "FREE" ? new Date(Date.now() + FREE_LINK_TTL_MS) : null;

  await db.contactShare.create({
    data: {
      ownerUserId: userId,
      contactId,
      shareType: "VCARD_LINK",
      token: randomBytes(24).toString("base64url"),
      status: "ACTIVE",
      expiresAt,
    },
  });

  revalidatePath(`/contacts/${contactId}`);
};

export const revokeShare = async (formData: FormData) => {
  const userId = await requireUserId();
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
  const userId = await requireUserId();
  await assertCanStaticShare(userId); // Pro+ gate

  const contactId = str(formData, "contactId");
  const recipientEmail = str(formData, "recipientEmail").toLowerCase();
  if (!contactId || !recipientEmail) {
    throw new Error("Enter a recipient email.");
  }

  const [contact, owner, recipient] = await Promise.all([
    db.contact.findFirst({ where: { id: contactId, userId }, select: SNAPSHOT_SELECT }),
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.user.findUnique({ where: { email: recipientEmail }, select: { id: true } }),
  ]);
  if (!contact) {
    throw new Error("Contact not found.");
  }
  if (recipient?.id === userId) {
    throw new Error("You can't share a contact with yourself.");
  }

  const trimmedOwnerName = owner?.name?.trim() ?? "";
  const ownerName =
    trimmedOwnerName.length > 0 ? trimmedOwnerName : (owner?.email ?? "A Kontax user");

  await db.contactShare.create({
    data: {
      ownerUserId: userId,
      contactId,
      shareType: "STATIC_COPY",
      status: "ACTIVE",
      recipientUserId: recipient?.id ?? null,
      recipientEmail,
      // Snapshot the contact at share time so it's deliverable even if the owner
      // later edits/archives/deletes the original (P12-03 risk note).
      snapshot: { ...contact, ownerName },
    },
  });

  await sendShareInviteEmail({
    recipientEmail,
    ownerName,
    contactName: contact.fullName ?? "a contact",
    recipientExists: Boolean(recipient?.id),
    live: false,
  });

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
  const userId = await requireUserId();
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

  revalidatePath("/shares");
  revalidatePath("/");
  if (newContactId) {
    redirect(`/contacts/${newContactId}`);
  }
};

export const declineStaticShare = async (formData: FormData) => {
  const userId = await requireUserId();
  const shareId = str(formData, "shareId");

  await db.contactShare.updateMany({
    where: { id: shareId, recipientUserId: userId, status: "ACTIVE", recipientContactId: null },
    data: { status: "DECLINED" },
  });

  revalidatePath("/shares");
};

// ── P12-04: live Kontax-to-Kontax share (Pro+, both parties) ─────────────────

export const createLiveShare = async (formData: FormData) => {
  const userId = await requireUserId();
  await assertCanLiveShare(userId); // Pro+ gate (sender)

  const contactId = str(formData, "contactId");
  const recipientEmail = str(formData, "recipientEmail").toLowerCase();
  if (!contactId || !recipientEmail) {
    throw new Error("Enter a recipient email.");
  }

  const [contact, owner, recipient] = await Promise.all([
    db.contact.findFirst({ where: { id: contactId, userId }, select: { ...SNAPSHOT_SELECT, sourceType: true } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.user.findUnique({ where: { email: recipientEmail }, select: { id: true } }),
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
    throw new Error("This contact is a live share received from someone else and can't be re-shared live.");
  }

  const trimmedOwnerName = owner?.name?.trim() ?? "";
  const ownerName =
    trimmedOwnerName.length > 0 ? trimmedOwnerName : (owner?.email ?? "A Kontax user");

  await db.contactShare.create({
    data: {
      ownerUserId: userId,
      contactId,
      shareType: "LIVE_SYNC",
      status: "ACTIVE",
      recipientUserId: recipient?.id ?? null,
      recipientEmail,
      snapshot: { ...snapshotFields, ownerName },
    },
  });

  await sendShareInviteEmail({
    recipientEmail,
    ownerName,
    contactName: snapshotFields.fullName ?? "a contact",
    recipientExists: Boolean(recipient?.id),
    live: true,
  });

  revalidatePath(`/contacts/${contactId}`);
};

export const acceptLiveShare = async (formData: FormData) => {
  const userId = await requireUserId();
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

  revalidatePath("/shares");
  revalidatePath("/");
  if (newContactId) {
    redirect(`/contacts/${newContactId}`);
  }
};

// Recipient unlinks a live contact: the share is revoked and their copy freezes
// into an independent static record.
export const unlinkLiveShare = async (formData: FormData) => {
  const userId = await requireUserId();
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
