# P37 · Part 1 — The Data Model (Build Now)

**Status:** Ticketed as **[Phase 40](../build-phase/phase-40.md)** (2026-07-02) — this doc remains the authoritative spec. This is the foundation every later path
(CardDAV projection, native apps, open standard) sits on top of. It does not depend
on any of them, and none of them can begin without it.

**Decision needed before ticketing:** confirm the schema shape, the migration
strategy for `Contact.bookId`, and the V1 scope cuts flagged at the end.

---

## 1. Why this is the foundation

Today a contact belongs to exactly one book (`Contact.bookId`, nullable). That single
fact blocks every feature we've discussed:

- A contact can't be in both Personal and Work.
- A work-colleague-who-is-also-a-friend has to be duplicated.
- Sync connections can't be scoped to a book without duplication.
- Shared-book privacy has nowhere to live.

P37 replaces the one-book assumption with a **multi-book membership model** and a
**field-level privacy layer**. Once those two exist, CardDAV projection and native
apps are just consumers of the same model.

The mental model we're committing to:

> **Books = where a contact lives. Labels = what it is. Lists = how you look at them.**
> A contact is one row. It appears in many books. Some of its fields are shared with
> shared-book members; some stay private.

---

## 2. Core concepts and where each lives

| Concept | What it is | Source of truth | New / existing |
|---|---|---|---|
| **Book (personal)** | A container a contact lives in. Maps to sync destinations. | `AddressBook` | Exists |
| **Book (shared)** | A Family/Team container. | `GroupAddressBook` | Exists |
| **Book membership** | Which books a contact belongs to. | `ContactBookMembership` | **New** |
| **Shared field layer** | Contact data visible to shared-book members. | `Contact` row | Exists |
| **Private field layer** | Data visible only to the owner. | `ContactPrivateField` | **New** |
| **Sharing policy** | Per-member rule: which field types are shared into a shared book. | `GroupMember.sharingPolicy` | **New (field)** |
| **Label** | Cross-cutting tag. | `Contact.labels[]` + `Label` registry | Exists |
| **List (smart list)** | Saved filter / dynamic view. | `SavedFilter.filterState` | Exists |

---

## 3. Schema changes

### 3.1 New — `ContactBookMembership` (replaces `Contact.bookId`)

```prisma
model ContactBookMembership {
  id            String      @id @default(cuid())
  contactId     String
  addressBookId String      // personal AddressBook only (shared books use GroupContact)
  isPrimary     Boolean     @default(false) // the contact's "home" book; exactly one true per contact
  createdAt     DateTime    @default(now())

  contact     Contact     @relation(fields: [contactId], references: [id], onDelete: Cascade)
  addressBook AddressBook @relation(fields: [addressBookId], references: [id], onDelete: Cascade)

  @@unique([contactId, addressBookId])
  @@index([addressBookId])
  @@index([contactId])
}
```

