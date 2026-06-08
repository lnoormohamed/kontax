# P13-05 Shared Address Book in Contacts Workspace

## Purpose
This ticket integrates the shared family address book into the existing contacts workspace so that family members see their private contacts and shared contacts in a unified view, can filter between them, can create contacts targeting either book, and can see clear attribution on shared contacts. Without this surface, the shared address book is operationally complete (P13-03) and propagates changes (P13-04) but is invisible in the main product experience where users spend most of their time.

## Background
The contacts workspace (People tab) currently shows only private contacts scoped to the authenticated user's userId. All contact list queries are `WHERE userId = authenticated user`. Shared contacts in the GroupContact model have a Contact.userId set to the group owner's nominal id — they will not appear in the private contact query. This ticket adds the query logic and UI to show both sets together.

The workspace uses existing filter controls (search, sort, archive state). These must be extended to support the Private/Family/All view toggle without breaking existing private-contact filtering behavior.

Phase 10 (ActivityEvent) established the CONTACT_UPDATED event with actorDetail as a string label for the last editor. The contact detail page can show the last editor by reading the most recent CONTACT_UPDATED or CONTACT_CREATED ActivityEvent for the contact where actor === 'FAMILY_MEMBER'.

Phase 13-04 established the `useFamilyBookUpdates` hook. This ticket wires that hook into the workspace to show the "Family book updated" banner.

## Scope

**In scope:**
- Contact list query extension to include shared contacts for family members
- "Family" badge on shared contact rows
- View toggle: Private only / Family only / All (default)
- Contact detail page: Family address book source badge, last-updated-by attribution
- "Create contact" target selector: Private (default) or Family (shared)
- Search covering both private and shared contacts
- "Family book updated" banner wired to P13-04 propagation hook
- Handling the case where the user is not a family member (hide all family-related UI)
- Handling the case where the user is a member with canEdit: false (view-only badge, disabled edit actions)

**Out of scope:**
- Family group management page (P13-06)
- CardDAV exposure of shared contacts (P13-08)
- The "Add to family book" action UI (that action is triggered from the contact detail page — specify the trigger point here but the mutation logic is in P13-03)
- Performance optimizations for users with > 10,000 contacts (v1 is acceptable with correct indexes)

## Design / Implementation Spec

### Contact List Query Architecture

The unified contact list query must return both private contacts and shared contacts, with enough metadata to distinguish them in the UI.

**Private contacts:** `Contact WHERE userId = authenticatedUserId AND archivedAt IS NULL`

**Shared contacts:** `Contact WHERE id IN (SELECT contactId FROM GroupContact JOIN GroupAddressBook ON ... JOIN Group ON ... JOIN GroupMember ON ... WHERE GroupMember.userId = authenticatedUserId AND GroupMember.inviteStatus = 'ACCEPTED') AND archivedAt IS NULL`

**Combined approach — two queries unioned in the API layer:**

Rather than a SQL UNION (which complicates Prisma query construction), the API fetches both sets separately and merges them in the application layer before returning to the client:

```typescript
export async function getWorkspaceContacts(
  userId: string,
  options: {
    view: 'private' | 'family' | 'all'
    search?: string
    sortBy: 'displayName' | 'updatedAt'
    sortDir: 'asc' | 'desc'
    page: number
    pageSize: number
    includeArchived?: boolean
  }
): Promise<WorkspaceContact[]> {
  const { view, search, sortBy, sortDir, page, pageSize, includeArchived } = options
  const archivedFilter = includeArchived ? undefined : { archivedAt: null }

  let privateContacts: Contact[] = []
  let sharedContacts: (Contact & { isShared: true; groupAddressBookId: string; addedByUserId: string })[] = []

  // Fetch private contacts
  if (view === 'private' || view === 'all') {
    privateContacts = await prisma.contact.findMany({
      where: {
        userId,
        ...archivedFilter,
        ...(search ? buildContactSearchWhere(search) : {})
      }
    })
  }

  // Fetch shared contacts
  if (view === 'family' || view === 'all') {
    const membership = await prisma.groupMember.findFirst({
      where: { userId, inviteStatus: 'ACCEPTED', group: { type: 'FAMILY' } },
      include: { group: { include: { defaultAddressBook: true } } }
    })

    if (membership?.group?.defaultAddressBook) {
      const groupContacts = await prisma.groupContact.findMany({
        where: {
          groupAddressBookId: membership.group.defaultAddressBook.id,
          contact: { ...archivedFilter, ...(search ? buildContactSearchWhere(search) : {}) }
        },
        include: { contact: true }
      })
      sharedContacts = groupContacts.map(gc => ({
        ...gc.contact,
        isShared: true as const,
        groupAddressBookId: gc.groupAddressBookId,
        addedByUserId: gc.addedByUserId
      }))
    }
  }

  // Merge and de-duplicate (a private contact copied to the shared book appears in both — show both)
  const all: WorkspaceContact[] = [
    ...privateContacts.map(c => ({ ...c, isShared: false as const })),
    ...sharedContacts
  ]

  // Sort
  all.sort((a, b) => {
    const va = sortBy === 'displayName' ? (a.displayName ?? '') : a.updatedAt.toISOString()
    const vb = sortBy === 'displayName' ? (b.displayName ?? '') : b.updatedAt.toISOString()
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  // Paginate
  return all.slice((page - 1) * pageSize, page * pageSize)
}
```

