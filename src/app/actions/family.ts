"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { emitEvent } from "~/lib/activity";
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";
import { appUrl, sendEmail } from "~/server/email";
import { getUserFamilyMembership } from "~/server/family-access";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48h signed-token expiry

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Create -----------------------------------------------------------------
export const createFamilyGroup = async (formData: FormData) => {
  const userId = await requireUserId();
  const name = str(formData, "name") || "My Family";

  const billing = await getUserBillingContext(userId);
  if (!billing.entitlements.familyGroupEnabled) {
    throw new Error("A Family plan is required to create a family group.");
  }
  // v1: one family group per user (as owner).
  const existing = await db.group.findFirst({
    where: { ownerId: userId, type: "FAMILY" },
    select: { id: true },
  });
  if (existing) {
    redirect("/settings/family");
  }

  const maxMembers = billing.entitlements.memberSlotsLimit ?? 6;
  await db.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        ownerId: userId,
        type: "FAMILY",
        name,
        maxMembers,
        members: {
          create: {
            userId,
            role: "OWNER",
            inviteStatus: "ACCEPTED",
            canEdit: true,
            joinedAt: new Date(),
          },
        },
        addressBooks: { create: { name, isDefault: true } },
      },
      include: { addressBooks: true },
    });
    await tx.group.update({
      where: { id: group.id },
      data: { defaultAddressBookId: group.addressBooks[0]?.id },
    });
  });

  revalidatePath("/settings/family");
  revalidatePath("/settings");
  redirect("/settings/family");
};

// --- Invite -----------------------------------------------------------------
const sendInviteEmail = async (opts: {
  email: string;
  groupName: string;
  ownerName: string;
  token: string;
  recipientExists: boolean;
}) => {
  const link = `${appUrl()}/family/join/${opts.token}`;
  const subject = `${opts.ownerName} invited you to the ${opts.groupName} book on Kontax`;
  const cta = opts.recipientExists
    ? "Accept the invitation"
    : "Create your free Kontax account to join";
  const text = `${opts.ownerName} invited you to share the "${opts.groupName}" family contact book on Kontax.\n\n${cta}: ${link}\n\nThis invite expires in 48 hours.`;
  const html =
    `<p>${escapeHtml(opts.ownerName)} invited you to share the <strong>${escapeHtml(opts.groupName)}</strong> family contact book on Kontax.</p>` +
    `<p><a href="${link}">${cta}</a></p>` +
    `<p style="color:#8b938c;font-size:12px">This invite expires in 48 hours.</p>`;
  await sendEmail({ to: opts.email, subject, html, text });
};

