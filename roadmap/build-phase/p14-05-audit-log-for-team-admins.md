# P14-05 Audit Log for Team Admins

## Purpose
Teams plan users need a complete, queryable record of every action taken on their shared contacts — who created a contact, who changed a phone number, who bulk-archived 47 records last Tuesday, and who imported the Clients book from a vCard file. This ticket delivers the team audit log: the query infrastructure, the filtering UI, the pagination strategy, the CSV export, and the retention policy (unlimited, never pruned). This feature is a primary differentiator of the Teams plan from personal and Family tiers.

## Background
Phase 10 introduced `ActivityEvent` as a personal activity log. Every contact mutation emits an event row with `actor`, `actorDetail`, `entityType`, `entityId`, `eventType`, and `diff` (JSON diff of changed fields). Personal events are scoped by `ActivityEvent.userId` and displayed to the owning user only.

P14-01 added `teamId` (nullable FK to `Group`) and optionally `actorId` (nullable FK to `User`) to `ActivityEvent`. P14-04 populates these fields for all team contact mutations, with `actor = TEAM_MEMBER` and `actorDetail` in the format `"[Member name] · [Team name] · [Book name]"`.

Because teams can have high event volumes (25 members × many contacts × frequent edits), the audit log needs:
- Cursor-based pagination rather than offset pagination.
- Efficient composite indexes (added in P14-01).
- A filter system that works at the database level, not in-memory.
- A streaming CSV export that doesn't load all rows into memory.

## Scope

### In scope
- Route: `/settings/teams/{teamId}/audit` (standalone page) and address-book-scoped tab variant.
- Server-side query function: `getTeamAuditLog` with filtering and cursor pagination.
- Filters: member, address book, event type category, date range.
- CSV export of filtered results (streaming).
- Retention policy: unlimited (no pruning job for Teams plan events).
- Access control: OWNER and ADMIN only.
- Per-member restriction: members see only their own events in personal activity log (Phase 10) — confirmed by access control gating here.

### Out of scope
- Personal activity log changes — Phase 10.
- Family activity log — separate simpler feature.
- Real-time streaming (WebSocket/SSE) of live events — future work.
- External webhook delivery of audit events — future work.
- SIEM integration — future work.

## Design / Implementation Spec

### 1. Database Index Strategy

P14-01 added `@@index([teamId, createdAt(sort: Desc)])` on `ActivityEvent`. This ticket verifies this is sufficient and adds any additional indexes needed.

**Query patterns to support:**

| Filter combination | Index used |
|---|---|
| `teamId` only | `(teamId, createdAt DESC)` ✓ |
| `teamId + actorId` | `(teamId, actorId, createdAt DESC)` — add if not present |
| `teamId + addressBookId` (derived from actorDetail) | Cannot be indexed via substring. Use a separate `addressBookId` column instead. |
| `teamId + eventType` | `(teamId, eventType, createdAt DESC)` — add if query plans show seq scan |
| `teamId + createdAt range` | `(teamId, createdAt DESC)` ✓ |

**Problem**: `actorDetail` is a denormalized string like `"Alice Smith · Acme Corp · Clients"`. Filtering by address book via substring match on `actorDetail` would require `ILIKE '%Clients%'` which is not indexable. This is a schema design error that must be fixed here.

**Solution: Add `addressBookId` directly to `ActivityEvent`**

```prisma
model ActivityEvent {
  // ... existing fields ...
  teamId        String?
  team          Group?           @relation(...)
  actorId       String?
  actorUser     User?            @relation("ActivityEventActor", ...)
  addressBookId String?          // NEW — nullable, populated for team events
  addressBook   GroupAddressBook? @relation(fields: [addressBookId], references: [id], onDelete: SetNull)

  @@index([teamId, createdAt(sort: Desc)])
  @@index([teamId, actorId, createdAt(sort: Desc)])
  @@index([teamId, addressBookId, createdAt(sort: Desc)])
  @@index([teamId, eventType, createdAt(sort: Desc)])
}
```

Migration: add nullable `addressBookId TEXT REFERENCES "GroupAddressBook"(id) ON DELETE SET NULL` to `ActivityEvent`. Update `emitTeamContactEvent` in P14-04 to populate this field.

---

### 2. Server Query Function