**De-duplication note:** When a member uses "Add to family book" (P13-03), a copy of their private contact is created in the shared book. The original private contact and the shared copy are two separate Contact records with different IDs. They will both appear in the "All" view — this is correct behavior. The private copy shows no badge; the shared copy shows the "Family" badge. The user can distinguish them by source badge.

**Search performance:** The search filter uses the existing `buildContactSearchWhere` utility which searches across displayName, primaryEmail, primaryPhone, and ContactIdentifier.valueNormalized. For shared contacts, the same search criteria apply — there is no separate search index for shared contacts. The index on `(groupAddressBookId, updatedAt)` from P13-01 helps with listing but not with search. Ensure that the Contact table has a full-text search index or GIN index on the searchable fields that covers shared contacts (Contact.userId may be the group owner's id, but the index is on the Contact table itself, not scoped by userId).

### WorkspaceContact Type

```typescript
interface WorkspaceContact {
  id: string
  userId: string
  displayName: string | null
  givenName: string | null
  familyName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  archivedAt: Date | null
  updatedAt: Date
  // ... other Contact fields ...
  isShared: boolean
  groupAddressBookId?: string  // Present when isShared is true
  addedByUserId?: string       // Present when isShared is true
}
```

### Contact Row Component — Family Badge

For each contact row in the list:

```tsx
function ContactRow({ contact }: { contact: WorkspaceContact }) {
  return (
    <div className="contact-row">
      <ContactAvatar contact={contact} />
      <div className="contact-info">
        <span className="contact-name">{contact.displayName}</span>
        {contact.isShared && (
          <span className="family-badge" aria-label="Shared in Family book">
            Family
          </span>
        )}
      </div>
      <span className="contact-email">{contact.primaryEmail}</span>
    </div>
  )
}
```

The "Family" badge is a small pill/chip styled in a warm color distinct from the contact's source badges (which come from CardDAV sync accounts). The design spec is in P13-07. The badge is also shown in the archived contacts view if the archived contact is a shared contact.

### View Toggle

Add a segmented control above the contact list (integrated with the existing filter toolbar):

```
[All]  [Private]  [Family]
```

- "All" is the default — shows both private and shared contacts
- "Private" — shows only contacts where isShared === false
- "Family" — shows only contacts where isShared === true; shown only when the user is an ACCEPTED family group member

The view toggle state is stored in component state (not URL params in v1 — URL param persistence is a v2 nicety). The toggle selection is preserved when the user applies a search or changes the sort order.

If the user is not a family group member, the "Family" option is hidden entirely and the "All" label is also hidden (only the private contacts view is available, which is the existing behavior). The existence of the toggle is gated on `membership !== null`.

### Contact Detail Page — Shared Contact View

When a contact is a shared contact (`isShared === true`), the contact detail page shows two additional elements:

**1. Family address book source badge:**
In the "Sources" section of the contact detail (or near the top if the contact has no other sources):
```
Family address book  [GroupName]
```
Styled similarly to the existing CardDAV sync source badges from Phase 9.

**2. Last updated by attribution:**
Query the most recent ActivityEvent for this contact where `actor === 'FAMILY_MEMBER'`:

```typescript
const lastEdit = await prisma.activityEvent.findFirst({
  where: {
    contactId: contact.id,
    actor: 'FAMILY_MEMBER',
    eventType: { in: ['CONTACT_UPDATED', 'CONTACT_CREATED'] }
  },
  orderBy: { createdAt: 'desc' }
})
```

Display as:
```
Last updated by Sarah (via Family Book)  ·  3 days ago
```

The `actorDetail` field contains `"{Name} via Family Book"` — extract the name from the prefix before " via Family Book" for display.

If no FAMILY_MEMBER event exists (e.g., the contact was added before activity logging was in place), omit the attribution line rather than showing a placeholder.

**3. Edit and delete button state for view-only members:**

If the authenticated user's GroupMember.canEdit is false:
- The "Edit" button is hidden or replaced with a disabled "View only" indicator
- The "Archive" / "Delete" button is hidden
- An inline note reads: "You have view-only access to this family address book."

If canEdit is true, the existing edit/archive buttons are shown normally.

**4. "Add to family book" action on private contacts:**

On the contact detail page for a private contact (isShared === false), when the user is an ACCEPTED family member with canEdit: true, show an "Add to family book" button. This button triggers the `POST /api/family/groups/{groupId}/contacts/add-from-private` endpoint from P13-03.

After the action succeeds, show a confirmation: "Contact added to Family Book. The shared copy is independent — edits to one won't affect the other." This sets the user's expectation that the private and shared copies are separate.

If the contact is already in the family book (CONTACT_ALREADY_IN_FAMILY_BOOK error), show: "This contact is already in your Family Book."

### Create Contact Target Selector

When opening the "Create contact" form, if the user is an ACCEPTED family group member with canEdit: true, show a target selector:

```
Save to:  [Private (default)] [Family book]
```

Selecting "Family book" changes the form submission target to `POST /api/contacts` with `targetAddressBook: { type: 'group', groupAddressBookId: ... }` as specified in P13-03.

If canEdit is false, only "Private (default)" is shown — no family book option.

### "Family Book Updated" Banner

Wire the propagation hook from P13-04 into the workspace:

```tsx
function ContactsWorkspace() {
  const { familyGroupId } = useFamilyMembership()
  const { hasUpdates, dismissUpdates } = useFamilyBookUpdates(familyGroupId)

  const handleRefresh = useCallback(() => {
    refetchContacts()  // Re-runs the workspace contact query
    dismissUpdates()
  }, [refetchContacts, dismissUpdates])

  return (
    <div>
      {hasUpdates && (
        <FamilyBookUpdateBanner onRefresh={handleRefresh} onDismiss={dismissUpdates} />
      )}
      <ContactList ... />
    </div>
  )
}
```

```tsx
function FamilyBookUpdateBanner({ onRefresh, onDismiss }: { onRefresh: () => void; onDismiss: () => void }) {
  return (
    <div className="family-update-banner" role="status" aria-live="polite">
      <span>Your family book was updated.</span>
      <button onClick={onRefresh}>Refresh</button>
      <button onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  )
}
```

The banner does not auto-refresh the contact list because the user might be mid-action (filling out a form, reading a contact detail). The user must explicitly click "Refresh" to pull in the changes.

### Search Behavior

Search (`GET /api/contacts?search={query}`) is extended to cover shared contacts when the user is a family member:

- Default search (view: all): searches both private and shared contacts
- When view: private: searches only private contacts
- When view: family: searches only shared contacts

Search within the API should apply the same `buildContactSearchWhere` utility to both result sets. The results are merged and sorted by relevance (displayName match first, then email/phone match) in the application layer.

### Pagination Complexity

The merge-then-paginate approach in `getWorkspaceContacts` fetches all matching contacts from both queries and paginates in the application layer. For users with thousands of private contacts AND hundreds of shared contacts, this approach can be expensive.

**v1 acceptable limit:** Up to 1000 private contacts + 500 shared contacts before application-layer pagination becomes slow. For users within these bounds, the merged sort + paginate is fast enough in Node.js.

**Optimization path for v2:** Implement cursor-based pagination on each query separately, interleave results in sorted order (merge-sort style), and track two cursors. This requires sorted queries with comparable keys (e.g., both sorted by displayName) and a merge cursor mechanism. Document this as a follow-up task.

### Entitlement Gates in the Workspace

The workspace checks family membership before showing family-related UI:

```typescript
const { membership } = useFamilyMembership()
// membership: GroupMember | null

const isFamilyMember = membership?.inviteStatus === 'ACCEPTED'
const canEdit = membership?.canEdit ?? false
```

If `isFamilyMember` is false: no view toggle, no family badge, no "Add to family book" button, no "Family book" option in the create contact target selector.

If `isFamilyMember` is true but `canEdit` is false: view toggle shows "Family" option (read-only view), family badge appears on shared contacts, contact detail shows "View only" indicator, "Create contact" does not show "Family book" target.

### API Route Summary

| Route | Method | Purpose |
|---|---|---|
| `/api/contacts` | GET | Extended to support `view` query param (private/family/all) |
| `/api/contacts` | POST | Extended to support `targetAddressBook` body param |
| `/api/family/{groupId}/membership` | GET | Returns the authenticated user's GroupMember for this group |
| `/api/family/{groupId}/contacts` | GET | Returns shared contacts with optional `updatedSince` param (P13-04) |

The `/api/contacts` route changes are backward-compatible: existing callers without the `view` param default to `view=all` which returns all accessible contacts (private + shared). This may be a breaking change for callers that expected only private contacts — document this in the API changelog if there are external API consumers.

## Acceptance Criteria

- Family members see their private and shared contacts together in the "All" view by default
- "Family" badge is visible on shared contact rows and is absent on private contact rows
- View toggle (Private / Family / All) is visible for family members and correctly filters the contact list
- View toggle is hidden for non-family-member users; contact list behavior is unchanged for those users
- Contact detail for a shared contact shows: Family address book source badge, last-updated-by attribution (from ActivityEvent), view-only indicator if canEdit is false
- Contact detail for a private contact shows "Add to family book" button for ACCEPTED members with canEdit: true; button is absent for non-members and view-only members
- "Add to family book" success: shows confirmation message; the shared copy appears in the family view; the private copy is unchanged
- "Add to family book" on a contact already in the book shows CONTACT_ALREADY_IN_FAMILY_BOOK message
- Create contact form shows target selector for ACCEPTED members with canEdit: true; default is Private
- Creating a contact with "Family book" target creates it in the shared book; it appears in the Family view with the Family badge
- "Family book updated" banner appears when the propagation hook signals an update; Refresh button re-fetches the contact list
- Search returns results from both private and shared contacts in the "All" view
- Users with no family membership see the workspace exactly as it was before Phase 13 (no regressions)
- TypeScript compilation passes; no console errors in the workspace for either family or non-family users

## Risks and Open Questions

- **Pagination with merged result sets:** The application-layer merge-then-paginate approach works for typical family group contact volumes (< 1,000 contacts total). If a member has tens of thousands of private contacts, the merge approach fetches all private contacts before paginating. Add a `LIMIT 2000` guard to the private contact query in v1 to prevent unbounded fetches, and document this limit in the API response.
- **"All" view default may be surprising to existing Pro users who upgrade to Family:** Before Phase 13, the contact list showed only private contacts. After joining a family group, the "All" default includes shared contacts. This change in default behavior should be communicated to the user on their first visit to the workspace after accepting a family invite — show a one-time tooltip: "Your family's shared contacts now appear here. Use the All / Private / Family toggle to filter."
- **Shared contact with same display name as a private contact:** In the "All" view, a member could see "John Smith" appear twice — once as their private contact and once as the shared family contact. The "Family" badge is the only distinguishing visual. Make sure the badge is visually distinct enough for this scenario. The P13-07 design brief should address this.
- **canEdit check on every render:** The `useFamilyMembership` hook must be efficient — it fetches the GroupMember record for the current user. If this hook triggers a separate API call on every workspace render, it will add latency. Cache the membership data for the duration of the session and invalidate when the group management page makes changes.

## Outcome
Family members see their private and shared contacts in a unified workspace with clear visual distinction, filtering controls, and full attribution on shared contacts, with no behavior regression for non-family users.
