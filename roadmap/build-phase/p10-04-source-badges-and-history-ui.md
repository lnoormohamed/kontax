# P10-04 Source Badges and Per-Contact History UI

## Purpose
This ticket surfaces the source tracking and activity event data on the contact detail page so users can see where a contact came from and review its full change history. Without a UI, the data written by P10-02 and P10-03 is invisible. The source badge and last-updated-by line answer "where did this come from and who last touched it?" instantly, without opening the history tab. The history tab answers "what has changed and when?" with full field-level detail. Together, these build trust in the accuracy of the user's contact data and reduce confusion when contacts appear to change unexpectedly after a sync.

## Background
The contact detail page currently shows contact fields and edit/archive actions. It has no origin attribution and no change history. Users who import from CSV, sync with CardDAV, or eventually receive shared contacts have no way to understand why a contact looks the way it does.

P10-03 added `sourceType`, `sourceDetail`, `lastMutatedBy`, and `lastMutatedByDetail` to the Contact model. P10-02 added ActivityEvent emission to all mutation paths. This ticket consumes both: the source badge and last-updated-by line read from the Contact record directly (fast, no join needed); the History tab queries ActivityEvent by contactId.

The per-contact history feature is available on all plans. The global Activity feed (P10-06) is Pro-gated. This distinction is important — the History tab on contact detail must be rendered for Free users without a paywall.

## Scope

### In Scope
- Source badge component on the contact detail page
- "Last updated by" line below the source badge
- History tab on the contact detail page (alongside existing Details and Edit tabs, or as an additional tab)
- Per-contact ActivityEvent feed: reverse-chronological, paginated
- Human-readable event summaries for all 14 event types
- Expandable field diff rows for CONTACT_UPDATED events
- Actor icons per actor type
- Empty state for contacts with no events (pre-Phase 10 contacts)
- Loading and error states for the history tab
- API endpoint for per-contact activity events

### Out of Scope
- Global activity feed (P10-06)
- Pro gating for any of the features in this ticket (all features here are available on all plans)
- Editing or undoing from the history tab (undo is in P10-05)
- Source badge on contact list rows (could follow as a quick enhancement, not in scope here)
- Push notifications or real-time updates to the history tab

## Design / Implementation Spec

### API Endpoint: Per-Contact Activity History

**GET /api/contacts/:id/history**

Query parameters:
- `cursor` (string, optional): Cursor for pagination — the `createdAt` ISO string of the last event seen
- `limit` (number, optional): Page size, default 30, max 100

Response:
```typescript
{
  events: ActivityEventRow[],
  nextCursor: string | null, // null if no more events
  hasMore: boolean,
}

interface ActivityEventRow {
  id: string;
  eventType: EventType;
  actor: Actor;
  actorDetail: string | null;
  payload: unknown;
  createdAt: string; // ISO 8601
  // Computed fields for display:
  summary: string;       // Human-readable one-line summary
  actorLabel: string;    // e.g. "You", "iCloud sync", "contacts.csv"
}
```

The `summary` and `actorLabel` fields are computed server-side by `src/lib/activity/formatters.ts` so the client does not need to implement summary logic.

**Authorization**: Only the contact's owner can access this endpoint. The query must include `WHERE userId = <authenticated user id>`.

**Query**:
```sql
SELECT *
FROM "ActivityEvent"
WHERE "contactId" = $1
  AND ("createdAt" < $cursor OR $cursor IS NULL)
ORDER BY "createdAt" DESC
LIMIT $limit + 1  -- fetch one extra to determine hasMore
```

Uses the `(contactId, createdAt DESC)` index from P10-01. The extra row technique (fetch limit+1, return limit rows, set `hasMore` based on whether extra row exists) avoids a separate COUNT query.

**Server Action alternative**: If the contact detail page is a Server Component with no client-side pagination, the initial load can be a Server Action returning the first page. Subsequent pages (if any) use a Client Component fetch. For Phase 10, use a React Server Component for the initial load and a `"use client"` wrapper for pagination.

### Source Badge Component

**Location**: `src/components/contacts/SourceBadge.tsx`

```typescript
interface SourceBadgeProps {
  sourceType: SourceType;
  sourceDetail: string | null;
}
```