export const inviteFamilyMember = async (formData: FormData) => {
  const userId = await requireUserId();
  const email = str(formData, "email").toLowerCase();
  if (!emailPattern.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const group = await db.group.findFirst({
    where: { ownerId: userId, type: "FAMILY" },
    include: { members: true, owner: { select: { name: true, email: true } } },
  });
  if (!group) {
    throw new Error("Create a family group first.");
  }

  // Seat limit: owner + (maxMembers - 1) others; count non-declined members.
  const activeMembers = group.members.filter((m) => m.inviteStatus !== "DECLINED").length;
  if (activeMembers >= group.maxMembers) {
    throw new Error(`Your family book is full (${group.maxMembers} members).`);
  }

  const recipient = await db.user.findUnique({ where: { email }, select: { id: true } });
  // Block duplicate invites / existing members.
  const dupe = group.members.find(
    (m) => m.invitedEmail === email || m.userId === recipient?.id,
  );
  if (dupe && dupe.inviteStatus !== "DECLINED") {
    throw new Error("That person is already invited or a member.");
  }

  const token = randomBytes(24).toString("base64url");
  const data = {
    groupId: group.id,
    userId: recipient?.id ?? null,
    invitedEmail: email,
    role: "MEMBER" as const,
    inviteStatus: "PENDING" as const,
    canEdit: true,
    inviteToken: token,
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    invitedByUserId: userId,
  };
  if (dupe) {
    await db.groupMember.update({ where: { id: dupe.id }, data });
  } else {
    await db.groupMember.create({ data });
  }

  const ownerName = group.owner.name?.trim() ?? group.owner.email ?? "A Kontax user";
  await sendInviteEmail({
    email,
    groupName: group.name,
    ownerName,
    token,
    recipientExists: Boolean(recipient),
  });

  revalidatePath("/settings/family");
};

// --- Accept / decline (token) -----------------------------------------------
export const acceptFamilyInvite = async (formData: FormData) => {
  const userId = await requireUserId();
  const token = str(formData, "token");

  const member = await db.groupMember.findUnique({
    where: { inviteToken: token },
    include: { user: { select: { email: true } } },
  });
  if (member?.inviteStatus !== "PENDING") {
    throw new Error("This invite is no longer valid.");
  }
  if ((member.inviteExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY) < Date.now()) {
    throw new Error("This invite has expired. Ask the owner to resend it.");
  }

  await db.groupMember.update({
    where: { id: member.id },
    data: {
      userId,
      inviteStatus: "ACCEPTED",
      joinedAt: new Date(),
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  revalidatePath("/");
  revalidatePath("/settings/family");
  redirect("/?tab=people&filter=all");
};

export const declineFamilyInvite = async (formData: FormData) => {
  await requireUserId();
  const token = str(formData, "token");
  const member = await db.groupMember.findUnique({ where: { inviteToken: token } });
  if (member?.inviteStatus === "PENDING") {
    await db.groupMember.update({
      where: { id: member.id },
      data: { inviteStatus: "DECLINED", inviteToken: null, inviteExpiresAt: null },
    });
  }
  revalidatePath("/settings/family");
  redirect("/contacts");
};

// --- Owner management: revoke invite / remove member ------------------------
const requireOwnedMember = async (ownerId: string, memberId: string) => {
  const member = await db.groupMember.findFirst({
    where: { id: memberId, group: { ownerId, type: "FAMILY" } },
    include: { group: { select: { ownerId: true } } },
  });
  if (!member) {
    throw new Error("Member not found.");
  }
  return member;
};

export const removeFamilyMember = async (formData: FormData) => {
  const userId = await requireUserId();
  const memberId = str(formData, "memberId");
  const member = await requireOwnedMember(userId, memberId);
  if (member.role === "OWNER") {
    throw new Error("The owner can't be removed. Transfer ownership or delete the group.");
  }
  // Removing a member only revokes shared-book access; private contacts untouched.
  await db.groupMember.delete({ where: { id: member.id } });
  revalidatePath("/settings/family");
};

// --- Shared contact operations (P13-03) -------------------------------------
// Portable fields copied when adding a private contact to the family book.
const COPY_SELECT = {
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
  emailEntries: true,
  phone: true,
  phoneEntries: true,
  company: true,
  phoneticCompany: true,
  jobTitle: true,
  department: true,
  website: true,
  websiteEntries: true,
  birthday: true,
  address: true,
  addressEntries: true,
  significantDates: true,
  relatedPeople: true,
  customFields: true,
  notes: true,
} as const;

const jsonOrUndef = (v: unknown) => (v == null ? undefined : (v as never));

// "Add to family book": copy one of the user's private contacts into the shared
// book (a copy, not a move — the original is untouched). Creates a new Contact
// owned (nominally) by the group owner + a GroupContact link.
export const addContactToFamilyBook = async (formData: FormData) => {
  const userId = await requireUserId();
  const contactId = str(formData, "contactId");

  const membership = await getUserFamilyMembership(userId);
  if (!membership) {
    throw new Error("Join or create a family book first.");
  }
  if (!membership.canEdit) {
    throw new Error("You have view-only access to the family book.");
  }
  if (!membership.bookId) {
    throw new Error("This family group has no shared book.");
  }

  // Must be a private contact the user owns.
  const source = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: COPY_SELECT,
  });
  if (!source) {
    throw new Error("Contact not found.");
  }

  const group = await db.group.findUnique({
    where: { id: membership.groupId },
    select: { ownerId: true, name: true },
  });
  if (!group) {
    throw new Error("Family group not found.");
  }

  // Already in the book?
  const dupe = await db.groupContact.findFirst({
    where: {
      groupAddressBookId: membership.bookId,
      contact: { fullName: source.fullName, email: source.email },
    },
    select: { id: true },
  });
  if (dupe) {
    throw new Error("A contact with that name is already in the family book.");
  }

  await db.$transaction(async (tx) => {
    const copy = await tx.contact.create({
      data: {
        userId: group.ownerId, // group owns the shared contact (nominal owner)
        fullName: source.fullName,
        firstName: source.firstName,
        middleName: source.middleName,
        lastName: source.lastName,
        phoneticFirstName: source.phoneticFirstName,
        phoneticLastName: source.phoneticLastName,
        namePrefix: source.namePrefix,
        nameSuffix: source.nameSuffix,
        nickname: source.nickname,
        email: source.email,
        emailEntries: jsonOrUndef(source.emailEntries),
        phone: source.phone,
        phoneEntries: jsonOrUndef(source.phoneEntries),
        company: source.company,
        phoneticCompany: source.phoneticCompany,
        jobTitle: source.jobTitle,
        department: source.department,
        website: source.website,
        websiteEntries: jsonOrUndef(source.websiteEntries),
        birthday: source.birthday,
        address: source.address,
        addressEntries: jsonOrUndef(source.addressEntries),
        significantDates: jsonOrUndef(source.significantDates),
        relatedPeople: jsonOrUndef(source.relatedPeople),
        customFields: jsonOrUndef(source.customFields),
        notes: source.notes,
        sourceType: "MANUAL",
        sourceDetail: `${membership.groupName} (family book)`,
        lastMutatedBy: "MANUAL",
      },
      select: { id: true },
    });
    await tx.groupContact.create({
      data: {
        groupAddressBookId: membership.bookId!,
        contactId: copy.id,
        addedByUserId: userId,
      },
    });
    await emitEvent(tx, {
      userId,
      contactId: copy.id,
      eventType: "CONTACT_CREATED",
      actor: "USER",
      payload: { familyBook: membership.groupName },
    });
  });

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
};

// --- Owner management: permissions, resend, delete (P13-06) -----------------
export const setMemberCanEdit = async (formData: FormData) => {
  const userId = await requireUserId();
  const memberId = str(formData, "memberId");
  const canEdit = str(formData, "canEdit") === "true";
  const member = await requireOwnedMember(userId, memberId);
  if (member.role === "OWNER") {
    throw new Error("The owner always has edit access.");
  }
  await db.groupMember.update({ where: { id: member.id }, data: { canEdit } });
  revalidatePath("/settings/family");
};

export const resendFamilyInvite = async (formData: FormData) => {
  const userId = await requireUserId();
  const memberId = str(formData, "memberId");
  const member = await requireOwnedMember(userId, memberId);
  if (member.inviteStatus !== "PENDING" || !member.invitedEmail) {
    throw new Error("That invite can't be resent.");
  }
  const group = await db.group.findUnique({
    where: { id: member.groupId },
    include: { owner: { select: { name: true, email: true } } },
  });
  if (!group) throw new Error("Group not found.");

  const token = randomBytes(24).toString("base64url");
  await db.groupMember.update({
    where: { id: member.id },
    data: { inviteToken: token, inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  const recipient = await db.user.findUnique({
    where: { email: member.invitedEmail },
    select: { id: true },
  });
  await sendInviteEmail({
    email: member.invitedEmail,
    groupName: group.name,
    ownerName: group.owner.name?.trim() ?? group.owner.email ?? "A Kontax user",
    token,
    recipientExists: Boolean(recipient),
  });
  revalidatePath("/settings/family");
};

// Delete the family group. Owner only. Permanently deletes the shared contacts
// (they live in the book, not a member's private library) and all membership.
export const deleteFamilyGroup = async (formData: FormData) => {
  const userId = await requireUserId();
  const groupId = str(formData, "groupId");
  const group = await db.group.findFirst({
    where: { id: groupId, ownerId: userId, type: "FAMILY" },
    include: { addressBooks: { include: { contacts: { select: { contactId: true } } } } },
  });
  if (!group) {
    throw new Error("Family group not found.");
  }
  const contactIds = group.addressBooks.flatMap((b) => b.contacts.map((c) => c.contactId));

  await db.$transaction(async (tx) => {
    if (contactIds.length > 0) {
      // Deleting the Contact rows cascades their GroupContact links.
      await tx.contact.deleteMany({ where: { id: { in: contactIds } } });
    }
    // Deleting the group cascades members + address books.
    await tx.group.delete({ where: { id: group.id } });
  });

  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings");
};

export const leaveFamilyGroup = async (formData: FormData) => {
  const userId = await requireUserId();
  const groupId = str(formData, "groupId");
  const member = await db.groupMember.findFirst({
    where: { groupId, userId, inviteStatus: "ACCEPTED" },
    select: { id: true, role: true },
  });
  if (!member) {
    throw new Error("You're not a member of that group.");
  }
  if (member.role === "OWNER") {
    throw new Error("The owner can't leave. Transfer ownership or delete the group.");
  }
  await db.groupMember.delete({ where: { id: member.id } });
  revalidatePath("/");
  revalidatePath("/settings/family");
};
