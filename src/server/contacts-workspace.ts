import { Prisma } from "../../generated/prisma";
import { db } from "~/server/db";
import { buildNoteMatchExcerpt } from "~/lib/note-match";
import { isFullTextEligible, searchContactIds } from "~/server/contact-search";
import { getUserFamilyMembership } from "~/server/family-access";
import { getAccessibleTeamBooks } from "~/server/team-access";
import type { ContactHealthKey } from "~/server/contact-health";

/**
 * P38-02 — workspace contact list as a single windowed SQL query.
 *
 * Replaces the three per-scope `findMany` calls + in-memory sort with one
 * UNION ALL across private/family/team scopes, ordered and paged in Postgres.
 * The list stays one continuous phone-book-style list in the UI; the client
 * streams further windows in as the user scrolls (no visible pagination).
 *
 * Ordering authority is Postgres (replicating the old JS
 * `compareWorkspaceContacts`: favorites first, then phonetic-aware
 * last/first name with company/full-name fallback). The same WHERE fragments
 * feed the health-card counts so they stay exact under windowing.
 */

export type WorkspaceSortKey = "name" | "updated";
export type WorkspaceFilterKey = "all" | "recent" | "incomplete" | "favorites" | "emergency";

export type WorkspaceScope = {
  userId: string;
  /** Include the user's own (non-group) contacts. */
  includePrivate: boolean;
  /** Personal book filter (private scope only). */
  personalBookId: string | null;
  personalBookIsDefault: boolean;
  /** Family shared book to include (null = none). */
  familyBookId: string | null;
  /** Team shared books to include. */
  teamBookIds: string[];
};

export type WorkspaceListParams = {
  scope: WorkspaceScope;
  archived: boolean;
  /** Raw search text — ILIKE path when FTS ids are not provided. */
  query: string;
  /** FTS result ids for the private scope (null = use ILIKE). */
  ftsPrivateIds: string[] | null;
  /** FTS result ids for the shared scopes (null = use ILIKE). */
  ftsSharedIds: string[] | null;
  /** id → rank map entries for relevance ordering (FTS only). */
  ftsRanked: { id: string; rank: number }[] | null;
  filter: WorkspaceFilterKey;
  label: string | null;
  health: ContactHealthKey | null;
  sort: WorkspaceSortKey;
  /** Ship notes out of the DB to build search-match excerpts. */
  includeNotes: boolean;
  limit: number;
  offset: number;
};

export type WorkspaceRow = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  avatarUrl: string | null;
  isFavorite: boolean;
  isEmergency: boolean;
  sharedKind: "family" | "team" | null;
  labels: unknown;
  // P46-01: the list's primary sort key, lowercased (phoneticLastName ??
  // lastName, else company/full). The alphabet scrubber folds this to an index
  // letter so the rail, section headers, and sort share one key.
  sortName: string;
  noteMatchSnippet?: string;
};

export type WorkspaceHealthCounts = Record<ContactHealthKey, number>;

/** Rows in the first server-rendered window and each scroll-loaded window. */
export const WORKSPACE_PAGE_SIZE = 300;

// --- scope + FTS resolution (shared by the page and the load-more action) ----

export type ResolvedBooks = {
  familyBookId: string | null;
  teamBookIds: string[];
  personalBooks: { id: string; isDefault: boolean }[];
};

/**
 * Build the effective query scope from the user's books and the URL params.
 * Mirrors the book/scope logic in contacts/page.tsx — `bookParam` is only
 * honoured when it matches a book the user can actually access.
 */
