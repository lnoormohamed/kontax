# P28-DB09 — Design Brief: Power User Features (Smart Lists, Personal Books, Bulk Edit, Keyboard Shortcuts, QR Code)

## Purpose

This brief specifies the visual design and interaction patterns for Phase 28's power user productivity features: the smart list creation flow and sidebar item, the personal address book management panel, the bulk edit toolbar, the keyboard shortcuts overlay, and the vCard QR code modal. These features target the daily-active user segment that drives word-of-mouth.

## Background

Power users spend significant time in the contacts list. They need ways to save and recall complex filter combinations, organise contacts into personal books, batch-process multiple contacts, navigate without reaching for the mouse, and share contacts instantly. Each of these is a high-signal feature that turns "I check this app occasionally" into "I use this app every day."

The locked design language applies throughout.

---

## Scope

### In scope

1. Smart list sidebar item and creation modal
2. Personal address book panel in the sidebar
3. Bulk edit toolbar and action menu
4. Keyboard shortcut overlay (?)
5. vCard QR code modal

### Out of scope

- Full-text search UI (P28-07 — separate ticket)

---

## Design / Implementation Spec

### 1. Smart Lists

**Sidebar item:** smart lists appear in the left sidebar under a "My Lists" section, below the main nav items (All, Favourites, Duplicates, Archived).

```
My Lists
+ New list
  📋 VCs in NYC
  📋 Salesforce export
  📋 Contractors
```

Section label: same style as "Sync accounts" — `font-size: 11px`, `font-weight: 700`, uppercase, `color: #8b938c`. Smart list icon: `List` Lucide, 14px, `color: #5c655e`.

Active smart list item: `background: #e3efe7`, `border-left: 3px solid #17352e`, same as primary nav active state.

Right-click context menu (or `…` button on hover): Rename / Duplicate / Delete.

**"+ New list" modal:**

```
┌─────────────────────────────────────────────────┐
│  Save this filter as a list                     │
│                                                  │
│  Name: [VCs in NYC                        ]      │
│                                                  │
│  Saves the current filter:                       │
│  City: New York · Tag: VC                        │
│                                                  │
│  [Cancel]   [Save list]                          │
└─────────────────────────────────────────────────┘
```

- Title: 17px 700. Name input: full-width, `height: 44px`, `border-radius: 12px`.
- Filter summary: `font-size: 13px`, `color: #5c655e`. Pills showing active filters (same style as the filter bar chips).
- "Save list" button: blue, `height: 44px`.

---

### 2. Personal Address Books Panel

In the sidebar, below "My Lists", a "Books" section:

```
Books
+ New book
  📘 Default
  📘 Work
  📘 Friends
  📘 Family (shared) ← from Phase 13 — read-only icon
```

Section header with same style as "My Lists". Book icon: `BookOpen`, 14px.

