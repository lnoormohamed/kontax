# P12-03 Static Kontax-to-Kontax Share

## Purpose
This ticket implements the first of two account-to-account sharing modes: a one-time contact delivery from one Kontax user to another. The sender chooses a contact and specifies a recipient by email. The recipient receives a notification and can accept (gaining an independent copy of the contact in their account) or decline. After acceptance, the two copies are fully independent — no ongoing connection exists between them. This feature enables real-world scenarios like a Pro user sharing a business contact with a colleague, a family member sharing a doctor's contact information, or anyone who wants to give someone else a saved contact without needing to export a file and send it manually.

## Background
Phase 12-01 introduced `shareType: STATIC_COPY` on `ContactShare`. Phase 10 introduced the `ActivityEvent` model with `CONTACT_SHARED` and `CONTACT_SHARE_RECEIVED` event types. Phase 10 also added `sourceType: SHARED_STATIC` to the `Contact` model, meaning the schema is already prepared to record that a contact originated from a static share.

Phase 11 introduced `staticShareEnabled` on the `Subscription` model as the plan gate for this feature. Free plan users cannot send static shares. Pro, Family, and Teams users can.

Phase 12-03 is a prerequisite for Phase 12-04 (live share). The acceptance flow for live shares follows the same notification and accept/decline mechanics defined here, with additional plan checks layered on top. Build this correctly and P12-04 extends it rather than reimplementing it.

## Scope

**In scope:**
- Server action to create a `STATIC_COPY` share
- Recipient lookup by email (existing Kontax user vs no account)
- Contact snapshot capture at share creation time
- In-app notification creation for the recipient (in-app badge count — rendering in P12-06)
- Transactional email to the recipient when a share is sent
- Accept server action: create contact copy in recipient's account with `sourceType: SHARED_STATIC`
- Decline server action: set `status: DECLINED`, notify sender
- Contact copy independence after acceptance (no propagation hooks)
- `CONTACT_SHARED` ActivityEvent on sender side at creation
- `CONTACT_SHARE_RECEIVED` ActivityEvent on recipient side at acceptance
- Invite-to-register flow for non-account recipients
- Share creation UI: "Share with a Kontax user" option in the share sheet with email input
- Basic pending share indicator on the sender's contact detail (full management in P12-05)

**Out of scope:**
- Live sync propagation (P12-04)
- Full incoming share notification rendering and management view (P12-06)
- Share management UI beyond the creation confirmation (P12-05)
- Bulk sharing (sharing the same contact to multiple recipients simultaneously) — future enhancement
- Sharing a group of contacts — only single-contact sharing in Phase 12

---

## Design / Implementation Spec

### Plan Gate

Before creating a static share, verify:

```typescript
const entitlement = await getUserEntitlements(session.user.id);
if (!entitlement.staticShareEnabled) {
  throw new Error("PLAN_GATE_STATIC_SHARE");
}
```

The client should surface this as an upgrade prompt. Do not silently fail or create a degraded share — the user must be on Pro or above to use this feature.

### Recipient Resolution

The share creation flow takes a recipient email address as input. Before creating the `ContactShare` record, resolve whether the email belongs to an existing Kontax user:

```typescript
const recipientUser = await prisma.user.findUnique({
  where: { email: recipientEmail.toLowerCase().trim() },
  select: { id: true, name: true, email: true },
});
```

**Case A: Existing Kontax user**
- Set `recipientUserId: recipientUser.id` and `recipientEmail: null` on the `ContactShare` record.
- Send an in-app notification immediately.
- Send a transactional email to the recipient.

**Case B: No Kontax account**
- Set `recipientUserId: null` and `recipientEmail: recipientEmail.toLowerCase().trim()` on the `ContactShare` record.
- Send an invite email to `recipientEmail` explaining that someone has shared a contact with them and they need to create a Kontax account to receive it.
- When they register, the registration flow must query for pending `ContactShare` records where `recipientEmail` equals the new account's confirmed email address and link them: `prisma.contactShare.updateMany({ where: { recipientEmail: newUser.email, status: "ACTIVE" }, data: { recipientUserId: newUser.id } })`. This linkage must happen atomically in the registration transaction. After linkage, send the in-app notification as if they were an existing user.