export function buildWorkspaceScope(
  userId: string,
  books: ResolvedBooks,
  bookParam: string | null,
  scopeParam: "all" | "private" | "shared",
): WorkspaceScope {
  const activeSharedBook =
    bookParam &&
    (bookParam === books.familyBookId || books.teamBookIds.includes(bookParam))
      ? bookParam
      : null;
  const personalBook = bookParam
    ? books.personalBooks.find((b) => b.id === bookParam) ?? null
    : null;

  const includePrivate = !activeSharedBook && scopeParam !== "shared";
  const includeShared = scopeParam !== "private" && !personalBook;

  const familyTargetId = activeSharedBook
    ? activeSharedBook === books.familyBookId
      ? books.familyBookId
      : null
    : books.familyBookId;
  const teamTargetIds = activeSharedBook
    ? books.teamBookIds.includes(activeSharedBook)
      ? [activeSharedBook]
      : []
    : books.teamBookIds;

  return {
    userId,
    includePrivate,
    personalBookId: personalBook?.id ?? null,
    personalBookIsDefault: personalBook?.isDefault ?? false,
    familyBookId: includeShared ? familyTargetId : null,
    teamBookIds: includeShared ? teamTargetIds : [],
  };
}

/**
 * Full-text search resolution for the workspace list (mirrors P28-07 logic in
 * contacts/page.tsx): private FTS on people/archived tabs, shared FTS only on
 * the people tab, relevance ranking only on the people tab.
 */
export async function resolveWorkspaceFts(
  scope: WorkspaceScope,
  tab: "people" | "archived",
  query: string,
): Promise<{
  ftsPrivateIds: string[] | null;
  ftsSharedIds: string[] | null;
  ftsRanked: { id: string; rank: number }[] | null;
}> {
  if (!query || !isFullTextEligible(query)) {
    return { ftsPrivateIds: null, ftsSharedIds: null, ftsRanked: null };
  }
  const privateRows = await searchContactIds({ userId: scope.userId }, query);
  const sharedBookIds = [scope.familyBookId, ...scope.teamBookIds].filter(
    (id): id is string => !!id,
  );
  const sharedRows =
    tab === "people" && sharedBookIds.length > 0
      ? await searchContactIds({ groupBookIds: sharedBookIds }, query)
      : null;
  return {
    ftsPrivateIds: privateRows.map((r) => r.id),
    ftsSharedIds: sharedRows ? sharedRows.map((r) => r.id) : null,
    ftsRanked: tab === "people" ? [...privateRows, ...(sharedRows ?? [])] : null,
  };
}

/** The user's books, resolved fresh (used by the load-more server action). */
export async function resolveWorkspaceBooks(userId: string): Promise<ResolvedBooks> {
  const [family, teamBooks, personalBooks] = await Promise.all([
    getUserFamilyMembership(userId),
    getAccessibleTeamBooks(userId),
    db.addressBook.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, isDefault: true },
    }),
  ]);
  return {
    familyBookId: family?.bookId ?? null,
    teamBookIds: teamBooks.map((b) => b.id),
    personalBooks,
  };
}

const STALE_SYNC_DAYS = 45;

const EMPTY = Prisma.empty;

const blank = (col: Prisma.Sql) => Prisma.sql`(${col} IS NULL OR trim(${col}) = '')`;

// --- health predicates (must mirror src/server/contact-health.ts) -----------

const healthPredicate = (key: ContactHealthKey, now: Date): Prisma.Sql => {
  switch (key) {
    case "missing-methods":
      return Prisma.sql`(${blank(Prisma.sql`c.email`)} OR ${blank(Prisma.sql`c.phone`)})`;
    case "missing-context":
      return Prisma.sql`(${blank(Prisma.sql`c.company`)} AND ${blank(Prisma.sql`c."jobTitle"`)} AND ${blank(Prisma.sql`c.department`)})`;
    case "unlabeled":
      return Prisma.sql`NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(c.labels) = 'array' THEN c.labels ELSE '[]'::jsonb END
        ) AS lv(v) WHERE trim(lv.v) <> ''
      )`;
    case "missing-dates":
      return Prisma.sql`(${blank(Prisma.sql`c.birthday`)} AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(c."significantDates") = 'array' THEN c."significantDates" ELSE '[]'::jsonb END
        ) AS de(e) WHERE jsonb_typeof(de.e) = 'object' AND trim(coalesce(de.e ->> 'date', '')) <> ''
      ))`;
    case "sync-attention": {
      const staleCutoff = new Date(now.getTime() - STALE_SYNC_DAYS * 86_400_000);
      return Prisma.sql`EXISTS (
        SELECT 1 FROM "SyncContactLink" l
        LEFT JOIN "SyncAccount" a ON a.id = l."syncAccountId"
        WHERE l."contactId" = c.id AND (
          coalesce(l."lastErrorCode", '') <> ''
          OR a.status::text IN ('ERROR', 'NEEDS_REAUTH', 'PAUSED')
          OR coalesce(l."lastSyncedAt", a."lastSucceededAt") IS NULL
          OR coalesce(l."lastSyncedAt", a."lastSucceededAt") < ${staleCutoff}
        )
      )`;
    }
  }
};

