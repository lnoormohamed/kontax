# P12-01 Contact Share Schema

## Purpose
This ticket defines the `ContactShare` model and its supporting enums as the stable data-layer foundation for all Phase 12 sharing features. Every subsequent ticket in Phase 12 depends on this schema being correct, migrated, and unchanging. Getting the model right before any application logic is written saves costly migrations later and ensures that all three sharing modes — vCard link, static Kontax-to-Kontax, and live Kontax-to-Kontax — can coexist on the same record structure without hacks or workaround columns.

## Background
Phase 10 introduced the `ActivityEvent` model with event types `CONTACT_SHARED` and `CONTACT_SHARE_RECEIVED`, establishing the audit trail infrastructure that Phase 12 builds on. Phase 10 also added `sourceType` and `sourceDetail` fields to the `Contact` model with explicit enum values `SHARED_STATIC` and `SHARED_LIVE` — meaning the Contact model is already expecting Phase 12 to set those values when a shared contact is created in a recipient's account.

Phase 11 introduced `liveShareEnabled` and `staticShareEnabled` entitlement fields on the `Subscription` model, and updated `SubscriptionPlan` to `FREE`, `PRO`, `FAMILY`, `TEAMS`. These entitlement fields are the gates that P12-02 through P12-04 will check before permitting share creation.

The `Contact` model carries `userId` as its ownership root. Any `ContactShare` record must unambiguously identify both the owning user and the contact being shared, and must not assume that `contactId` alone is enough — the same contact ID can never appear under a different user, but the model is cleaner when `ownerUserId` is stored explicitly for join-free access checks.

## Scope

**In scope:**
- `ShareType` enum definition
- `ShareStatus` enum definition
- `ContactShare` model with all fields documented below
- Database indexes on the model
- Snapshot storage strategy for static shares (pending delivery)
- `lastErrorAt` and `lastErrorCode` fields for propagation error tracking (used by P12-08)
- Prisma migration that runs cleanly in development and production

**Out of scope:**
- Any application logic — no server actions, no API routes, no UI
- Token generation logic (P12-02)
- vCard serving endpoint (P12-02)
- Share notification system (P12-06)
- Propagation job (P12-08)
- Any changes to the `Contact`, `User`, or `Subscription` models

---

## Design / Implementation Spec

### ShareType Enum

```prisma
enum ShareType {
  VCARD_LINK
  STATIC_COPY
  LIVE_SYNC
}
```

`VCARD_LINK` — a public URL backed by a random token. No Kontax account needed on the recipient side. The link serves a `.vcf` file download when accessed.

`STATIC_COPY` — a one-time contact delivery to another Kontax account. The recipient gets an independent copy with no ongoing connection to the original. After acceptance, the two contacts are fully decoupled.

`LIVE_SYNC` — a connected contact delivery to another Kontax account. The recipient's copy is updated whenever the owner updates the original. Both parties must be on a paid plan. Revoking or unlinking converts the recipient's contact to a static copy.

### ShareStatus Enum

```prisma
enum ShareStatus {
  ACTIVE
  REVOKED
  EXPIRED
  DECLINED
}
```

`ACTIVE` — the share is in its normal operational state. For `VCARD_LINK` shares, ACTIVE means the link resolves and the file can be downloaded (subject to expiry check). For `STATIC_COPY` and `LIVE_SYNC` shares, ACTIVE means the share is either pending acceptance or already accepted (acceptance is tracked via `recipientContactId` being non-null, not by a separate status value — this avoids a redundant ACCEPTED status).

`REVOKED` — the owner explicitly revoked the share. The link returns HTTP 410 for vCard links. Live sync propagation stops. The recipient's contact, if already accepted, becomes a static copy with `sourceType: SHARED_STATIC`.

`EXPIRED` — the share passed its `expiresAt` timestamp without being revoked. Only meaningful for `VCARD_LINK` shares. A background job or on-demand check can set this. Expired links return HTTP 404.

`DECLINED` — the recipient declined the share. Only meaningful for `STATIC_COPY` and `LIVE_SYNC` shares. The owner is notified.

