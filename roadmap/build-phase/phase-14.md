# Phase 14 — Teams Plan: Shared Contact Books for Organisations

## Objective
Bring Kontax's contacts hub to small teams and organisations. A team can maintain multiple shared address books (e.g. "Clients", "Partners", "Suppliers"), control who can edit each book, sync team books to external platforms, and audit every change with full attribution. Teams builds directly on the Family shared-book infrastructure but adds the multi-book, role-based, and audit-log features that organisations need.

## Success Criteria
- A Teams plan subscriber can create a team, invite members up to their plan limit, and organise contacts across multiple named shared address books.
- Admin and Member roles control who can edit or just view each address book.
- Every change to a team address book is recorded in the audit log with full attribution — who changed what, when, and from which device or integration.
- Team address books can be synced to external CardDAV providers (the same client sync from Phase 5/9), giving the whole team access to team contacts on their devices.
- Team management and address book configuration are accessible to admins without needing support.

## Exit Criteria
- Team creation, invite, and role management flows are complete.
- Multiple shared address books are supported per team.
- Audit log is available to team admins with unlimited retention.
- Team-level CardDAV sync accounts are functional (extending Phase 5 sync to a team context).

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P14-01 | Done | P0 | P13-01 |
| P14-02 | Done | P0 | P14-01 |
| P14-03 | Done | P0 | P14-01 |
| P14-04 | Done | P1 | P14-02, P14-03, P10-01, P10-02 |
| P14-05 | Done | P1 | P14-04, P10-01 |
| P14-06 | Not Started | P1 | P14-04, P5-01, P7-03 |
| P14-07 | Done | P1 | P14-05, P14-06 |
| P14-08 | Not Started | P2 | P14-07 |
| P14-09 | Not Started | P2 | P14-07, P9-04 |

---

## P14-01 — Extend Group schema for Teams
- Status: `Done`
- **Tradeoff (documented):** per-book permissions stored as `GroupMember.addressBookPermissions` JSON ({bookId: EDIT|VIEW|NONE}) for flexibility; normalise into a join table if book-permission queries get hot. Shipped: `GroupMember.addressBookPermissions`, `GroupAddressBook.archivedAt` (isDefault/description already present from P13), new `TeamSyncAccount` model linking a SyncAccount→team book, and Group/SyncAccount back-relations. Teams set isDefault=false + maxMembers=25 at creation (schema defaults unchanged). Pushed clean; build green.
- Priority: `P0`
- Dependencies: `P13-01`
- Implementation Notes:
  - Teams use the same `Group`, `GroupMember`, `GroupAddressBook`, and `GroupContact` models from Phase 13, extended with team-specific fields.
  - `Group`: `type` is already an enum (`FAMILY`, `TEAM`) — no change needed.
  - `GroupMember`: add `addressBookPermissions Json?` — a map of `{ [addressBookId]: "EDIT" | "VIEW" | "NONE" }`. This lets admins grant per-book permissions to members rather than a single team-wide toggle. Default: `EDIT` for all books when a member joins.
  - `GroupAddressBook`: add `isDefault Boolean @default(false)` (Teams can have multiple books, none is implicitly "default"), `description String?`, `archivedAt DateTime?`.
  - Add `TeamSyncAccount` model to represent a CardDAV sync account owned by the team rather than an individual user:
    - `id`, `groupId`, `syncAccountId` (FK to the existing `SyncAccount`), `addedByUserId`, `addressBookId` (which team address book this sync account is linked to), `createdAt`.
    - This links an existing `SyncAccount` to a team address book rather than a personal contact collection.
  - `maxMembers` on `Group` defaults to 25 for Teams; allow it to be increased by operators for enterprise-tier customers without a schema change.
- Acceptance Criteria:
  - Per-book member permissions are representable in the schema.
  - Multiple address books per team are supported.
  - Team sync account model links a `SyncAccount` to a team address book.
  - Migration runs cleanly alongside Family group data.
- Risks / Open Questions:
  - Per-book permissions stored as JSON are flexible but harder to query. If book-level permission queries become frequent, consider a normalised `GroupMemberAddressBookPermission` join table instead. Document the tradeoff.

