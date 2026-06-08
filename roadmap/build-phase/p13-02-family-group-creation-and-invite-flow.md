# P13-02 Family Group Creation and Invite Flow

## Purpose
This ticket implements the complete lifecycle of a family group: creation by a Family plan subscriber, inviting up to five additional members by email, handling accept and decline flows (including for users who do not yet have a Kontax account), and managing membership changes — cancelling pending invites, removing accepted members, and revoking access. Without this flow, the Family plan subscription has no way to bootstrap a group, and the shared address book built in P13-03 has no members to share with.

## Background
Phase 11 updated the SubscriptionPlan enum to include FAMILY and added entitlement flags to the Subscription model (`familyGroupEnabled`, `memberSlotsLimit`). Phase 11 also stubbed a "coming soon" placeholder in the settings page for Family plan users. Phase 13-01 produced the Group, GroupMember, and GroupAddressBook schema with all required fields including inviteStatus, inviteEmail, invitedAt, invitedByUserId, and canEdit.

The key product constraints from Phase 13 design decisions:
- The Family plan subscription is owned by one user (the group owner). Other members do not need their own Family plan — their access to the shared book is granted through GroupMember membership.
- One family group per user. A user cannot be an ACCEPTED member of two FAMILY groups simultaneously.
- Invite tokens must be signed and carry a 48-hour expiry. A simple UUID link in the email is not sufficient because it would allow anyone with the link to join the group without verification.
- An invitee who does not have a Kontax account receives the invite email with a registration prompt. After registration, their new userId is linked to the pending GroupMember record.

The Phase 9 CardDAV server used Basic Auth app passwords. This invite flow does not use app passwords — it uses email-based invitation with a signed JWT or HMAC token.

## Scope

**In scope:**
- Family group creation flow (settings page action → Group + GroupAddressBook + first GroupMember)
- Invite by email: GroupMember record creation, token generation, invite email sending
- Accept flow: token verification, userId linking, inviteStatus → ACCEPTED
- Decline flow: from email link or in-app notification, inviteStatus → DECLINED
- Invite cancellation by owner (pending invite only), inviteStatus → REVOKED
- Member removal by owner or admin (accepted member), inviteStatus → REVOKED
- Registration prompt for invitees without a Kontax account (after registration, link userId to pending GroupMember)
- One-family-group-per-user enforcement
- Blocking invitee who is already an owner of a different FAMILY group
- Server-side API routes for all flows
- Entitlement gate: only Family plan subscribers can create a group

**Out of scope:**
- Shared address book contact operations (P13-03)
- Change propagation (P13-04)
- Group management page UI beyond the initial settings stub (P13-06)
- Owner transfer (P13-06)
- Group deletion (P13-06)
- Email template visual design (that is a design deliverable, not an engineering one; the template content is specified here)

## Design / Implementation Spec

### Entitlement Gate

Before creating a family group, verify that the requesting user has `Subscription.familyGroupEnabled = true`. If not, return a 403 with error code `FAMILY_PLAN_REQUIRED`. The settings page should not show the "Create Family Group" button at all for non-Family plan users, but the API must enforce it independently.

Also verify that the user does not already own or belong to an active FAMILY group:

```typescript
const existingGroup = await prisma.group.findFirst({
  where: { ownerId: userId, type: 'FAMILY' }
})
const existingMembership = await prisma.groupMember.findFirst({
  where: {
    userId,
    inviteStatus: 'ACCEPTED',
    group: { type: 'FAMILY' }
  }
})
if (existingGroup || existingMembership) {
  throw new AppError('ALREADY_IN_FAMILY_GROUP')
}
```

### Family Group Creation

**API Route:** `POST /api/family/groups`

**Request body:**
```typescript
{
  name: string  // e.g. "Smith Family" — max 50 chars, min 1 char
}
```

**Server-side flow (single Prisma transaction):**

1. Validate entitlement (Family plan, no existing group/membership)
2. Create `Group`: `{ ownerId: userId, type: 'FAMILY', name, maxMembers: 6 }`
3. Create `GroupAddressBook`: `{ groupId: newGroup.id, name: 'Family', isDefault: true }`
4. Update `Group.defaultAddressBookId` to point to the new GroupAddressBook
5. Create `GroupMember`: `{ groupId: newGroup.id, userId, role: 'OWNER', inviteStatus: 'ACCEPTED', canEdit: true, joinedAt: now() }`
6. Emit ActivityEvent: `{ userId, eventType: 'CONTACT_CREATED' ... }` — actually, this is a group-level event, not a contact event. Phase 13 does not add new EventType values for group events in v1. The group creation is visible in the settings page, not the activity feed.