### ContactShare Model

```prisma
model ContactShare {
  id                  String      @id @default(cuid())

  // Ownership
  ownerUserId         String
  owner               User        @relation("OwnedShares", fields: [ownerUserId], references: [id], onDelete: Cascade)

  contactId           String
  contact             Contact     @relation(fields: [contactId], references: [id], onDelete: Cascade)

  // Share classification
  shareType           ShareType
  status              ShareStatus @default(ACTIVE)

  // vCard link token — set for VCARD_LINK, null for account shares
  token               String?     @unique

  // Recipient — account shares only
  recipientUserId     String?
  recipient           User?       @relation("ReceivedShares", fields: [recipientUserId], references: [id], onDelete: SetNull)
  recipientEmail      String?     // Non-account recipient; linked to account on registration

  // Set after recipient accepts — the Contact record created in their account
  recipientContactId  String?     @unique
  recipientContact    Contact?    @relation("SharedContactInstance", fields: [recipientContactId], references: [id], onDelete: SetNull)

  // Lifecycle timestamps
  expiresAt           DateTime?   // null = no expiry; VCARD_LINK Free plan = createdAt + 7 days
  revokedAt           DateTime?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  // vCard link download tracking
  downloadCount       Int         @default(0)

  // Live sync tracking
  lastPushedAt        DateTime?   // LIVE_SYNC only; updated on each successful propagation

  // Propagation error tracking (used by P12-08)
  lastErrorAt         DateTime?
  lastErrorCode       String?     // Short machine-readable code, e.g. "RECIPIENT_ACCOUNT_LOCKED"

  // Contact snapshot at share creation time
  // Stored as JSON. Used to deliver static shares if the original contact is
  // archived or deleted before the recipient accepts. For LIVE_SYNC, this is
  // the baseline snapshot sent on acceptance; subsequent updates are diffs.
  contactSnapshot     Json?

  @@index([ownerUserId, status, createdAt(sort: Desc)])
  @@index([recipientUserId, status])
  @@index([token])                // Already unique, but a partial index here aids hot-path lookups
  @@index([contactId, status])    // For "what shares does this contact have?" queries
}
```

### Field-by-Field Notes

**`id`** — cuid, stable internal identifier. Never exposed in URLs. The `token` field is what goes in public URLs for vCard links.

**`ownerUserId`** — denormalized from `contact.userId`. Stored explicitly so access control checks do not require a join to `Contact`. Must equal `contact.userId` at insertion time — enforce at the application layer, not via a database constraint (Prisma does not support multi-column cross-table constraints natively).

**`contactId`** — the contact being shared. On `onDelete: Cascade`, so if the contact is hard-deleted, the share records are cleaned up. However, the normal product flow is soft-archive, not hard delete — the `contactSnapshot` field is the safety net for the case where a static share is pending and the original contact is archived before the recipient accepts.

**`shareType`** — immutable after creation. Do not allow changing the type of an existing share.

**`status`** — mutable. State transitions:
- `ACTIVE` → `REVOKED` (owner revokes, or recipient unlinks for LIVE_SYNC)
- `ACTIVE` → `EXPIRED` (background job or on-demand check at download time)
- `ACTIVE` → `DECLINED` (recipient declines a STATIC_COPY or LIVE_SYNC share)
- No transitions back to ACTIVE from any other state — if a revoked share needs to be re-shared, a new `ContactShare` record is created.

**`token`** — 32-character URL-safe base64 string (`crypto.randomBytes(24).toString('base64url')`). Null for `STATIC_COPY` and `LIVE_SYNC` shares. The `@unique` constraint means token collisions are caught at the database level — the application should retry generation on a unique constraint violation, which is astronomically unlikely with 192 bits of randomness but must be handled.

**`recipientUserId`** — null for `VCARD_LINK`. Set immediately for `STATIC_COPY` and `LIVE_SYNC` shares to existing Kontax users. Remains null until registration for non-account invites (use `recipientEmail` in that case).

