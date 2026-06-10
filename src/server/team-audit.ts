import { db } from "~/server/db";
import { getManageableTeam } from "~/server/team-access";

// Team audit log (P14-05): every change to a team address book, scoped by the
// contacts that live in the team's books. Admin-only. Unlimited retention.

export type AuditFilters = {
  memberId?: string;
  bookId?: string;
  eventType?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  cursor?: string; // ISO createdAt
};

const AUDIT_LIMIT = 100;

export const AUDIT_EVENT_TYPES = [
  "CONTACT_CREATED",
  "CONTACT_UPDATED",
  "CONTACT_ARCHIVED",
  "CONTACT_RESTORED",
  "CONTACT_MERGED",
  "CONTACT_IMPORTED",
  "SYNC_PUSHED",
  "SYNC_PULLED",
] as const;

export type TeamAuditRow = {
  id: string;
  createdAt: Date;
  eventType: string;
  actorDetail: string | null;
  memberName: string;
  contactName: string;
  bookName: string;
  diffCount: number;
};

export const loadTeamAudit = async (userId: string, filters: AuditFilters) => {
  const manageable = await getManageableTeam(userId);
  if (!manageable) {
    return null;
  }
  const teamId = manageable.team.id;

  const [books, members] = await Promise.all([
    db.groupAddressBook.findMany({
      where: { groupId: teamId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    db.groupMember.findMany({
      where: { groupId: teamId, inviteStatus: "ACCEPTED" },
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
  ]);

  // Map the team's book contacts → bookId (optionally scoped to one book).
  const bookIds = filters.bookId ? [filters.bookId] : books.map((b) => b.id);
  const links = await db.groupContact.findMany({
    where: { groupAddressBookId: { in: bookIds } },
    select: { contactId: true, groupAddressBookId: true },
  });
  const contactBook = new Map(links.map((l) => [l.contactId, l.groupAddressBookId]));
  const contactIds = [...contactBook.keys()];
  const bookName = new Map(books.map((b) => [b.id, b.name]));
  const memberName = new Map(
    members.map((m) => [m.userId ?? "", m.user?.name?.trim() ?? m.user?.email ?? "Member"]),
  );

  if (contactIds.length === 0) {
    return { team: manageable.team, books, members, rows: [] as TeamAuditRow[], nextCursor: null };
  }

  const fromDate = filters.from ? new Date(`${filters.from}T00:00:00Z`) : null;
  const toDate = filters.to ? new Date(`${filters.to}T23:59:59Z`) : null;
  const cursorDate = filters.cursor ? new Date(filters.cursor) : null;

  const rowsRaw = await db.activityEvent.findMany({
    where: {
      contactId: { in: contactIds },
      ...(filters.memberId ? { userId: filters.memberId } : {}),
      ...(filters.eventType ? { eventType: filters.eventType as never } : {}),
      ...(fromDate || toDate
        ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
        : {}),
      ...(cursorDate && !Number.isNaN(cursorDate.getTime()) ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: AUDIT_LIMIT + 1,
    select: {
      id: true,
      createdAt: true,
      eventType: true,
      actorDetail: true,
      userId: true,
      payload: true,
      contactId: true,
      contact: { select: { fullName: true } },
    },
  });

  const hasMore = rowsRaw.length > AUDIT_LIMIT;
  const page = rowsRaw.slice(0, AUDIT_LIMIT);
  const rows: TeamAuditRow[] = page.map((e) => {
    const diffs = (e.payload as { diffs?: unknown[] } | null)?.diffs;
    return {
      id: e.id,
      createdAt: e.createdAt,
      eventType: e.eventType,
      actorDetail: e.actorDetail,
      memberName: memberName.get(e.userId) ?? "Member",
      contactName: e.contact?.fullName ?? "(deleted contact)",
      bookName: bookName.get(contactBook.get(e.contactId ?? "") ?? "") ?? "—",
      diffCount: Array.isArray(diffs) ? diffs.length : 0,
    };
  });

  return {
    team: manageable.team,
    books,
    members,
    rows,
    nextCursor: hasMore ? page[page.length - 1]?.createdAt.toISOString() ?? null : null,
  };
};
