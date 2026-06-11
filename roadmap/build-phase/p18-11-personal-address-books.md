# P18-11 — Personal Address Books

## Purpose

Introduce a first-class `AddressBook` model that gives every user a named, stable container for their contacts. In v1 each user has one default book — functionally identical to today's flat contact pool — but the model exists and carries a stable slug used in CardDAV URLs. This unlocks two things downstream:

1. **Family group dissolution (Phase 13):** when a shared `GroupAddressBook` dissolves, each member receives a personal `AddressBook` that is their own private copy. No tag needed, no export step — the book simply becomes non-shared. The `sourceGroupBookId` field preserves the link so that if the user re-subscribes to Family later, the system can find their former group book's contacts and offer to re-promote them.

2. **CardDAV sync continuity:** the book's slug is stable and appears in the CardDAV URL. A device that has synced `/dav/addressbooks/{userId}/default/` continues working without reconfiguration after this change. When a user's group book dissolves into a personal book and they later re-subscribe, the new shared book uses the same slug — devices reconnect and resume from their cached ETags rather than re-downloading everything.

P9-01 explicitly anticipated this: *"If multiple address books are introduced later, this becomes `/dav/addressbooks/{userId}/{bookSlug}/`. The migration path should be noted so future engineers do not assume `default` is a reserved word."* This ticket is that migration.

## Background

The current schema has:
- `Contact` — flat, owned by `userId`, no book grouping
- `GroupAddressBook` — shared books for Family/Teams groups (Phase 11 scaffolding)
- CardDAV server hardcodes `/dav/addressbooks/{userId}/default/` (P9-01 through P9-04)

There are no personal books. Contacts are an undifferentiated pool per user. This ticket adds the model layer without changing any product behaviour for existing users — the migration creates a default book for every user and assigns all their contacts to it. The CardDAV URL changes from `default` (hardcoded) to `{slug}` (dynamic), but the default book's slug is `"default"` so existing device connections are unaffected.

## Scope

**In scope:**
- `AddressBook` Prisma model
- `Contact.bookId` FK (nullable for safe migration, backfilled)
- `GroupAddressBook.dissolvedToBookId` — records the personal `AddressBook` created for the owner when a group book dissolves (Phase 13 sets this field; this ticket defines it)
- Data migration: create default `AddressBook` for every existing user; backfill `Contact.bookId`
- CardDAV URL handlers updated from hardcoded `default` to dynamic `{bookSlug}`
- CTag derivation updated to be per-book
- `getUserDefaultBook(userId)` utility function

**Out of scope:**
- UI for creating, renaming, or managing personal books (future phase)
- Multiple personal books per user (the model supports it; the product surface does not yet)
- The Family dissolution flow that populates `sourceGroupBookId` (Phase 13 owns this)
- Sharing a personal book (GroupAddressBook handles shared books; personal books are private)

---

## Design / Implementation Spec

### Schema changes

#### New model: `AddressBook`

Add to `prisma/schema.prisma`:

```prisma
model AddressBook {
    id                String    @id @default(cuid())
    userId            String
    name              String
    slug              String
    description       String?
    isDefault         Boolean   @default(false)
    // Set by Phase 13 when a GroupAddressBook dissolves into this personal book.
    // Preserved so re-subscription can locate former shared-book contacts.
    sourceGroupBookId String?
    archivedAt        DateTime?
    createdAt         DateTime  @default(now())
    updatedAt         DateTime  @updatedAt

    user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
    contacts Contact[]

    @@unique([userId, slug])
    @@index([userId, isDefault])
    @@index([userId, archivedAt])
}
```

Add to `User` model:
```prisma
addressBooks AddressBook[]
```

**Field notes:**
- `slug`: used directly in the CardDAV URL path segment. URL-safe characters only (lowercase alphanumeric + hyphens). The default book slug is `"default"`. Future personal books use a slug derived from their name (slugified) with a numeric suffix if a collision exists (e.g. `"work"`, `"work-2"`).
- `isDefault`: exactly one `AddressBook` per user has `isDefault = true`. This is the book contacts are created in when no book is specified.
- `sourceGroupBookId`: not a FK — references `GroupAddressBook.id` but stored as a plain string to avoid a circular dependency between models and to survive the group book being archived. Phase 13 writes this field; this ticket only defines it.
- `archivedAt`: personal books can be archived (hidden from the default view). The default book cannot be archived.

