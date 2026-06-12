"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { emitEvent } from "~/lib/activity";
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";
import { appUrl, sendEmail } from "~/server/email";
import { canEditTeamBook } from "~/server/team-access";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

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
  // P21-07: impersonation sessions are read-only.
  if (session.impersonatedBy) {
    throw new Error("This is a read-only impersonation session — changes are blocked.");
  }
  return session.user.id;
};

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The team the user owns or administers (owner/admin), used for management gates.
const getManageableTeam = async (userId: string) => {
  const member = await db.groupMember.findFirst({
    where: {
      userId,
      inviteStatus: "ACCEPTED",
      role: { in: ["OWNER", "ADMIN"] },
      group: { type: "TEAM" },
    },
    include: { group: true },
  });
  return member ? { team: member.group, role: member.role } : null;
};

// --- Create -----------------------------------------------------------------
export const createTeam = async (formData: FormData) => {
  const userId = await requireUserId();
  const name = str(formData, "name") || "My Team";
  const description = str(formData, "description") || null;

  const billing = await getUserBillingContext(userId);
  if (!billing.entitlements.teamsEnabled) {
    throw new Error("A Teams plan is required to create a team.");
  }
  const existing = await db.group.findFirst({
    where: { ownerId: userId, type: "TEAM" },
    select: { id: true },
  });
  if (existing) {
    redirect("/settings/teams");
  }

  const maxMembers = billing.entitlements.memberSlotsLimit ?? 25;
  await db.group.create({
    data: {
      ownerId: userId,
      type: "TEAM",
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
      // First address book seeds the team with one book (Teams can add more).
      addressBooks: { create: { name: "Team contacts", description, isDefault: false } },
    },
  });

  revalidatePath("/settings/teams");
  revalidatePath("/settings");
  redirect("/settings/teams");
};

// --- Invite -----------------------------------------------------------------
const sendInviteEmail = async (opts: {
  email: string;
  teamName: string;
  inviterName: string;
  token: string;
  recipientExists: boolean;
}) => {
  const link = `${appUrl()}/teams/join/${opts.token}`;
  const subject = `${opts.inviterName} invited you to the ${opts.teamName} team on Kontax`;
  const cta = opts.recipientExists
    ? "Accept the invitation"
    : "Create your free Kontax account to join";
  const text = `${opts.inviterName} invited you to the "${opts.teamName}" team on Kontax.\n\n${cta}: ${link}\n\nThis invite expires in 48 hours.`;
  const html =
    `<p>${escapeHtml(opts.inviterName)} invited you to the <strong>${escapeHtml(opts.teamName)}</strong> team on Kontax.</p>` +
    `<p><a href="${link}">${cta}</a></p>` +
    `<p style="color:#8b938c;font-size:12px">This invite expires in 48 hours.</p>`;
  await sendEmail({ to: opts.email, subject, html, text });
};

