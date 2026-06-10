# Phase 13 — Family Plan: Shared Contact Books

## Objective
Make the Family plan a real product by letting family members share a common address book. A family group has one shared contact book that all members can view and edit. Everyone also keeps their own private contact library. When a family member updates a shared contact, every other member sees the change. No one needs to manually re-enter or re-sync a contact just because a family friend moved or got a new phone number.

## Success Criteria
- A Family plan subscriber can create a family group, invite up to 5 other members, and share a family address book with all of them.
- Every member sees shared contacts in their workspace alongside their private contacts.
- Changes to a shared contact propagate to all members in near real-time.
- The family admin can manage membership, transfer ownership, and control who can edit the shared book.
- Each member retains a completely private contact library that other family members cannot see.

## Exit Criteria
- Family group creation, invite, accept, and remove flows are complete.
- Shared family address book is visible and editable in each member's workspace.
- Change propagation works reliably across all members.
- Activity log shows family address book changes with attribution (who changed what).

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P13-01 | Done | P0 | P11-02 |
| P13-02 | Done | P0 | P13-01 |
| P13-03 | Done | P0 | P13-01, P10-01, P10-02 |
| P13-04 | Not Started | P1 | P13-02, P13-03, P10-01 |
| P13-05 | Not Started | P1 | P13-04 |
| P13-06 | Not Started | P1 | P13-04 |
| P13-07 | Not Started | P1 | P13-05, P13-06 |
| P13-08 | Not Started | P2 | P13-07, P9-04 |

---

