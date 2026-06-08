# P13-06 Family Group Management Page

## Purpose
This ticket builds the `/settings/family` management page where the group owner and admins can invite members, manage roles and edit permissions, cancel or resend pending invites, remove members, transfer group ownership, and delete the group. Members use this page to view the group they belong to and leave it voluntarily. Without this management surface, group administration is inaccessible after the initial creation flow in P13-02.

## Background
Phase 13-02 created the group creation and invite flows. The group management page referenced in P13-02 as `/settings/family` was linked from the settings page as a placeholder. This ticket builds that page.

Phase 11 added a "coming soon" placeholder to the settings page for Family plan users. Phase 13-02 replaced it with a "Create Family Group" button. This ticket adds the full management page that the settings page links to after a group is created.

Key administrative actions and their permission requirements:
- **Invite member:** OWNER or ADMIN
- **Cancel pending invite:** OWNER or ADMIN
- **Resend invite:** OWNER or ADMIN
- **Remove accepted member:** OWNER can remove anyone; ADMIN can remove MEMBERs only (not other ADMINs or the OWNER)
- **Promote MEMBER to ADMIN:** OWNER only
- **Demote ADMIN to MEMBER:** OWNER only
- **Transfer ownership:** OWNER only
- **Toggle canEdit:** OWNER or ADMIN
- **Leave group:** MEMBER or ADMIN (not OWNER — owner must transfer first)
- **Delete group:** OWNER only

## Scope

**In scope:**
- `/settings/family` Next.js page (App Router: `src/app/settings/family/page.tsx`)
- Owner view: full administrative controls
- Admin view: invite/remove members, toggle canEdit; no role promotion/demotion, no ownership transfer, no group deletion
- Member view: read-only view of group details with "Leave group" option
- All server actions or API routes needed by this page
- Promote/demote admin role
- Owner transfer flow with billing implication documentation
- Leave group flow
- Delete group flow with typed confirmation and cascade logic
- Notification to members when the group is deleted

**Out of scope:**
- Group creation (P13-02)
- Invite email content and token (P13-02)
- Shared contact operations (P13-03)
- The workspace contact list (P13-05)
- Visual design specification (P13-07)
- Billing integration changes for owner transfer (documented here, implemented by the billing team in a follow-up ticket)

## Design / Implementation Spec

### Page Structure

`/settings/family` is accessible to any user who is an ACCEPTED member of a FAMILY group. Non-members who navigate to this URL see a redirect to `/settings` (or a prompt to create a family group if they have a Family plan subscription).

The page is organized into four sections:

1. **Group header:** Group name (editable by OWNER/ADMIN), member count, plan status
2. **Members list:** All ACCEPTED and PENDING members
3. **Invite new member form:** (OWNER/ADMIN only)
4. **Danger zone:** Leave group (MEMBER/ADMIN), Delete group (OWNER), Transfer ownership (OWNER)

### Page Data Fetching

```typescript
// src/app/settings/family/page.tsx

export default async function FamilySettingsPage() {
  const user = await getAuthenticatedUser()

  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id, inviteStatus: 'ACCEPTED', group: { type: 'FAMILY' } },
    include: {
      group: {
        include: {
          members: {
            where: { inviteStatus: { in: ['ACCEPTED', 'PENDING'] } },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }]
          },
          defaultAddressBook: { select: { id: true, name: true } }
        }
      }
    }
  })

  if (!membership) redirect('/settings')

  return <FamilyManagementClient membership={membership} currentUser={user} />
}
```

The page is a server component that passes the full group data to a client component. The client component handles all interactive state (invite form, confirmation dialogs).

### Group Name Editing

**UI:** The group name is displayed with an inline edit button (pencil icon). Clicking it activates an input field. Saving triggers `PATCH /api/family/groups/{groupId}`.

**API Route:** `PATCH /api/family/groups/{groupId}`

**Request body:** `{ name: string }` (min 1 char, max 50 chars)

**Authorization:** OWNER or ADMIN