#### Update `Contact` model

Add to `Contact`:

```prisma
bookId String?
book   AddressBook? @relation(fields: [bookId], references: [id], onDelete: SetNull)

@@index([bookId, archivedAt, fullName])
```

`bookId` is nullable for safe migration. Once the backfill migration runs, all existing contacts will have `bookId` set. A follow-up migration can make it non-nullable, but that is not in scope for this ticket — enforce non-null at the application layer instead.

`onDelete: SetNull` — if a personal book is deleted, its contacts have `bookId` set to null and fall back to the user's default book (application layer resolves null → default book).

#### Update `GroupAddressBook` model

Add one field:

```prisma
dissolvedToBookId String? // AddressBook.id of the personal book created for the owner on dissolution
```

Phase 13 writes this when it dissolves a group book. Not a FK for the same reason as `sourceGroupBookId` above.

Run: `prisma migrate dev --name add-address-books`

### Data migration

After the schema migration, run a data migration to create a default `AddressBook` for every existing user and backfill `Contact.bookId`:

```typescript
// scripts/migrate-default-address-books.mjs
// Run once after the schema migration is applied.

const users = await db.user.findMany({ select: { id: true } });

for (const user of users) {
  const book = await db.addressBook.upsert({
    where: { userId_slug: { userId: user.id, slug: "default" } },
    update: {},
    create: {
      userId: user.id,
      name: "All Contacts",
      slug: "default",
      isDefault: true,
    },
  });

  await db.contact.updateMany({
    where: { userId: user.id, bookId: null },
    data: { bookId: book.id },
  });
}
```

This script is idempotent — safe to re-run. It will not overwrite existing `bookId` values.

Add to `package.json`:
```json
"migrate:books": "node scripts/migrate-default-address-books.mjs"
```

### Utility: `getUserDefaultBook`

In `src/server/address-books.ts`:

```typescript
export async function getUserDefaultBook(userId: string): Promise<AddressBook> {
  const book = await db.addressBook.findFirst({
    where: { userId, isDefault: true },
  });
  if (book) return book;

  // Fallback: create the default book if it doesn't exist yet.
  // This covers the window between user creation and the migration script running.
  return db.addressBook.create({
    data: { userId, name: "All Contacts", slug: "default", isDefault: true },
  });
}
```

All server actions that create contacts must call `getUserDefaultBook(userId)` and set `Contact.bookId` if not explicitly provided.

### CardDAV URL update

P9-01 and P9-04 hardcode `default` in the address book URL path segment. Update the route handler structure to use a dynamic `[bookSlug]` segment:

**Current route structure (`src/app/dav/addressbooks/[userId]/`):**
```
default/
  route.ts        ← PROPFIND, REPORT
  [uid]/
    route.ts      ← GET, PUT, DELETE
```

**New route structure:**
```
[bookSlug]/
  route.ts        ← PROPFIND, REPORT
  [uid]/
    route.ts      ← GET, PUT, DELETE
```

In the route handlers, resolve the address book:

```typescript
const book = await db.addressBook.findUnique({
  where: { userId_slug: { userId, slug: bookSlug } },
});
if (!book || book.archivedAt) {
  return new Response("Not Found", { status: 404 });
}
```

**Contact queries within the book** — all REPORT and individual GET/PUT/DELETE handlers must add `bookId = book.id` to their Prisma queries. Contacts from other books are not visible through this book's CardDAV URL.

**PROPFIND on `/dav/addressbooks/{userId}/`** — the Depth:1 response now lists all of the user's non-archived books (not just `default`). Each book appears as a separate collection. In v1 this still returns only one book per user (the default), but the response is generated dynamically rather than hardcoded.

### CTag update

The current CTag derivation uses the most recent `Contact.updatedAt` across all the user's contacts. Update it to be scoped per book:

