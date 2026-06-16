# Sharing model

**Cross-cutting subsystem.** How contacts are shared between users — or published publicly — and how those shares are maintained and revoked.

---

## Three share types

All sharing goes through the `ContactShare` table. The `shareType` determines the semantics:

| Type | Description | Recipient needs Kontax? | Updates after send? |
|------|-------------|------------------------|-------------------|
| `VCARD_LINK` | Public URL returning a .vcf download | No | No (static at time of visit) |
| `STATIC_COPY` | One-time Kontax-to-Kontax share | Yes | No |
| `LIVE_SYNC` | Ongoing sync: owner edits propagate to recipient | Yes | Yes |

Live sharing requires both owner and recipient to be on Pro or higher. Downgrading either side converts the share to `STATIC_COPY`.

---

## ContactShare schema

```
ContactShare {
  id                 — CUID
  ownerUserId        — the user who created the share
  contactId          — the source contact (nullable: may be deleted after share)
  shareType          — VCARD_LINK | STATIC_COPY | LIVE_SYNC
  token              — unique random token for vCard links
  recipientUserId    — set when a Kontax user accepts the share
  recipientEmail     — email the share was sent to (for pending/unsolicited)
  recipientContactId — the copy of the contact in the recipient's address book
  status             — ACTIVE | REVOKED
  snapshot           — JSON snapshot of the contact at share time
  expiresAt          — optional expiry (used by vCard links)
  revokedAt          — set on revoke
  lastPushedAt       — last live-sync push (LIVE_SYNC only)
  lastErrorAt        — error state for paused live pushes
  lastErrorCode      — error code for paused live pushes
  downloadCount      — how many times a vCard link was downloaded
}
```

The `snapshot` field is a JSON blob of the contact's portable fields at share time. This ensures a `STATIC_COPY` can be delivered even if the owner later edits, archives, or deletes the source contact.

---

## vCard link flow (`VCARD_LINK`)

1. Owner clicks Share → vCard link on a contact.
2. Server creates a `ContactShare` row with `shareType=VCARD_LINK` and a random `token`.
3. The public URL is `https://getkontax.com/share/{token}`.
4. Any visitor can download a `.vcf` file. No Kontax account needed.
5. `downloadCount` increments on each download.
6. Optionally set `expiresAt` to auto-expire the link.

---

## Static Kontax-to-Kontax share flow (`STATIC_COPY`)

1. Owner shares to a recipient's email. A `ContactShare` row is created with `status=ACTIVE`, `shareType=STATIC_COPY`, `snapshot` set, `recipientEmail` set.
2. Recipient is notified (in-app notification + email).
3. Recipient accepts: a new `Contact` is created in their address book using the `snapshot`. `recipientContactId` is set on the share row.
4. The recipient's copy is fully independent — edits by the owner do not propagate.

---

## Live sync flow (`LIVE_SYNC`)

1. Owner shares as live. `shareType=LIVE_SYNC`, `snapshot` set as initial state.
2. Recipient accepts: a new `Contact` is created from `snapshot`. `recipientContactId` set.
3. **On every edit to the source contact**: the sync engine finds all active `LIVE_SYNC` shares for that contact and pushes the updated fields to each `recipientContactId`. `lastPushedAt` is updated.
4. If a push fails (e.g. recipient account `LOCKED`): `lastErrorAt` and `lastErrorCode` are set. Pushes are retried on the next sync cycle.

---

## Revocation

When the owner revokes a `LIVE_SYNC` share:
- `status` → `REVOKED`, `revokedAt` set.
- The recipient's copy (`recipientContact`) is converted to a `STATIC_COPY` (no longer receives updates).
- The share row's `shareType` is set to `STATIC_COPY` to reflect the final state.

When the owner revokes a `STATIC_COPY` or `VCARD_LINK`:
- `status` → `REVOKED`, `revokedAt` set.
- No effect on recipient side (they already have a copy or the link stops working).

---

## Downgrade side-effects

When a user downgrades below Pro (to FREE), `applyDowngrade` in `stripe-handlers.ts` converts:
- All outbound `LIVE_SYNC` shares owned by the user → `STATIC_COPY`.
- All inbound accepted `LIVE_SYNC` shares where the user is the recipient → `STATIC_COPY`.

When an account deletion is scheduled, `scheduleAccountDeletion` in `account.ts`:
- Accepted outbound `LIVE_SYNC` shares → `STATIC_COPY` (recipients keep a snapshot).
- Pending (not yet accepted) outbound `LIVE_SYNC` shares → `REVOKED`.

---

## Private additions (recipient-side)

The recipient's copy of a shared contact is a fully independent `Contact` row in their address book. They can add private notes, labels, and favourites. These are never synced back to the owner.

---

## References

- Schema: `prisma/schema.prisma` — `ContactShare`, `ShareType`, `ShareStatus`
- Share operations: `src/server/contact-shares.ts`
- Downgrade: `src/server/stripe-handlers.ts` → `applyDowngrade`
- Account deletion: `src/app/actions/account.ts` → `scheduleAccountDeletion`