**`recipientEmail`** — used when the recipient does not have a Kontax account at share time. When they register, the registration flow must query for pending shares where `recipientEmail` matches the new account's email and set `recipientUserId`. This linkage must happen inside the registration transaction.

**`recipientContactId`** — null until the recipient accepts the share. Set to the newly created Contact ID in the recipient's account at acceptance time. The `@unique` constraint ensures one-to-one mapping between a share and its delivered contact.

**`expiresAt`** — null means no expiry. For `VCARD_LINK` shares created by Free plan users, the application must set this to `createdAt + 7 days` at insertion time. For Pro+ users, this defaults to null (no expiry) but can be set to a user-specified date. The download endpoint checks this at request time — do not rely solely on the background expiry job.

**`revokedAt`** — timestamp set when status transitions to `REVOKED`. Null otherwise.

**`downloadCount`** — integer incremented on each vCard file download from a `VCARD_LINK` share. Not meaningful for account shares (leave at 0). Updated via `$executeRaw` or an atomic increment to avoid race conditions when the same link is accessed concurrently.

**`lastPushedAt`** — updated by the live sync propagation job each time changes are successfully pushed to the recipient's contact. Null until the first propagation. Used by the share management UI to display "Last synced X ago."

**`lastErrorAt`** and **`lastErrorCode`** — set when a propagation attempt fails. Cleared when a subsequent propagation succeeds. `lastErrorCode` is a short machine-readable string, not a human message — the UI translates it. Defined error codes:

| Code | Meaning |
|---|---|
| `RECIPIENT_ACCOUNT_LOCKED` | Recipient's account is in locked state |
| `RECIPIENT_ACCOUNT_SUSPENDED` | Recipient's account is suspended |
| `RECIPIENT_PLAN_DOWNGRADED` | Recipient downgraded to Free; live share auto-converted |
| `CONTACT_NOT_FOUND` | Recipient's linked contact was deleted unexpectedly |
| `PROPAGATION_TIMEOUT` | Background job timed out during push |
| `UNKNOWN` | Unclassified error; inspect logs |

**`contactSnapshot`** — JSON blob capturing the complete portable representation of the contact at share creation time. This includes all non-null fields that would be emitted by `contactsToVCard`. The snapshot is used in two scenarios:

1. Static share delivery when the original contact has been archived before the recipient accepts: the share is delivered from the snapshot rather than the live record.
2. Live sync initial push: the snapshot is sent to the recipient on acceptance, establishing the baseline before subsequent diffs are applied.

Snapshot format should be the same as the vCard-to-object output structure already used in the codebase — do not introduce a new serialization format. Size must be bounded; do not embed binary avatar data in the snapshot. Store the `avatarUrl` string only.

### Relationship Back-References on Existing Models

The `ContactShare` model introduces two new relations on `User` and two new relations on `Contact`. These must be added as back-reference fields:

On `User`:
```prisma
ownedShares       ContactShare[] @relation("OwnedShares")
receivedShares    ContactShare[] @relation("ReceivedShares")
```

On `Contact`:
```prisma
shares                ContactShare[]
sharedContactInstance ContactShare?  @relation("SharedContactInstance")
```

The `sharedContactInstance` back-reference reflects the fact that a contact created in a recipient's account via sharing can be the `recipientContactId` of at most one `ContactShare` record (enforced by the `@unique` on `recipientContactId`).

### Multiple Active Shares Per Contact

A single contact can have multiple active `ContactShare` records simultaneously. Examples:

- Owner has a `VCARD_LINK` share (for the general public) and a `LIVE_SYNC` share with a colleague.
- Owner has two `STATIC_COPY` shares sent to two different Kontax users, both pending.
- Owner has a `VCARD_LINK` with custom expiry and a `LIVE_SYNC` with another person.

There is no uniqueness constraint preventing multiple active shares of the same type for the same contact. The application layer does not need to enforce any such restriction — it is valid product behavior.

### Index Rationale

`@@index([ownerUserId, status, createdAt(sort: Desc)])` — primary query pattern for the share management UI on the contact detail page: "show me all ACTIVE shares I own, newest first." With `contactId` added as a filter in the query, PostgreSQL will use this index efficiently.