**Response:** 201 with the created Group and GroupAddressBook.

The creation must be wrapped in a single transaction so that if the GroupAddressBook or first GroupMember creation fails, the Group is also rolled back and the user is not left with a broken partial state.

### Invite Token Design

Invite tokens use HMAC-SHA256 signed with a server-side secret (`INVITE_TOKEN_SECRET` environment variable). The token payload is:

```typescript
interface InviteTokenPayload {
  groupId: string
  groupMemberId: string
  inviteEmail: string
  expiresAt: number   // Unix timestamp
}
```

Token generation:
```typescript
function generateInviteToken(payload: InviteTokenPayload): string {
  const data = JSON.stringify(payload)
  const dataB64 = Buffer.from(data).toString('base64url')
  const sig = crypto
    .createHmac('sha256', process.env.INVITE_TOKEN_SECRET!)
    .update(dataB64)
    .digest('base64url')
  return `${dataB64}.${sig}`
}
```

Token verification:
```typescript
function verifyInviteToken(token: string): InviteTokenPayload {
  const [dataB64, sig] = token.split('.')
  const expectedSig = crypto
    .createHmac('sha256', process.env.INVITE_TOKEN_SECRET!)
    .update(dataB64)
    .digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    throw new Error('INVALID_TOKEN')
  }
  const payload: InviteTokenPayload = JSON.parse(Buffer.from(dataB64, 'base64url').toString())
  if (payload.expiresAt < Date.now() / 1000) {
    throw new Error('TOKEN_EXPIRED')
  }
  return payload
}
```

The token expiry is 48 hours from invite creation time. JWT library is an acceptable alternative to this manual HMAC approach — if the project already has a JWT library installed, use that. The core requirement is: signed, tamper-evident, time-limited.

Do not store the token in the database. The GroupMemberId in the payload is the lookup key. On acceptance, query the GroupMember by ID and verify it matches the token's groupId and inviteEmail. This means the token cannot be replayed even if stolen, because accepting it transitions inviteStatus to ACCEPTED and the same token cannot be used again (the ACCEPTED GroupMember no longer matches the PENDING state expected during validation).

### Sending Invite Emails

**API Route:** `POST /api/family/groups/{groupId}/invites`

**Request body:**
```typescript
{
  email: string  // The email address to invite
}
```

**Server-side validation:**
1. Requesting user must be OWNER or ADMIN GroupMember of this group
2. Group must not be at maxMembers (count ACCEPTED members; exclude PENDING, DECLINED, REVOKED)
3. The email must not already have an ACCEPTED or PENDING GroupMember for this group
4. The invitee must not already be an ACCEPTED member of any other FAMILY group (checked by looking up User.email → userId → GroupMember)

**Server-side flow:**
1. Look up whether a Kontax user with this email already exists: `prisma.user.findUnique({ where: { email } })`
2. Create GroupMember: `{ groupId, userId: existingUser?.id ?? null, role: 'MEMBER', inviteStatus: 'PENDING', canEdit: true, invitedAt: now(), invitedByUserId: requestingUserId, inviteEmail: email }`
3. Generate invite token (48hr expiry)
4. Build accept URL: `https://app.kontax.app/invite/accept?token={token}`
5. Build decline URL: `https://app.kontax.app/invite/decline?token={token}`
6. Send invite email (see email content spec below)

**Email content:**

Subject: `{InviterName} invited you to join {GroupName} on Kontax`

Body (plain text base, HTML version also required):
```
{InviterName} has invited you to join the "{GroupName}" shared contacts book on Kontax.

As a member, you'll be able to:
- View and update shared contacts with your family
- Keep your own private contacts separate

[Accept Invitation]  ← links to accept URL
[Decline]  ← links to decline URL

This invitation expires in 48 hours.
```

If the invitee does not have a Kontax account, append:
```
You don't have a Kontax account yet. Click "Accept Invitation" to create one and join {GroupName}.
```

The accept URL for non-registered users should include a `?register=true` query param so the accept page can show the registration form before confirming the invite.

### Accept Flow

**Route:** `GET /invite/accept?token={token}` (Next.js page route, not API route)

