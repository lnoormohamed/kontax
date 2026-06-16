import { db } from "~/server/db";

export type TeamGraceState = "active" | "grace" | "locked";

// Derive whether a team is active, in grace, or locked based solely on the
// group row and the owner's current billing. teamsEnabled=true always means
// active (re-upgrade clears teamsGraceEndsAt, but this guards the edge case).
export const getTeamGraceState = (
  teamsGraceEndsAt: Date | null,
  teamsEnabled: boolean,
): TeamGraceState => {
  if (teamsEnabled || teamsGraceEndsAt === null) return "active";
  return teamsGraceEndsAt > new Date() ? "grace" : "locked";
};

// Authorization helpers for Teams (Phase 14) shared address books.
// A team has multiple GroupAddressBooks. Each MEMBER has a per-book permission
// (EDIT | VIEW | NONE) stored in GroupMember.addressBookPermissions JSON;
// the default for an unspecified book is EDIT. OWNER/ADMIN always have EDIT.

export type BookPermission = "EDIT" | "VIEW" | "NONE";

export type TeamMembership = {
  memberId: string;
  groupId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  isManager: boolean; // owner or admin
  teamName: string;
  permissions: Record<string, BookPermission>;
};

const asPermMap = (value: unknown): Record<string, BookPermission> => {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, BookPermission> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === "EDIT" || v === "VIEW" || v === "NONE") out[k] = v;
  }
  return out;
};

export const getUserTeamMembership = async (userId: string): Promise<TeamMembership | null> => {
  const member = await db.groupMember.findFirst({
    where: { userId, inviteStatus: "ACCEPTED", group: { type: "TEAM" } },
    include: { group: { select: { name: true } } },
  });
  if (!member) return null;
  return {
    memberId: member.id,
    groupId: member.groupId,
    role: member.role,
    isManager: member.role === "OWNER" || member.role === "ADMIN",
    teamName: member.group.name,
    permissions: asPermMap(member.addressBookPermissions),
  };
};

// Resolve a member's permission for one book (managers always EDIT; default EDIT).
export const resolveBookPermission = (
  membership: TeamMembership,
  bookId: string,
): BookPermission => {
  if (membership.isManager) return "EDIT";
  return membership.permissions[bookId] ?? "EDIT";
};

// The (non-archived) team books the user can see, with their permission.
export const getAccessibleTeamBooks = async (
  userId: string,
): Promise<{ id: string; name: string; permission: BookPermission }[]> => {
  const membership = await getUserTeamMembership(userId);
  if (!membership) return [];
  const books = await db.groupAddressBook.findMany({
    where: { groupId: membership.groupId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  return books
    .map((b) => ({ id: b.id, name: b.name, permission: resolveBookPermission(membership, b.id) }))
    .filter((b) => b.permission !== "NONE");
};

// Can the user EDIT this team book right now? (membership + not archived + EDIT)
export const canEditTeamBook = async (userId: string, bookId: string): Promise<boolean> => {
  const membership = await getUserTeamMembership(userId);
  if (!membership) return false;
  const book = await db.groupAddressBook.findFirst({
    where: { id: bookId, groupId: membership.groupId, archivedAt: null },
    select: { id: true },
  });
  if (!book) return false;
  return resolveBookPermission(membership, bookId) === "EDIT";
};

// The team-book context for a contact, if it lives in a TEAM book.
export const getContactTeamContext = async (contactId: string) => {
  const gc = await db.groupContact.findFirst({
    where: { contactId, groupAddressBook: { group: { type: "TEAM" } } },
    include: {
      groupAddressBook: { include: { group: { select: { id: true, name: true } } } },
    },
  });
  if (!gc) return null;
  return {
    bookId: gc.groupAddressBookId,
    bookName: gc.groupAddressBook.name,
    archived: Boolean(gc.groupAddressBook.archivedAt),
    groupId: gc.groupAddressBook.group.id,
    teamName: gc.groupAddressBook.group.name,
  };
};

// P34F-06: read-only billing summary for any member. Never returns Stripe IDs.
export const getTeamBillingSummary = async (groupId: string) => {
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: {
      teamsEnabled: true,
      teamsGraceEndsAt: true,
      owner: { select: { name: true, email: true } },
      subscriptions: {
        where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          plan: true,
          status: true,
          memberSlotsLimit: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
      _count: { select: { members: { where: { inviteStatus: "ACCEPTED" } } } },
    },
  });
  if (!group) return null;
  const sub = group.subscriptions[0] ?? null;
  return {
    ownerName: group.owner.name ?? group.owner.email,
    plan: sub?.plan ?? "TEAMS",
    status: sub?.status ?? null,
    seatsUsed: group._count.members,
    seatsLimit: sub?.memberSlotsLimit ?? null,
    renewsAt: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    graceState: getTeamGraceState(group.teamsGraceEndsAt, group.teamsEnabled),
    graceEndsAt: group.teamsGraceEndsAt,
  };
};

// The manageable team (owner/admin) for management actions.
export const getManageableTeam = async (userId: string) => {
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