export const inviteTeamMember = async (formData: FormData) => {
  const userId = await requireUserId();
  const email = str(formData, "email").toLowerCase();
  if (!emailPattern.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  const manageable = await getManageableTeam(userId);
  if (!manageable) {
    throw new Error("Only the team owner or an admin can invite members.");
  }
  const team = await db.group.findUnique({
    where: { id: manageable.team.id },
    include: { members: true, owner: { select: { name: true, email: true } } },
  });
  if (!team) throw new Error("Team not found.");

  const activeMembers = team.members.filter((m) => m.inviteStatus !== "DECLINED").length;
  if (activeMembers >= team.maxMembers) {
    throw new Error(`Your team is full (${team.maxMembers} members).`);
  }

  const recipient = await db.user.findUnique({ where: { email }, select: { id: true } });
  const dupe = team.members.find(
    (m) => m.invitedEmail === email || m.userId === recipient?.id,
  );
  if (dupe && dupe.inviteStatus !== "DECLINED") {
    throw new Error("That person is already invited or a member.");
  }

  const token = randomBytes(24).toString("base64url");
  const role: "ADMIN" | "MEMBER" = str(formData, "role") === "ADMIN" ? "ADMIN" : "MEMBER";
  const data = {
    groupId: team.id,
    userId: recipient?.id ?? null,
    invitedEmail: email,
    role,
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

  const inviterName = team.owner.name?.trim() ?? team.owner.email ?? "A Kontax user";
  await sendInviteEmail({
    email,
    teamName: team.name,
    inviterName,
    token,
    recipientExists: Boolean(recipient),
  });
  revalidatePath("/settings/teams");
};

// --- Accept / decline -------------------------------------------------------
export const acceptTeamInvite = async (formData: FormData) => {
  const userId = await requireUserId();
  const token = str(formData, "token");
  const member = await db.groupMember.findUnique({ where: { inviteToken: token } });
  if (member?.inviteStatus !== "PENDING") {
    throw new Error("This invite is no longer valid.");
  }
  if ((member.inviteExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY) < Date.now()) {
    throw new Error("This invite has expired. Ask an admin to resend it.");
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
  revalidatePath("/contacts");
  revalidatePath("/settings/teams");
  redirect("/contacts?tab=people&filter=all");
};

export const declineTeamInvite = async (formData: FormData) => {
  await requireUserId();
  const token = str(formData, "token");
  const member = await db.groupMember.findUnique({ where: { inviteToken: token } });
  if (member?.inviteStatus === "PENDING") {
    await db.groupMember.update({
      where: { id: member.id },
      data: { inviteStatus: "DECLINED", inviteToken: null, inviteExpiresAt: null },
    });
  }
  revalidatePath("/settings/teams");
  redirect("/contacts");
};

// --- Role / membership management -------------------------------------------
const requireManagedMember = async (userId: string, memberId: string) => {
  const manageable = await getManageableTeam(userId);
  if (!manageable) {
    throw new Error("Only the team owner or an admin can manage members.");
  }
  const member = await db.groupMember.findFirst({
    where: { id: memberId, groupId: manageable.team.id },
  });
  if (!member) {
    throw new Error("Member not found.");
  }
  return { member, actorRole: manageable.role, team: manageable.team };
};

export const setTeamMemberRole = async (formData: FormData) => {
  const userId = await requireUserId();
  const memberId = str(formData, "memberId");
  const role = str(formData, "role"); // "ADMIN" | "MEMBER"
  const { member, actorRole } = await requireManagedMember(userId, memberId);
  if (member.role === "OWNER") {
    throw new Error("The owner's role can't be changed here.");
  }
  if (role === "ADMIN" && actorRole !== "OWNER") {
    throw new Error("Only the team owner can promote a member to admin.");
  }
  if (role !== "ADMIN" && role !== "MEMBER") {
    throw new Error("Unknown role.");
  }
  await db.groupMember.update({ where: { id: member.id }, data: { role } });
  revalidatePath("/settings/teams");
};

export const removeTeamMember = async (formData: FormData) => {
  const userId = await requireUserId();
  const memberId = str(formData, "memberId");
  const { member } = await requireManagedMember(userId, memberId);
  if (member.role === "OWNER") {
    throw new Error("The owner can't be removed. Transfer ownership or delete the team.");
  }
  await db.groupMember.delete({ where: { id: member.id } });
  revalidatePath("/settings/teams");
};

export const resendTeamInvite = async (formData: FormData) => {
  const userId = await requireUserId();
  const memberId = str(formData, "memberId");
  const { member, team } = await requireManagedMember(userId, memberId);
  if (member.inviteStatus !== "PENDING" || !member.invitedEmail) {
    throw new Error("That invite can't be resent.");
  }
  const owner = await db.user.findUnique({
    where: { id: team.ownerId },
    select: { name: true, email: true },
  });
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
    teamName: team.name,
    inviterName: owner?.name?.trim() ?? owner?.email ?? "A Kontax user",
    token,
    recipientExists: Boolean(recipient),
  });
  revalidatePath("/settings/teams");
};

// --- Address books (P14-03) -------------------------------------------------
const requireManagedBook = async (userId: string, bookId: string) => {
  const manageable = await getManageableTeam(userId);
  if (!manageable) {
    throw new Error("Only the team owner or an admin can manage address books.");
  }
  const book = await db.groupAddressBook.findFirst({
    where: { id: bookId, groupId: manageable.team.id },
  });
  if (!book) {
    throw new Error("Address book not found.");
  }
  return { book, team: manageable.team };
};

export const createTeamBook = async (formData: FormData) => {
  const userId = await requireUserId();
  const name = str(formData, "name");
  const description = str(formData, "description") || null;
  if (!name) {
    throw new Error("Give the address book a name.");
  }
  const manageable = await getManageableTeam(userId);
  if (!manageable) {
    throw new Error("Only the team owner or an admin can create address books.");
  }
  await db.groupAddressBook.create({
    data: { groupId: manageable.team.id, name, description, isDefault: false },
  });
  revalidatePath("/settings/teams");
};

export const renameTeamBook = async (formData: FormData) => {
  const userId = await requireUserId();
  const bookId = str(formData, "bookId");
  const name = str(formData, "name");
  const description = str(formData, "description") || null;
  if (!name) {
    throw new Error("Give the address book a name.");
  }
  await requireManagedBook(userId, bookId);
  await db.groupAddressBook.update({ where: { id: bookId }, data: { name, description } });
  revalidatePath("/settings/teams");
};

export const archiveTeamBook = async (formData: FormData) => {
  const userId = await requireUserId();
  const bookId = str(formData, "bookId");
  const { book } = await requireManagedBook(userId, bookId);
  await db.groupAddressBook.update({
    where: { id: bookId },
    data: { archivedAt: book.archivedAt ? null : new Date() },
  });
  revalidatePath("/settings/teams");
};

// Delete a book: soft-archive its contacts (audit trail) then drop the book.
export const deleteTeamBook = async (formData: FormData) => {
  const userId = await requireUserId();
  const bookId = str(formData, "bookId");
  await requireManagedBook(userId, bookId);
  const links = await db.groupContact.findMany({
    where: { groupAddressBookId: bookId },
    select: { contactId: true },
  });
  const contactIds = links.map((l) => l.contactId);
  await db.$transaction(async (tx) => {
    if (contactIds.length > 0) {
      await tx.contact.updateMany({
        where: { id: { in: contactIds } },
        data: { archivedAt: new Date(), syncTombstoneAt: new Date() },
      });
    }
    await tx.groupAddressBook.delete({ where: { id: bookId } });
  });
  revalidatePath("/settings/teams");
};

// Set a member's permission (EDIT | VIEW | NONE) for one book.
export const setMemberBookPermission = async (formData: FormData) => {
  const userId = await requireUserId();
  const memberId = str(formData, "memberId");
  const bookId = str(formData, "bookId");
  const permission = str(formData, "permission");
  if (!["EDIT", "VIEW", "NONE"].includes(permission)) {
    throw new Error("Unknown permission.");
  }
  const { member } = await requireManagedMember(userId, memberId);
  await requireManagedBook(userId, bookId);
  if (member.role !== "MEMBER") {
    throw new Error("Owners and admins always have full access.");
  }
  const current =
    member.addressBookPermissions && typeof member.addressBookPermissions === "object"
      ? (member.addressBookPermissions as Record<string, string>)
      : {};
  const next = { ...current, [bookId]: permission };
  await db.groupMember.update({
    where: { id: member.id },
    data: { addressBookPermissions: next },
  });
  revalidatePath("/settings/teams");
};

// "Add to team book": copy a private contact into a team book (copy, not move).
const TEAM_COPY_SELECT = {
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

export const addContactToTeamBook = async (formData: FormData) => {
  const userId = await requireUserId();
  const contactId = str(formData, "contactId");
  const bookId = str(formData, "bookId");

  if (!(await canEditTeamBook(userId, bookId))) {
    throw new Error("You don't have edit access to that team book.");
  }
  const book = await db.groupAddressBook.findUnique({
    where: { id: bookId },
    select: { name: true, group: { select: { ownerId: true, name: true } } },
  });
  if (!book) {
    throw new Error("Team book not found.");
  }
  const source = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: TEAM_COPY_SELECT,
  });
  if (!source) {
    throw new Error("Contact not found.");
  }
  const jsonOrUndef = (v: unknown) => (v == null ? undefined : (v as never));

  await db.$transaction(async (tx) => {
    const copy = await tx.contact.create({
      data: {
        userId: book.group.ownerId,
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
        sourceDetail: `${book.group.name} · ${book.name}`,
        lastMutatedBy: "MANUAL",
      },
      select: { id: true },
    });
    await tx.groupContact.create({
      data: { groupAddressBookId: bookId, contactId: copy.id, addedByUserId: userId },
    });
    await emitEvent(tx, {
      userId,
      contactId: copy.id,
      eventType: "CONTACT_CREATED",
      actor: "USER",
      payload: { teamBook: `${book.group.name} · ${book.name}` },
    });
  });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
};