---

## P14-02 — Team creation, invite, and role management
- Status: `Done`
- Owner transfer deferred (subscription is userId-anchored — billing sign-off needed, same as Family). Grace-period-on-cancel flow also deferred to billing. Shipped: create, invite (token+SES, 25-seat limit), accept/decline, promote/demote (only owner→ADMIN; owner+admin manage), remove, leave, delete team.
- Priority: `P0`
- Dependencies: `P14-01`
- Implementation Notes:
  - Teams plan subscribers see a "Create Team" flow in settings. Team creation: team name, optional description, creates the `Group` with `type: TEAM` and adds the creator as `OWNER`.
  - Invite by email: same invite flow as Family (Phase 13) with the same signed-token, 48-hour expiry pattern. Teams invite limit defaults to 25 members but is configurable per subscription.
  - Roles:
    - `OWNER` — full control, can transfer ownership, cannot be removed except by transferring ownership first.
    - `ADMIN` — can invite/remove members, create/archive address books, manage per-book permissions, and manage team sync accounts.
    - `MEMBER` — can edit or view address books according to their per-book permissions. Cannot manage team structure.
  - Role assignment: owner and admins can promote a member to admin or demote an admin to member. Only the owner can promote to admin.
  - Member removal: immediate. Removed members lose access to all team address books. Their private contacts are unaffected.
  - Owner transfer: owner can transfer ownership to any admin. Transfers the subscription anchor. Document billing implications before building.
- Acceptance Criteria:
  - Team creation and invite flows work end-to-end.
  - Role assignment, promotion, demotion, and removal work correctly.
  - Permission changes take effect immediately — no stale access after removal or demotion.
- Risks / Open Questions:
  - Teams inviting users who are already on a Family plan (as owner or member): allow it. Team membership and Family membership are independent. Users can belong to one Family group and one Team simultaneously.
  - If the Teams plan subscriber (owner) cancels their subscription, all members lose team address book access. Define the grace period and notification flow before building.

---

## P14-03 — Multiple shared address books
- Status: `Done`
- Workspace tab/section presentation of multiple books is handled in P14-07; this ticket ships the books CRUD, per-book permissions, and the create-contact book selector.
- Priority: `P0`
- Dependencies: `P14-01`
- Implementation Notes:
  - Team admins can create, rename, archive, and delete address books from the team management page.
  - Creating an address book: name (required), description (optional). Creates a `GroupAddressBook` record.
  - Archiving: address book and all its contacts become read-only for all members. Archived books are hidden from the default workspace view but accessible via filter. No data is deleted.
  - Deleting a non-archived address book requires explicit confirmation and is irreversible. Contacts in the deleted book are permanently removed (soft-delete / archive, not hard-delete, to preserve audit trail).
  - Per-book member permissions: admins can set per-book permissions for each member (`EDIT`, `VIEW`, `NONE`). Default is `EDIT` for all members. `NONE` hides the book entirely from that member.
  - Address book selector in the create-contact flow: members with access to multiple team books see a dropdown to choose the target book. Default is the most recently used book.
  - Workspace: members see all team books they have access to as tabs or sections alongside their private contacts, clearly labelled with the book name (e.g. "Clients", "Partners").
- Acceptance Criteria:
  - Admins can create, rename, archive, and delete address books.
  - Per-book permissions restrict or grant access per member correctly.
  - Members with `NONE` permission cannot see or query the hidden book.
  - Multiple books are clearly presented in the workspace without confusing private and team contacts.
- Risks / Open Questions:
  - A member with access to 5+ team address books could have a cluttered workspace. Consider a "pinned books" preference or a collapsible team section before shipping at scale.

---

