# P28-01 — Smart Lists / Saved Filters

## Purpose

Let users save any combination of active filters as a named "smart list" that appears in the sidebar and can be recalled with one click. A user who frequently needs to see "VCs in New York" or "Contractors tagged enterprise" should not have to reconstruct the filter combination each session.

## Background

The Phase 16 contacts list (P16-01) encodes the active filter state as URL params (`?city=New+York&tag=VC`). Smart lists persist that URL param state as JSON in a `SavedFilter` row (P28-02 defines the schema). This ticket implements the creation flow, sidebar item, and the application of a saved filter when the user clicks it.

## Scope

**In scope:**
- "Save as list" button that appears in the filter bar when at least one filter is active
- "New list" creation modal — name input, filter summary
- Saved lists appear in the sidebar under "My Lists"
- Clicking a list applies its saved filter state (navigates to `/?{savedFilterState}`)
- Context menu on each list item: Rename, Duplicate, Delete
- Active list highlighted in the sidebar (URL state matches the list's filter state)

**Out of scope:**
- Smart list schema (P28-02 — separate ticket; this ticket depends on it)
- Mobile sidebar (lists shown in a "Lists" bottom sheet on mobile)

---

## Design / Implementation Spec

### "Save as list" button

In the contacts list filter bar (P16-01), when `activeFilterCount > 0`:

```tsx
// In the filter bar, after the filter chips:
<button
  onClick={() => setShowSaveListModal(true)}
  style={{
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 13, color: "#4158f4", fontWeight: 500,
    background: "none", border: "none", cursor: "pointer",
    padding: "0 8px",
  }}
>
  <Save size={14} />
  Save as list
</button>
```

### "Save as list" modal

```tsx
function SaveListModal({ filterState, onSave, onClose }: {
  filterState: ContactFilterState;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Modal title="Save this filter as a list" onClose={onClose}>
      <p style={{ fontSize: 13, color: "#5c655e", margin: "0 0 16px" }}>
        Saves the current filter:
      </p>
      <FilterSummaryChips filterState={filterState} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. VCs in NYC"
        style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid #d8ddd6",
          padding: "0 16px", fontSize: 14, marginTop: 16 }}
        autoFocus
      />
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!name.trim() || saving}
          onClick={async () => {
            setSaving(true);
            await onSave(name.trim());
            onClose();
          }}
        >
          Save list
        </Button>
      </ModalActions>
    </Modal>
  );
}
```

### Sidebar "My Lists" section

```tsx
// In the sidebar component (below the main nav items):
function SmartListsSection({ lists }: { lists: SavedFilter[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <SidebarSection label="My Lists" action={{ label: "+ New list", onClick: openCreateModal }}>
      {lists.length === 0 && (
        <p style={{ fontSize: 13, color: "#8b938c", padding: "8px 16px" }}>
          No lists yet. Apply a filter and save it.
        </p>
      )}
      {lists.map((list) => {
        const isActive = isFilterStateMatch(list.filterState, searchParams);
        return (
          <SidebarItem
            key={list.id}
            icon={<List size={14} />}
            label={list.name}
            active={isActive}
            href={`/?${serializeFilterState(list.filterState)}`}
            contextMenu={[
              { label: "Rename", onClick: () => openRenameModal(list) },
              { label: "Duplicate", onClick: () => duplicateList(list) },
              { label: "Delete", onClick: () => openDeleteConfirm(list), destructive: true },
            ]}
          />
        );
      })}
    </SidebarSection>
  );
}
```

### `isFilterStateMatch`

Compare the current URL params against a saved filter state:

```typescript
function isFilterStateMatch(
  saved: ContactFilterState,
  searchParams: ReadonlyURLSearchParams,
): boolean {
  const current = deserializeFilterState(searchParams);
  return JSON.stringify(normaliseFilterState(saved)) === JSON.stringify(normaliseFilterState(current));
}
```

`normaliseFilterState` sorts arrays and lowercases strings for stable comparison.

### Rename

Inline text input on double-click or via context menu. Saved on blur or Enter:

```typescript
export async function renameSavedFilter(id: string, name: string): Promise<void> {
  const session = await auth();
  await db.savedFilter.update({
    where: { id, userId: session!.user!.id },
    data: { name: name.trim() },
  });
}
```

### Duplicate

Creates a new `SavedFilter` with the same `filterState` and name "{name} (copy)":

```typescript
export async function duplicateSavedFilter(id: string): Promise<void> {
  const session = await auth();
  const original = await db.savedFilter.findUniqueOrThrow({ where: { id, userId: session!.user!.id } });
  await db.savedFilter.create({
    data: {
      userId: session!.user!.id,
      name: `${original.name} (copy)`,
      filterState: original.filterState,
      sortOrder: original.sortOrder + 1,
    },
  });
}
```

---

## Acceptance Criteria

- "Save as list" button appears in the filter bar when at least one filter is active.
- Clicking "Save as list" opens a modal with the filter summary and a name input.
- Saving creates a `SavedFilter` row and the list appears in the sidebar under "My Lists".
- Clicking a list item navigates to the contacts route with the saved filter state applied.
- The active list item is highlighted when the current URL filter state matches the saved state.
- Context menu: Rename, Duplicate, and Delete work correctly with confirmation for Delete.
- "+ New list" in the sidebar section header also opens the creation modal (with no pre-filled filter state — the user applies filters after creation).

---

## Risks and Open Questions

- **Filter state serialisation stability:** the `filterState` JSON stored in `SavedFilter` must be stable across app versions. If P16-01 adds new filter types, ensure old saved filters still deserialise correctly and any unrecognised filter keys are ignored rather than causing errors.