// --- filter / search fragments ----------------------------------------------

const filterPredicate = (filter: WorkspaceFilterKey, now: Date): Prisma.Sql => {
  switch (filter) {
    case "recent": {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      return Prisma.sql`c."updatedAt" >= ${cutoff}`;
    }
    case "incomplete":
      return Prisma.sql`(c.email IS NULL OR c.email = '' OR c.phone IS NULL OR c.phone = '')`;
    case "favorites":
      return Prisma.sql`c."isFavorite" = true`;
    case "emergency":
      return Prisma.sql`c."isEmergency" = true`;
    case "all":
      return Prisma.sql`true`;
  }
};

// Mirrors getSearchConditions in contacts/page.tsx (ILIKE fallback path).
const ilikePredicate = (query: string): Prisma.Sql => {
  const like = `%${query}%`;
  return Prisma.sql`(
    c."fullName" ILIKE ${like}
    OR c."phoneticFirstName" ILIKE ${like}
    OR c."phoneticLastName" ILIKE ${like}
    OR c.nickname ILIKE ${like}
    OR c.email ILIKE ${like}
    OR c.phone ILIKE ${like}
    OR c.company ILIKE ${like}
    OR c."phoneticCompany" ILIKE ${like}
    OR c."jobTitle" ILIKE ${like}
    OR c.website ILIKE ${like}
    OR c.address ILIKE ${like}
  )`;
};

const searchPredicate = (query: string, ftsIds: string[] | null): Prisma.Sql => {
  if (ftsIds) return Prisma.sql`c.id = ANY(${ftsIds}::text[])`;
  if (query) return ilikePredicate(query);
  return Prisma.sql`true`;
};

const labelPredicate = (label: string | null): Prisma.Sql =>
  label ? Prisma.sql`c.labels @> ${JSON.stringify([label])}::jsonb` : Prisma.sql`true`;

// --- name-aware sort keys (must mirror the old getNameAwareSortKeys) --------

// first/last prefer the phonetic reading; empty-name contacts fall back to
// company (or its reading), then full name.
const SORT_KEY_COLUMNS = Prisma.sql`
  lower(coalesce(nullif(trim(c."phoneticFirstName"), ''), nullif(trim(c."firstName"), ''), '')) AS k_first,
  lower(coalesce(nullif(trim(c."phoneticLastName"), ''), nullif(trim(c."lastName"), ''), '')) AS k_last,
  lower(coalesce(nullif(trim(c."phoneticCompany"), ''), nullif(trim(c.company), ''), '')) AS k_company,
  lower(coalesce(nullif(trim(c."fullName"), ''), '')) AS k_full
`;

const NAME_ORDER = Prisma.sql`
  s."isFavorite" DESC,
  CASE WHEN k_first = '' OR k_last = '' THEN coalesce(nullif(k_company, ''), k_full) ELSE k_last END,
  CASE WHEN k_first = '' OR k_last = '' THEN coalesce(nullif(k_company, ''), k_full) ELSE k_first END,
  k_company,
  CASE WHEN k_first = '' OR k_last = '' THEN coalesce(nullif(k_full, ''), k_company) ELSE k_full END,
  s.id
`;

// --- scope branches -----------------------------------------------------------

const ROW_COLUMNS = Prisma.sql`
  c.id,
  c."fullName",
  c."firstName",
  c."lastName",
  c.nickname,
  c.email,
  c.phone,
  c.company,
  c."avatarUrl",
  c."isFavorite",
  c."isEmergency",
  c.labels,
  c."updatedAt",
  c."archivedAt"
`;