Only the name field is editable via this endpoint. Other Group fields (type, ownerId, maxMembers) are not user-editable.

### Members List

Display each ACCEPTED member as a row:

| Avatar | Name (email) | Role badge | Joined date | Edit permission toggle | Actions |
|---|---|---|---|---|---|
| [avatar] | Sarah Kim (sarah@...) | Member | Jan 2025 | [toggle] | [Remove] |
| [avatar] | Mark Kim (mark@...) | Admin | Dec 2024 | [toggle] | [Remove] / [Demote] |
| [avatar] | You | Owner | Dec 2024 | — | — |

**Role badge colors:** OWNER = gold/amber, ADMIN = blue, MEMBER = gray

**Pending invites** are shown in a separate subsection below the accepted members list:

| Email | Sent date | Status | Actions |
|---|---|---|---|
| friend@email.com | 3 days ago | Pending | [Resend] [Cancel] |
| other@email.com | 5 days ago | Declined | — |

DECLINED invites are shown in a muted state for historical context but with no action buttons.

### canEdit Toggle

The canEdit toggle is a switch component visible on each ACCEPTED member row (except the OWNER's own row). Toggling it triggers `PATCH /api/family/groups/{groupId}/members/{groupMemberId}`:

**Request body:** `{ canEdit: boolean }`

**Authorization:** OWNER or ADMIN (admins can toggle for MEMBERs; OWNER can toggle for anyone including ADMINs)

The toggle change takes effect immediately — the next request the affected member makes to a shared contact mutation endpoint will reflect the new canEdit value.

Show a brief confirmation toast: "Sarah is now view-only" or "Sarah can now edit the family book."

### Promote/Demote Admin

Visible on member rows for OWNER only:

- For a MEMBER row: "Promote to Admin" button/link
- For an ADMIN row: "Demote to Member" button/link

**API Route:** `PATCH /api/family/groups/{groupId}/members/{groupMemberId}/role`

**Request body:** `{ role: 'ADMIN' | 'MEMBER' }`

**Authorization:** OWNER only

Role changes take effect immediately. No email notification is sent in v1 (the affected member sees the change on their next visit to the management page).

### Remove Member

**UI:** "Remove" button on each accepted member row (OWNER: all rows except their own; ADMIN: MEMBER rows only).

**Confirmation dialog:**
```
Remove [Name] from [Group Name]?

[Name] will lose access to the family address book immediately.
Their private contacts will not be affected.

[Cancel]  [Remove Member]
```

**API Route:** `DELETE /api/family/groups/{groupId}/members/{groupMemberId}` (from P13-02)

After removal, the row transitions to a "Removed" visual state before disappearing on next page refresh. An optional toast: "Sarah was removed from Smith Family."

### Transfer Ownership

OWNER only. Accessible from the danger zone.

**UI flow:**
1. Dropdown to select the new owner from ACCEPTED members
2. Warning message (see below)
3. Typed confirmation: "type the new owner's name to confirm"
4. [Transfer Ownership] button

**Warning message:**
```
Transfer ownership of [Group Name] to [Member Name]?

This transfers the Family plan subscription to [Member Name]'s account.
You will become an Admin member. Your Family plan subscription will be
downgraded to a Pro plan.

Important: After transfer, [Member Name] is responsible for the group's
billing. If they cancel their Family plan, all members will lose access to
the shared address book.

Type "[Member Name]" to confirm.
```

**Billing implications (documented for implementation):**

The Family plan subscription (`Subscription.userId = owner.id`) must be transferred to the new owner's account. The exact mechanism depends on the billing provider:
- If using Stripe: the subscription must be transferred to a new Stripe customer record for the new owner. This requires Stripe's subscription transfer API or cancelling the current subscription and creating a new one for the new customer. The billing integration team must implement this.
- If using a simpler billing model (invoice-based): update `Subscription.userId` to the new owner's id.

This ticket documents the requirement but does not implement the billing transfer — that is a billing integration task. Block the Transfer Ownership UI until the billing transfer is confirmed to be implemented. In the meantime, show: "Ownership transfer is coming soon. Contact support to transfer ownership."

**API Route (when billing is ready):** `POST /api/family/groups/{groupId}/transfer-ownership`

**Request body:** `{ newOwnerId: string, confirmation: string }` (confirmation must equal the new owner's display name)

**Server-side flow:**
1. Verify requesting user is OWNER
2. Verify newOwnerId is an ACCEPTED MEMBER or ADMIN of this group
3. Verify confirmation string matches the new owner's display name (case-insensitive)
4. Trigger billing transfer (billing integration)
5. Update GroupMember for new owner: role → OWNER
6. Update GroupMember for old owner: role → ADMIN
7. Update Group.ownerId → newOwnerId

### Leave Group

Available to MEMBER and ADMIN roles (not OWNER — owner must transfer first).

**UI:** "Leave [Group Name]" button in the danger zone.

**Confirmation dialog:**
```
Leave [Group Name]?

You will lose access to the family address book immediately.
Your private contacts will not be affected.

[Cancel]  [Leave Group]
```

**API Route:** `POST /api/family/groups/{groupId}/leave`

**Server-side flow:**
1. Verify requesting user is ACCEPTED MEMBER or ADMIN (not OWNER)
2. Update GroupMember: `{ inviteStatus: 'REVOKED' }` (not deleted — keeps history)
3. Access to shared contacts is revoked immediately (next membership check returns null)
4. Redirect to `/settings` after confirmation

After leaving, the user's private contacts are untouched. They lose the "Family" view toggle in the workspace. The settings page no longer shows the family group section.

### Delete Group

OWNER only. In the danger zone.

**UI flow:**
1. "Delete [Group Name]" button (destructive red styling)
2. Warning modal with member impact
3. Typed confirmation: user must type the group name exactly

**Warning modal:**
```
Delete [Group Name]?

This will permanently delete the family address book and its [N] shared contacts.
All [M] members will lose access to the shared address book immediately.

Each member keeps their own private contacts — only the shared family contacts
will be deleted.

Your Family plan will continue (the group is deleted, not the subscription).

This cannot be undone.

Type "[Group Name]" to confirm deletion.
```

**API Route:** `DELETE /api/family/groups/{groupId}`

**Request body:** `{ confirmation: string }` (must equal the group name exactly — case-sensitive)

**Server-side flow (single transaction where possible):**

1. Verify requesting user is OWNER
2. Verify confirmation matches Group.name exactly
3. **Soft-archive all shared contacts:** Set `Contact.archivedAt = now()` for all Contact records linked via GroupContact to any GroupAddressBook of this group. These are contacts with `userId = groupOwner.id` — they should be archived, not hard-deleted, so they can be recovered by support if needed.
4. **Delete GroupContact records:** `DELETE FROM GroupContact WHERE groupAddressBookId IN (SELECT id FROM GroupAddressBook WHERE groupId = ?)`
5. **Revoke all GroupMember records:** `UPDATE GroupMember SET inviteStatus = 'REVOKED' WHERE groupId = ?`
6. **Archive GroupAddressBook records:** Set `archivedAt = now()` on all GroupAddressBook records for this group
7. **Update Group:** Set a `deletedAt` field (add this field to Group in the migration — nullable DateTime) to mark the group as deleted without hard-deleting the record
8. **Notify members:** Emit an ActivityEvent for each ACCEPTED member's userId with a new event type or use a SYSTEM actor:
   ```
   { userId: memberId, eventType: 'CONTACT_ARCHIVED', actor: 'SYSTEM', actorDetail: 'Family group deleted by owner', payload: { groupName: group.name } }
   ```
   (This reuses CONTACT_ARCHIVED at the group level — a more precise GROUP_DELETED event type could be added in a future schema update, but for v1 a SYSTEM actor event is sufficient.)

After deletion, all members who load the workspace see no family contacts and no view toggle. Their private contacts are unaffected.

**Group.deletedAt field:** Add to the Group model in the P13-01 migration (or as an addendum migration in this ticket):
```prisma
deletedAt DateTime?
@@index([deletedAt])
```

All queries on Group must add `WHERE deletedAt IS NULL` to exclude deleted groups.

### Member Notification for Group Deletion

Since Phase 13 does not implement a real-time notification system, the "notification" is implemented as an ActivityEvent in each member's feed. On the member's next visit to the workspace, their activity feed will show the event. The workspace must also check for deleted groups: if the user's GroupMember record has inviteStatus: REVOKED and the Group has a deletedAt set, show a one-time info banner:

```
Your family group [Group Name] was deleted by the owner. 
The shared family contacts are no longer available.
Your private contacts are not affected.
```

This banner is dismissed after the user acknowledges it (store dismissal in localStorage keyed by groupId).

### Page Load Performance

The `/settings/family` page must load the full member list with a single Prisma query (using includes). For a 6-member family, this is a trivial query. No pagination is needed on the members list in v1 (Teams with 25+ members is Phase 14).

## Acceptance Criteria

- `/settings/family` is accessible to ACCEPTED group members; non-members are redirected to `/settings`
- Group owner sees full administrative controls: invite, remove, promote/demote, toggle canEdit, transfer ownership, delete group
- Group admin sees: invite, remove MEMBERs, toggle canEdit for MEMBERs; cannot see owner transfer or group deletion
- Group member sees: group name, member list (read-only), leave group option
- canEdit toggle change takes effect immediately (next shared contact mutation attempt by the affected member reflects the new value)
- Promote/demote role changes update GroupMember.role immediately
- Remove member: GroupMember.inviteStatus set to REVOKED; removed member loses shared contact access on next request
- Transfer ownership: blocked with "coming soon" UI until billing transfer is implemented; API route is not callable without the billing step completing
- Leave group: MEMBER or ADMIN can leave; GroupMember.inviteStatus set to REVOKED; private contacts unaffected; user redirected to /settings
- OWNER cannot leave without first transferring ownership; show clear message "Transfer ownership before leaving"
- Delete group: requires typed confirmation matching group name; soft-archives all shared contacts; revokes all GroupMember records; sets Group.deletedAt; members see "group deleted" banner on next workspace visit
- TypeScript compilation passes; no server-side errors in happy path flows for all three role perspectives

## Risks and Open Questions

- **Owner transfer billing dependency:** The transfer ownership flow is blocked on billing integration work. The UI must gracefully handle the "coming soon" state without showing a broken form. Add a feature flag `FAMILY_OWNER_TRANSFER_ENABLED` to control whether the form is shown or replaced with a "contact support" link.
- **Group deletion and the shared contacts:** Soft-archiving the shared contacts (setting archivedAt) means the underlying Contact records still exist in the database with userId = group owner's id. These contacts are now "orphaned" — they belong to the ex-owner's private account (nominally) but were never their private contacts. The ex-owner should not see these contacts in their workspace. The soft-archive state ensures they are hidden by default. Consider a cleanup job that hard-deletes these orphaned archived contacts after 90 days.
- **Cascade delete timing:** The server-side group deletion flow involves multiple UPDATE and DELETE operations. Wrapping them all in a single Prisma transaction ensures atomicity, but for a group with many shared contacts, a single transaction may hold locks for a long time. For v1 with a maximum of 6 members and a typical shared book of hundreds of contacts, this is acceptable. For larger scales, batch the soft-archiving step outside the transaction.
- **Concurrent deletion:** If two requests attempt to delete the same group simultaneously (e.g., admin panel and owner UI), the second request should receive a 404 (group already deleted). The `WHERE deletedAt IS NULL` check on the Group query prevents double-processing.
- **The typed confirmation for delete is case-sensitive** — the group name may contain special characters, spaces, or unicode. Ensure the comparison trims whitespace and handles unicode normalization (NFC) to avoid surprising failures where the name "Smith Family" with a smart quote does not match "Smith Family" typed with a straight quote.

## Outcome
Group owners and admins have a complete management interface for the family group, with clear permission boundaries between roles and safe, confirmed flows for all destructive actions.
