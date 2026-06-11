# P28-04 — Bulk Edit

## Purpose

Allow users to select multiple contacts and apply a field value to all of them simultaneously: move to a book, add a label, set a company name, archive, or delete. The bulk select infrastructure (checkboxes, contextual bar) already exists in P16-04 — this ticket extends it with the edit actions.

## Background

P16-04 implemented bulk select with checkboxes and a contextual bar that shows "N selected" with Merge, Archive, and Delete actions. This ticket replaces that bar with the full bulk edit toolbar from P28-DB09 and adds the company and label actions. Merging is already in P10-05.

## Scope

**In scope:**
- Replace the P16-04 contextual bar with the P28-DB09 bulk edit toolbar (dark background, full action set)
- "Move to book ▾" dropdown — lists user's books; applies `moveContactsToBook` (P28-03)
- "Add label ▾" — tag input popover; adds a label to all selected contacts
- "Set company" — single text input popover; sets `Contact.company` on all selected
- "Archive" — with confirmation
- "Delete permanently" (overflow menu) — with strong confirmation ("This cannot be undone")
- "Export selection as CSV" (overflow menu) — exports selected contacts
- Keyboard shortcut: `Escape` clears selection

**Out of scope:**
- Bulk merge (P10-05 already handles this)
- Bulk field-by-field editing (single field at a time is sufficient for v1)

---

## Design / Implementation Spec

### Bulk edit toolbar

Rendered at the bottom of the contacts list area when `selectedContactIds.length > 0`:

```tsx
function BulkEditToolbar({ selectedIds, onClear }: {
  selectedIds: string[];
  onClear: () => void;
}) {
  return (
    <div style={{
      position: "sticky", bottom: 0,
      background: "#1d2823", color: "#ffffff",
      borderRadius: 14, padding: "0 20px",
      height: 56, display: "flex", alignItems: "center", gap: 8,
      margin: "0 16px 16px",
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, marginRight: "auto" }}>
        {selectedIds.length} contact{selectedIds.length !== 1 ? "s" : ""} selected
      </span>

      <button onClick={onClear} style={ghostBtnStyle}><X size={16} /></button>

      <BulkMoveToBookButton selectedIds={selectedIds} onDone={onClear} />
      <BulkAddLabelButton selectedIds={selectedIds} onDone={onClear} />
      <BulkSetCompanyButton selectedIds={selectedIds} onDone={onClear} />
      <BulkArchiveButton selectedIds={selectedIds} onDone={onClear} />

      <BulkOverflowMenu selectedIds={selectedIds} onDone={onClear} />
    </div>
  );
}
```

### "Move to book" dropdown

```tsx
function BulkMoveToBookButton({ selectedIds, onDone }: ...) {
  const [open, setOpen] = useState(false);
  const { books } = useAddressBooks();

  return (
    <Dropdown open={open} onOpenChange={setOpen} trigger={
      <GhostButton>Move to book <ChevronDown size={12} /></GhostButton>
    }>
      {books.map((book) => (
        <DropdownItem key={book.id} onClick={async () => {
          await moveContactsToBook({ contactIds: selectedIds, targetBookId: book.id });
          onDone();
          setOpen(false);
        }}>
          {book.name}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
```

### "Add label" popover

```tsx
function BulkAddLabelButton({ selectedIds, onDone }: ...) {
  const [label, setLabel] = useState("");

  return (
    <Popover trigger={<GhostButton>Add label <ChevronDown size={12} /></GhostButton>}>
      <div style={{ padding: 16, width: 220 }}>
        <p style={{ fontSize: 13, color: "#8b938c", marginBottom: 8 }}>
          Add a label to {selectedIds.length} contacts
        </p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. VIP, prospect"
          style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid #d8ddd6",
            padding: "0 10px", fontSize: 13 }}
          onKeyDown={(e) => e.key === "Enter" && handleAddLabel()}
        />
        <Button variant="primary" size="sm" onClick={handleAddLabel} style={{ marginTop: 8, width: "100%" }}>
          Add label
        </Button>
      </div>
    </Popover>
  );
}
```

`bulkAddLabel` server action:

```typescript
export async function bulkAddLabel(input: {
  contactIds: string[];
  label: string;
}): Promise<void> {
  const session = await auth();
  // Labels are stored in Contact.tags (String[] field)
  await db.contact.updateMany({
    where: { id: { in: input.contactIds }, userId: session!.user!.id },
    data: {
      tags: { push: input.label.trim() },
    },
  });
}
```

### "Set company" popover

```tsx
function BulkSetCompanyButton({ selectedIds, onDone }: ...) {
  const [company, setCompany] = useState("");

  // Same popover pattern as Add label
  // `bulkSetCompany` calls: db.contact.updateMany({ data: { company } })
}
```

### Archive action

```tsx
function BulkArchiveButton({ selectedIds, onDone }: ...) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return <GhostButton onClick={() => setConfirming(true)}>Archive</GhostButton>;
  }

  return (
    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "#fff" }}>
        Archive {selectedIds.length}?
      </span>
      <button onClick={async () => { await bulkArchive(selectedIds); onDone(); }}
        style={{ background: "#b5472f", color: "#fff", borderRadius: 8, padding: "4px 12px",
          fontSize: 13, fontWeight: 600 }}>
        Confirm
      </button>
      <button onClick={() => setConfirming(false)} style={ghostBtnStyle}>Cancel</button>
    </span>
  );
}
```

### Overflow menu

```tsx
<DropdownMenu trigger={<GhostButton><MoreHorizontal size={16} /></GhostButton>}>
  <DropdownItem onClick={handleExportCsv}>
    Export selection as CSV
  </DropdownItem>
  <DropdownSeparator />
  <DropdownItem destructive onClick={() => setShowDeleteConfirm(true)}>
    Delete permanently
  </DropdownItem>
</DropdownMenu>
```

Delete permanently confirmation: a modal (not inline) — "Delete {N} contacts permanently? This cannot be undone." with a red "Delete" button.

### Keyboard escape

```typescript
// In the contacts list page:
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && selectedContactIds.length > 0) {
      clearSelection();
    }
  };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [selectedContactIds.length]);
```

---

## Acceptance Criteria

- When 1+ contacts are selected, the dark bulk edit toolbar renders at the bottom of the list.
- "Move to book" dropdown lists all user books; selecting one moves all selected contacts.
- "Add label" popover adds the label to all selected contacts' `tags` array.
- "Set company" overwrites the `company` field on all selected contacts.
- "Archive" shows inline confirmation; confirmed archive sets `archivedAt` on all selected contacts.
- "Delete permanently" opens a modal with a strong warning; confirmed delete hard-deletes the contacts.
- "Export as CSV" downloads a CSV containing only the selected contacts.
- Pressing `Escape` clears the selection.
- The toolbar shows the correct count as the selection changes.
- All server actions verify that the requesting user owns all targeted contacts.