```typescript
// Before (global):
const { updatedAt } = await db.contact.findFirst({
  where: { userId, archivedAt: null, syncTombstoneAt: null },
  orderBy: { updatedAt: "desc" },
  select: { updatedAt: true },
}) ?? { updatedAt: new Date(0) };

// After (per-book):
const { updatedAt } = await db.contact.findFirst({
  where: { bookId: book.id, archivedAt: null, syncTombstoneAt: null },
  orderBy: { updatedAt: "desc" },
  select: { updatedAt: true },
}) ?? { updatedAt: new Date(0) };
```

This is a correctness fix as much as a feature change: if a user has contacts in multiple books, a change to book A should not invalidate the CTag for book B.

---

## How Phase 13 uses this (reference for Phase 13 engineers)

When a Family group dissolves and each member receives a personal copy of the shared book:

1. For each member, create a new `AddressBook`:
   ```typescript
   const personalBook = await db.addressBook.create({
     data: {
       userId: member.userId,
       name: group.name,           // e.g. "Smith Family"
       slug: slugify(group.name),  // e.g. "smith-family"
       isDefault: false,
       sourceGroupBookId: groupAddressBook.id,
     },
   });
   ```
2. Copy all shared contacts from the `GroupAddressBook` into the member's personal library with `bookId = personalBook.id`.
3. Set `groupAddressBook.dissolvedToBookId = personalBook.id` on the owner's copy (for re-subscription lookup).

When the user later re-subscribes to Family and creates a new group:
1. Check `db.addressBook.findFirst({ where: { userId, sourceGroupBookId: oldGroupBookId } })`.
2. If found, surface an option: *"We found contacts from your previous family group. Would you like to use them as the starting point for the new shared book?"*
3. The new `GroupAddressBook` is populated from the personal book's contacts. The personal book remains; the user can choose to archive it once the shared book is active.

---

## Acceptance Criteria

- `AddressBook` model exists in the schema with all fields above; migration applied.
- `Contact.bookId` FK exists; all existing contacts are backfilled to their user's default book via the migration script.
- `GroupAddressBook.dissolvedToBookId` field exists (written by Phase 13, not this ticket).
- Every existing user has exactly one `AddressBook` with `isDefault: true` and `slug: "default"` after the migration.
- All server actions that create contacts set `bookId` to the user's default book.
- CardDAV URL handlers use `[bookSlug]` dynamically; looking up `slug: "default"` returns the default book.
- Existing device connections using `/dav/addressbooks/{userId}/default/` continue to work without reconfiguration.
- A request for a non-existent or archived book slug returns 404.
- PROPFIND on `/dav/addressbooks/{userId}/` lists all non-archived books (currently one per user).
- CTag is derived per-book, not per-user.
- `getUserDefaultBook` creates the default book if it does not exist (handles new signups).
- Unit tests: default book creation, slug uniqueness, contact backfill idempotency, CardDAV 404 on missing slug.

---

## Risks and Open Questions

- **Slug collision on dissolution:** if a user already has a personal book with slug `"smith-family"` and a group book named "Smith Family" dissolves, the slug must be suffixed: `"smith-family-2"`. The slugify utility must handle this with a DB uniqueness check.
- **`bookId: null` contacts after migration:** between the schema migration and the backfill script running, new contacts created by the application will have `bookId: null` (the default server action path hits the `getUserDefaultBook` fallback). Old contacts from before the migration also start as null. The backfill script handles both, but there is a small window where null contacts exist. All queries that list contacts must handle `bookId: null` as equivalent to the default book until the non-null constraint is enforced.
- **Multiple personal books in the future:** this ticket deliberately limits the product surface to one book per user. The model supports more. When the UI for creating personal books is added (future phase), ensure the `isDefault` constraint is enforced (exactly one default per user) and that CardDAV PROPFIND correctly advertises all books.
- **`onDelete: SetNull` on bookId:** if a personal book is deleted, its contacts become `bookId: null` and fall back to the default book behaviour. This is safe. However, if the default book itself is deleted (which should be prevented at the application layer), the fallback path breaks. Enforce that `isDefault: true` books cannot be deleted — return an error if attempted.
- **Teams shared books:** `GroupAddressBook` is also used for Teams (Phase 14). The `dissolvedToBookId` field is only relevant for Family dissolution in Phase 13. Teams dissolution follows the same pattern (30-day read-only → archive) — Phase 14 may or may not use `dissolvedToBookId`. Leave it available but do not require it for Phase 14.
