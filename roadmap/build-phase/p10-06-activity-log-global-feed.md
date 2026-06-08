# P10-06 Activity Log Global Feed (Pro)

## Purpose
This ticket adds a global Activity tab to the main workspace that shows a reverse-chronological feed of every event across all of a user's contacts. The per-contact History tab (P10-04) answers "what happened to this specific contact?" — the global feed answers "what happened across my entire address book recently?" For users who sync across multiple accounts, run regular imports, or manage a large contact list, the global feed provides a single place to review all activity, spot unexpected changes, and audit sync behavior. The feature is Pro-gated because it encourages an upgrade path and because high-volume sync users (the primary audience) are likely willing to pay for this visibility.

## Background
P10-01 through P10-04 establish the ActivityEvent model, instrument all mutation paths, add source tracking, and surface per-contact history. The global feed in this ticket is the aggregation layer on top of those foundations.

The workspace currently has navigation entries for People, Archived, and Duplicates. The Activity tab is added alongside these. The tab must be visible to all users in the navigation, but clicking it when on the Free plan shows an upgrade prompt instead of the feed.

The ActivityEvent table is indexed on `(userId, createdAt DESC)`, which is the exact index needed for the global feed query. The feed uses cursor-based pagination from the start to handle users with large event volumes (heavy CardDAV sync users can generate hundreds of events per day).

Pro plan retention is 90 days. The Phase 11 pruning job enforces this. At the time of Phase 10 shipping, events accumulate indefinitely — Phase 11 is the hard dependency for enforcing the 90-day window.

## Scope

### In Scope
- Activity tab in the main workspace navigation
- Global ActivityEvent feed for the authenticated user
- Reverse-chronological order, cursor-based pagination
- Event row rendering: timestamp, contact name link, summary, actor icon
- Filter controls: by event category, by actor, by date range
- Pro gating: locked state with upgrade prompt for Free users
- API endpoint for the global feed
- Empty state for users with no events
- Empty state per filter combination
- Loading and error states

### Out of Scope
- Per-contact history (P10-04)
- Retention enforcement and pruning (Phase 11)
- Push notifications or real-time updates to the feed
- Exporting the activity log
- Activity feed for admin/support view of user data (future)
- Filtering by specific contact name (text search within the feed — future)

## Design / Implementation Spec

### Plan Gating

The Activity tab is visible in the workspace navigation for all users. The gating behavior:

- **Free plan**: Clicking the Activity tab renders a locked state UI. Do not fetch any events. Do not show event count badges on the tab.
- **Pro plan**: Full feed access with 90-day retention window.

The locked state for Free users shows:
```
[LockIcon]
Activity Log  —  Pro Feature

See everything that's happened across your contacts: edits,
syncs, imports, and merges — all in one place.

[Upgrade to Pro  →]
```

The plan check must be server-side. Do not show event data to Free users even if they bypass the UI — the API endpoint must check the plan before returning data.

### API Endpoint: Global Activity Feed

**GET /api/activity**

Query parameters:
- `cursor` (string, optional): Cursor for pagination. A base64-encoded JSON object `{ createdAt: string, id: string }` pointing to the last event in the previous page. Using a compound cursor (both createdAt and id) handles the case where multiple events have the same createdAt timestamp.
- `limit` (number, optional): Page size, default 50, max 100
- `categories` (string[], optional): Filter by event category. Values: "edits", "sync", "imports", "merges", "shares". Multiple values are OR-combined.
- `actors` (string[], optional): Filter by actor. Values: "USER", "SYNC", "IMPORT", "SHARE", "SYSTEM"
- `from` (string, optional): ISO date string, start of date range filter (inclusive)
- `to` (string, optional): ISO date string, end of date range filter (inclusive)