**Book management modal** (opened by clicking a book's `…` menu → "Manage"):

```
┌─────────────────────────────────────────────────────────────────┐
│  Work                                    [Rename]  [Archive]    │
│  84 contacts                                                     │
│                                                                  │
│  ┌───────────────────────────────────────┐                      │
│  │  Move contacts from other books…      │  ← drag-and-drop      │
│  └───────────────────────────────────────┘                      │
│                                                                  │
│  CardDAV slug:  /dav/books/work                                  │
│  ☑ Expose to connected devices via CardDAV                       │
└─────────────────────────────────────────────────────────────────┘
```

- Rename: inline text input on click. Save on blur.
- Archive: confirmation modal. Default book cannot be archived.
- CardDAV slug: read-only, monospace, copy button.

---

### 3. Bulk Edit Toolbar

When 1+ contacts are selected (checkboxes from P16-04), a toolbar appears at the bottom of the contacts list (above the bottom nav on mobile):

```
┌──────────────────────────────────────────────────────────────────┐
│  3 contacts selected    [×]                                      │
│                                                                  │
│  [Move to book ▾]  [Add label ▾]  [Set company]  [Archive]  [⋯] │
└──────────────────────────────────────────────────────────────────┘
```

**Toolbar styling:** `background: #1d2823`, `color: #ffffff`, `height: 56px`, `border-radius: 14px`, `padding: 0 20px`, fixed at bottom of the list area (above pagination).

Count chip: "N contacts selected" in white. `[×]` clears selection.

Action buttons: white text, `font-size: 13px`, `font-weight: 600`. Hover: `background: rgba(255,255,255,0.1)`.

**Move to book ▾** dropdown: lists the user's personal books. Selecting moves all selected contacts to that book.

**Add label ▾** dropdown: a tag input that creates a label on all selected contacts.

**Set company:** opens a single text input popover; value applied to all selected contacts' `company` field.

**Archive:** confirmation: "Archive 3 contacts?" → red confirm button.

**⋯ More:** overflow menu → Delete permanently (destructive, red), Export selection as CSV.

---

### 4. Keyboard Shortcuts Overlay

Triggered by pressing `?` anywhere in the app. A centered modal:

```
┌──────────────────────────────────────────────────────────────────┐
│  Keyboard shortcuts                                       [×]    │
│                                                                   │
│  Navigation                                                       │
│  j / k         Next / previous contact                           │
│  ↵ Return       Open contact detail                              │
│  ⌘K             Quick search                                     │
│  Esc            Close / go back                                  │
│                                                                   │
│  Contacts                                                         │
│  c              Create contact                                   │
│  e              Edit focused contact                             │
│  f              Toggle favourite                                  │
│  ⌫ Backspace    Archive contact                                  │
│                                                                   │
│  Lists                                                            │
│  1–9            Switch to smart list 1–9                         │
│  l              Open list picker                                  │
└──────────────────────────────────────────────────────────────────┘
```

- Modal: `max-width: 480px`, `border-radius: 16px`, `padding: 28px 32px`. Backdrop: `rgba(29,40,35,0.5)`.
- Section headers: `font-size: 11px`, uppercase, `color: #8b938c`.
- Rows: `display: flex; justify-content: space-between`. Key chip: `background: #f2f4f0`, `border: 1px solid #d8ddd6`, `border-radius: 5px`, `padding: 2px 7px`, `font-family: monospace`, `font-size: 12px`, `color: #1d2823`.
- Action: `font-size: 13px`, `color: #5c655e`.

---

### 5. vCard QR Code Modal

Accessible from the contact detail page via a "Share" → "QR code" button, or from the contacts list context menu.

```
┌──────────────────────────────────────────────────────────────────┐
│  Share Jane Smith                                         [×]    │
│                                                                   │
│         ┌────────────────────────────┐                           │
│         │                            │                           │
│         │   [QR CODE — 200×200px]    │                           │
│         │                            │                           │
│         └────────────────────────────┘                           │
│                                                                   │
│  Scan to add Jane's contact to any phone.                         │
│                                                                   │
│  [Download QR]          [Copy link]                              │
└──────────────────────────────────────────────────────────────────┘
```

- QR code: 200×200px, white background, black modules. Generated client-side (no server call).
- "Download QR": downloads `jane-smith-qr.png`.
- "Copy link": copies the `/share/{token}` URL (creates a vCard share link if one doesn't exist, or uses the existing non-expired one).

---

## Acceptance Criteria

- Designer can produce all 5 feature screens without a follow-up meeting.
- Smart list sidebar section and creation modal are specified with states: empty, active, rename, delete.
- Address book sidebar section and book management modal are fully specified.
- Bulk edit toolbar is specified with dark background variant and all 4 primary actions + overflow menu.
- Keyboard shortcut overlay is specified with all shortcut rows and key chip styling.
- QR code modal shows the code + download + copy link actions.
- Mobile variants: bulk edit toolbar stays at bottom; QR modal is full-screen sheet.
