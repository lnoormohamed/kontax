# P12-04 Live Kontax-to-Kontax Share

## Purpose
This ticket implements live sharing: a connected contact relationship between two Kontax accounts where updates to the owner's contact propagate automatically to the recipient's linked copy. Live sharing enables real-world scenarios where the ongoing accuracy of a contact matters — a professional keeping their business contacts updated, a company distributing an employee directory, a family group staying in sync on shared contacts. Unlike the static share in P12-03, the live share creates a persistent relationship that persists until explicitly revoked by either party. Both the sender and the recipient must be on paid plans for a live share to be established and maintained.

## Background
Phase 12-03 established the full accept/decline notification flow and the contact copy mechanics. Phase 12-04 builds on that foundation rather than reimplementing it. The primary additions in this ticket are:

1. The plan check at acceptance time (recipient must be on a paid plan).
2. The propagation hookup: CONTACT_UPDATED/CONTACT_MERGED/CONTACT_RESTORED events on the owner's contact must trigger a push to all active LIVE_SYNC shares.
3. The restricted edit rights on the recipient's linked contact (read-only shared fields, writeable private notes).
4. The revocation / unlink mechanics that convert the live contact to a static copy.
5. Plan downgrade handling that auto-converts live received contacts.
6. Circular share detection.

Phase 12-08 handles the full reliability and error handling layer for propagation. This ticket implements the happy path and the structural wiring; P12-08 adds retries, error surfacing, and debouncing.

The `ActivityEvent` model from Phase 10 includes a `SYNC_PUSHED` event type that is used to record each successful propagation to a recipient. The `lastPushedAt` field on `ContactShare` (from P12-01) is updated by the propagation job.

## Scope