Response:
```typescript
{
  events: GlobalActivityEventRow[],
  nextCursor: string | null,
  hasMore: boolean,
  totalCount: number | null, // null for large sets — only computed if < 1000
}

interface GlobalActivityEventRow {
  id: string;
  eventType: EventType;
  actor: Actor;
  actorDetail: string | null;
  payload: unknown;
  createdAt: string; // ISO 8601
  contactId: string | null;
  contactName: string | null; // Denormalized from Contact — null if contact was deleted
  // Computed fields:
  summary: string;
  actorLabel: string;
  categoryIcon: string; // Icon name for the event category
}
```

**Contact name denormalization:**

The contact's name is fetched via a join on the Contact table in the query. If the contact was deleted (contactId is null), contactName is null. The UI handles this by showing "[Deleted contact]" in place of a link.

```sql
SELECT ae.*, c."fullName" AS "contactName"
FROM "ActivityEvent" ae
LEFT JOIN "Contact" c ON ae."contactId" = c.id
WHERE ae."userId" = $1
  AND ae."createdAt" < $cursor_createdAt
  AND (ae."eventType" = ANY($categories_filter) OR $no_category_filter)
  AND (ae."actor" = ANY($actors_filter) OR $no_actor_filter)
  AND (ae."createdAt" >= $from OR $no_from_filter)
  AND (ae."createdAt" <= $to OR $no_to_filter)
ORDER BY ae."createdAt" DESC, ae."id" DESC
LIMIT $limit + 1
```

**Category-to-EventType mapping:**

```typescript
const CATEGORY_EVENT_TYPES: Record<string, EventType[]> = {
  edits: [
    "CONTACT_CREATED", "CONTACT_UPDATED", "CONTACT_ARCHIVED",
    "CONTACT_RESTORED", "CONTACT_DELETED"
  ],
  sync: [
    "SYNC_PULLED", "SYNC_PUSHED",
    "SYNC_CONFLICT_DETECTED", "SYNC_CONFLICT_RESOLVED"
  ],
  imports: [
    "CONTACT_IMPORTED"
  ],
  merges: [
    "CONTACT_MERGED", "CONTACT_MERGE_UNDONE"
  ],
  shares: [
    "CONTACT_SHARED", "CONTACT_SHARE_RECEIVED"
  ],
};
```

**Cursor encoding:**

```typescript
function encodeCursor(event: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: event.createdAt.toISOString(), id: event.id })
  ).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const { createdAt, id } = JSON.parse(
    Buffer.from(cursor, "base64url").toString("utf8")
  );
  return { createdAt: new Date(createdAt), id };
}
```

The cursor-based query uses `(createdAt, id)` ordering to handle ties:

```sql
WHERE (ae."createdAt" < $cursor_createdAt OR
       (ae."createdAt" = $cursor_createdAt AND ae."id" < $cursor_id))
ORDER BY ae."createdAt" DESC, ae."id" DESC
```

**Plan check in API:**

```typescript
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });

  const subscription = await getUserSubscription(session.userId);
  if (subscription.plan === "FREE") {
    return new Response(
      JSON.stringify({ error: "PRO_REQUIRED", upgradeUrl: "/settings/billing" }),
      { status: 403 }
    );
  }

  // ... rest of handler
}
```

### Feed UI

**Location**: `src/app/(workspace)/activity/page.tsx`

The page is a Server Component for the initial load. The Activity tab renders the first page of events server-side with no loading spinner. Client components handle pagination.

#### Tab Placement

The Activity tab is added to the workspace navigation alongside the existing tabs:

```
People  |  Archived  |  Duplicates  |  Activity
```

For Free users, the Activity tab has a lock icon or Pro badge to signal gating before they click.

#### Filter Bar

Above the event feed, a horizontal filter bar:

```
Category: [All ▾]  Actor: [All ▾]  Date: [All time ▾]    {N} events
```

- **Category dropdown**: All, Edits, Sync, Imports, Merges, Shares. Multi-select supported — show selected count when more than one is selected ("2 categories").
- **Actor dropdown**: All, You, Sync, Import, Shared, System. Single or multi-select.
- **Date range**: All time, Today, This week, This month, Last 30 days, Custom (opens date picker).
- **Event count**: Right-aligned. Shows the count of events matching the current filter. Uses the `totalCount` from the API if < 1000, or "1,000+" if the count is large. Do not make a separate COUNT query — use the value from the events response.