The badge renders as a small chip with an icon and a label. It is placed in the contact detail header, below the contact name and above the contact fields.

**Rendering rules:**

| sourceType | Icon | Label |
|---|---|---|
| MANUAL | Person icon | "Added manually" |
| IMPORT_CSV | FileText icon | "Imported from {sourceDetail}" or "Imported from file" if null |
| SYNC_CARDDAV | CloudSync icon | "Synced from {sourceDetail}" or "Synced via CardDAV" if null |
| SHARED_STATIC | ArrowDownLeft icon | "Shared by {sourceDetail}" or "Received via share" if null |
| SHARED_LIVE | ArrowDownLeft icon (with pulse indicator) | "Live shared by {sourceDetail}" |
| API | Code icon | "Added via API" |

Visual design: the badge should be subtle, not attention-grabbing. A light background chip with a muted text color and a small icon. The P10-07 design brief specifies exact colors and sizes — implement to the design brief when it is available, or use a neutral placeholder style for development.

The badge must not be a link — it is informational only in Phase 10.

### "Last Updated By" Line

**Location**: Inline in the contact detail page below the source badge

Renders as a single line of muted text:

```
[ActorIcon] Last updated by {lastMutatedByLabel} · {relativeTime}
```

Examples:
- "Last updated by you · 2 hours ago"
- "Last updated by iCloud sync · Yesterday"
- "Last updated by contacts-export.csv import · 3 days ago"
- "Last updated by you · Just now"

**actorLabel mapping:**

```typescript
function formatActorLabel(lastMutatedBy: SourceType, lastMutatedByDetail: string | null): string {
  switch (lastMutatedBy) {
    case "MANUAL": return "you";
    case "IMPORT_CSV": return lastMutatedByDetail ? `${lastMutatedByDetail} import` : "file import";
    case "SYNC_CARDDAV": return lastMutatedByDetail ? `${lastMutatedByDetail} sync` : "CardDAV sync";
    case "SHARED_STATIC": return lastMutatedByDetail ? `${lastMutatedByDetail}` : "a shared contact";
    case "SHARED_LIVE": return lastMutatedByDetail ? `${lastMutatedByDetail} (live share)` : "a live share";
    case "API": return "API";
    default: return "unknown";
  }
}
```

**Timestamp**: Use `updatedAt` from the Contact record for the relative time. This is already present on the model. Use a utility like `formatDistanceToNow` from `date-fns`. The timestamp must update correctly on client-side navigation — avoid stale timestamps from SSR.

### History Tab

The contact detail page gains a "History" tab in addition to the existing view.

**Tab structure (example with existing tabs):**
```
[Details]  [History]
```

The History tab is not gated by plan. It is visible on every contact for all users.

#### Event Row Layout

Each event in the history feed renders as a compact horizontal row:

```
[ActorIcon]  [Summary]                     [RelativeTime]
             [Expand toggle if CONTACT_UPDATED]
```

Width: full-width within the tab panel. Height: 40px collapsed, auto-height expanded.

**ActorIcon** (16x16px icon, left-aligned):
- USER/MANUAL: Person icon
- SYNC/SYNC_CARDDAV: CloudSync icon
- IMPORT/IMPORT_CSV: FileImport icon
- SHARE: ArrowDownLeft icon
- FAMILY_MEMBER: Users icon
- SYSTEM: Cog icon

**Summary**: Human-readable one-liner from `formatters.ts`. Examples by event type:

| Event Type | Summary |
|---|---|
| CONTACT_CREATED | "Contact added" |
| CONTACT_UPDATED | "Updated · {N} field{s} changed" — expands to show diffs |
| CONTACT_ARCHIVED | "Archived" |
| CONTACT_RESTORED | "Restored from archive" |
| CONTACT_DELETED | "Deleted" |
| CONTACT_MERGED | "Merged with {absorbedContactName}" |
| CONTACT_MERGE_UNDONE | "Merge undone" |
| CONTACT_IMPORTED | "Imported from {actorDetail}" |
| CONTACT_SHARED | "Shared" |
| CONTACT_SHARE_RECEIVED | "Received via share from {actorDetail}" |
| SYNC_PULLED | "Pulled from {actorDetail} · {N} field{s} updated" (if diffs) or "Checked by {actorDetail} sync" (if no diffs — though we should not emit this event with no diffs) |
| SYNC_PUSHED | "Pushed to {actorDetail}" |
| SYNC_CONFLICT_DETECTED | "Sync conflict detected with {actorDetail}" |
| SYNC_CONFLICT_RESOLVED | "Sync conflict resolved ({resolution})" |