**In scope:**
- Server action to create a `LIVE_SYNC` share (similar to P12-03's `createStaticShare`)
- Plan gate: sender must have `liveShareEnabled`
- Acceptance flow: recipient plan check, fallback to static if Free
- Contact creation in recipient's account with `sourceType: SHARED_LIVE`
- Edit right enforcement: recipient can write private notes, cannot edit shared fields
- Propagation hook: wire CONTACT_UPDATED, CONTACT_MERGED, CONTACT_RESTORED ActivityEvents to trigger `propagateLiveShare` for the affected contact
- `propagateLiveShare` job: load all active LIVE_SYNC shares for the contact, push changes to each recipient's linked contact
- `SYNC_PUSHED` ActivityEvent on recipient side per successful propagation
- `lastPushedAt` update on the `ContactShare` record
- Revoke by owner: status REVOKED, recipient contact converts to SHARED_STATIC
- Unlink by recipient: same outcome from recipient's side
- Plan downgrade auto-conversion: on user plan change to Free, convert all active LIVE_SYNC received shares
- Circular share detection and rejection
- Merge handling: surviving contact inherits live shares, merged-away contact's shares are revoked

**Out of scope:**
- Full error handling and retry logic for propagation failures (P12-08)
- UI for the "Live from [Owner]" badge (P12-05 and P12-07)
- Full share management UI (P12-05)
- Incoming notification rendering (P12-06)
- Back-propagation (recipient edits propagate back to owner) — explicitly excluded from v1
- Partial field sharing (owner selects which fields to include in live share) — future enhancement

---

## Design / Implementation Spec

### Plan Gate on Creation

The sender must have `liveShareEnabled` in their subscription entitlements:

```typescript
const entitlement = await getUserEntitlements(session.user.id);
if (!entitlement.liveShareEnabled) {
  throw new Error("PLAN_GATE_LIVE_SHARE");
}
```

The plan tier check uses the `Subscription` model. `liveShareEnabled` is true for PRO, FAMILY, and TEAMS plans.

### Server Action: createLiveShare

```typescript
export async function createLiveShare(
  contactId: string,
  recipientEmail: string
): Promise<{ shareId: string; recipientExists: boolean }>
```

Steps:

1. Authenticate and verify ownership of `contactId`.
2. Check `liveShareEnabled` entitlement.
3. Prevent self-share.
4. Circular share detection (see below).
5. Resolve recipient (same pattern as P12-03: existing user vs no-account invite).
6. Capture contact snapshot (same as P12-03).
7. Create `ContactShare` with `shareType: "LIVE_SYNC"`, `status: "ACTIVE"`, `token: null`.
8. Create in-app notification for recipient if existing user.
9. Send transactional email to recipient.
10. Emit `CONTACT_SHARED` ActivityEvent.
11. Return `{ shareId, recipientExists }`.

The creation step is structurally identical to `createStaticShare` from P12-03. The meaningful divergence happens in `acceptLiveShare` and the propagation path.

### Circular Share Detection

Before creating the share, check whether a live share chain would form a loop:

```typescript
async function wouldCreateCircularShare(
  ownerUserId: string,
  contactId: string,
  recipientUserId: string | null
): Promise<boolean>
```

If `recipientUserId` is null (non-account invite), circular detection is deferred until acceptance — at that point, the recipient's account is known.

Check: does the recipient have a `LIVE_SYNC` share pointing back to the owner? Specifically:

1. Find all contacts the recipient owns that were created from a live share sourced from `ownerUserId` (i.e., `sourceType: SHARED_LIVE` contacts in the recipient's account where the corresponding `ContactShare.ownerUserId === ownerUserId`).
2. For each such contact, check if the recipient has any active `LIVE_SYNC` shares for it pointing to the original owner.

This detects the direct A→B→A circular case. For deeper chains (A→B→C→A), the check would need to be recursive. For v1, implement only the direct circular check. Document the limitation: deeper circular chains are not detected in v1 and would need to be addressed if the feature is widely used.

Throw `"CIRCULAR_SHARE_DETECTED"` if a loop would be created.

### Server Action: acceptLiveShare

```typescript
export async function acceptLiveShare(
  shareId: string
): Promise<{ newContactId: string } | { convertedToStatic: true; newContactId: string }>
```

Steps:

1. Authenticate. Verify `share.recipientUserId === session.user.id`.
2. Verify `share.shareType === "LIVE_SYNC"`.
3. Verify `share.status === "ACTIVE"` and `share.recipientContactId === null`.
4. **Recipient plan check**: load recipient's subscription entitlements. If `liveShareEnabled === false` (Free plan):
   - Convert the share to static: `await prisma.contactShare.update({ where: { id: shareId }, data: { shareType: "STATIC_COPY" } })`.
   - Notify the sender that the live share was downgraded to static because the recipient is on the Free plan.
   - Call `acceptShare(shareId)` from P12-03 to complete the static acceptance flow.
   - Return `{ convertedToStatic: true, newContactId }`.
5. If the recipient is on a paid plan, proceed with live share acceptance:
6. Circular share detection at acceptance time (for cases where recipient is now known for a non-account invite).
7. Deserialize the contact from the snapshot or live record.
8. Create contact in recipient's account:
   ```typescript
   const newContact = await prisma.contact.create({
     data: {
       userId: session.user.id,
       // ... portable fields from snapshot
       sourceType: "SHARED_LIVE",
       sourceDetail: ownerName,
     },
   });
   ```
9. Create `ContactIdentifier` records.
10. Update `ContactShare`: `recipientContactId: newContact.id`.
11. Emit `CONTACT_SHARE_RECEIVED` ActivityEvent on recipient side with `shareType: "LIVE_SYNC"`.
12. Return `{ newContactId }`.

### Propagation: wiring to ActivityEvents

The propagation job must be triggered when a `CONTACT_UPDATED`, `CONTACT_MERGED`, or `CONTACT_RESTORED` ActivityEvent is emitted for a contact that has active `LIVE_SYNC` shares.

Wire this in the `emitActivityEvent` function (Phase 10):

```typescript
// After the event is written to the database
if (
  ["CONTACT_UPDATED", "CONTACT_MERGED", "CONTACT_RESTORED"].includes(eventType) &&
  contactId !== null
) {
  void scheduleLiveSharePropagation(contactId);
}
```

`scheduleLiveSharePropagation` enqueues a background job (or calls the propagation function directly for MVP). P12-08 defines the debounce and error handling behavior. In this ticket, implement the minimal synchronous version: call `propagateLiveShare(contactId)` directly, wrapped in a try/catch that logs errors without throwing.

### propagateLiveShare

```typescript
async function propagateLiveShare(sourceContactId: string): Promise<void>
```

Steps:

1. Load all active `LIVE_SYNC` shares for the contact:
   ```typescript
   const shares = await prisma.contactShare.findMany({
     where: {
       contactId: sourceContactId,
       shareType: "LIVE_SYNC",
       status: "ACTIVE",
       recipientContactId: { not: null },
     },
   });
   ```
2. Load the current state of the source contact.
3. For each share:
   a. Load the recipient's contact by `share.recipientContactId`.
   b. If not found (contact was deleted by recipient): set `share.status = "REVOKED"`, skip.
   c. Check the recipient's account status (locked/suspended → set error state on share, skip — handled fully in P12-08).
   d. Update the recipient's contact with the current field values from the source contact. Only update shared fields — do not overwrite the recipient's private notes field.
   e. Update `ContactIdentifier` records for the recipient's contact (add new, update changed, soft-delete removed).
   f. Update the share: `lastPushedAt: new Date()`, clear `lastErrorAt` and `lastErrorCode`.
   g. Emit `SYNC_PUSHED` ActivityEvent on the **recipient's** side:
      ```typescript
      await emitActivityEvent({
        userId: share.recipientUserId,
        contactId: share.recipientContactId,
        eventType: "SYNC_PUSHED",
        actor: "SHARE",
        actorDetail: ownerName,
        payload: { shareId: share.id, sourceContactId },
      });
      ```
4. Log the propagation outcome (how many shares were updated, how many errored).

**Private notes preservation**: the recipient's private notes are stored in the `notes` field on their `Contact` record. During propagation, the source contact's `notes` field value is pushed to the recipient's contact. This would overwrite the recipient's private notes — which is wrong.

Resolution: add a `privateNotes` field to `Contact` (separate from `notes`) for Phase 12, or store the recipient's private notes in a separate model. The cleanest approach for v1 is a new nullable field:

```prisma
// On Contact model
sharedNotesFromOwner  String?   // For SHARED_LIVE contacts: notes from the owner (propagated)
privateNotes          String?   // For SHARED_LIVE contacts: recipient's private additions (not propagated)
```

For non-shared contacts, `privateNotes` is unused and both fields are null. For `SHARED_LIVE` contacts in a recipient's account:
- `notes` retains the original vCard meaning for display purposes (set to the concatenation of owner notes and private notes for display, but stored separately).
- `sharedNotesFromOwner` = the owner's `notes` value, updated on each propagation.
- `privateNotes` = the recipient's additions, never touched by propagation.

The UI on a SHARED_LIVE contact shows both sections: "Notes from [Owner]" (read-only) and "My notes" (editable).

If adding these fields is out of scope for P12-04, use a simpler v1 approach: propagation does not push `notes` updates. The `notes` field on the recipient's contact is entirely theirs. The owner's notes are not propagated. Document this limitation explicitly. This is the fallback if the schema change is deemed too risky mid-phase.

### Edit Right Enforcement on SHARED_LIVE Contacts

The contact detail page must detect whether the viewed contact is a `SHARED_LIVE` contact (i.e., `contact.sourceType === "SHARED_LIVE"`) and render it in read-only mode for shared fields.

At the API layer, the contact update server action must check:

```typescript
if (contact.sourceType === "SHARED_LIVE") {
  // Recipient can only update privateNotes (or the notes field if using the simpler approach)
  const allowedFields = new Set(["privateNotes"]);
  const attemptedFields = Object.keys(updates);
  if (attemptedFields.some(f => !allowedFields.has(f))) {
    throw new Error("CANNOT_EDIT_SHARED_CONTACT");
  }
}
```

This enforcement happens at the server action level. The UI also reflects this by disabling all fields except the private notes input, but server-side enforcement is the authoritative gate.

### Revoke by Owner

```typescript
export async function revokeLiveShare(
  shareId: string
): Promise<void>
```

1. Authenticate. Verify `share.ownerUserId === session.user.id`.
2. Verify `share.shareType === "LIVE_SYNC"` and `share.status === "ACTIVE"`.
3. Update share: `status: "REVOKED"`, `revokedAt: new Date()`.
4. If `share.recipientContactId !== null`: update the recipient's contact: `sourceType: "SHARED_STATIC"`, `sharedNotesFromOwner: null` (stop marking it as live). The recipient now owns a fully independent copy.
5. Notify the recipient that the live share was revoked and their contact is now a static copy.
6. Log the revocation in ActivityEvents (optional for v1 — no event type currently covers revocation; add `CONTACT_SHARE_REVOKED` if desired).

### Unlink by Recipient

```typescript
export async function unlinkLiveShare(
  shareId: string
): Promise<void>
```

1. Authenticate. Verify `share.recipientUserId === session.user.id`.
2. Verify `share.shareType === "LIVE_SYNC"` and `share.status === "ACTIVE"`.
3. Update share: `status: "REVOKED"`, `revokedAt: new Date()`.
4. Update the recipient's contact (now owned by this user): `sourceType: "SHARED_STATIC"`. The contact remains in the recipient's account as a static copy.
5. Notify the owner that the recipient has unlinked the contact (best-effort, not blocking).

### Plan Downgrade Auto-Conversion

When a user's subscription downgrades to Free (detected via billing webhook or plan change action), trigger:

```typescript
async function convertLiveSharesOnDowngrade(userId: string): Promise<void>
```

This function handles two cases:

**Case A: User is a recipient of live shares (their received live contacts become static)**
```typescript
const receivedLiveShares = await prisma.contactShare.findMany({
  where: {
    recipientUserId: userId,
    shareType: "LIVE_SYNC",
    status: "ACTIVE",
    recipientContactId: { not: null },
  },
});

for (const share of receivedLiveShares) {
  await prisma.contactShare.update({
    where: { id: share.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await prisma.contact.update({
    where: { id: share.recipientContactId! },
    data: { sourceType: "SHARED_STATIC" },
  });
  // Notify the owner
  await notifyOwnerOfAutoConversion(share.ownerUserId, share);
}
```

**Case B: User is an owner of live shares they've sent (their outbound live shares are revoked)**
This is a product decision: should downgrading the sender break their recipients' live shares? Given that live sharing requires both parties to be on paid plans, yes — if the sender downgrades to Free, their outbound live shares must be revoked and recipients notified. Their contacts convert to static copies on the recipient side.

```typescript
const sentLiveShares = await prisma.contactShare.findMany({
  where: {
    ownerUserId: userId,
    shareType: "LIVE_SYNC",
    status: "ACTIVE",
  },
});

for (const share of sentLiveShares) {
  await prisma.contactShare.update({
    where: { id: share.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  if (share.recipientContactId) {
    await prisma.contact.update({
      where: { id: share.recipientContactId },
      data: { sourceType: "SHARED_STATIC" },
    });
  }
  // Notify the recipient
  await notifyRecipientOfAutoConversion(share.recipientUserId, share);
}
```

This function is called from the subscription lifecycle webhook handler, not from user-facing code. It should be idempotent — safe to run multiple times without creating duplicate conversions.

### Merge Handling

When two contacts are merged and one has active `LIVE_SYNC` shares, the surviving contact must inherit those shares. The merged-away contact's shares must be revoked.

In the merge execution path (Phase 10), after the surviving contact is determined:

```typescript
// Transfer LIVE_SYNC shares from merged-away contact to surviving contact
await prisma.contactShare.updateMany({
  where: {
    contactId: mergedAwayContactId,
    shareType: "LIVE_SYNC",
    status: "ACTIVE",
  },
  data: { contactId: survivingContactId },
});
```

After transfer, trigger `propagateLiveShare(survivingContactId)` to push the merged contact state to all recipients. Recipients see the update as a `SYNC_PUSHED` event.

For `STATIC_COPY` shares that are still pending (not yet accepted): the snapshot already captures the state at share time, so no action is needed. The recipient receives the pre-merge version, which is acceptable.

### Data Integrity Guarantees

- The `recipientContactId` uniqueness constraint prevents double-acceptance.
- Propagation is always a full field replacement of shared fields, not a delta patch applied to the recipient's contact. This avoids accumulating inconsistencies from missed propagation events.
- Propagation reads the current state of the source contact fresh from the database on each run — it never reads from a cached or stale snapshot during propagation.
- All mutations within `acceptLiveShare` are atomic (single Prisma transaction).
- Plan downgrade auto-conversion is idempotent.

---

## Acceptance Criteria

- A Pro+ user can send a live share to another Kontax user by entering their email address.
- A Free plan user sees the live share option as disabled with an upgrade prompt.
- When a Free plan recipient accepts a live share, the share is automatically downgraded to static and the sender is notified.
- When a paid plan recipient accepts a live share, a contact appears in their account with `sourceType: SHARED_LIVE`.
- The recipient's contact displays a "Live from [Owner]" indicator (badge style defined in P12-07).
- When the owner updates their contact, the changes propagate to the recipient's linked contact.
- The recipient cannot edit the shared fields on the linked contact (server action rejects the update with `CANNOT_EDIT_SHARED_CONTACT`).
- The recipient can add and edit private notes without their notes being overwritten by propagation.
- Revoking the share from the owner's side converts the recipient's contact to `sourceType: SHARED_STATIC`.
- Unlinking from the recipient's side produces the same outcome.
- When a recipient's plan downgrades to Free, their live received contacts auto-convert to static and both parties are notified.
- When a sender's plan downgrades to Free, their outbound live shares are revoked and recipients' contacts become static.
- Circular share detection rejects an A→B→A configuration.
- When a contact with active live shares is merged, the surviving contact inherits the shares.
- `SYNC_PUSHED` ActivityEvent is emitted on the recipient's side after each successful propagation.
- `lastPushedAt` on the `ContactShare` record is updated after each successful propagation.

---

## Risks and Open Questions

- **Private notes storage model** — the `sharedNotesFromOwner` / `privateNotes` field split requires a schema migration. If this is deferred, propagation must explicitly exclude the `notes` field, and the product must document that note changes do not propagate. Decide before implementation begins.
- **Propagation synchrony** — in the MVP implementation, `propagateLiveShare` is called synchronously after the ActivityEvent is emitted. For contacts with many live shares, this adds latency to every contact save. P12-08 moves this to a background job with debouncing. The synchronous approach is acceptable only if the number of shares per contact is small (< 5) in v1.
- **Deeper circular detection** — the implementation only detects direct A→B→A circular shares, not A→B→C→A. For v1 this is acceptable (the feature is new and deep chains are unlikely), but document the gap.
- **Recipient downgrade race condition** — if a recipient downgrades their plan at the same time the owner is pushing a propagation, the propagation might succeed against a contact that is about to be converted to static. This is not harmful — the next propagation attempt will find the share revoked and stop. The timing window is negligible in practice.
- **Notification throttling for frequent propagations** — if the owner updates their contact rapidly (e.g. 10 edits in 2 minutes), the recipient could receive 10 `SYNC_PUSHED` events. P12-08's debouncing collapses these into one push. Without P12-08, the recipient's activity log could be noisy. Consider a minimal debounce (5 seconds) in this ticket's synchronous implementation.
- **Schema additive requirement for `sharedNotesFromOwner` and `privateNotes`** — if these fields are added here, they must be included in the Prisma migration for this ticket, separate from P12-01's migration. Run the migration as `p12-04-live-share-private-notes`.

---

## Outcome

Pro+ users can share a contact that stays live and in sync with a paid plan recipient, with full revocation mechanics that cleanly convert the live link to a static copy from either side.