## P14-04 — Shared address book contact operations (Teams)
- Status: `Done`
- Shipped: precise per-book permission enforcement on all single-contact mutation paths (create/edit/inline/entries/archive/restore) via resolveContactEditAccess (EDIT required; VIEW/NONE blocked), TEAM_MEMBER attribution ("[Member] · [Team] · [Book]"), and addContactToTeamBook (copy). **Deferred refinements:** team-scoped bulk ops with per-contact audit events, and import-into-a-team-book destination — tracked as follow-ups (the import pipeline + bulk actions are currently userId-scoped).
- Priority: `P1`
- Dependencies: `P14-02`, `P14-03`, `P10-01`, `P10-02`
- Implementation Notes:
  - Same contact create/edit/archive/restore operations as Phase 13, extended with team-specific attribution and permission checks.
  - Permission checks on every mutation: verify the acting member has `EDIT` permission for the target address book before writing. Return a clear error if not.
  - Activity events emitted for team address book mutations use `actor: TEAM_MEMBER` and `actorDetail: "[Member name] · [Team name] · [Book name]"` so the audit log is self-explanatory.
  - Bulk operations: admins can bulk-archive or bulk-delete contacts within a book (with confirmation). Emit individual `ActivityEvent` rows per contact for full audit trail, not a single bulk event.
  - Import into a team address book: extend the existing import flow to allow selecting a team address book as the destination. Imported contacts are owned by the team book, not the importing member's private library.
- Acceptance Criteria:
  - Permission checks are enforced on all mutation paths — no member can bypass book-level permissions.
  - Activity attribution correctly identifies the acting member, team, and book.
  - Bulk operations generate per-contact audit events.
  - Import can target a team address book.
- Risks / Open Questions:
  - Importing a large file into a team book could create hundreds of contacts. Ensure the import pipeline handles team book ownership correctly and does not create orphaned contacts linked to the wrong user.

---