**RelativeTime**: Right-aligned, muted. Uses the same relative time format as the "last updated by" line. On hover, show the absolute date/time in a tooltip.

#### Expandable Field Diff

For CONTACT_UPDATED events, clicking the row expands it to show the field diff:

```
[ActorIcon]  "Updated · 2 fields changed"          "3 hours ago"
             ▼ expanded:
             [FieldName]    [Before value]  →  [After value]
             [FieldName]    [Before value]  →  [After value]
```

For SYNC_PULLED events with diffs, same expansion behavior.

**Field name display mapping** (`src/lib/activity/formatters.ts`):

```typescript
const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  nickname: "Nickname",
  company: "Company",
  jobTitle: "Job title",
  phoneNumbers: "Phone numbers",
  emailAddresses: "Email addresses",
  addresses: "Addresses",
  birthday: "Birthday",
  notes: "Notes",
  websiteUrls: "Websites",
  socialProfiles: "Social profiles",
  // ... add all Contact fields
};

export function formatFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
```

**Before/After rendering:**

- Scalar values (strings, dates): render as plain text
- Null/undefined: render as "—" (em dash)
- Arrays (phoneNumbers, emailAddresses): render as comma-separated values or a vertical list if more than 2 items. If the array changed from 1 to 3 items, the diff shows the full before list and the full after list.
- Long values: truncate at 80 characters with ellipsis, full value on hover

#### Empty State

When a contact has no ActivityEvent records (created before Phase 10 shipped), the History tab shows:

```
[ClockIcon]
History starts from [Phase 10 deploy date]

Changes made before this date are not recorded.
Earlier contacts show the same history features going forward.
```

The deploy date must be configurable — store it as an environment variable (`ACTIVITY_LOG_START_DATE`) or a database setting so the copy stays accurate. Do not hardcode a date.

When a contact has events but the current page has no more events (end of pagination), show:

```
— No older history —
```

#### Loading State

While the history tab is loading, show a skeleton list of 5 event row placeholders. Do not show a spinner alone — the skeleton preserves the visual layout and feels faster.

#### Error State

If the ActivityEvent query fails:

```
[AlertIcon] Couldn't load history
[Retry button]
```

The retry button re-fetches the first page. Do not show a full-page error — this is a secondary tab and the contact detail page should remain usable.

#### Pagination in History Tab

The history tab uses "load more" pagination, not infinite scroll. A "Load more" button appears at the bottom of the loaded events if `hasMore` is true. Clicking it appends the next page to the existing list (no replace, no scroll reset). This is appropriate for a history tab where the user is scanning in reverse chronological order and may want to find a specific older event.

### Component File Structure

```
src/
  components/
    contacts/
      SourceBadge.tsx             # Source badge chip component
      LastUpdatedBy.tsx           # "Last updated by" line
      HistoryTab.tsx              # History tab container (client component for pagination)
      HistoryEventRow.tsx         # Single event row, collapsible
      HistoryFieldDiff.tsx        # Field diff expansion panel
      HistoryEmptyState.tsx       # Empty state for no events
  lib/
    activity/
      formatters.ts               # Summary/label formatting functions (updated)
      field-labels.ts             # Field name to display label mapping
  app/
    contacts/
      [id]/
        page.tsx                  # Contact detail page (server component, renders HistoryTab)
    api/
      contacts/
        [id]/
          history/
            route.ts              # GET /api/contacts/:id/history
```

### Data Fetching Strategy

The contact detail page is a Next.js App Router Server Component. The initial render fetches:
1. Contact data (including `sourceType`, `sourceDetail`, `lastMutatedBy`, `lastMutatedByDetail`, `updatedAt`) — already happens
2. First page of ActivityEvent rows for the History tab — new fetch, server-side