`src/lib/teams/audit.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const AuditLogFilterSchema = z.object({
  teamId: z.string().cuid(),
  actorUserId: z.string().cuid().optional(),       // filter by a specific member
  addressBookId: z.string().cuid().optional(),     // filter by a specific book
  eventTypeCategory: z.enum([                      // coarse category
    "ALL",
    "CONTACT",       // CONTACT_CREATED | CONTACT_UPDATED | CONTACT_ARCHIVED | ...
    "ADDRESS_BOOK",  // BOOK_CREATED | BOOK_RENAMED | BOOK_ARCHIVED | BOOK_DELETED
    "MEMBER",        // MEMBER_JOINED | MEMBER_REMOVED | ROLE_CHANGED
    "IMPORT",        // IMPORT_COMPLETED
    "SYNC",          // SYNC_COMPLETED | SYNC_CONFLICT
    "PERMISSIONS",   // PERMISSION_CHANGED
  ]).default("ALL"),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  cursor: z.string().optional(),   // base64-encoded cursor: { id, createdAt }
  pageSize: z.number().int().min(1).max(100).default(50),
});

export type AuditLogFilter = z.infer<typeof AuditLogFilterSchema>;

// Maps coarse category to specific eventType values
const EVENT_TYPE_CATEGORY_MAP: Record<string, string[]> = {
  CONTACT: [
    "CONTACT_CREATED", "CONTACT_UPDATED", "CONTACT_ARCHIVED",
    "CONTACT_RESTORED", "CONTACT_DELETED", "CONTACT_MERGED",
  ],
  ADDRESS_BOOK: [
    "BOOK_CREATED", "BOOK_RENAMED", "BOOK_ARCHIVED",
    "BOOK_UNARCHIVED", "BOOK_DELETED",
  ],
  MEMBER: ["MEMBER_JOINED", "MEMBER_REMOVED", "ROLE_CHANGED", "OWNERSHIP_TRANSFERRED"],
  IMPORT: ["IMPORT_COMPLETED", "IMPORT_PARTIAL"],
  SYNC: ["SYNC_COMPLETED", "SYNC_CONFLICT", "SYNC_ERROR"],
  PERMISSIONS: ["PERMISSION_CHANGED"],
};

export async function getTeamAuditLog(filter: AuditLogFilter) {
  const where: Prisma.ActivityEventWhereInput = {
    teamId: filter.teamId,
    ...(filter.actorUserId && { actorId: filter.actorUserId }),
    ...(filter.addressBookId && { addressBookId: filter.addressBookId }),
    ...(filter.eventTypeCategory && filter.eventTypeCategory !== "ALL" && {
      eventType: { in: EVENT_TYPE_CATEGORY_MAP[filter.eventTypeCategory] ?? [] },
    }),
    ...(filter.dateFrom || filter.dateTo
      ? {
          createdAt: {
            ...(filter.dateFrom && { gte: filter.dateFrom }),
            ...(filter.dateTo && { lte: filter.dateTo }),
          },
        }
      : {}),
  };

  // Cursor-based pagination
  if (filter.cursor) {
    const decoded = JSON.parse(Buffer.from(filter.cursor, "base64").toString());
    where.OR = [
      { createdAt: { lt: new Date(decoded.createdAt) } },
      { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
    ];
  }

  const events = await prisma.activityEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filter.pageSize + 1, // fetch one extra to determine hasNextPage
    include: {
      actorUser: { select: { id: true, name: true, email: true } },
      addressBook: { select: { id: true, name: true } },
    },
  });

  const hasNextPage = events.length > filter.pageSize;
  const results = hasNextPage ? events.slice(0, filter.pageSize) : events;

  const nextCursor =
    hasNextPage && results.length > 0
      ? Buffer.from(
          JSON.stringify({
            createdAt: results[results.length - 1].createdAt.toISOString(),
            id: results[results.length - 1].id,
          })
        ).toString("base64")
      : null;

  return { events: results, nextCursor, hasNextPage };
}
```

---

### 3. Server Action: Authorize and Fetch

```typescript
// src/app/actions/audit.ts

export async function fetchTeamAuditLog(
  rawFilter: z.infer<typeof AuditLogFilterSchema>
) {
  const session = await auth();
  const filter = AuditLogFilterSchema.parse(rawFilter);

  // Authorize: OWNER or ADMIN only
  await requireGroupRole(session.user.id, filter.teamId, "ADMIN");

  return getTeamAuditLog(filter);
}
```

---

### 4. Route Structure

#### 4.1 Standalone Audit Log Page
`/settings/teams/[teamId]/audit` — full-page audit log with all filters.

This page is an RSC shell that renders a `<AuditLogView>` client component. The client component manages filter state and calls `fetchTeamAuditLog` via a server action on filter change.

#### 4.2 Per-Book Audit Tab
Within the team workspace book view, an "Activity" or "Audit" tab shows events filtered to `addressBookId = current book`. The same `AuditLogView` component is reused with `addressBookId` pre-populated and the address book filter hidden.

---

### 5. Filter UI

The audit log page header contains a filter bar:

