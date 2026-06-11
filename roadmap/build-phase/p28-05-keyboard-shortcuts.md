# P28-05 — Keyboard Shortcuts

## Purpose

Add keyboard navigation and action shortcuts throughout the contacts workspace: `j`/`k` to move between contacts, `/` to focus search, `c` to create, `e` to edit, `f` to toggle favourite, `Backspace` to archive, and `?` to show the shortcuts overlay. Power users who process large contact libraries should never need to reach for the mouse.

## Background

The P28-DB09 brief specifies the shortcut set and the overlay modal design. This ticket implements the keyboard event handlers, focus management, and the overlay. Shortcuts are scoped to the contacts workspace — they are inactive when a form or input has focus (to prevent conflicts with text entry).

## Scope

**In scope:**
- Global shortcut hook (`useContactsShortcuts`) registered in the contacts layout
- `j` / `k`: navigate to next / previous contact in the list; highlights the row and scrolls it into view
- `/`: focus the search input
- `c`: navigate to `/contacts/new`
- `e`: open the edit form for the focused contact
- `f`: toggle favourite on the focused contact
- `Backspace`: archive the focused contact (with a brief undo toast)
- `Escape`: clear search / close modals / deselect
- `?`: toggle the keyboard shortcut overlay modal
- `1`–`9`: switch to saved smart list 1–9 (if they exist)
- Shortcut overlay modal per P28-DB09 spec

**Out of scope:**
- Bulk select shortcuts (deferred — `Space` to select a contact adds complexity with the existing checkbox system)
- Custom keybinding configuration

---

## Design / Implementation Spec

### Guard: suppress shortcuts when an input is focused

```typescript
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" ||
    (el as HTMLElement).contentEditable === "true";
}
```

All shortcut handlers check `isInputFocused()` at the top and return early if true.

### `useContactsShortcuts` hook

`src/app/contacts/_hooks/use-contacts-shortcuts.ts`:

```typescript
export function useContactsShortcuts(params: {
  contacts: ContactRow[];
  focusedIndex: number | null;
  setFocusedIndex: (i: number | null) => void;
  smartLists: SavedFilter[];
  onCreateContact: () => void;
}) {
  const router = useRouter();
  const { focusedIndex, contacts, setFocusedIndex, smartLists } = params;

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      switch (e.key) {
        case "j": {
          e.preventDefault();
          const next = focusedIndex === null ? 0 : Math.min(focusedIndex + 1, contacts.length - 1);
          setFocusedIndex(next);
          scrollRowIntoView(next);
          break;
        }
        case "k": {
          e.preventDefault();
          const prev = focusedIndex === null ? 0 : Math.max(focusedIndex - 1, 0);
          setFocusedIndex(prev);
          scrollRowIntoView(prev);
          break;
        }
        case "/": {
          e.preventDefault();
          document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
          break;
        }
        case "c": {
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            params.onCreateContact();
          }
          break;
        }
        case "e": {
          if (focusedIndex !== null) {
            e.preventDefault();
            router.push(`/contacts/${contacts[focusedIndex].id}/edit`);
          }
          break;
        }
        case "f": {
          if (focusedIndex !== null) {
            e.preventDefault();
            await toggleFavourite(contacts[focusedIndex].id);
          }
          break;
        }
        case "Backspace": {
          if (focusedIndex !== null && !e.metaKey) {
            e.preventDefault();
            await archiveContact(contacts[focusedIndex].id);
            toast({ message: "Contact archived.", action: { label: "Undo", onClick: () => restoreContact(contacts[focusedIndex!].id) }, duration: 5000 });
          }
          break;
        }
        case "?": {
          e.preventDefault();
          toggleShortcutsOverlay();
          break;
        }
        default: {
          // Smart list shortcuts: 1–9
          const numMatch = e.key.match(/^[1-9]$/);
          if (numMatch && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const idx = parseInt(e.key) - 1;
            if (idx < smartLists.length) {
              router.push(`/?${serializeFilterState(smartLists[idx].filterState)}`);
            }
          }
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [focusedIndex, contacts, smartLists]);
}
```

### Focus management

The "focused contact" state (`focusedIndex`) is separate from route-level selection. It is a client-side highlight for keyboard navigation. The focused row is visually indicated with a `background: #f9faf8` tint and a left border (2px `#d8ddd6`).

```typescript
function scrollRowIntoView(index: number) {
  const rows = document.querySelectorAll("[data-contact-row]");
  rows[index]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
```

Each contact row needs `data-contact-row` added to the root element.

### Keyboard shortcuts overlay

`src/app/contacts/_components/keyboard-shortcuts-overlay.tsx`:

```tsx
const SHORTCUTS = [
  { section: "Navigation", shortcuts: [
    { keys: ["j", "k"], description: "Next / previous contact" },
    { keys: ["↵"], description: "Open contact detail" },
    { keys: ["Esc"], description: "Close / go back" },
  ]},
  { section: "Contacts", shortcuts: [
    { keys: ["c"], description: "Create contact" },
    { keys: ["e"], description: "Edit focused contact" },
    { keys: ["f"], description: "Toggle favourite" },
    { keys: ["⌫"], description: "Archive contact" },
    { keys: ["/"], description: "Focus search" },
  ]},
  { section: "Lists", shortcuts: [
    { keys: ["1–9"], description: "Switch to smart list" },
    { keys: ["?"], description: "Show shortcuts" },
  ]},
];

export function KeyboardShortcutsOverlay({ open, onClose }: ...) {
  if (!open) return null;
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} maxWidth={480}>
      {SHORTCUTS.map(({ section, shortcuts }) => (
        <section key={section} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            color: "#8b938c", letterSpacing: "0.06em", marginBottom: 8 }}>
            {section}
          </h3>
          {shortcuts.map(({ keys, description }) => (
            <div key={description} style={{ display: "flex", justifyContent: "space-between",
              padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: "#5c655e" }}>{description}</span>
              <span style={{ display: "flex", gap: 4 }}>
                {keys.map((k) => (
                  <kbd key={k} style={{ background: "#f2f4f0", border: "1px solid #d8ddd6",
                    borderRadius: 5, padding: "2px 7px", fontFamily: "monospace",
                    fontSize: 12, color: "#1d2823" }}>
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </section>
      ))}
    </Modal>
  );
}
```

---

## Acceptance Criteria

- `j` moves focus to the next contact row; `k` moves to the previous.
- `/` focuses the search input.
- `c` navigates to `/contacts/new`.
- `e` navigates to the edit form for the focused contact.
- `f` toggles favourite on the focused contact; the row updates immediately.
- `Backspace` archives the focused contact with an undo toast.
- `1`–`9` navigates to the corresponding smart list (by sort order).
- `?` opens and closes the shortcuts overlay modal.
- All shortcuts are inactive when any form input has focus.
- The shortcuts overlay shows all shortcuts with correct key chip styling.

---

## Risks and Open Questions

- **`Backspace` conflicts with browser back navigation:** on some browsers, `Backspace` triggers browser back when no input is focused. The event handler calls `e.preventDefault()` to block this. Verify this works on Chrome, Safari, and Firefox. If it causes issues, consider using `Delete` instead.
- **macOS `⌫` vs Windows `Delete`:** `Backspace` is the correct key on all platforms. `Delete` on macOS is actually `Fn+Backspace`. Use `e.key === "Backspace"` which is consistent across platforms.
