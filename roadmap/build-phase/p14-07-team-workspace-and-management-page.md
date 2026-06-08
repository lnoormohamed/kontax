# P14-07 Team Workspace and Management Page

## Purpose
This ticket delivers the navigation, layout, and interaction patterns for two major surfaces: the main workspace (where members browse and interact with contacts across personal and team address books) and the team management page (where owners and admins configure team membership, address books, sync accounts, and access the audit log). Both surfaces must handle the maximum complexity case — a user who simultaneously belongs to a Family group and a Team — without overwhelming them. Clear visual hierarchy, strong separation between personal and shared data, and role-sensitive controls are the primary design constraints.

## Background
Phase 13 delivered a Family-aware workspace: a collapsible "Family" section was added to the contacts sidebar alongside the personal contacts section. The Phase 13 implementation assumed one shared book per group. Teams breaks this assumption: a team can have multiple books, each with different contacts and different per-member visibility. The workspace must accommodate this.

The team management page is new in Phase 14. It replaces the simple "Family settings" page from Phase 11/13 with a richer tabbed interface covering four distinct concerns: Members, Address Books, Sync Accounts, and Audit Log. Admins see management controls; members see a read-only summary.

## Scope

### In scope
- Workspace layout: collapsible team section with per-book sub-sections, contact row badges, empty states, private vs team visual distinction.
- Navigation: sidebar (or header) quick access to the team workspace section; breadcrumb on management page.
- Team management page (`/settings/teams/{teamId}`): Members tab, Address Books tab, Sync Accounts tab, Audit Log tab.
- Members tab: member list with role badges, invite action, remove action, role change actions (contextual by acting user's role).
- Address Books tab: list of books with per-member permission indicators, archive/rename/create actions.
- Sync Accounts tab: list of linked sync accounts with status indicators, connect/remove actions.
- Audit Log tab: embeds the `AuditLogView` component from P14-05.
- Handling the simultaneous Family + Team membership case.
- Mobile-responsive layout for workspace (management page can be desktop-primary for Teams MVP).

### Out of scope
- Individual contact detail page — uses existing contact detail component.
- Design tokens, color palette, illustration assets — P14-08.
- CardDAV connect-device flow — P14-09.
- Billing management — separate billing settings page.

## Design / Implementation Spec

### 1. Workspace Layout

#### 1.1 Page Structure

The workspace is a two-panel layout:
- Left: sidebar with collapsible sections.
- Right: contact list for the selected section/book.

Sidebar sections in priority order:
1. **My Contacts** — personal contacts (always present, always first).
2. **Family** — if user is a member of a Family group (Phase 13 section, unchanged).
3. **[Team Name]** — if user is a member of a Team group (new in Phase 14).

Each section is independently collapsible. Collapse state is stored in `localStorage` per section key.

#### 1.2 Team Section in Sidebar

```
▼ Acme Corp                    ⚙ (gear icon → /settings/teams/{teamId})
  ├── Main                     [12]
  ├── Clients                  [47]
  ├── Vendors                  [8]
  └── [+ New book]             (ADMIN/OWNER only)
```

Each book entry shows:
- Book name.
- Contact count badge (count of non-archived contacts).
- Active state (highlighted when selected).

Books are sorted: default book first, then alphabetically. Archived books are hidden unless the "Show archived" toggle is active.

The gear icon navigates to `/settings/teams/{teamId}`. It is visible to all team members but shows different content depending on role (admins see management controls, members see read-only view).

`[+ New book]` is only visible to OWNER and ADMIN. Clicking opens the "Create Address Book" modal inline.

#### 1.3 Workspace Contact List — Team Book View

When a team book is selected in the sidebar, the right panel shows contacts in that book.

**Header row:**
```
Clients                              [ Search... ]   [ + Add Contact ]   [ ⋮ More ]
47 contacts · Acme Corp              [ Filter ▼ ]    [ Import ]
```

- Book name and contact count.
- Team name as sub-label (so the user always knows which team the book belongs to).
- "Add Contact" button: hidden if user has VIEW permission. Shows EDIT permission indicator if user has EDIT.
- "Import" button: hidden if user has VIEW permission.
- "More" menu (⋮): for ADMIN/OWNER — "Archive book", "Rename book", "Export contacts".

**Contact rows:**
```
[ Avatar ] John Doe                  📞 +1 (555) 123-4567   ✉ john@acme.com
           Added by Alice Smith · 3 days ago
```

Contact rows in team books carry a subtle book badge (P14-08 will specify exact visual). In the "My Contacts" section, no badge. In a team book, a small tag showing the book name (useful when contacts appear in search results across sections).

**Read-only overlay for VIEW permission:**
When the user has VIEW permission, the contact list is displayed normally but:
- "Add Contact" and "Import" buttons are hidden.
- Each contact row has no edit actions (no pencil icon, no right-click edit).
- A banner at the top of the contact list: "You have view-only access to this book."

#### 1.4 Archived Book View

When the user toggles "Show archived books" in the team section, archived books appear at the bottom of the team section list with:
- Muted/grey styling.
- "ARCHIVED" badge next to book name.
- Contact count shown.
- Clicking selects the book and shows contacts in a read-only view.
- No "Add Contact", "Import", or edit actions are available regardless of member role.
- ADMIN/OWNER sees "Unarchive" option in the "More" menu.

#### 1.5 Simultaneous Family + Team Membership

When a user belongs to both a Family group and a Team, the sidebar shows all three sections:

```
▼ My Contacts                 [243]
▼ The Johnsons (Family)        [18]
  └── Shared Contacts
▼ Acme Corp (Team)             [67]
  ├── Main                    [12]
  ├── Clients                 [47]
  └── Vendors                  [8]
```

Design rules for this case:
- Each section has a distinct visual treatment (P14-08 will define colors/icons).
- "My Contacts", "Family", and "Team" sections MUST NOT be visually confused. The user must be able to identify at a glance which context they are working in.
- The active section/book is highlighted with a clear selected state.
- The right panel header always shows the current context: book name, parent section name, role indicator.
- Search: cross-section search shows results grouped by section (My Contacts, Family, Team book name). Never mix results from different sections without labeling.

---

### 2. Team Management Page

Route: `/settings/teams/{teamId}`

This is a Next.js page with tab-based navigation. The active tab is stored in the URL as a query param: `?tab=members` (default), `?tab=books`, `?tab=sync`, `?tab=audit`.

#### 2.1 Page Shell

```typescript
// src/app/settings/teams/[teamId]/page.tsx

export default async function TeamSettingsPage({
  params,
  searchParams,
}: {
  params: { teamId: string };
  searchParams: { tab?: string };
}) {
  const session = await auth();
  const membership = await getGroupMembership(session.user.id, params.teamId);
  if (!membership) redirect("/settings");

  const group = await prisma.group.findUniqueOrThrow({
    where: { id: params.teamId },
    select: { id: true, name: true, type: true },
  });
  if (group.type !== "TEAM") redirect("/settings");

  const isAdmin = membership.role === "OWNER" || membership.role === "ADMIN";
  const activeTab = searchParams.tab ?? "members";

  return (
    <TeamManagementShell
      teamId={params.teamId}
      teamName={group.name}
      userRole={membership.role}
      activeTab={activeTab}
    >
      {activeTab === "members" && <MembersTab teamId={params.teamId} isAdmin={isAdmin} role={membership.role} />}
      {activeTab === "books" && <AddressBooksTab teamId={params.teamId} isAdmin={isAdmin} />}
      {activeTab === "sync" && isAdmin && <SyncAccountsTab teamId={params.teamId} />}
      {activeTab === "sync" && !isAdmin && <NoAdminAccess />}
      {activeTab === "audit" && isAdmin && <AuditLogTab teamId={params.teamId} />}
      {activeTab === "audit" && !isAdmin && <NoAdminAccess />}
    </TeamManagementShell>
  );
}
```

#### 2.2 Tab Navigation

```
[ Members ]  [ Address Books ]  [ Sync Accounts ]  [ Audit Log ]
             (ADMIN only tabs are shown but disabled for MEMBERs with a tooltip)
```

For non-admin members: "Sync Accounts" and "Audit Log" tabs are visible (they can see the team structure) but show a "Admin access required" empty state when clicked. This is preferable to hiding the tabs entirely — it communicates to members that these features exist and are governed by admins.

---

### 3. Members Tab

#### 3.1 Member List

```
Members  (12 / 25)                                    [ + Invite Member ]

Name             Email                Role     Status    Actions
Alice Smith      alice@acme.com       Owner    Active    —
Bob Jones        bob@acme.com         Admin    Active    [ Make Member ]  [ Remove ]
Carol Wu         carol@acme.com       Member   Active    [ Make Admin ]   [ Remove ]
David Lee        david@acme.com       Member   Pending   [ Resend ]       [ Revoke ]
```

- Member count / cap (e.g., "12 / 25").
- Role badge: "Owner" (special styling), "Admin" (accent color), "Member" (default).
- Status badge: "Active", "Pending" (invite not yet accepted), "Revoked".
- Actions column is role-sensitive (see P14-02 capabilities matrix).
- Pending invites are shown at the bottom of the list, separated by a divider.

**For members viewing the list (not admin):**
- Actions column is hidden.
- No "Invite Member" button.
- Shows the member's own row with no actions.

#### 3.2 Invite Member Modal

Triggered by "+ Invite Member" (ADMIN/OWNER only):

```
Invite a team member

Email address:  [ __________________ ]
Role:           [ Member ▼ ]           (Member | Admin)

[ Cancel ]  [ Send Invite ]
```

On success: toast "Invite sent to {email}". Pending row appears immediately in the list (optimistic UI or page refresh).

#### 3.3 Role Change Confirmation

"Make Admin" and "Make Member" show a confirmation popover (not a full modal):
```
Promote Carol Wu to Admin?
Admins can invite/remove members, create books, and manage permissions.
[ Cancel ] [ Confirm ]
```

#### 3.4 Remove Member Confirmation

```
Remove David Lee from Acme Corp?
David will immediately lose access to all team address books.
[ Cancel ] [ Remove ]
```

---

### 4. Address Books Tab

#### 4.1 Book List

```
Address Books                                          [ + New Book ]

Name          Contacts    Description           Status    Actions
Main          12          Default shared book   Active    [ Rename ] [ Archive ]
Clients       47          —                     Active    [ Rename ] [ Archive ]
Vendors        8          External partners     Active    [ Rename ] [ Archive ]
Old Prospects  3          —                     Archived  [ Unarchive ] [ Delete ]
```

"New Book" button is ADMIN/OWNER only.
"Delete" is OWNER only and only visible for archived books.

Clicking a book name navigates to the workspace with that book selected.

#### 4.2 Per-Book Permission Matrix

Below (or accessible via "Manage Permissions" link per book), an admin can view and edit the permission matrix:

```
Permissions for: Clients

Member          Permission
Alice (Owner)   EDIT (always)
Bob Jones       [ EDIT ▼ ]
Carol Wu        [ VIEW ▼ ]
Eve Turner      [ NONE ▼ ]
```

Each permission cell is a dropdown (EDIT | VIEW | NONE) for each member. The OWNER row is locked to EDIT. Changes auto-save (optimistic update + server action). A "Reset all to EDIT" bulk action is available.

The matrix is paginated if there are more than 10 members (show 10 per page with next/prev arrows).

#### 4.3 Create Book Modal

```
Create Address Book

Name:         [ __________________ ]  (required)
Description:  [ __________________ ]  (optional, 300 chars)

[ Cancel ]  [ Create ]
```

---

### 5. Sync Accounts Tab

#### 5.1 Sync Account List

```
Sync Accounts                                          [ + Connect Account ]
(Admin access required to manage sync accounts)

Label              Book       Last Synced          Status     Actions
Google Workspace   Clients    Today at 2:15 PM     ✓ OK       [ Sync Now ] [ Remove ]
Nextcloud          Vendors    Yesterday at 11:00   ⚠ Conflict [ Resolve ]  [ Remove ]
—                  Main       Never                — None     —
```

- Books with no sync account show a "—" row.
- Status icons: ✓ OK, ⚠ Conflict, ✗ Error, ↺ Syncing, — None.
- "Sync Now" triggers an immediate sync job.
- "Resolve" navigates to the conflict resolution UI (from Phase 7, adapted for team context).

#### 5.2 Connect Sync Account Modal

```
Connect CardDAV Account

Label:         [ __________________ ]  (e.g., "Google Workspace")
Target book:   [ Clients ▼ ]
Server URL:    [ https://____________ ]
Username:      [ __________________ ]
Password:      [ __________________ ]
Sync direction: [ Bidirectional ▼ ]   (Pull only | Push only | Bidirectional)

[ Test Connection ]   [ Cancel ]  [ Connect ]
```

"Test Connection" tests credentials without saving. Shows a success/error inline message. "Connect" is disabled until a successful test.

---

### 6. Audit Log Tab

Embeds the `<AuditLogView>` client component from P14-05 with `teamId` pre-set and no override allowed. Admins see the full audit log. Members see "Admin access required."

The tab shows a count badge when there are unreviewed events (optional: track `lastAuditViewedAt` per admin and count events since then).

---

### 7. Quick Access Navigation

The workspace sidebar includes a gear icon (⚙) next to the team section header. This navigates to `/settings/teams/{teamId}`. The link is visible to all team members.

Additionally, consider a breadcrumb in the workspace header when a team book is selected:
```
Workspace › Acme Corp › Clients
```

Each segment is a link: "Workspace" goes to the workspace root, "Acme Corp" goes to the team management page, "Clients" is the current book (no link).

---

### 8. Data Fetching Architecture

The team management page uses server components (RSC) for the initial data fetch and client components for interactive elements (modals, dropdowns, tab switching).

```typescript
// Members tab data shape
interface MembersTabData {
  members: {
    id: string;          // GroupMember.id
    userId: string;
    name: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    inviteStatus: "ACCEPTED" | "PENDING";
    joinedAt: Date | null;
    invitedAt: Date;
  }[];
  memberCount: number;
  memberCap: number;
}

// Address books tab data shape
interface AddressBooksTabData {
  books: {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    archivedAt: Date | null;
    contactCount: number;
    memberPermissions: {
      memberId: string;
      memberName: string;
      memberRole: string;
      permission: "EDIT" | "VIEW" | "NONE";
    }[];
  }[];
}
```

Queries for the management page are server actions that perform the appropriate `requireGroupRole` check before returning data.

---

### 9. Empty States

| Context | Empty state message |
|---|---|
| Team has no address books | "No address books yet. Create your first book to start organizing contacts." |
| Address book has no contacts | "This address book is empty. Add contacts or import from a file." |
| No sync accounts | "No sync accounts connected. Connect a CardDAV account to automatically keep this book in sync." |
| No audit events | "No activity recorded yet. Events will appear here as team members interact with contacts." |
| Member with no team | "You're not part of a team yet. Ask your team admin for an invite, or [start a team] if you're on the Teams plan." |

---

### 10. Accessibility and Responsive Behavior

- All interactive elements must have accessible labels (aria-label on icon-only buttons).
- Tab navigation on the management page must be keyboard-navigable.
- Modal dialogs must trap focus and return focus to the trigger on close.
- The sidebar sections must have `role="navigation"` and `aria-label` values per section.
- Contact list must use `role="list"` and `role="listitem"`.
- Workspace is responsive to tablet (768px+). Management page is desktop-primary for Teams MVP but must not break at 768px.

## Acceptance Criteria

- [ ] Workspace sidebar shows a "Team" section when the user belongs to a Team group.
- [ ] Team section in sidebar lists all address books the user has VIEW or EDIT permission on.
- [ ] Default book appears first; others are sorted alphabetically.
- [ ] A user with both Family and Team membership sees both sections without visual confusion.
- [ ] Selecting a team book in the sidebar shows the correct contacts in the right panel.
- [ ] Contact rows in team books show the book badge.
- [ ] A member with VIEW permission sees no "Add Contact" or "Import" buttons.
- [ ] A member with VIEW permission sees a "view-only" banner.
- [ ] Archived books are hidden by default; visible via "Show archived" toggle.
- [ ] `/settings/teams/{teamId}` is accessible to all team members.
- [ ] The team management page tabs navigate via URL query params.
- [ ] Members tab shows all members with correct role badges and status.
- [ ] "Invite Member" button is only visible to OWNER and ADMIN.
- [ ] Role change actions respect the capability matrix (e.g., ADMIN cannot see "Make Admin" button).
- [ ] Address Books tab shows book list with contact counts and actions appropriate to the user's role.
- [ ] Permission matrix is shown per book; OWNER is locked to EDIT.
- [ ] Sync Accounts tab is accessible to ADMIN/OWNER; shows "Admin access required" to MEMBERs.
- [ ] Audit Log tab embeds `AuditLogView` with teamId pre-set.
- [ ] Gear icon in sidebar navigates to `/settings/teams/{teamId}`.
- [ ] All modals trap focus and return focus to trigger on close.
- [ ] Page renders without error when the team has 0 books, 0 members (impossible state but guard anyway), or all books archived.

## Risks and Open Questions

- **Sidebar length with many books**: A team with 20 books will produce a very long sidebar. Consider collapsing to "show first 5, then expand" with a "Show all books (20)" link.
- **Permission matrix for large teams**: A 25-member × 20-book matrix = 500 cells. Rendering this as a full table may be slow and overwhelming. Consider a paginated "one member's permissions" view instead of the full matrix for teams over 10 members.
- **Contact count queries**: Computing `contactCount` per book requires a JOIN + COUNT query. For a team with 20 books, this is 20 queries (or one GROUP BY query). Use a single aggregated query: `SELECT groupAddressBookId, COUNT(*) FROM GroupContact WHERE groupId = X GROUP BY groupAddressBookId`.
- **URL-based tab state vs localStorage**: Using URL query params (`?tab=members`) is chosen for shareability and browser history. However, if the user is on a deep tab and refreshes, they stay on that tab. This is the correct behavior.
- **Family + Team sidebar hierarchy**: If the user has both Family and a Team, the sidebar has 3 sections. On mobile (< 768px), this may require a bottom navigation or a hamburger menu. Defer mobile layout decision to P14-08.

## Outcome
Team members have a clear, well-organized workspace that presents their personal, family, and team contacts without confusion, and team admins have a comprehensive management page to handle every aspect of their team's configuration in one place.