`@@index([recipientUserId, status])` — query pattern for the incoming shares notification system: "how many ACTIVE pending shares does this user have?" and "show me all ACTIVE pending shares for this user." Pending shares are identified by `recipientContactId IS NULL` at the application layer.

`@@index([contactId, status])` — query pattern for the contact detail page loading its share list, and for the live sync propagation job looking up all `LIVE_SYNC` / `ACTIVE` shares for a given contact after a mutation event fires.

`@@index([token])` — the `@unique` constraint on `token` already creates a B-tree index, so this explicit index annotation is redundant in PostgreSQL. Include it in the Prisma schema to make the intent explicit for future reviewers. The download endpoint will hit this path on every public vCard request.

### Migration Strategy

The migration adds three new database objects: the `ShareType` enum, the `ShareStatus` enum, and the `contact_shares` table. No existing tables are altered — the back-reference fields on `User` and `Contact` are virtual Prisma-only relations and do not require column additions.

Run `prisma migrate dev --name add-contact-share-schema` in development. Review the generated SQL before applying to production. The migration is purely additive and carries zero risk of data loss.

After migration, run `prisma generate` to update the Prisma Client types. Confirm the generated types expose `ShareType`, `ShareStatus`, and `ContactShare` correctly.

---

## Acceptance Criteria

- `ShareType` enum exists in the Prisma schema with values `VCARD_LINK`, `STATIC_COPY`, `LIVE_SYNC`.
- `ShareStatus` enum exists in the Prisma schema with values `ACTIVE`, `REVOKED`, `EXPIRED`, `DECLINED`.
- `ContactShare` model exists with all fields listed in the spec above, including `lastErrorAt`, `lastErrorCode`, and `contactSnapshot`.
- `token` field has a `@unique` constraint.
- `recipientContactId` field has a `@unique` constraint.
- All three indexes are present: `(ownerUserId, status, createdAt)`, `(recipientUserId, status)`, `(contactId, status)`.
- Back-reference fields are added to `User` and `Contact` models.
- `prisma migrate dev` runs without errors.
- `prisma generate` produces correct TypeScript types for all new enums and the new model.
- No existing migrations are modified.
- The schema is reviewed and signed off before any P12-02 through P12-08 implementation begins.

---

## Risks and Open Questions

- **`onDelete: Cascade` on `contactId`** — if the system ever hard-deletes a contact that has active LIVE_SYNC shares, the share records are wiped silently. The product should prevent hard deletion of contacts with active shares, or at minimum emit a warning. Document this constraint in the Contact deletion flow.
- **`onDelete: SetNull` on `recipientUserId`** — if a recipient account is deleted, the share record remains with `recipientUserId: null`. This is safe for VCARD_LINK (no recipient), but for account shares it creates orphaned records. Add a cleanup job or handle this in the account deletion flow.
- **`contactSnapshot` JSON size** — contacts with many phone numbers, email addresses, and addresses can produce large JSON. Set a reasonable payload cap (e.g. 64KB) and validate at insertion time. Reject or truncate oversized snapshots rather than letting them grow unbounded.
- **`recipientEmail` linkage at registration** — the registration flow must actively query for pending shares matching the new account email. If this query is missed, pending invites will never be delivered. Add a test specifically covering the registration path.
- **Token entropy** — `crypto.randomBytes(24).toString('base64url')` produces 192 bits of randomness, which is sufficient. Do not reduce entropy to make tokens "prettier" or shorter. The token is not user-facing in a way that requires memorability.
- **Circular share prevention** — `ContactShare` schema allows A to share contact X to B and B to later share contact Y (which is their copy of X) to A as a `LIVE_SYNC`. This creates a logical loop that P12-04 must detect and reject at the application layer. The schema cannot enforce this — it is an application concern.

---

## Outcome

The `ContactShare` model is migrated, typed, and stable, providing the complete data foundation on which all Phase 12 sharing modes can be built without schema changes.