```
[ Member: All ▼ ] [ Address Book: All ▼ ] [ Type: All ▼ ] [ From: ____ ] [ To: ____ ] [ Reset ]    [ Export CSV ]
```

- **Member filter**: dropdown populated from the team's accepted members (OWNER/ADMIN/MEMBER roles, all shown). Default: "All members". Selecting a member sets `actorUserId` filter.
- **Address book filter**: dropdown of non-archived books plus archived books (shown with muted label). Default: "All books".
- **Type filter**: dropdown of `ALL | CONTACT | ADDRESS_BOOK | MEMBER | IMPORT | SYNC | PERMISSIONS`. Default: "All types".
- **Date range**: two date-picker inputs. Default: last 30 days. Max range: unlimited (Teams plan has no retention limit).
- **Reset**: clears all filters and resets to default.

Filter state is stored in URL query params (using Next.js `useSearchParams`) to enable shareable filter URLs and browser back/forward navigation.

---

### 6. Audit Log Row Layout

Each row in the audit log displays:

```
[ Avatar ] Alice Smith          CONTACT UPDATED     2026-06-08 14:32:01
            Acme Corp · Clients
            "John Doe" — phone changed: +1 (555) 123-4567 → +1 (555) 987-6543
            [ Show diff ▼ ]
```

- Actor avatar (initials fallback).
- Actor name + optional "Admin" role badge.
- Event type badge (color-coded by category: blue for CONTACT, orange for ADDRESS_BOOK, purple for MEMBER, green for IMPORT/SYNC).
- Timestamp (local time, ISO format on hover for precision).
- `actorDetail` string (team name · book name — team name is always the current team so this effectively shows the book name).
- Short human-readable description of the event (derived from `eventType` + contact display name from `entityId` lookup).
- Diff expansion: clicking "Show diff" reveals a structured diff view (field-by-field before/after) sourced from `ActivityEvent.diff` JSON.

**Diff display format:**
```
Fields changed:
  phone[0].number:   +1 (555) 123-4567  →  +1 (555) 987-6543
  email[0].value:    alice@old.com       →  alice@new.com
```

Diff parsing must handle null (field added or removed) gracefully.

---

### 7. CSV Export

**Server Action: `exportTeamAuditLogCsv`**

```typescript
export async function exportTeamAuditLogCsv(
  rawFilter: z.infer<typeof AuditLogFilterSchema>
) {
  const session = await auth();
  const filter = AuditLogFilterSchema.parse({ ...rawFilter, pageSize: 100 });
  await requireGroupRole(session.user.id, filter.teamId, "ADMIN");

  // For CSV export, ignore cursor and fetch ALL matching rows up to a safe limit
  // Safety limit: 50,000 rows. Teams audit logs can be large.
  // If result exceeds limit, return partial results with a header row warning.
}
```

**Route: `GET /api/teams/[teamId]/audit/export.csv`**

This must be an API route (not a server action) because it streams a Response with `Content-Type: text/csv` and `Content-Disposition: attachment`.

```typescript
// src/app/api/teams/[teamId]/audit/export/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  // Auth check
  // Parse filter from query params
  // Stream CSV rows via ReadableStream

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Header row
      controller.enqueue(
        encoder.encode(
          "Timestamp,Member,Role,Team,Address Book,Event Type,Contact,Field Changes\n"
        )
      );

      // Paginate through all results
      let cursor: string | null = null;
      const BATCH_SIZE = 500;
      let totalRows = 0;
      const MAX_ROWS = 50_000;

      do {
        const { events, nextCursor } = await getTeamAuditLog({
          teamId: params.teamId,
          // ... other filters from query params ...
          cursor: cursor ?? undefined,
          pageSize: BATCH_SIZE,
        });

        for (const event of events) {
          if (totalRows >= MAX_ROWS) break;
          const row = formatCsvRow(event);
          controller.enqueue(encoder.encode(row + "\n"));
          totalRows++;
        }

        cursor = nextCursor;
      } while (cursor && totalRows < MAX_ROWS);

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${params.teamId}-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}
```

**CSV row format:**
```
Timestamp,Member,Role,Team,Address Book,Event Type,Contact,Field Changes
"2026-06-08T14:32:01.000Z","Alice Smith","ADMIN","Acme Corp","Clients","CONTACT_UPDATED","John Doe","phone[0].number: +1 (555) 123-4567 → +1 (555) 987-6543"
```

The "Field Changes" column is a semicolon-separated summary of the diff (not full JSON) to keep the CSV readable in Excel.

---

### 8. Retention Policy

Teams plan audit events: **never pruned**. The existing pruning job (if any) from Phase 10 must be extended to exclude events with `teamId IS NOT NULL`.