The History tab component receives the initial events as a prop and uses client-side fetching only for pagination ("Load more"). This avoids a loading spinner on initial page load for the history tab.

```typescript
// app/contacts/[id]/page.tsx (Server Component)
const [contact, initialHistory] = await Promise.all([
  getContact(id, userId),
  getContactHistory(id, userId, { limit: 30 }),
]);
```

### Accessibility

- The History tab must be keyboard navigable. Use a proper tab panel pattern (ARIA tablist/tab/tabpanel roles).
- Expandable event rows must be togglable via Enter/Space keys.
- Actor icons must have `aria-label` or `title` attributes so screen readers can identify the actor.
- Relative timestamps must have a `<time>` element with the absolute datetime in `dateTime` attribute.
- The "Load more" button must have a clear, descriptive label ("Load older history").

### Performance Considerations

- The `(contactId, createdAt DESC)` index from P10-01 ensures the history query is fast even for contacts with hundreds of events.
- The initial server-side fetch for the first 30 events adds a small amount to the contact detail page load time. Parallelize it with the contact data fetch using `Promise.all`.
- Client-side pagination fetches are cached by the browser for the duration of the session. No server-side caching of event pages is needed at this scale.
- Event row diffs in the payload are stored as JSON. The client parses them on row expansion — no separate fetch needed for the diff content.

## Acceptance Criteria

- Source badge is visible on every contact detail page and shows the correct label and icon for each `sourceType` value
- Source badge shows "Added manually" for contacts with `sourceType = MANUAL`
- Source badge shows "Imported from {filename}" for contacts with `sourceType = IMPORT_CSV` and a non-null `sourceDetail`
- Source badge shows "Synced from {label}" for contacts with `sourceType = SYNC_CARDDAV`
- "Last updated by" line shows the correct actor label and a relative timestamp
- History tab appears on the contact detail page
- History tab is visible and usable on Free plan (not gated)
- History tab shows events in reverse chronological order
- Each event row shows the correct actor icon, human-readable summary, and relative timestamp
- CONTACT_UPDATED event rows expand to show field diffs when clicked
- Field diff shows field name, before value, and after value for each changed field
- Null before/after values render as "—" not as "null" or "undefined"
- Contacts with no events show the empty state message referencing the activity log start date
- "Load more" button appears when there are more events and appends the next page on click
- Loading state shows skeleton rows while fetching
- Error state shows retry button
- History tab is keyboard accessible
- GET /api/contacts/:id/history returns events for the authenticated user only
- GET /api/contacts/:id/history returns 401 for unauthenticated requests
- GET /api/contacts/:id/history returns 403 if the authenticated user does not own the contact
- TypeScript compilation passes with no new errors

## Risks and Open Questions

- **Tab placement conflict**: The contact detail page may not currently have a tab structure. Adding "Details" and "History" tabs is a meaningful layout change that affects the entire contact detail view. Confirm with the designer whether the tab metaphor is the right pattern, or if the history should be a collapsible section at the bottom of the contact detail page instead.
- **History tab load time**: The initial server-side fetch for the first 30 events adds latency to the contact detail page. If contacts can have thousands of events (e.g., a heavily-synced contact), the query may be slow. The index should prevent this, but verify with EXPLAIN on a representative dataset.
- **"History starts from" date**: The correct date is the date Phase 10 was deployed, not the date the ticket was written. This date must be stored somewhere accessible to the component. An environment variable is simplest. A database row in a Settings table is more robust for multi-environment consistency.
- **Diff rendering for multi-value fields**: Showing the full before/after array for a contact with 10 phone numbers and only one changed is verbose. Consider showing array diff as "added: [new number]" and "removed: [old number]" rather than full before/after arrays. This requires a more sophisticated diff formatter that detects set-level changes within arrays.
- **Relative timestamp staleness**: Server-rendered relative timestamps ("3 hours ago") become inaccurate as the user spends time on the page. Use a client-side `useEffect` that re-renders timestamps periodically, or use a well-known relative time component that handles this automatically.

## Outcome

Every contact detail page shows its origin via a source badge and "last updated by" attribution, and provides a fully browsable, field-level change history in a dedicated History tab available to all plan tiers.