## P13-01 — Family group and shared address book schema
- Status: `Done`
- **Decision (ownership model):** Chose the `GroupContact` join model over a
  nullable `Contact.groupId`. Rationale: `Contact.userId` stays the stable
  ownership anchor so existing per-user queries/indexes are untouched, and
  per-member state (`isFavorite`/`isEmergency`) is not incorrectly shared across
  the group. A shared contact is a `Contact` (nominally owned by the group
  owner's `userId`) linked into a `GroupAddressBook` via `GroupContact`;
  access/mutation gate on `GroupMember`, not `userId` equality. "Add to family
  book" creates a new `Contact` + `GroupContact` (copy, not move).
- Shipped: `Group.maxMembers`/`defaultAddressBookId`; `GroupMember.canEdit`/
  `invitedAt`/`invitedByUserId`/`joinedAt` + `(groupId, inviteStatus)` index;
  `GroupAddressBook.isDefault` + `contacts` relation; new `GroupContact` model
  with `(groupAddressBookId, contactId)` unique + `(groupAddressBookId, updatedAt)`
  index; `Contact.groupContacts` back-relation. Pushed cleanly; build green.
- Priority: `P0`
- Dependencies: `P11-02`
- Implementation Notes:
  - Extend the `Group` scaffolding model added in Phase 11 with operational fields:
    - `Group`: add `maxMembers Int @default(6)`, `defaultAddressBookId String?` (FK to `GroupAddressBook`).
  - Extend `GroupMember`: add `canEdit Boolean @default(true)` (admin can restrict specific members to view-only), `joinedAt DateTime?`, `invitedAt DateTime @default(now())`, `invitedByUserId String`.
  - Extend `GroupAddressBook`: add `isDefault Boolean @default(true)` (Family v1 has one book; Teams may have multiple).
  - Add `GroupContact` model to represent contacts that live in a shared address book:
    - `id`, `groupAddressBookId`, `contactId` (FK to `Contact` — the canonical contact record), `addedByUserId`, `createdAt`, `updatedAt`.
    - A `GroupContact` is owned by the group, not an individual user. The underlying `Contact` record still needs a `userId` for schema compatibility — use the group owner's `userId` as the nominal owner and gate direct mutations through group membership checks rather than userId equality.
    - Alternative approach: add a nullable `groupId` to `Contact` directly. Evaluate which is cleaner before implementing. Document the decision.
  - Add `(groupAddressBookId, contactId)` unique constraint to prevent duplicate entries.
  - Indexes: `(groupId, status)` on `GroupMember`, `(groupAddressBookId, updatedAt)` on `GroupContact`.
- Acceptance Criteria:
  - Schema supports family groups with one shared address book and up to 6 members.
  - Group contact ownership model is documented and unambiguous.
  - Migration runs cleanly alongside existing contact and user data.
- Risks / Open Questions:
  - The `Contact.userId` FK is currently the core ownership anchor. Decide before migrating whether shared contacts point to a group owner or whether a new nullable `groupId` field is cleaner. This decision affects query patterns throughout the app.
  - Family plan allows only one shared address book in v1. Teams (Phase 14) needs multiple. Ensure the schema supports this extension without rework.

---

## P13-02 — Family group creation and invite flow
- Status: `Done`
- Priority: `P0`
- Dependencies: `P13-01`
- Implementation Notes:
  - Family plan subscribers see a "Create Family Group" prompt in their settings page (replacing the "coming soon" placeholder from Phase 11).
  - Group creation: user enters a group name (e.g. "Smith Family"), which creates the `Group`, the default `GroupAddressBook`, and adds the creator as `OWNER`.
  - Invite by email: owner sends invites to up to 5 email addresses. Each invite creates a `GroupMember` record with `inviteStatus: PENDING` and sends an email with an accept link.
  - Accept link: recipient clicks the link, is prompted to log in or register, and then confirms joining the family group. Sets `inviteStatus: ACCEPTED` and `joinedAt`.
  - Decline: recipient can decline from the email or from an in-app notification. Sets `inviteStatus: DECLINED`.
  - If the invitee does not have a Family plan themselves: they join as a member under the inviting owner's Family subscription. They do not need their own Family plan — their access to the shared book is granted through membership. They retain their own private contacts and their own plan (Free or Pro) for private features.
  - The owner can revoke an invite (pending) or remove a member (accepted) at any time from the group management page.
  - Removing a member revokes their access to the shared address book immediately. Their private contacts are unaffected.
- Acceptance Criteria:
  - Family group creates correctly with owner as first member.
  - Invite emails send and accept links work.
  - Accepted members can see the shared address book in their workspace.
  - Declined and revoked invites are handled cleanly.
  - Member removal is immediate and does not affect private contacts.
- Risks / Open Questions:
  - If an invitee already has their own Family plan (as an owner of a different group), can they join a second family group? v1 decision: one family group per user. Document this limit.
  - Invite link security: use a signed token with expiry (48 hours) rather than a simple ID parameter.

---

## P13-03 — Shared address book contact operations
- Status: `Done`
- **Conflict handling:** last-write-wins with per-edit ActivityEvent logging (no SyncConflict for v1 family edits).
- Priority: `P0`
- Dependencies: `P13-01`, `P10-01`, `P10-02`
- Implementation Notes:
  - Any group member with `canEdit: true` can create, update, and archive contacts in the shared address book.
  - Members with `canEdit: false` (view-only) can only read shared contacts and export them.
  - Contact creation in the shared book: same form as private contact creation, but with the target address book selector showing "Family (shared)" as an option. Creates a `Contact` record and a `GroupContact` linking record.
  - Contact update: same edit flow. Emit an `ActivityEvent` with the editing member's `userId` as actor so the shared activity log shows attribution.
  - Contact archive in the shared book: soft-archive. Other members see it as archived, not deleted. Only the group admin or the archiving member can restore it.
  - Members cannot move a shared contact to their private library, and cannot move a private contact to the shared book without intent (explicit "Add to family book" action).
  - "Add to family book": a member can add one of their existing private contacts to the shared book. This creates a copy in the shared book (not a move). The original private contact is unchanged.
- Acceptance Criteria:
  - Shared address book supports create, update, archive, and restore for members with edit rights.
  - View-only members cannot mutate shared contacts.
  - Activity attribution correctly identifies which member made each change.
  - "Add to family book" copies the contact rather than moving it.
- Risks / Open Questions:
  - Concurrent edits from two members simultaneously need conflict handling. Reuse the existing `SyncConflict` model or add a lightweight last-write-wins with event logging. Decide before building.

---

## P13-04 — Change propagation across family members
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P13-02`, `P13-03`, `P10-01`
- Implementation Notes:
  - When a shared contact is created, updated, or archived, all family members should see the change in their workspace within seconds without refreshing.
  - Implementation approach: use server-sent events (SSE) or polling (every 30 seconds as fallback) to push workspace refresh signals to connected members when the shared address book's collection CTag changes. Do not push full contact data over the push channel — push only a "shared book updated" signal, then let the client re-fetch the affected contacts.
  - Alternatively, if a real-time push channel is not yet in place, acceptable v1 behaviour is: changes are visible the next time the member loads or refreshes their workspace, with a "shared book updated — refresh to see changes" banner. Document which approach is shipping in v1 and mark real-time push as a follow-up if deferred.
  - Emit `ActivityEvent` rows on all members' accounts when a shared contact changes: `CONTACT_UPDATED` with `actor: FAMILY_MEMBER` and `actorDetail: "[Member name] via Family Book"`.
- Acceptance Criteria:
  - A change made by one member is visible to others within 30 seconds (real-time) or on next page load (polling fallback).
  - Activity log for every member reflects shared book changes with correct attribution.
  - The propagation mechanism is documented clearly so it can be upgraded to real-time in a follow-up.
- Risks / Open Questions:
  - Do not build a full WebSocket infrastructure just for this feature in v1. SSE or polling is acceptable and keeps the scope manageable.

---

## P13-05 — Shared address book in the contacts workspace
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P13-04`
- Implementation Notes:
  - The contacts workspace People tab shows both private and shared contacts by default, visually distinguished by a small "Family" badge on shared contact rows.
  - Add a filter/view toggle to show only private contacts, only shared (Family), or both. This integrates with the existing workspace filter controls.
  - Contact detail page for a shared contact shows a "Family address book" source badge and "Last updated by [Member Name]" attribution.
  - Search covers both private and shared contacts by default. Shared contacts are discoverable by name, email, and phone.
  - The "Create contact" action shows a target selector: "Private" (default) or "Family (shared)" when the user is a family group member.
- Acceptance Criteria:
  - Shared contacts are visible in the workspace alongside private contacts with a clear visual distinction.
  - Filter controls work correctly to scope to private or shared contacts.
  - Contact detail correctly attributes shared contacts to the family book and shows the last editor.
  - Create flow allows the member to choose private or shared target.
- Risks / Open Questions:
  - Contact list sort and pagination must handle the mixed private/shared result set correctly — ensure indexes support this query pattern efficiently.

---

## P13-06 — Family group management page
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P13-04`
- Implementation Notes:
  - Add a `/settings/family` route (or modal) for the group owner and admins to manage the family group.
  - Show: group name, member list (name, email, role, joined date, edit permission toggle, remove button), pending invites (email, sent date, resend/cancel), and invite new member form.
  - Owner transfer: owner can designate another accepted member as the new owner. This transfers the Family plan subscription anchor — document the billing implications before building.
  - Edit permission toggle: admin can set any member to view-only. Changes take effect immediately.
  - Leave group: members can leave the group from their settings page. Leaving removes access to the shared book but does not delete the member's private contacts.
  - Delete group: only the owner can delete the group. Requires confirmation. Deletes all shared contacts (with a warning that this is permanent). Members revert to their own plan tier for private features.
- Acceptance Criteria:
  - Group owner can invite, remove, and manage permissions for all members.
  - Members can leave voluntarily.
  - Owner transfer works cleanly.
  - Group deletion properly cleans up all shared contacts and member access.
- Risks / Open Questions:
  - Owner transfer billing implications need to be confirmed with the billing integration before building — the subscription is currently anchored to a single `userId`.

---

## P13-07 — Design brief: family plan surfaces
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P13-05`, `P13-06`
- Implementation Notes:
  - Produce a design brief covering:
    - **Family group onboarding**: empty state for new Family plan users, "Create family group" prompt, group name input.
    - **Invite flow**: email input, pending invite list, accept/decline screens for invitees.
    - **Workspace with shared contacts**: Family badge on contact rows, filter toggle (Private / Family / All), create contact target selector.
    - **Contact detail for shared contact**: Family book source badge, last-edited-by attribution, "Add to family book" action on private contacts.
    - **Family group management page**: member list, role badges, edit-permission toggle, remove member confirmation, leave group, delete group warning.
    - **Change propagation banner**: "Family book updated" refresh indicator.
  - Brief should distinguish clearly between owner view and member view throughout.
- Acceptance Criteria:
  - Designer has complete coverage of all family plan surfaces.
  - Owner and member perspectives are clearly differentiated.
  - All destructive action states (remove member, leave group, delete group) are designed with appropriate confirmation patterns.
- Risks / Open Questions:
  - "Family" branding should feel warm and personal, not corporate. Tone guidance should be included in the brief.

---

## P13-08 — Family shared address book CardDAV server exposure (optional)
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P13-07`, `P9-04`
- Implementation Notes:
  - Extend the CardDAV server from Phase 9 to expose the family shared address book as a separate collection for each family member.
  - URL structure: `/dav/addressbooks/{userId}/family/` alongside the existing `/dav/addressbooks/{userId}/default/`.
  - Each member's family collection exposes the same shared contacts. Writes to the family collection from a device apply as family book mutations (with the member's identity as actor) and propagate to all other members.
  - This makes the family shared book natively accessible from iPhone, macOS Contacts, and DAVx⁵ without opening the Kontax app — the same native sync experience from Phase 9, but for the shared book.
  - Only implement if Phase 9 CardDAV server is stable and tested. Do not let this block Phase 13 core delivery.
- Acceptance Criteria:
  - Family shared address book appears as a separate collection in each member's CardDAV account.
  - Changes written via CardDAV are attributed correctly to the member and propagated to other members.
  - The default private address book and family collection are clearly named in the client.
- Risks / Open Questions:
  - Some CardDAV clients may merge multiple collections into a single flat contacts list. This is expected client behavior — document it rather than trying to work around it.