```typescript
// In the prune job (wherever it exists):
await prisma.activityEvent.deleteMany({
  where: {
    createdAt: { lt: pruneThreshold },
    teamId: null, // Only prune personal events, never team events
  },
});
```

Add this condition as a comment in the prune job: `// Team events (teamId IS NOT NULL) are never pruned per Teams plan retention policy`.

For personal and Family plan events, the existing retention logic applies (whatever was set in Phase 10).

---

### 9. Access Control Summary

| Role | Access to audit log |
|---|---|
| OWNER | Full access to team audit log and CSV export |
| ADMIN | Full access to team audit log and CSV export |
| MEMBER | No access to team audit log (`/settings/teams/{teamId}/audit` redirects to 403) |

Individual members can only see their own activity in the personal activity log (Phase 10). This is enforced by the Phase 10 query scoping by `userId = session.user.id` — team events where `actor = TEAM_MEMBER` are not surfaced in the personal log for non-owners.

**Exception**: the team owner's personal activity log will show team events because `ActivityEvent.userId = team owner's userId` for all team contact events. This is an acceptable side effect — the owner effectively "owns" all team contact activity in the data model. Display logic in Phase 10's activity log UI should filter to `actor != TEAM_MEMBER` for the personal view to avoid confusion.

---

### 10. Performance Considerations

- The composite indexes added in Section 1 must be verified with `EXPLAIN ANALYZE` on a dataset of 1M+ ActivityEvent rows in staging.
- The cursor pagination approach avoids `OFFSET` scans, which degrade linearly. Even page 100 of results will be fast.
- CSV export batches 500 rows at a time to avoid memory spikes. Node.js's streaming response (`ReadableStream`) ensures the CSV is flushed to the client incrementally.
- The diff JSON stored in `ActivityEvent.diff` should be kept compact. Large diffs (e.g., importing a contact with 50 fields) could bloat the table. Consider truncating diff at 10KB and storing a flag `diffTruncated: Boolean`.

## Acceptance Criteria

- [ ] `/settings/teams/{teamId}/audit` is accessible to OWNER and ADMIN roles.
- [ ] `/settings/teams/{teamId}/audit` returns 403 (or redirects) for MEMBER role.
- [ ] The audit log displays events with actor, actorDetail, event type, timestamp, and contact name.
- [ ] Filtering by member shows only that member's events.
- [ ] Filtering by address book shows only events for that book.
- [ ] Filtering by event type category (e.g., CONTACT) shows only matching events.
- [ ] Date range filtering works for both `dateFrom` and `dateTo`, independently and combined.
- [ ] Cursor-based pagination returns correct results for pages beyond the first.
- [ ] "Show diff" expansion renders a structured field-by-field diff.
- [ ] CSV export button downloads a valid CSV file with the correct columns.
- [ ] CSV export respects the current active filters.
- [ ] CSV export with > 50,000 matching rows downloads the first 50,000 rows.
- [ ] Team audit events are never deleted by the personal event prune job.
- [ ] Personal activity log (Phase 10) does not show team contact events in the member's own log.
- [ ] `addressBookId` is populated on all `ActivityEvent` rows emitted by P14-04 actions.
- [ ] The per-book audit tab in the workspace shows only events for that book.
- [ ] Filter state is reflected in the URL query params (shareable URL).

## Risks and Open Questions

- **`addressBookId` migration**: This column is added in this ticket. The `emitTeamContactEvent` helper (P14-04) must be updated to populate it. Coordinate the migration order: P14-01 or P14-05 owns the column addition — decide and document.
- **Diff JSON size**: Phase 10 may not have a size cap on diff JSON. Large imports or contacts with many fields could produce very large diffs. Add a `MAX_DIFF_SIZE = 10_000` bytes cap in `emitTeamContactEvent` and truncate with `diffTruncated: true` flag.
- **Personal log bleed-through**: The team owner's personal activity log will show team contact events unless the Phase 10 UI filters by `actor = PERSONAL`. This should be fixed in Phase 10 code as a small followup, not blocked on this ticket.
- **CSV export for very active teams**: A team with 25 members making frequent edits over 2 years could have millions of events. The 50,000-row CSV cap is a safety valve. The UI should show a warning: "Your filtered results exceed 50,000 rows. The export will include the most recent 50,000 events. Use date range filters to narrow your export."
- **Event categories completeness**: The `EVENT_TYPE_CATEGORY_MAP` must stay in sync with new event types added in P14-02, P14-04, P14-06. Consider generating it from a shared enum definition rather than maintaining a manual map.

## Outcome
Team admins have a fully queryable, filterable, exportable audit trail of all team activity with unlimited retention, providing the compliance and accountability capabilities that justify the Teams plan pricing.