// --- Team CardDAV sync accounts (P14-06) ------------------------------------
// Link one of the admin's connected CardDAV accounts to a team book; sync then
// operates on that book's contacts (handled in the sync runner).
export const linkTeamSyncAccount = async (formData: FormData) => {
  const userId = await requireUserId();
  const syncAccountId = str(formData, "syncAccountId");
  const bookId = str(formData, "bookId");
  const manageable = await getManageableTeam(userId);
  if (!manageable) {
    throw new Error("Only the team owner or an admin can manage sync accounts.");
  }
  const [account, book] = await Promise.all([
    db.syncAccount.findFirst({ where: { id: syncAccountId, userId }, select: { id: true } }),
    db.groupAddressBook.findFirst({
      where: { id: bookId, groupId: manageable.team.id },
      select: { id: true },
    }),
  ]);
  if (!account) {
    throw new Error("That sync account isn't yours to link.");
  }
  if (!book) {
    throw new Error("Address book not found.");
  }
  const existing = await db.teamSyncAccount.findUnique({ where: { syncAccountId } });
  if (existing) {
    throw new Error("That sync account is already linked.");
  }
  await db.teamSyncAccount.create({
    data: {
      groupId: manageable.team.id,
      syncAccountId,
      addressBookId: bookId,
      addedByUserId: userId,
    },
  });
  revalidatePath("/settings/teams");
};

