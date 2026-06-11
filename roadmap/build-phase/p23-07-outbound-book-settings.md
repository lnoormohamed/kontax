# P23-07 — Outbound Kontax-as-Server Book Settings

## Purpose

When a user creates a new Kontax address book (Kontax acting as a CardDAV server, introduced in Phase 9), offer book-level sync scope at creation time: which of the user's personal address books should populate this outbound book, and whether it is read-only or writable for connected devices. This is the server-side counterpart to P23-03 (client-side book allowlist).

## Background

Phase 9 established Kontax as a CardDAV server. P18-11 added the `AddressBook` model — each user can have multiple personal address books, and Kontax exposes them via the CardDAV server URL. Currently, the Kontax CardDAV server exposes all of the user's contacts in a single default collection. This ticket adds per-book scope: a user can create an "iPhone" book that contains only their personal contacts, and a "Work" book that contains only contacts from their Work address book — each scoped independently and accessible via the device's native contacts app.

The design decision from the roadmap: the book creation flow may offer a subset of sync scope options at creation time since the book doesn't exist yet and the scope must be set before any device connects.

## Scope

**In scope:**
- `AddressBook.deviceWritable Boolean` — whether connected devices can create/edit contacts in this book, or read-only
- `AddressBook.sourceBookIds String[]` — which of the user's personal books to include in this Kontax CardDAV book; empty = all contacts
- Book creation form additions: writable toggle, source book selection
- Book edit panel: update `deviceWritable` and `sourceBookIds`
- Kontax CardDAV server respects `sourceBookIds` when building the REPORT response for a book

**Out of scope:**
- App password management (P9-02/P9-05)
- Creating new source books (P28-03)
- Sharing this book with family or team members (Phase 13/14)

---

## Design / Implementation Spec

### Schema change

```prisma
// On AddressBook model (P18-11):
deviceWritable   Boolean  @default(true)
sourceBookIds    String[] // IDs of source AddressBook rows to include; empty = all
```

Run: `prisma migrate dev --name add-address-book-device-settings`

### Book creation form additions

In the "Create address book" modal (or the device connections settings page), add:

```
Device access
─────────────────────────────────────────────────
○ Read and write   (connected devices can edit contacts)
● Read only        (connected devices see contacts but cannot change them)

Source contacts
─────────────────────────────────────────────────
☑ All my contacts  (default)
☐ Personal
☐ Work
☐ Family
```

- **Device access radio:** maps to `AddressBook.deviceWritable`. Default: `true` (read-write).
- **Source contacts:** list of the user's existing `AddressBook` rows. Selecting specific books sets `sourceBookIds`. Selecting "All my contacts" clears `sourceBookIds` (empty = all).

### CardDAV server respects `sourceBookIds`

In `src/app/dav/[...path]/route.ts` (or the CardDAV server handler), when responding to a `REPORT` or `PROPFIND` for a specific address book collection:

```typescript
const addressBook = await db.addressBook.findUniqueOrThrow({
  where: { id: addressBookId },
  select: { sourceBookIds: true, deviceWritable: true },
});

// Filter contacts to those in the source books
const contacts = await db.contact.findMany({
  where: {
    userId,
    archivedAt: null,
    ...(addressBook.sourceBookIds.length > 0
      ? { bookId: { in: addressBook.sourceBookIds } }
      : {}),
  },
});
```

For write operations (`PUT`, `DELETE`) — check `deviceWritable`:

```typescript
if (!addressBook.deviceWritable) {
  return new Response(null, { status: 403, statusText: "Read-only address book" });
}
```

Return a `DAV:read-only` property in the PROPFIND response for read-only books so compliant clients (iOS, macOS) display the book as non-editable.

### Book edit panel

In Settings → Devices & app passwords, each address book card gets an "Edit" action that opens the same form above, pre-populated with the current values.

---

## Acceptance Criteria

- `AddressBook.deviceWritable` and `sourceBookIds` fields exist; migration applied.
- When `deviceWritable = false`, the CardDAV server returns 403 for `PUT` and `DELETE` on that book's contacts.
- When `sourceBookIds` is non-empty, the CardDAV REPORT only includes contacts from those source books.
- When `sourceBookIds` is empty, all of the user's contacts are included (preserving current behaviour).
- The book creation form includes the writable toggle and source book selector.
- The book edit form saves changes correctly and the CardDAV server reflects them on the next request.

---

## Risks and Open Questions

- **iOS behaviour with read-only books:** iOS Contacts shows a lock icon for read-only CardDAV accounts and prevents the user from editing. Verify this works correctly by testing on real iOS hardware after this ticket ships (extend P9-07's device testing checklist).
- **Source book scope and sync direction:** if a user also has a CardDAV sync account (outbound, P23-04) pulling contacts into one of the source books, changes from that sync will automatically appear in the Kontax-as-server book the next time a device syncs. Document this relationship in the settings UI so users understand the data flow.
- **Empty source book edge case:** if a user selects a source book that contains zero contacts, the resulting Kontax CardDAV book will also be empty. The UI should show the contact count per source book to help users make informed selections.