**Page behavior:**
1. Verify the token signature and expiry
2. Look up the GroupMember by groupMemberId from the token payload
3. If GroupMember.inviteStatus is not PENDING, show an appropriate error ("This invite has already been used", "This invite has been cancelled")
4. If the user is not logged in: redirect to login page with `?returnTo=/invite/accept?token={token}` (or show inline registration form if `?register=true` is present)
5. After authentication: verify the authenticated user's email matches the token's inviteEmail (case-insensitive). If not, show "This invite was sent to a different email address."
6. Show a confirmation screen: group name, inviter name, member count
7. On confirm: call `POST /api/family/invites/accept`

**API Route:** `POST /api/family/invites/accept`

**Request body:** `{ token: string }`

**Server-side flow (transaction):**
1. Verify token (signature + expiry)
2. Load GroupMember by groupMemberId
3. Verify inviteStatus === PENDING
4. Verify authenticated user's email matches inviteEmail (case-insensitive)
5. Enforce one-family-group-per-user constraint for the accepting user
6. Update GroupMember: `{ userId: authenticated user id, inviteStatus: 'ACCEPTED', joinedAt: now() }`
7. Return the group details so the client can redirect to the workspace

### Decline Flow

**Route:** `GET /invite/decline?token={token}` (page route)

Similar to accept but simpler: verify token, load GroupMember, show a confirmation ("Are you sure you want to decline this invitation?"), and on confirm call `POST /api/family/invites/decline`.

**API Route:** `POST /api/family/invites/decline`

Updates GroupMember.inviteStatus to DECLINED. The member record is kept (not deleted) for audit purposes — the group owner can see in the management page that this email address declined.

Decline can also be triggered from an in-app notification if the invitee is already a Kontax user and is logged in when they receive the invite.

### Cancelling a Pending Invite

**API Route:** `DELETE /api/family/groups/{groupId}/invites/{groupMemberId}`

Only the OWNER or ADMIN of the group can cancel a pending invite. Sets inviteStatus to REVOKED. The token generated for this invite is now invalid (even if not expired) because the GroupMember record's inviteStatus no longer matches PENDING when the token acceptance path checks it.

### Removing an Accepted Member

**API Route:** `DELETE /api/family/groups/{groupId}/members/{groupMemberId}`

Only the OWNER or ADMIN can remove a member. ADMIN cannot remove another ADMIN or the OWNER — only the OWNER can remove admins. Removing the OWNER is not permitted through this endpoint (use owner transfer in P13-06).

**Server-side flow:**
1. Verify requesting user is OWNER (can remove anyone) or ADMIN (can remove MEMBERs only)
2. Verify target is not the OWNER
3. Update GroupMember: `{ inviteStatus: 'REVOKED' }`
4. The removed member's access to shared contacts is revoked immediately — all queries that check GroupMember membership will exclude REVOKED members
5. Removed member's private contacts are untouched

**Access revocation mechanism:** Queries that return shared contacts (P13-05) filter on `GroupMember.inviteStatus === 'ACCEPTED'`. Setting inviteStatus to REVOKED is sufficient to revoke access — no session invalidation or cache purge is required, because the membership check is done on every request.

### Resend Invite

**API Route:** `POST /api/family/groups/{groupId}/invites/{groupMemberId}/resend`

Available for PENDING invites only. Generates a new token with a fresh 48-hour expiry and resends the email. The GroupMember record is unchanged — only a new token is generated and the email is re-sent. The old token remains technically valid until it expires, but the new token supersedes it in practice (both tokens point to the same GroupMember, and the first acceptance wins).

If stronger security is required, store a token version nonce on GroupMember and increment it on resend — the verification step checks the nonce. This is a v2 hardening; v1 accepts the window of double-token validity.

### Registration Flow for New Users

When an invitee without an account clicks the accept link:

1. They arrive at `/invite/accept?token={token}&register=true`
2. The page shows a registration form (name, password) pre-filled with their email (extracted from the token payload, shown as read-only)
3. On registration submit: create User account, then immediately execute the invite acceptance flow (steps 5–7 from the Accept Flow above), all in a single transaction
4. The user lands in the workspace as a new Kontax account that is already an ACCEPTED member of the family group

The email address on the new account must match the inviteEmail in the token. Do not allow the registering user to change the email on this registration form — it is fixed to the invited address.

### State Machine for InviteStatus