type BranchArgs = {
  params: WorkspaceListParams;
  now: Date;
};

const commonPredicates = (
  { params, now }: BranchArgs,
  ftsIds: string[] | null,
): Prisma.Sql => {
  const health = params.health ? healthPredicate(params.health, now) : Prisma.sql`true`;
  return Prisma.sql`${searchPredicate(params.query, ftsIds)}
    AND ${filterPredicate(params.filter, now)}
    AND ${labelPredicate(params.label)}
    AND ${health}`;
};

const privateBranch = (args: BranchArgs): Prisma.Sql => {
  const { scope, archived } = args.params;
  const bookFilter = scope.personalBookId
    ? scope.personalBookIsDefault
      ? Prisma.sql`(c."bookId" = ${scope.personalBookId} OR c."bookId" IS NULL)`
      : Prisma.sql`c."bookId" = ${scope.personalBookId}`
    : Prisma.sql`true`;
  return Prisma.sql`
    SELECT ${ROW_COLUMNS}, ${args.params.includeNotes ? Prisma.sql`c.notes` : Prisma.sql`NULL::text`} AS notes,
      NULL::text AS shared_kind, ${SORT_KEY_COLUMNS}
    FROM "Contact" c
    WHERE c."userId" = ${scope.userId}
      AND c."archivedAt" IS ${archived ? Prisma.sql`NOT NULL` : Prisma.sql`NULL`}
      -- archived view matches the legacy query: no group exclusion there
      AND ${archived ? Prisma.sql`true` : Prisma.sql`NOT EXISTS (SELECT 1 FROM "GroupContact" gc WHERE gc."contactId" = c.id)`}
      AND ${bookFilter}
      AND ${commonPredicates(args, args.params.ftsPrivateIds)}
  `;
};

const sharedBranch = (args: BranchArgs, kind: "family" | "team"): Prisma.Sql => {
  const { scope } = args.params;
  const bookIds = kind === "family" ? [scope.familyBookId!] : scope.teamBookIds;
  return Prisma.sql`
    SELECT ${ROW_COLUMNS}, ${args.params.includeNotes ? Prisma.sql`c.notes` : Prisma.sql`NULL::text`} AS notes,
      ${kind}::text AS shared_kind, ${SORT_KEY_COLUMNS}
    FROM "Contact" c
    WHERE c."archivedAt" IS NULL
      AND EXISTS (
        SELECT 1 FROM "GroupContact" gc
        WHERE gc."contactId" = c.id AND gc."groupAddressBookId" = ANY(${bookIds}::text[])
      )
      AND ${commonPredicates(args, args.params.ftsSharedIds)}
  `;
};

const scopedUnion = (args: BranchArgs): Prisma.Sql | null => {
  const { scope, archived } = args.params;
  const branches: Prisma.Sql[] = [];
  if (scope.includePrivate || archived) branches.push(privateBranch(args));
  if (!archived && scope.familyBookId) branches.push(sharedBranch(args, "family"));
  if (!archived && scope.teamBookIds.length > 0) branches.push(sharedBranch(args, "team"));
  if (branches.length === 0) return null;
  return Prisma.join(branches, " UNION ALL ");
};

// --- public API ----------------------------------------------------------------

type RawRow = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  avatarUrl: string | null;
  isFavorite: boolean;
  isEmergency: boolean;
  labels: unknown;
  notes: string | null;
  shared_kind: "family" | "team" | null;
  sort_name: string;
  total_count: bigint;
};