**Self-share prevention:** check that `recipientEmail` does not match the sending user's own email. Return a user-visible error if it does.

**Blocked user check:** if the recipient has blocked the sender (or vice versa) — this relationship does not exist in the current schema. Deferred to a future phase. For now, any valid email is an acceptable recipient.

### Contact Snapshot

At share creation time, capture the contact snapshot:

```typescript
const contact = await prisma.contact.findUniqueOrThrow({
  where: { id: contactId, userId: session.user.id },
  include: { identifiers: true, addresses: true },
});

const snapshot = serializeContactForSnapshot(contact);
```

`serializeContactForSnapshot` produces a plain JSON object representing the contact's portable fields. It should be the same serialization used by `contactsToVCard` as input, so the delivery step can call `contactsToVCard(deserializeSnapshot(share.contactSnapshot))` when serving the contact to the recipient.

The snapshot must not include internal database IDs (`id`, `userId`, `syncUid`, etc.) — these are system fields that must not leak across account boundaries. The snapshot is purely field data: names, phone numbers, email addresses, addresses, notes, job title, organization, birthday, `avatarUrl` string.

### Server Action: createStaticShare

```typescript
export async function createStaticShare(
  contactId: string,
  recipientEmail: string
): Promise<{ shareId: string; recipientExists: boolean }>
```

Full sequence:

1. Authenticate and verify ownership of `contactId`.
2. Verify `staticShareEnabled` entitlement.
3. Check self-share.
4. Resolve recipient.
5. Capture contact snapshot.
6. Create `ContactShare`:
   ```typescript
   const share = await prisma.contactShare.create({
     data: {
       ownerUserId: session.user.id,
       contactId,
       shareType: "STATIC_COPY",
       status: "ACTIVE",
       token: null,
       recipientUserId: recipientUser?.id ?? null,
       recipientEmail: recipientUser ? null : normalizedEmail,
       contactSnapshot: snapshot,
     },
   });
   ```
7. If existing user: create in-app notification (see Notification Model below).
8. Send transactional email (see Email Notifications below).
9. Emit `CONTACT_SHARED` ActivityEvent:
   ```typescript
   await emitActivityEvent({
     userId: session.user.id,
     contactId,
     eventType: "CONTACT_SHARED",
     actor: "SHARE",
     actorDetail: "static_copy",
     payload: {
       shareId: share.id,
       recipientEmail: normalizedEmail,
       recipientExists: !!recipientUser,
     },
   });
   ```
10. Return `{ shareId: share.id, recipientExists: !!recipientUser }`.

The return value lets the UI show the appropriate confirmation message: "Share sent to {name}" if the recipient has an account, or "Invite sent to {email} — they'll need to create a Kontax account to receive it" if they don't.

### Notification Model

In-app notifications for incoming shares require a notification record. This ticket introduces a lightweight `ShareNotification` concept, but rather than adding a separate model, store the pending state directly on the `ContactShare` record — `recipientContactId === null` and `status === ACTIVE` indicates a pending unaccepted share. The P12-06 ticket renders these as notifications in the UI.

No new database model is needed for the notification — the query pattern is:

```typescript
// Count of pending incoming shares for a user
const pendingCount = await prisma.contactShare.count({
  where: {
    recipientUserId: session.user.id,
    status: "ACTIVE",
    recipientContactId: null,
    shareType: { in: ["STATIC_COPY", "LIVE_SYNC"] },
  },
});
```

### Email Notifications

Two transactional emails are required for this ticket:

**Email 1: Share notification to existing Kontax user**
- To: recipient's email
- Subject: `{senderName} shared a contact with you on Kontax`
- Body: brief description of the share, the contact's display name, and a CTA button linking to the pending shares view in the Kontax app.
- The link should be a deep link to the Kontax app's pending shares view: `https://kontax.app/contacts/shares/pending`.

**Email 2: Invite to non-account recipient**
- To: `recipientEmail`
- Subject: `{senderName} wants to share a contact with you`
- Body: explanation that the sender has a contact to share, that they need a free Kontax account to receive it, and a CTA button: "Create account and receive contact."
- The CTA link should include a query parameter so the registration page can surface the pending share after signup: `https://kontax.app/register?pendingShare={shareId}`.