```
PENDING → ACCEPTED   (invitee accepts)
PENDING → DECLINED   (invitee declines)
PENDING → REVOKED    (owner/admin cancels invite)
ACCEPTED → REVOKED   (owner/admin removes member)
DECLINED → PENDING   (owner re-invites same email — creates a new GroupMember record, does not update the DECLINED one)
```

When a DECLINED invitee is re-invited, create a new GroupMember record with PENDING status rather than resetting the existing DECLINED record. This preserves the decline event for audit purposes.

### Settings Page Integration

Replace the "coming soon" placeholder from Phase 11 in `/settings` with:
- If user has Family plan and no group: show "Create Family Group" button with a short name input
- If user has Family plan and is OWNER: show group name, member count badge, and link to `/settings/family` (P13-06)
- If user has Family plan and is a MEMBER (not owner): show group name and "You're a member of {GroupName}" with a link to `/settings/family`

The `/settings/family` page is built in P13-06. The link here can point to the page before it is built, but show a loading state.

### Error Codes

All API errors return JSON with an `error` field:

| Code | Meaning |
|---|---|
| `FAMILY_PLAN_REQUIRED` | User does not have a Family plan subscription |
| `ALREADY_IN_FAMILY_GROUP` | User already owns or belongs to a FAMILY group |
| `GROUP_FULL` | The group is at maxMembers capacity |
| `INVITE_ALREADY_EXISTS` | An active PENDING or ACCEPTED invite already exists for this email |
| `INVITEE_IN_OTHER_GROUP` | The invitee is already an ACCEPTED member of another FAMILY group |
| `INVALID_TOKEN` | Invite token failed signature verification |
| `TOKEN_EXPIRED` | Invite token is past its 48-hour expiry |
| `INVITE_NOT_PENDING` | The invite has already been used, declined, or cancelled |
| `EMAIL_MISMATCH` | Accepting user's email does not match the invite email |
| `PERMISSION_DENIED` | Requesting user does not have permission for this action |

## Acceptance Criteria

- A Family plan subscriber can create a family group from the settings page; the group, address book, and owner GroupMember are created in a single transaction
- Inviting by email creates a PENDING GroupMember record and sends an invite email with a signed token link
- Invite token is verified server-side: invalid signature returns 400, expired token returns 400 with TOKEN_EXPIRED code
- Accepting an invite as an existing Kontax user: GroupMember transitions to ACCEPTED and the member can see the shared address book in their workspace
- Accepting an invite as a new user: registration + acceptance happens atomically; new account is immediately an ACCEPTED member
- Declining an invite: GroupMember transitions to DECLINED; group owner can see the declined status in the management page
- Owner can cancel a pending invite: GroupMember transitions to REVOKED; existing token for that invite becomes functionally invalid
- Owner or admin can remove an accepted member: GroupMember transitions to REVOKED; removed member's access to shared contacts is revoked on their next request
- Group membership count is enforced: inviting when at maxMembers returns GROUP_FULL error
- One-family-group-per-user is enforced at both creation and acceptance
- An invitee who is already an OWNER of another FAMILY group receives INVITEE_IN_OTHER_GROUP error
- All API routes return appropriate error codes for invalid states
- TypeScript compilation passes; no runtime errors in happy path flows

## Risks and Open Questions

- **Email deliverability:** The invite email contains an accept link with a token. If the email is delivered to spam, the invitee may miss it. Consider adding an in-app invite notification for invitees who already have a Kontax account and are logged in — show the invite in a banner or notification center rather than relying solely on email.
- **Token double-use window on resend:** The current design allows two valid tokens to exist simultaneously when a resend is issued before the first token expires. This is low-risk (both tokens go to the same email address) but should be documented as a known v1 limitation.
- **Billing implications of member access:** Family members who join under the owner's subscription get Pro-equivalent features while they are members. If the owner cancels their Family plan, all members must lose the elevated feature access. The entitlement gate must re-check not just GroupMember.inviteStatus but also the group owner's current subscription status on every feature-gated request. This coupling must be implemented before Phase 13 ships.
- **The INVITE_TOKEN_SECRET environment variable** must be set in all environments (development, staging, production) before this feature can be tested. Add it to the environment variable documentation and deployment checklist.
- **Invitee at capacity on member slots:** If the group owner invited 5 people and all 5 accepted, the group is at capacity (6 total including the owner). The management page (P13-06) must make it clear the group is full and the invite form should be disabled.

## Outcome
A Family plan subscriber can create a family group and invite up to five members by email, with secure signed invite tokens and a complete accept/decline/remove lifecycle.