## P14-05 — Audit log for team admins
- Status: `Done`
- Shipped /settings/teams/audit (admin-only): filter by member/book/event-type/date-range, cursor pagination (100/page), CSV export, unlimited retention (no pruning). Scoped to events on the team's book contacts. Per-address-book tab presentation folds into P14-07.
- Priority: `P1`
- Dependencies: `P14-04`, `P10-01`
- Implementation Notes:
  - Team admins see a full audit log for all team address book changes: every `ActivityEvent` with `actor: TEAM_MEMBER` scoped to the team's address books.
  - The audit log is available under the team management page (`/settings/teams/{teamId}/audit`) and is also accessible as a tab per address book.
  - Unlimited retention for Teams plan (no pruning, unlike Pro's 90-day window).
  - Filter by: member, address book, event type (created/updated/archived/merged/imported), date range.
  - Export audit log: CSV export of filtered events, including timestamp, member name, event type, contact name, and field-level diff summary.
  - Individual members can see their own activity in their personal activity log (Phase 10), but cannot see other members' activity — only admins see the full team audit log.
- Acceptance Criteria:
  - Audit log shows all team address book mutations with full attribution.
  - Filter and date range controls work correctly.
  - CSV export produces a readable audit report.
  - Non-admin members cannot access the team audit log.
- Risks / Open Questions:
  - A large team with active imports could generate tens of thousands of audit events quickly. Ensure the audit log query is paginated and indexed efficiently before shipping.

---

## P14-06 — Team-level CardDAV sync accounts
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P14-04`, `P5-01`, `P7-03`
- Implementation Notes:
  - Extend the existing CardDAV client sync (Phase 5) to allow syncing a team address book to an external CardDAV provider.
  - A team admin can connect a CardDAV account (e.g. a shared Google Workspace CardDAV endpoint, a company Nextcloud instance) and link it to a specific team address book.
  - The sync behaves identically to personal CardDAV sync but operates on the team address book's contact set rather than a personal contact library. Sync jobs are attributed to the team admin who configured the account.
  - Activity events for sync operations on team books use `actor: SYNC` with `actorDetail: "[Sync account label] · [Team name] · [Book name]"`.
  - Team sync account management is accessible to team admins in the team management page alongside member management.
  - Sync conflicts on team books are surfaced to team admins rather than the individual member who last edited the contact.
- Acceptance Criteria:
  - Team admins can connect, configure, and disconnect CardDAV sync accounts for team address books.
  - Sync jobs operate on the team address book's contacts correctly.
  - Sync activity is attributed to the team and book in the audit log.
  - Sync conflicts surface to admins, not all members.
- Risks / Open Questions:
  - If multiple team members edit the same contact at the same time and a sync job runs concurrently, conflict handling must attribute the conflict to the team book rather than a personal contact. Ensure the `SyncConflict` model supports team-book-scoped conflicts.

---

## P14-07 — Team workspace, management page, and navigation
- Status: `Done`
- Shipped: team books surface in the contacts workspace (permission-aware, NONE books excluded), tagged with a team badge via the shared cluster; All/Private/Shared scope toggle + a per-book `?book=` filter; sidebar "Shared books" lists family + each team book; team-book chip on the contact detail. The management page keeps a single sectioned layout (all admin controls present, plus the audit link); the tabbed reorg with the Sync Accounts tab folds in with P14-06.
- Priority: `P1`
- Dependencies: `P14-05`, `P14-06`
- Implementation Notes:
  - The main workspace for Teams members shows private contacts and team address books in a clearly structured layout. Private and team sections should not blur — it must always be obvious whether you are looking at your own contacts or a team book.
  - Team section: collapsible group per team (a user can belong to one team), listing each accessible address book as a sub-section or tab. Contact rows in team books carry a team/book badge.
  - Team management page (`/settings/teams/{teamId}`): tabbed layout with Members, Address Books, Sync Accounts, and Audit Log tabs.
  - Admins see management controls (invite, remove, permissions, create book, sync accounts).
  - Members see a read-only view of the team structure and their own permissions.
  - Quick access: a "Team" shortcut in the workspace header or sidebar for members who belong to a team.
- Acceptance Criteria:
  - Team contacts are clearly distinguished from private contacts in the workspace.
  - Team management page is navigable and provides all admin controls in one place.
  - Members see their permissions clearly without needing to contact an admin.
- Risks / Open Questions:
  - A member who belongs to both a Family group (Phase 13) and a Team (Phase 14) has four potential contact scopes: private, family, team book A, team book B. The workspace must present this without overwhelming the user — consider a strong visual hierarchy from the start.

---

## P14-08 — Design brief: Teams plan surfaces
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P14-07`
- Implementation Notes:
  - Produce a design brief covering:
    - **Team creation onboarding**: prompt for Teams plan subscribers, team name input, first address book creation.
    - **Workspace with multiple team books**: section hierarchy, book badges on contact rows, private vs team visual distinction.
    - **Address book tabs/sections**: empty state, contact list, filter controls per book.
    - **Team management page**: member list with role badges and per-book permission indicators, invite flow, address book management, sync account management, audit log tab.
    - **Audit log**: filter bar, event row layout (timestamp, member avatar, event summary, diff expansion), CSV export button.
    - **Per-book permission matrix**: admin view of member permissions per book — consider a matrix table layout.
    - **Admin vs member view** throughout the management page.
  - Brief should emphasise clarity and density — teams users are more likely to be power users than casual contacts managers.
- Acceptance Criteria:
  - Designer has complete coverage of all Teams surfaces.
  - Admin and member perspectives are clearly differentiated throughout.
  - The design accommodates a user who belongs to both a Family group and a Team without visual confusion.
- Risks / Open Questions:
  - Team features should feel professional and trust-inspiring, not consumer-casual. Tone and visual language should shift slightly from the personal Kontax brand.

---

## P14-09 — Teams CardDAV server exposure (optional)
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P14-07`, `P9-04`
- Implementation Notes:
  - Extend the Kontax CardDAV server (Phase 9) to expose team address books as additional collections for each team member.
  - URL structure: `/dav/addressbooks/{userId}/team-{bookId}/` — one collection per accessible team address book.
  - Changes written via CardDAV from a member's device are attributed to that member in the audit log, not anonymised.
  - The collection display name should include the team and book name (e.g. "Acme Corp · Clients") so clients can distinguish it from personal and family collections.
  - Only implement if Phase 9 and Phase 13's family CardDAV extension are stable and tested.
- Acceptance Criteria:
  - Team address books appear as separate named collections in each member's CardDAV account.
  - Device-originated writes are attributed to the correct member in the audit log.
  - Collection names clearly identify the team and book.
- Risks / Open Questions:
  - A member with access to multiple team books will see multiple new collections appear in their phone's contacts app. Communicate this clearly in the connect-device UI.