Both emails use the transactional email provider configured in the app. If no provider is configured, log a warning and skip email delivery — do not fail the share creation. The in-app notification path must succeed independently of the email path.

### Server Action: acceptShare

Location: `src/app/actions/shares.ts`

```typescript
export async function acceptShare(
  shareId: string
): Promise<{ newContactId: string }>
```

Full sequence:

1. Authenticate. Verify `share.recipientUserId === session.user.id` (or link if the share was an invite that just got registered — handle both cases).
2. Load the share with `shareType` check. Only `STATIC_COPY` shares are handled here. `LIVE_SYNC` acceptance has additional steps handled in P12-04's `acceptLiveShare` action.
3. Verify `share.status === "ACTIVE"` and `share.recipientContactId === null` (not already accepted).
4. Load the source contact if available: `prisma.contact.findUnique({ where: { id: share.contactId } })`. This may return null if the original was hard-deleted. Fall back to `share.contactSnapshot` if null.
5. Deserialize the contact data from either the live record or the snapshot.
6. Create the new contact in the recipient's account:
   ```typescript
   const newContact = await prisma.contact.create({
     data: {
       userId: session.user.id,
       displayName: contactData.displayName,
       givenName: contactData.givenName,
       familyName: contactData.familyName,
       // ... all portable fields
       sourceType: "SHARED_STATIC",
       sourceDetail: ownerName,   // sender's display name
       // identifiers created separately
     },
   });
   ```
7. Create `ContactIdentifier` records for the new contact's phone numbers, email addresses, websites, etc. — follow the same pattern as the import flow.
8. Set `recipientContactId` on the share:
   ```typescript
   await prisma.contactShare.update({
     where: { id: shareId },
     data: { recipientContactId: newContact.id },
   });
   ```
9. Emit `CONTACT_SHARE_RECEIVED` ActivityEvent on the recipient's side:
   ```typescript
   await emitActivityEvent({
     userId: session.user.id,
     contactId: newContact.id,
     eventType: "CONTACT_SHARE_RECEIVED",
     actor: "SHARE",
     actorDetail: ownerName,
     payload: { shareId, shareType: "STATIC_COPY", sourceContactId: share.contactId },
   });
   ```
10. Optionally notify the sender that the share was accepted (nice-to-have for v1, not blocking).
11. Return `{ newContactId: newContact.id }`.

The UI navigates to the new contact immediately after acceptance.

### Server Action: declineShare

```typescript
export async function declineShare(
  shareId: string
): Promise<void>
```

1. Authenticate. Verify `share.recipientUserId === session.user.id`.
2. Verify `share.status === "ACTIVE"` and `share.recipientContactId === null`.
3. Update: `status: "DECLINED"`.
4. Notify the sender (in-app notification and/or email) that the share was declined. This is a best-effort notification — failure to notify must not fail the decline action.

### Contact Independence After Acceptance

After `acceptShare` completes, the new contact in the recipient's account has no runtime link to the original. There are no database foreign keys connecting the two contacts after `recipientContactId` is set (that field points from the `ContactShare` to the new contact, not the other way). The `ContactShare` record remains as an audit trail, but no propagation hooks are wired for `STATIC_COPY` shares.

Verify this independence by checking that the `CONTACT_UPDATED` ActivityEvent handler (P12-08) only triggers propagation for `LIVE_SYNC` shares, not `STATIC_COPY` shares.

### Invite-to-Register Deep Link Handling

When the registration page is loaded with `?pendingShare={shareId}`, the page should:

1. After successful registration and email confirmation, call the share linkage logic.
2. Display a banner or prompt: "You have a pending contact share from {senderName}. Accept it now?"
3. The user can navigate to the pending shares view or accept inline.

This requires the registration flow to:
- Accept `pendingShare` as a query param.
- After account creation, run the linkage update: `prisma.contactShare.updateMany({ where: { recipientEmail: newUser.email, status: "ACTIVE" }, data: { recipientUserId: newUser.id } })`.
- Redirect to `?pendingShare={shareId}` or `/contacts/shares/pending` as appropriate.

