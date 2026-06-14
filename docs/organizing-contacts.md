# Organizing contacts: books, shared books, lists & labels

Kontax gives users four ways to organize contacts. They look similar in the
sidebar but are fundamentally different primitives. This doc defines each one,
how they differ, and when to use which — for both product decisions and so the
code stays consistent.

The one question that separates them: **how does a contact come to be "in" it?**

| Primitive       | How membership works            | Contacts per item | A contact can be in… | Owned by        | Kind        |
| --------------- | ------------------------------- | ----------------- | -------------------- | --------------- | ----------- |
| **Book**        | You assign it (it lives there)  | many              | exactly **1** book   | the user        | container   |
| **Shared book** | A group member adds a **copy**  | many              | 1 per group book     | the group       | container   |
| **List**        | **Computed** from a saved filter | dynamic           | any number / none    | the user        | saved view  |
| **Label**       | You tag it                      | many              | any number of labels | the user        | tag         |

---

## Book (personal address book)

**What it is.** A book is a *container* that partitions a user's own contacts —
"Work", "Personal", "Clients". Every personal contact lives in **exactly one**
book; there's a **Default** book that also owns contacts that haven't been filed
anywhere (`bookId = null` rolls into Default).

**Data model.** `AddressBook` (one row per book) + `Contact.bookId` (the contact's
single book). Each book has a URL-safe `slug` used in **CardDAV** paths
(`/dav/books/<slug>`) and a `deviceWritable` flag. The Default book has
`isDefault = true` and cannot be renamed or archived.

**Behavior.**
- Moving a contact between books is a reassignment of `bookId` — it leaves one
  book and joins another. It's never in two books at once.
- Books map to CardDAV collections, so connected devices (iPhone, Thunderbird)
  can subscribe to a specific book. The `slug` is **stable on rename** so those
  subscriptions don't break.
- Archiving a book archives its contacts too.

**Use it when** the user wants a hard partition that also syncs to their devices
as a distinct address book — e.g. keep "Work" and "Personal" as separate
collections on their phone.

**Status:** shipped (P18-11 model, P28-03 UI). [[P28-03]]

---

## Shared book (group / family / team book)

**What it is.** A book **owned by a group** (a family or a team), whose members
collaborate on a shared set of contacts. It behaves like a book but the contents
are visible to and (depending on role) editable by everyone in the group.

**Data model.** A *different* model — `GroupAddressBook` (owned by a `Group`) +
`GroupContact` (links a `Contact` into the shared book). Access is gated by
`GroupMember`, **not** by `Contact.userId`. Adding a contact to a shared book
creates a **new Contact + GroupContact** — a **copy**, not a move; the original
stays in the user's personal book.

**Behavior.**
- Renders in its **own "Shared" sidebar section**, grouped by family/team — kept
  separate from personal books on purpose, so it's always obvious a contact is
  visible to other people (a privacy boundary). A member sees shared books as
  **read-only** in their own list; managing them happens in the group surface.
- Because membership is a copy, edits to the personal original and the shared
  copy are independent unless explicitly synced (Phase 13).

**Use it when** multiple people need the same contacts — a family's shared
contacts, a team directory. **Not** for a single user's own partitioning (that's
a Book).

**Status:** shipped (Phase 13/14; surfaced in the P28-03 sidebar). [[P28-03]]

> **Why books and shared books are separate primitives:** they have different
> ownership and permission models (`AddressBook.userId` vs `GroupMember`), and
> dropping a contact into a *shared* book exposes it to other people. The
> separate sidebar section and the copy-not-move semantics exist to make that
> boundary impossible to miss.

---

## List (smart list / saved filter)

**What it is.** A **saved view**, not a container. A list is a named, persisted
filter (e.g. "VCs in NYC" = `tag:VC city:"New York"`). Its membership is
**computed every time** by re-running the filter — no contact is ever "put into"
a list, and a contact can match many lists or none.

**Data model.** `SavedFilter` with a JSON `filterState` (the contacts-list URL
params: `tab / filter / q / book / scope`). Clicking a list just navigates to
`/contacts?<that filter>`. Renaming, duplicating, deleting a list **never touches
any contact** — only the saved shortcut.

**Behavior.**
- Zero-cost: creating/deleting a list has no effect on contact data.
- Always live: a contact that newly matches the filter appears automatically;
  one that stops matching disappears. There's no membership to maintain.
- Reorderable, with `1`–`9` keyboard shortcuts to switch between the first nine.

**Use it when** the user repeatedly reconstructs the same filter combination and
wants one-click recall. It answers "show me everyone who *currently* matches X",
not "this specific set of people".

**Status:** shipped (P28-01 UI, P28-02 schema). [[P28-01]] [[P28-02]]

---

## Label (tag)

**What it is.** A lightweight, **many-to-many tag** on a contact — "VIP",
"Investor", "Newsletter". A contact can carry any number of labels, and labels
cut across books (a "VIP" can live in any book).

**Data model.** `Contact.labels` — a JSON array of strings on the contact itself.
No separate Label table; labels exist by being used.

**Behavior.**
- Attached at create time (contact form) and in bulk (the bulk-edit toolbar's
  "Add label", which de-dupes case-insensitively). [[P28-04]]
- Cross-cutting: applying/removing a label only edits that contact's tag array;
  it doesn't move or copy anything.

**Use it when** the user wants flexible, overlapping classification that a single
exclusive book can't express — the same contact being both "Investor" and "VIP".

**Status:** **partially built.** The data layer (attach at create, bulk add) is
live, but there is **no browse/filter-by-label UI yet** — the sidebar "Labels"
section is a hardcoded placeholder, and no `label=` filter exists on the contacts
list. Filtering by label is the missing piece. (A future smart list *could* one
day filter on a label, which is exactly why labels and lists are different
layers: labels are the *data*, lists are *saved queries over* that data.)

---

## Choosing between them

- **One home that syncs to my devices →** Book.
- **Same contacts shared with other people →** Shared book.
- **A filter I keep re-typing →** List.
- **Overlapping tags on a contact →** Label.

A useful mental model:

- **Books** (personal + shared) are *where a contact lives* — exclusive, one home.
- **Labels** are *what a contact is* — many, overlapping, descriptive.
- **Lists** are *a question you ask* — computed, owning nothing.

The cleanest end state is **labels as the cross-cutting data layer** and **lists
as saved queries** (including queries over labels and books), with **books** as
the exclusive, sync-backed home for each contact.