Filters are applied instantly as the user changes them. Use `useRouter` to push the updated filter parameters into the URL query string so the filter state is shareable and survives page refresh.

#### Event Row Layout

```
[ActorIcon]  [ContactName]  [Summary]                     [RelativeTime]
```

- **ActorIcon**: Same icon set as P10-04's History tab. 20x20px for the global feed (slightly larger than per-contact history).
- **ContactName**: If `contactId` is non-null, render as a link to `/contacts/{contactId}`. If null (contact deleted), render as "[Deleted contact]" in muted text without a link.
- **Summary**: The human-readable event summary from `formatters.ts`. For the global feed, summaries should include the contact name when the event type is contact-agnostic (e.g., "Merged with J. Smith" rather than just "Merged"). When the contact name is already shown as a link, the summary should omit redundant name references.
- **RelativeTime**: Right-aligned. Absolute timestamp on hover via tooltip.

Full row example:
```
[PersonIcon]  John Smith  Updated · 3 fields changed              2 hours ago
[CloudIcon]   Jane Doe    Pulled from iCloud · 2 fields updated   3 hours ago
[FileIcon]    Emily Chen  Imported from contacts-export.csv       Yesterday
[MergeIcon]   Bob Wilson  Merged with R. Wilson                   3 days ago
```

Rows are not expandable in the global feed. Expanding diffs is a per-contact history feature. Clicking a row navigates to the contact detail page where the full history (with diffs) is available.

#### Pagination in Global Feed

The global feed uses "Load more" pagination, same pattern as P10-04's history tab. A "Load more" button at the bottom appends the next page. No infinite scroll — the user may want to inspect a specific period without accidentally loading too much.

Show a loading indicator on the "Load more" button while the next page is fetching:
```
[Load more events ↓]  →  [Loading…]  →  [More events appended]
```

#### Empty State: No Events

When the user has no events at all (e.g., they just upgraded to Pro and have not made any changes):

```
[ActivityIcon]
No activity yet

Changes to your contacts will appear here as you edit,
import, sync, and merge.
```

#### Empty State: No Events Matching Filters

When the current filter combination returns no events:

```
[FilterIcon]
No events match your filters

Try broadening your date range or removing some category filters.

[Clear filters]
```

The "Clear filters" button resets all filters to "All".

#### Loading State

Initial server-side render: no loading state needed for the first page (rendered on server).
"Load more" pagination: show a loading indicator on the button.
Filter changes: show a skeleton list while the filtered results load.

Skeleton for filter loading: 10 rows of gray placeholder bars matching the event row height.

#### Error State

If the feed query fails:
```
[AlertIcon]  Couldn't load activity

[Retry]
```

Retry re-fetches the current page with the current filters. If the error persists, show a support link.

### Component File Structure

```
src/
  app/
    (workspace)/
      activity/
        page.tsx                  # Server component — initial load
        ActivityFeedClient.tsx    # Client component — pagination + filter state
        ActivityFilterBar.tsx     # Filter controls
        ActivityEventRow.tsx      # Individual event row
        ActivityEmptyState.tsx    # Empty states (no events, no filter results)
        ActivityProGate.tsx       # Locked state for Free users
    api/
      activity/
        route.ts                  # GET /api/activity
  lib/
    activity/
      formatters.ts               # Updated with global feed summary variants
      cursor.ts                   # Cursor encode/decode utilities
      categories.ts               # Category-to-EventType mapping
```

### Performance

- The `(userId, createdAt DESC)` index makes the base query fast at any scale.
- The LEFT JOIN to Contact for `contactName` adds minor overhead but avoids N+1 queries. For 50 events per page, this join is negligible.
- Filter queries that add WHERE clauses on `eventType` or `actor` may not use the composite index optimally. Consider adding additional indexes if filter queries become slow:
  - `(userId, actor, createdAt DESC)` for actor filter
  - `(userId, eventType, createdAt DESC)` for category/eventType filter
  Do not add these proactively — monitor query performance after launch.