### UI: Share Sheet — Static Share Option

In the share sheet on the contact detail page, the "Share with a Kontax user — Static" option:

- Is disabled (grayed out with an "Upgrade" badge) for Free plan users.
- For Pro+ users, clicking it opens an email input field inline in the share sheet.
- Input: standard email input with validation.
- "Send" button calls `createStaticShare`.
- On success: shows "Share sent to {name or email}" confirmation toast.
- On `PLAN_GATE_STATIC_SHARE` error: shows upgrade prompt.
- On self-share error: shows "You can't share a contact with yourself."

### Data Integrity Guarantees

- The contact snapshot is written inside the same database transaction as the `ContactShare` record creation. There is no window where a share exists without a snapshot.
- The `recipientContactId` uniqueness constraint ensures a share can only be accepted once. A second call to `acceptShare` on an already-accepted share will find `recipientContactId !== null` and exit early without creating a duplicate contact.
- All mutations within `acceptShare` (contact creation, identifier creation, share update, activity event) should run within a single Prisma transaction to ensure atomicity.

---

## Acceptance Criteria

- A Pro+ user can share a contact with another Kontax user by entering their email address.
- A Free plan user sees the static share option as disabled with an upgrade prompt.
- When the recipient is an existing Kontax user, they receive an in-app notification (badge count increases) and an email notification.
- When the recipient does not have a Kontax account, they receive an invite email with a registration link that carries the share context.
- After the non-account recipient registers, the pending share is linked to their new account.
- The recipient can accept the share. Accepting creates a contact in their account with `sourceType: SHARED_STATIC` and `sourceDetail` set to the sender's name.
- The new contact in the recipient's account contains all portable fields from the original at share-creation time (not at acceptance time).
- After acceptance, modifying the original contact in the sender's account does not affect the recipient's copy.
- The recipient can decline the share. Declining sets `status: DECLINED`.
- The sender can see the share status (pending/accepted/declined) on the contact detail page.
- If the sender archives their contact after sending the share but before acceptance, the recipient can still accept and receive the contact (served from snapshot).
- `CONTACT_SHARED` ActivityEvent is emitted on share creation.
- `CONTACT_SHARE_RECEIVED` ActivityEvent is emitted on share acceptance.
- A user cannot share a contact with themselves.
- All mutations in `acceptShare` are atomic — no partial contact creation without the share record being updated.

---

## Risks and Open Questions

- **Transactional email provider availability** — if the email provider is not yet configured, the invite-to-register flow for non-account recipients will silently fail on email delivery. Define a fallback: log the invite URL so it can be manually retrieved during development. Add a startup check that warns if the email provider is not configured.
- **Snapshot staleness** — the snapshot captures the contact at share-creation time. If the sender significantly updates the contact between creation and acceptance, the recipient receives an older version. This is by design for static shares but may confuse users. Consider adding a "Preview" capability in the accept flow that shows what the recipient will receive.
- **`acceptShare` race condition** — two simultaneous calls to `acceptShare` for the same share could both see `recipientContactId === null` and proceed to create two contacts. Mitigate with a database-level unique constraint on `recipientContactId` (already in the schema) and handle the constraint violation in the server action: if a unique violation occurs, return the existing `recipientContactId` as success.
- **Non-account invite expiry** — there is currently no expiry for static share invites to non-account recipients. If the recipient never registers, the share sits as ACTIVE indefinitely. Consider adding a 30-day auto-expiry for non-account invites in a future cleanup job.
- **Source contact deletion** — if the sender hard-deletes their contact after creating a share, the `contactId` FK would cascade-delete the share (per the schema). This means the recipient's pending share disappears without notification. The product should prevent hard-deletion of contacts with pending active shares, or at minimum convert them to EXPIRED status with a notification.
- **Large contact snapshot** — contacts with many identifiers (e.g. 20 phone numbers, 10 email addresses) could produce a large JSON snapshot. Enforce the 64KB cap defined in P12-01 at the server action level.

---

## Outcome

Pro+ Kontax users can send a one-time contact copy to any email address — whether or not the recipient has a Kontax account — and the recipient receives a fully independent contact in their account upon acceptance.