export const unlinkTeamSyncAccount = async (formData: FormData) => {
  const userId = await requireUserId();
  const teamSyncAccountId = str(formData, "teamSyncAccountId");
  const manageable = await getManageableTeam(userId);
  if (!manageable) {
    throw new Error("Only the team owner or an admin can manage sync accounts.");
  }
  const link = await db.teamSyncAccount.findFirst({
    where: { id: teamSyncAccountId, groupId: manageable.team.id },
    select: { id: true },
  });
  if (!link) {
    throw new Error("Sync link not found.");
  }
  await db.teamSyncAccount.delete({ where: { id: link.id } });
  revalidatePath("/settings/teams");
};

export const leaveTeam = async (formData: FormData) => {
  const userId = await requireUserId();
  const groupId = str(formData, "groupId");
  const member = await db.groupMember.findFirst({
    where: { groupId, userId, inviteStatus: "ACCEPTED" },
    select: { id: true, role: true },
  });
  if (!member) {
    throw new Error("You're not a member of that team.");
  }
  if (member.role === "OWNER") {
    throw new Error("The owner can't leave. Transfer ownership or delete the team.");
  }
  await db.groupMember.delete({ where: { id: member.id } });
  revalidatePath("/contacts");
  revalidatePath("/settings/teams");
};

// Owner only. Permanently removes the team, its books, and their contacts.
export const deleteTeam = async (formData: FormData) => {
  const userId = await requireUserId();
  const groupId = str(formData, "groupId");
  const team = await db.group.findFirst({
    where: { id: groupId, ownerId: userId, type: "TEAM" },
    include: { addressBooks: { include: { contacts: { select: { contactId: true } } } } },
  });
  if (!team) {
    throw new Error("Team not found.");
  }
  const contactIds = team.addressBooks.flatMap((b) => b.contacts.map((c) => c.contactId));
  await db.$transaction(async (tx) => {
    if (contactIds.length > 0) {
      await tx.contact.deleteMany({ where: { id: { in: contactIds } } });
    }
    await tx.group.delete({ where: { id: team.id } });
  });
  revalidatePath("/contacts");
  revalidatePath("/settings");
  redirect("/settings");
};