**Rules:**
- Every contact has **at least one** membership at all times (enforced in application
  logic — Prisma can't express "≥1 child").
- Exactly one membership per contact has `isPrimary = true`. The primary book is the
  default destination for sync write-back and the contact's "home" for display.
- Deleting the last membership is forbidden; deleting a contact cascades memberships.

### 3.2 New — `ContactPrivateField` (the private layer)

```prisma
model ContactPrivateField {
  id        String   @id @default(cuid())
  contactId String
  userId    String   // the owner; one private layer per (contact, user)
  fieldType String   // "PHONE" | "EMAIL" | "ADDRESS" | "NOTE" | "BIRTHDAY" | "LABEL" | "CUSTOM"
  label     String?  // e.g. "home", "personal"
  value     Json     // same entry shape as the matching Contact JSON field
  position  Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([contactId, userId])
}
```

**Rules:**
- A field on the `Contact` row is the **shared layer**. A `ContactPrivateField` row is
  the **private layer**. They never collide — a value is in exactly one layer.
- "Make a field private" = move the value from the `Contact` row into a
  `ContactPrivateField` row and clear it on the shared row.
- "Make a field shared" = the reverse.
- Multiple members can each hold their own private fields on the **same** contact —
  scoped by `userId`.

### 3.3 New field — `GroupMember.sharingPolicy`

```prisma
// On the existing GroupMember model:
sharingPolicy Json?  // per-field-type share flags; null = use book/plan default
```

Shape (illustrative):

```json
{
  "name": true, "company": true, "jobTitle": true,
  "workEmail": true, "workPhone": true,
  "personalEmail": false, "personalPhone": false,
  "homeAddress": false, "birthday": false,
  "notes": false, "labels": false, "customFields": false
}
```

- Set once when a member **creates or joins** a shared book (not per-edit).
- Each member controls their own policy within the same book.
- `null` falls back to the default policy (work fields shared, personal fields private —
  see §5).

### 3.4 New field — `GroupAddressBook.minimumSharingPolicy` (Teams only)

```prisma
minimumSharingPolicy Json?  // admin-set floor; members may restrict further, not loosen
```

- Teams admins can require a minimum (e.g. work email + phone always shared).
- A member's effective policy = `max(minimumSharingPolicy, sharingPolicy)` per field
  (a field the admin forces shared cannot be made private by the member).
- Family books leave this `null`.

### 3.5 New field — `SyncAccount.destinationBookId`

```prisma
destinationBookId String?  // personal AddressBook the sync writes into; null = primary/default book
```

- Scopes a personal sync connection to one book. Null preserves current behaviour
  (writes to the default book) for backwards compatibility.
- This is the seam that Part 2 (CardDAV projection) builds on. We add the **column**
  in P37 even though the projection *logic* ships in Part 2 — so the data model is
  complete and the migration happens once.

### 3.6 Deprecate — `Contact.bookId`

- Kept during migration, then removed in a follow-up cleanup ticket once all reads go
  through `ContactBookMembership`.

---

## 4. Migration plan

Order matters — this is a live DB on staging and prod (schema currently identical).

1. **Add new tables + columns** (`ContactBookMembership`, `ContactPrivateField`,
   `sharingPolicy`, `minimumSharingPolicy`, `destinationBookId`). All nullable /
   additive — no data loss, deployable independently.
2. **Backfill `ContactBookMembership`:** for every existing contact, create one
   membership row from its current `bookId` (or the user's default book if null),
   `isPrimary = true`.
3. **Seed default books:** ensure every user has **Personal** (`slug: "personal"`) and
   **Work** (`slug: "work"`) books. Existing default book maps to Personal. New users
   get both at account creation.
4. **Cut over reads:** migrate every query that filters by `Contact.bookId` to join
   through `ContactBookMembership` (see §6 for the blast radius).
5. **Cut over writes:** contact create/edit, import, and sync write memberships.
6. **Remove `Contact.bookId`** in a final cleanup ticket once §4–5 are verified in prod.

> Per [`project_db-and-verification-workflow`]: use `prisma db push`, never
> `--accept-data-loss` blindly. The backfill (step 2) must run **before** any code
> reads memberships, or contacts vanish from the UI. Deploy runs `db push` on startup —
> a half-applied migration crash-loops the site, so steps 1–2 ship together and ahead
> of the read cutover.

---

## 5. Default sharing policy (the "no prompt on every edit" rule)

Privacy is decided **once** at book join/create, then applied silently. Defaults by
field type:

| Field type | Default in a shared book |
|---|---|
| Name, company, job title | **Shared** |
| Work email, work phone | **Shared** |
| Personal email, personal phone | **Private** |
| Home address | **Private** |
| Birthday | **Private** |
| Notes | **Private** |
| Labels | **Private** |
| Custom fields | **Private** |

The **label on a field entry** drives the default — a phone tagged "work" defaults
shared, one tagged "home" defaults private. The member can override any of these in
their policy (subject to a Teams admin minimum).

---

## 6. Edit-context resolution rules

Where an edit happens determines which layer it writes to. No per-edit prompts.

| Edit origin | Behaviour |
|---|---|
| Personal book context (Personal/Work) | Policy applies. Private fields → private layer; shared fields → shared row. |
| **Shared book context** (navigate Shared Book → contact, edit there) | Explicit intent to share. Writes to the shared row regardless of default policy. |
| Personal sync connection inbound | Policy applies — private fields stay private, never propagate to shared books. |
| Shared-book sync inbound | Writes to the shared row only. |

**Conflict rule:** shared-book edits are authoritative for shared fields; personal
sync is authoritative for private fields. The two layers can't conflict because a
value lives in exactly one layer.

---

## 7. Labels and lists under the new model

- **Labels stay user-global.** "Work + VIP" is a *query* (book filter + label filter),
  not a new entity. No per-book label duplication.
- **Label privacy:** a label is a field type in the sharing policy. Default **private**
  — your "VIP" tag is yours, not the group's.
- **Lists adapt for free.** `SavedFilter.filterState` is JSON, so adding `bookIds: [...]`
  needs **no schema change**. A list can be "All Work contacts tagged Client".
- **Shared labels (`GroupLabel`) and shared lists are explicitly out of V1 scope** —
  see §9.

---

## 8. The sidebar / navigation consequence

Books become first-class navigation. Proposed structure:

```
All Contacts
├── Personal            (book)
├── Work                (book)
├── Work Team           (shared book)
└── Family              (shared book)

LABELS
├── VIP   ├── Client   └── Plumber

LISTS
├── Recently added   └── Missing email
```

Books = containers (navigation). Labels and lists = filters applied within the current
book context. This is a meaningful nav redesign and warrants its own design brief
(reference: existing [`06-settings`] and [`01-contacts-list`] briefs for the current
sidebar).

---

## 9. V1 scope cuts (recommended — confirm before ticketing)

Keep P37 to the **core model** so it ships and proves out. Defer:

| Deferred to fast-follow | Why |
|---|---|
| `GroupLabel` (group-wide shared labels) | Core multi-book + privacy must settle first. |
| Shared lists (`SavedFilter.groupId`) | Same. |
| Per-field override on top of policy | Policy-level covers 90%; granular later if demanded. |
| Native apps / proprietary protocol | Strategic R&D — see Part 3. |
| Open standard | Positioning decision — see Part 4. |

In scope for P37: `ContactBookMembership`, `ContactPrivateField`,
`GroupMember.sharingPolicy`, `GroupAddressBook.minimumSharingPolicy`,
`SyncAccount.destinationBookId`, the migration + backfill, default-book seeding,
read/write cutover, and the sidebar redesign.

---

## 10. Open decisions for you

1. **`Contact.bookId` removal** — same phase as the cutover, or a separate cleanup
   phase after a prod soak period? (Recommend: separate, after soak.)
2. **Default books naming** — "Personal" + "Work", or let users rename freely from day
   one? (Recommend: seed those two names, fully renameable.)
3. **Teams minimum policy** — ship `minimumSharingPolicy` in P37, or defer admin
   enforcement to the Teams hardening phase? (Recommend: ship the column, defer the
   admin UI if time-constrained.)
4. **Sidebar redesign** — fold into P37, or a parallel design-brief ticket? (Recommend:
   parallel brief, implemented within P37.)

---

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (books, privacy in shared books)
- [ ] Internal · engineering — `docs/` concept doc: "books vs lists vs labels" + privacy layers
- [ ] Internal · admins/ops — runbook: backfill + rollback procedure

[`project_db-and-verification-workflow`]: ../../.claude/... (memory)
[`06-settings`]: ../design-briefs/06-settings.md
[`01-contacts-list`]: ../design-briefs/01-contacts-list.md