export async function listWorkspaceContacts(
  params: WorkspaceListParams,
): Promise<{ rows: WorkspaceRow[]; totalCount: number }> {
  const now = new Date();
  const union = scopedUnion({ params, now });
  if (!union) return { rows: [], totalCount: 0 };

  const ftsActive = params.ftsRanked !== null && params.ftsRanked !== undefined;
  const rankJoin = ftsActive
    ? Prisma.sql`LEFT JOIN unnest(
        ${params.ftsRanked!.map((r) => r.id)}::text[],
        ${params.ftsRanked!.map((r) => r.rank)}::float8[]
      ) AS fr(id, rank) ON fr.id = s.id`
    : EMPTY;

  const orderBy = params.archived
    ? params.sort === "name"
      ? NAME_ORDER
      : Prisma.sql`s."archivedAt" DESC, s.id`
    : ftsActive
      ? Prisma.sql`coalesce(fr.rank, -1) DESC, ${NAME_ORDER}`
      : params.sort === "name"
        ? NAME_ORDER
        : Prisma.sql`s."updatedAt" DESC, s.id`;

  const rows = await db.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT s.*, count(*) OVER () AS total_count,
      -- P46-01: the alphabet index letter derives from the SAME primary key the
      -- list is ordered by (NAME_ORDER, above), so bucket = header = sort. The
      -- client folds this string to an A–Z letter (or #) in bucketLetter().
      CASE WHEN s.k_first = '' OR s.k_last = '' THEN coalesce(nullif(s.k_company, ''), s.k_full) ELSE s.k_last END AS sort_name
    FROM (${union}) s
    ${rankJoin}
    ORDER BY ${orderBy}
    LIMIT ${params.limit} OFFSET ${params.offset}
  `);

  const totalCount = rows.length > 0 ? Number(rows[0]!.total_count) : 0;
  return {
    rows: rows.map((row) => {
      const snippet =
        params.includeNotes && params.query
          ? buildNoteMatchExcerpt(row.notes, params.query)
          : null;
      return {
        id: row.id,
        fullName: row.fullName,
        firstName: row.firstName,
        lastName: row.lastName,
        nickname: row.nickname,
        email: row.email,
        phone: row.phone,
        company: row.company,
        avatarUrl: row.avatarUrl,
        isFavorite: row.isFavorite,
        isEmergency: row.isEmergency,
        sharedKind: row.shared_kind,
        labels: row.labels,
        sortName: row.sort_name,
        ...(snippet ? { noteMatchSnippet: snippet } : {}),
      };
    }),
    totalCount,
  };
}

// --- workspace badge/nav counts (P38-03) -------------------------------------

export type WorkspaceCounts = {
  privatePeople: number;
  sharedPeople: number;
  favorites: number;
  emergency: number;
  archived: number;
  incomingShares: number;
  unreadNotifications: number;
  syncErrors: number;
  connectedSync: number;
  openMergeSuggestions: number;
  highConfidenceMergeSuggestions: number;
};

/**
 * P38-03: the workspace's nav/badge counts in one round trip. Replaces the
 * former wave of 9 separate `count` queries plus 2 merge-suggestion counts.
 */
export async function getWorkspaceCounts(
  userId: string,
  sharedBookIds: string[],
): Promise<WorkspaceCounts> {
  const sharedCount =
    sharedBookIds.length > 0
      ? Prisma.sql`(
          SELECT count(*) FROM "Contact" sc
          WHERE sc."archivedAt" IS NULL AND EXISTS (
            SELECT 1 FROM "GroupContact" gc
            WHERE gc."contactId" = sc.id AND gc."groupAddressBookId" = ANY(${sharedBookIds}::text[])
          )
        )`
      : Prisma.sql`0`;

  const [row] = await db.$queryRaw<
    Array<{
      private_people: bigint;
      shared_people: bigint;
      favorites: bigint;
      emergency: bigint;
      archived: bigint;
      incoming_shares: bigint;
      unread: bigint;
      sync_errors: bigint;
      connected_sync: bigint;
      open_suggestions: bigint;
      high_confidence: bigint;
    }>
  >(Prisma.sql`
    SELECT
      count(*) FILTER (
        WHERE c."archivedAt" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "GroupContact" gc WHERE gc."contactId" = c.id)
      ) AS private_people,
      count(*) FILTER (WHERE c."archivedAt" IS NULL AND c."isFavorite") AS favorites,
      count(*) FILTER (WHERE c."archivedAt" IS NULL AND c."isEmergency") AS emergency,
      count(*) FILTER (WHERE c."archivedAt" IS NOT NULL) AS archived,
      ${sharedCount} AS shared_people,
      (
        SELECT count(*) FROM "ContactShare" cs
        WHERE cs."recipientUserId" = ${userId}
          AND cs."shareType"::text IN ('STATIC_COPY', 'LIVE_SYNC')
          AND cs.status::text = 'ACTIVE'
          AND cs."recipientContactId" IS NULL
      ) AS incoming_shares,
      (
        SELECT count(*) FROM "Notification" n
        WHERE n."userId" = ${userId} AND n."readAt" IS NULL AND n."dismissedAt" IS NULL
      ) AS unread,
      (
        SELECT count(*) FROM "SyncAccount" sa
        WHERE sa."userId" = ${userId} AND sa.status::text IN ('ERROR', 'NEEDS_REAUTH')
      ) AS sync_errors,
      (
        SELECT count(*) FROM "SyncAccount" sa
        WHERE sa."userId" = ${userId} AND sa.status::text = 'ACTIVE'
      ) AS connected_sync,
      (
        SELECT count(*) FROM "MergeSuggestion" ms
        WHERE ms."userId" = ${userId} AND ms.status::text = 'OPEN'
      ) AS open_suggestions,
      (
        SELECT count(*) FROM "MergeSuggestion" ms
        WHERE ms."userId" = ${userId} AND ms.status::text = 'OPEN' AND ms.confidence::text = 'HIGH'
      ) AS high_confidence
    FROM "Contact" c
    WHERE c."userId" = ${userId}
  `);

  return {
    privatePeople: Number(row?.private_people ?? 0n),
    sharedPeople: Number(row?.shared_people ?? 0n),
    favorites: Number(row?.favorites ?? 0n),
    emergency: Number(row?.emergency ?? 0n),
    archived: Number(row?.archived ?? 0n),
    incomingShares: Number(row?.incoming_shares ?? 0n),
    unreadNotifications: Number(row?.unread ?? 0n),
    syncErrors: Number(row?.sync_errors ?? 0n),
    connectedSync: Number(row?.connected_sync ?? 0n),
    openMergeSuggestions: Number(row?.open_suggestions ?? 0n),
    highConfidenceMergeSuggestions: Number(row?.high_confidence ?? 0n),
  };
}

/**
 * Health-card counts over the same scope/search/filter/label conditions as the
 * list (minus any active health filter), computed in SQL so they stay exact
 * when the list itself is windowed.
 */
export async function getWorkspaceHealthCounts(
  params: Omit<WorkspaceListParams, "health" | "limit" | "offset" | "includeNotes" | "sort" | "ftsRanked">,
): Promise<WorkspaceHealthCounts> {
  const now = new Date();
  const fullParams: WorkspaceListParams = {
    ...params,
    health: null,
    sort: "name",
    includeNotes: false,
    ftsRanked: null,
    limit: 0,
    offset: 0,
  };
  const union = scopedUnion({ params: fullParams, now });
  if (!union) {
    return {
      "missing-methods": 0,
      "missing-context": 0,
      unlabeled: 0,
      "missing-dates": 0,
      "sync-attention": 0,
    };
  }

  // Health predicates reference c.* — wrap the union rows back under alias c.
  const [counts] = await db.$queryRaw<
    Array<{ mm: bigint; mc: bigint; ul: bigint; md: bigint; sa: bigint }>
  >(Prisma.sql`
    SELECT
      count(*) FILTER (WHERE ${healthPredicate("missing-methods", now)}) AS mm,
      count(*) FILTER (WHERE ${healthPredicate("missing-context", now)}) AS mc,
      count(*) FILTER (WHERE ${healthPredicate("unlabeled", now)}) AS ul,
      count(*) FILTER (WHERE ${healthPredicate("missing-dates", now)}) AS md,
      count(*) FILTER (WHERE ${healthPredicate("sync-attention", now)}) AS sa
    FROM "Contact" c
    WHERE c.id IN (SELECT id FROM (${union}) s)
  `);

  return {
    "missing-methods": Number(counts?.mm ?? 0n),
    "missing-context": Number(counts?.mc ?? 0n),
    unlabeled: Number(counts?.ul ?? 0n),
    "missing-dates": Number(counts?.md ?? 0n),
    "sync-attention": Number(counts?.sa ?? 0n),
  };
}
