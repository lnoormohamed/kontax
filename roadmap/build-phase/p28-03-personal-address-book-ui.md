# P28-03 — Personal Address Book Management UI

## Purpose

Allow users to create, rename, archive, and switch between personal address books, and move contacts between books. P18-11 added the `AddressBook` model and the default book — this ticket adds the user interface for managing books beyond the default.

## Background

The `AddressBook` model (P18-11) gives each user a personal namespace for their contacts. Currently, all contacts are in the default book and there is no UI to create additional books. Power users organise contacts across multiple books (Work, Personal, Family, Clients). This ticket adds the sidebar book section and the book management modal per the P28-DB09 design brief.

## Scope

**In scope:**
- "Books" section in the sidebar under "My Lists" — lists all personal books
- "New book" creation (name required, slug auto-generated)
- Book management modal: rename, archive, contact count, CardDAV slug display
- Move contacts between books: from the contact detail page action menu and from bulk select (P28-04)
- Active book filter: clicking a book in the sidebar filters the contacts list to that book
- Default book cannot be renamed or archived

**Out of scope:**
- Shared family/team books (Phase 13/14)
- CardDAV outbound book settings (P23-07 — separate ticket)

---

## Design / Implementation Spec

### Sidebar "Books" section

```tsx
function BooksSection({ books }: { books: AddressBook[] }) {
  return (
    <SidebarSection label="Books" action={{ label: "+ New book", onClick: openCreateModal }}>
      {books.map((book) => (
        <SidebarItem
          key={book.id}
          icon={<BookOpen size={14} />}
          label={book.name}
          badge={book._count.contacts.toString()}
          active={activeBookId === book.id}
          href={`/?bookId=${book.id}`}
          contextMenu={book.isDefault ? [] : [
            { label: "Rename", onClick: () => openRenameModal(book) },
            { label: "Manage", onClick: () => openManageModal(book) },
            { label: "Archive", onClick: () => openArchiveConfirm(book), destructive: true },
          ]}
        />
      ))}
    </SidebarSection>
  );
}
```

Default book: shown first, no context menu, no archive/rename option.

### "New book" modal

Simple name input:

```tsx
<Modal title="New address book" onClose={onClose}>
  <input
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder="e.g. Work, Personal, Clients"
    style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid #d8ddd6",
      padding: "0 16px", fontSize: 14 }}
    autoFocus
  />
  <ModalActions>
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button variant="primary" disabled={!name.trim()} onClick={handleCreate}>
      Create book
    </Button>
  </ModalActions>
</Modal>
```

`createAddressBook` server action:

```typescript
export async function createAddressBook(input: { name: string }): Promise<AddressBook> {
  const session = await auth();
  const slug = generateSlug(input.name); // "Work Contacts" → "work-contacts"

  return db.addressBook.create({
    data: {
      userId: session!.user!.id,
      name: input.name.trim(),
      slug,
      isDefault: false,
    },
  });
}
```

### Book management modal

Shows the book details with rename in-place, contact count, and the CardDAV slug:

```tsx
<Modal title={book.name} onClose={onClose}>
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 13, fontWeight: 500, color: "#5c655e" }}>Name</label>
    <EditableText
      value={bookName}
      onSave={(name) => renameAddressBook(book.id, name)}
    />
  </div>

  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 13, fontWeight: 500, color: "#5c655e" }}>Contacts</label>
    <p style={{ fontSize: 14, color: "#1d2823" }}>{book._count.contacts} contacts</p>
  </div>

  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 13, fontWeight: 500, color: "#5c655e" }}>
      CardDAV path <HelpTooltip content="Use this path when setting up a device connection" />
    </label>
    <CopyableCode value={`/dav/books/${book.slug}`} />
  </div>

  <div style={{ paddingTop: 16, borderTop: "1px solid #d8ddd6" }}>
    <Button variant="destructive" onClick={() => openArchiveConfirm(book)}>
      Archive this book
    </Button>
  </div>
</Modal>
```

### Move contacts between books

**From contact detail:** in the `…` menu on a contact detail page, add "Move to book →" which opens a popover with the user's books listed.

**From bulk edit (P28-04):** the "Move to book ▾" dropdown in the bulk edit toolbar moves all selected contacts.

`moveContactsToBook` server action:

```typescript
export async function moveContactsToBook(input: {
  contactIds: string[];
  targetBookId: string;
}): Promise<void> {
  const session = await auth();

  // Verify ownership of both contacts and target book
  await db.addressBook.findUniqueOrThrow({
    where: { id: input.targetBookId, userId: session!.user!.id },
  });

  await db.contact.updateMany({
    where: { id: { in: input.contactIds }, userId: session!.user!.id },
    data: { bookId: input.targetBookId },
  });
}
```

### Archive confirmation

```
Archive "Work"?
This book and its 84 contacts will be archived.
Archived contacts can be restored from the Archived view.

[Cancel]   [Archive book]   ← red
```

`archiveAddressBook` sets `addressBook.archivedAt` and sets all contacts in the book to `archivedAt = now()`.

---

## Acceptance Criteria

- "Books" section appears in the sidebar listing all non-archived personal books.
- Clicking a book applies a `bookId` filter to the contacts list.
- "New book" creates a book with the given name and an auto-generated slug.
- The management modal shows the contact count, rename input, and CardDAV path.
- Renaming updates `AddressBook.name` while preserving the slug (slug changes would break CardDAV links).
- Archiving a book archives the book and all its contacts.
- "Move to book" from contact detail and from bulk edit calls `moveContactsToBook`.
- The default book cannot be renamed or archived (context menu is empty; modal shows a "Default book" badge).
