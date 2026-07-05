# Runbook: P40 contact book-membership backfill

**Subsystem:** Multi-book contact model (Phase 40) — `ContactBookMembership` backfill
**Audience:** Engineers running the P40 migration on staging/prod

---

## Overview

Phase 40 moves contacts from single-book ownership (`Contact.bookId`) to a
membership model (`ContactBookMembership`). The schema is additive and already
deployed (P40-01…04). This runbook covers the one-off **backfill** that creates
one membership row per existing contact, and how to roll it back.

The backfill is **additive and idempotent**: it never writes `Contact.bookId`,
never deletes memberships, and skips rows that already exist. `Contact.bookId`
stays populated through the soak — it is the rollback anchor and the source of
truth until the P40-06 read cutover.

**Script:** `scripts/backfill-contact-book-memberships.mjs`
(`npm run backfill:book-memberships`)

---

## Ordering (critical)

```
1. Deploy the additive schema (P40-01…04)         ← already shipped
2. npm run migrate:books        (P18-11 default books — ensures every
                                 contact has a bookId; safe to re-run)
3. npm run backfill:book-memberships   ← THIS runbook
4. ...later: P40-06 read/write cutover (reads switch to memberships)
```

- Run step 2 **before** step 3: the backfill will not invent a book. A contact
  with `bookId = null` and no default book is **skipped and reported**, not
  fixed. If the final summary reports any skips, run `migrate:books` and re-run.
- Run step 3 **before** the P40-06 read cutover. Once reads come from
  memberships, a contact with no membership row disappears from lists.

> Deploy safety: the app runs `prisma db push` on startup (see
> [deploy.md](deploy.md)). This backfill is a **manual** script — it is not part
> of startup and does not touch the schema.

---

## Running the backfill

Dry run first (reports the would-create count, writes nothing):

```bash
npm run backfill:book-memberships -- --dry-run
```

Apply:

```bash
npm run backfill:book-memberships
```

Expected output ends with:

```
Done. Contacts scanned: N. Memberships created: N. Skipped (no book): 0.
```

### Verification

```sql
-- Every contact should have a membership; expect 0 rows.
SELECT c.id
FROM "Contact" c
LEFT JOIN "ContactBookMembership" m ON m."contactId" = c.id
WHERE m.id IS NULL;

-- Each membership should match the contact's current bookId; expect 0 rows.
SELECT m.id
FROM "ContactBookMembership" m
JOIN "Contact" c ON c.id = m."contactId"
WHERE c."bookId" IS NOT NULL AND c."bookId" <> m."addressBookId";

-- Exactly one primary per contact; expect 0 rows.
SELECT "contactId", COUNT(*) FILTER (WHERE "isPrimary")
FROM "ContactBookMembership"
GROUP BY "contactId"
HAVING COUNT(*) FILTER (WHERE "isPrimary") <> 1;
```

Re-running the script must report `0` newly created memberships (idempotent).

---

## Rollback

The backfill only inserts `ContactBookMembership` rows and changes nothing else,
so rollback is a truncate of what it wrote. `Contact.bookId` is untouched and
remains the source of truth until the P40-06 cutover, so removing memberships is
non-destructive while reads still come from `bookId`.

```sql
-- Full rollback: remove all backfilled memberships.
TRUNCATE TABLE "ContactBookMembership";
```

If the cutover (P40-06) has already shipped, do **not** truncate — reads now
depend on memberships. Roll back the cutover deploy first, then this.

There is no schema rollback in this runbook: the P40 tables/columns are additive
and harmless when unused. Column removal is a separate post-soak cleanup phase.

---

## New accounts

New signups seed a **Personal** (default) + **Work** book pair at registration
(`seedDefaultBooksForNewUser`, `src/server/address-books.ts`). This is
new-accounts-only — existing accounts keep their books exactly as named and are
never given a book they did not create. The backfill above does not create books.