- For users with 90 days of events at high sync frequency (e.g., a CardDAV sync that touches 100 contacts per day), the ActivityEvent table may contain 8,000+ rows per user. This is well within PostgreSQL's comfortable range for indexed queries.

### Security Considerations

- Every query must be scoped to `userId = <authenticated user>`. Cross-user event access is a critical security boundary.
- The plan check is performed on the server, not the client. A Free user who inspects network requests cannot bypass the plan gate by calling the API directly.
- `contactId` and `contactName` in the response must only reference contacts belonging to the authenticated user. The LEFT JOIN to Contact must include `AND c."userId" = $userId` to prevent returning other users' contact names.
- Cursor tokens are base64-encoded timestamps and IDs. They do not contain PII. However, they should be treated as opaque — do not document their structure as a stable API.

### Retention Display

Once Phase 11's pruning job is active, events older than 90 days (Pro) are deleted. The feed should display a note at the bottom of the feed when the retention limit is reached:

```
— Activity history starts 90 days ago —
Activity older than 90 days is not retained on your current plan.
```

For Phase 10, this message is not shown (no pruning yet). Phase 11 adds the pruning job and can add this message as part of that work.

## Acceptance Criteria

- Activity tab is visible in the workspace navigation for all users
- Free users see the locked state with an upgrade prompt when clicking the Activity tab
- Free users cannot access the GET /api/activity endpoint (returns 403)
- Pro users see the global event feed
- Feed displays events in reverse-chronological order
- Feed uses cursor-based pagination
- "Load more" button appends the next page without replacing the current events
- Category filter correctly narrows events to the selected categories
- Actor filter correctly narrows events by actor
- Date range filter correctly narrows events by date
- Multiple filters can be applied simultaneously with AND logic between categories and actors
- Filter state is reflected in the URL query string
- Navigating to the Activity tab with URL query parameters pre-populates the filters
- Deleted contact rows show "[Deleted contact]" without a link
- Non-deleted contact names link to the contact detail page
- Empty state is shown when no events exist for the user
- Empty state with "Clear filters" button is shown when filters produce no results
- Error state with retry button is shown when the query fails
- GET /api/activity returns 401 for unauthenticated requests
- GET /api/activity requires Pro plan (403 for Free)
- GET /api/activity correctly paginates using cursor parameters
- GET /api/activity correctly applies all filter parameters
- TypeScript compilation passes with no new errors

## Risks and Open Questions

- **Index coverage for filtered queries**: The base `(userId, createdAt DESC)` index covers the unfiltered feed well. Adding `eventType` or `actor` filters may cause PostgreSQL to abandon the index and do a full table scan if the filter is selective enough to mislead the query planner. Test with EXPLAIN ANALYZE on realistic data volumes after launch.
- **totalCount for large feeds**: Computing a COUNT(*) for the event count badge in the filter bar adds a second query per page load. For users with tens of thousands of events, this query may be slow. The recommended approach is to cap at 1,000 and show "1,000+" rather than an exact count. Alternatively, skip the count entirely and remove the count badge from the filter bar.
- **URL state for filters**: Storing filter state in URL query parameters is good for shareability but requires careful handling of Next.js router pushes to avoid unnecessary re-renders. Use shallow routing where possible.
- **Real-time updates**: The global feed does not update in real-time. If a sync runs while the user is viewing the feed, new events are not visible until they reload or navigate away and back. Consider a "New events available" banner that appears when the feed is stale — but this requires a polling mechanism or WebSocket and is out of scope for Phase 10.
- **Phase 11 dependency for retention**: Without Phase 11's pruning job, the ActivityEvent table grows without bound. For beta users, this is acceptable. For production Pro users, Phase 11 must ship shortly after Phase 10 to enforce the 90-day retention promise.

## Outcome

Pro users have a single Activity tab in their workspace that shows a complete, filterable, cursor-paginated reverse-chronological feed of all contact activity, giving full visibility into what changed, when, and why.
