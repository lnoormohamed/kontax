# P40-DB01 — Books-First Navigation & Multi-Membership Surfaces

**Phase:** [Phase 40](../build-phase/phase-40.md) · **Ticket:** [P40-DB01](../build-phase/p40-db01-design-brief-books-first-navigation.md)
**Priority:** P0 — changes the first thing every user sees (`/contacts` sidebar) and the product's mental model.
**Extends (does not replace):** [01-contacts-list](01-contacts-list.md), [02-contact-detail](02-contact-detail.md), [03-create-edit-contact](03-create-edit-contact.md), [12-sharing-ui](12-sharing-ui.md), [13-family](13-family-plan-surfaces.md), [14-teams](14-teams-plan-surfaces.md).

> **Design system (locked):** ink `#1d2823`, green `#17352e`, blue `#4158f4`, hairline `#d8ddd6`, Geist. Reuse existing sidebar-section styling (P28-DB09 / P31B-DB12), chip conventions (`label-chip.tsx`), and the sharing surfaces from briefs 12–14. No new visual language.

---

## Model decisions — LANDED (with product, 2026-07-04)

These were the three open decisions in the ticket. They are now locked and drive the build (P40-06/07/08):

1. **Remove-from-last-book → BLOCK.** Every contact must remain in ≥1 book (matches the schema invariant "≥1 membership at all times"). The detail "Books" block disables the remove control on the final membership; the copy explains why and points to delete-contact. No silent move.
2. **Multi-membership indicators → DETAIL PAGE ONLY (v1).** The contacts list keeps the Phase 38 lean-row payload untouched — **no** book dot/badge on rows. Membership is surfaced only on the contact detail "Books" block. (Row indicators can be revisited post-soak if users ask; deferring protects the hot query.)
3. **Default books → seed "Personal" + "Work", fully renameable.** Already implemented (P40-05 `seedDefaultBooksForNewUser`). "Personal" is the default/home book. Existing accounts keep their books exactly as named — never seeded a second book.

---

## Purpose

Give the multi-book model a user-facing shape: books as the primary navigation axis, a contact that can live in several books, private fields other members never see, and a per-member sharing policy decided once (not per edit).

---

## 1. Books-first sidebar

### Hierarchy (section order)

```
┌ SIDEBAR ─────────────────┐
│  All contacts            │  ← aggregate across every personal book (default landing)
│                          │
│  BOOKS                   │  ← section header, uppercase micro-label (#8a938c)
│   ● Personal      1,204  │  ← default book; count right-aligned, tabular
│   ● Work            318  │
│   + New book             │  ← ghost row, opens rename-inline create
│                          │
│  SHARED                  │  ← only when the user is in a family/team book
│   ▣ The Alvarez Family   │  ← shared-book glyph differs from personal ●
│   ▣ Acme Team      [T]   │  ← [T] = Teams badge chip (green), see §5 floor
│                          │
│  MY LISTS                │  ← P28 smart lists, unchanged
│   Recently added         │
│   Missing email          │
│                          │
│  LABELS                  │  ← P31B labels, unchanged
│   VIP   Client   Plumber │
└──────────────────────────┘
```

- **"All contacts"** stays at the top and remains the default view — the union of all personal book memberships (plus shared books the user can see). It is not a book; no count-to-book mapping, no membership.
- **Books** is the new primary section, above Lists and Labels. Personal books first, then a **Shared** section (rendered only if the user belongs to ≥1 family/team book — no empty header).
- **Counts** are per-book membership counts, right-aligned, tabular-nums, `#8a938c`. "All contacts" shows the deduped total (a contact in 2 books counts once).
- Books and Labels/Lists coexist: selecting a book sets the **book scope**; Labels/Lists then filter *within* the active book (or within All contacts). This is the "Books = where · Labels = what · Lists = how" model.

### States

| State | Treatment |
|---|---|
| **Default** | Active row: green left-border (2px `#17352e`) + `#f0f3ef` fill, ink text. Inactive: ink text, no fill; hover `#f6f8f5`. |
| **Empty book** | Count shows `0`, muted. Selecting it lands on the list empty-state ("No contacts in *Work* yet · Add contact / Import"). |
| **Overflow (>8 books)** | Books section scrolls internally after 8 rows (max-height, thin scrollbar); Lists/Labels stay pinned below. No "show more". |
| **Drag / reorder** | Personal books reorder via drag handle on hover (grip glyph, `#c2c9c0`). Order persists per user (see §Data). Shared books are not reorderable. |
| **Shared-book badge** | Family: quiet `▣` glyph. Teams: `[T]` chip in green `#17352e` on `#e8 efe9`. Read-only shared book: lock glyph after the name. |
| **Active** | As Default active; the header breadcrumb echoes the book name. |

### Affordances
- **Create:** "+ New book" ghost row → inline editable row (autofocus), Enter commits, Esc cancels. Slug auto-derived, collision-suffixed.
- **Rename:** double-click a book row name → inline edit (personal books only; not "All contacts", not shared books you don't own).
- **Book overflow menu** (kebab on hover): Rename · Reorder · Set as default · Archive. Archive is blocked for the last remaining book and for the default book (must reassign default first) — reuse existing settings/books rules.

---

## 2. Multi-membership on the contact row

**v1: nothing on the row.** Per decision #2, rows are unchanged from P38. The list within a book scope shows only that book's members; "All contacts" shows everyone once. No per-row book indicator. (Rationale recorded so a future reviewer doesn't "add the missing badge".)

---

## 3. Membership on the contact detail — the "Books" block

New block on `/contacts/[id]`, below the header, above Notes:

```
BOOKS
  [ Personal ✕ ]  [ Work ✕ ]        + Add to book ▾
```

- Each membership is a **chip** (reuse `label-chip.tsx` shape; book chips use a neutral fill `#eef1ec`, ink text, `●` leading dot to distinguish from labels).
- **✕** removes that membership. On the **last** membership the ✕ is disabled (opacity 40%, `cursor: not-allowed`) with tooltip: *"A contact must stay in at least one book. Delete the contact to remove it entirely."* (decision #1).
- **+ Add to book ▾** opens a menu of the user's other personal books not already joined; selecting adds a membership (no copy, no move — same contact row).
- **Primary book** marked with a small "Home" affordance on its chip (the `isPrimary` book — sync write-back home). Changing primary = a menu item on the chip; exactly one primary always.
- **Read-only shared book:** if the contact is in a shared book the user can't edit, that chip is shown muted with a lock glyph and no ✕.

### States
- **Single membership:** one chip, ✕ disabled.
- **Multiple:** chips wrap; "Add to book" trails.
- **Read-only shared book present:** muted locked chip alongside editable personal chips.

---

## 4. Private fields

Private = **not shown to other members of a shared book**. It is NOT "never leaves your device" — sync/export still carry it for the owner. Copy must stay honest (aligns with the P45 projection brief).

- **Marking:** on multi-value rows in the contact form (phone, email, address, etc.) each entry gets a **lock toggle** at the end of the row. Unlocked = shared layer; locked = private layer (this user only). Default follows the sharing policy (§5) — the toggle just overrides one entry.
- **Owner render (detail):** a private field shows a subtle **lock glyph** (`#8a938c`, 12px) trailing the value. No banner, no color change.
- **Other-member render:** the field is simply **absent** — no redaction placeholder, no "hidden" row. They can't tell a private field exists. (Verified with two seeded accounts, per P40-02 acceptance.)
- **Copy:** helper text under the lock toggle: *"Private — not shown to other members of this book."*

---

## 5. Sharing-policy picker

Lives in **group/book settings** (family & teams), not in the per-contact edit flow (the "no prompt on every edit" rule).

```
WHAT YOU SHARE IN “Acme Team”
  Contact details you add here are shared with the team by default.
  You can make any single field private when you add it.

  ☑ Name, company, job title          (always shared)
  ☑ Work email & phone
  ☐ Personal email & phone
  ☐ Home address
  ☐ Birthday
  ☐ Notes
  ☐ Labels
```

- Each row toggles a policy key group (maps to `SharingPolicy` keys, `src/lib/sharing-policy.ts`). Descriptions in plain language.
- **Teams floor (`minimumSharingPolicy`):** rows the admin forces shared render **checked + disabled** with a caption *"Your team requires this to be shared."* The member can restrict others further, not loosen these.
- **One-time educational moment:** the first time a user edits a contact inside a shared book, a single dismissible inline note appears above the form: *"You're editing in *Acme Team*. Work details are shared with the team; personal details stay private. Change what you share in team settings."* Shows once per (user, book); never again.

---

## 6. Edit-context cues

Which layer an edit lands in (source §6, implemented in P40-07) is shown as a **quiet context line in the form header**, never a per-field prompt:

| Editing in | Header line |
|---|---|
| Personal book (Personal/Work) | *"Editing in Personal"* — neutral, `#8a938c`. |
| Shared book (navigated in from the shared book) | *"Editing in Acme Team — changes are shared with the team."* green accent. |
| (private entries) | the per-entry lock glyph (§4) is the only per-field cue. |

The line reflects the resolved edit context; no interruptive modal.

---

## 7. Migration moment (existing users)

On first `/contacts` load after the backfill, an existing user sees a **one-time dismissible explainer** (banner slot, reuse the P42 single-banner slot pattern):

> **Your contacts now live in books.** Everything you had is in **Personal**. Create a **Work** book (or any book) and drop contacts into more than one at a time. *Got it →*

- Shows **once per existing user**, keyed on a per-user flag; **never** for new accounts (they were seeded Personal+Work and onboarded into the model).
- No forced tour, no overlay. Dismiss persists.
- Their existing default book keeps its exact name (not force-renamed to "Personal" — decision #3 / P40-05).

---

## 8. Mobile treatment

Per [mobile-design-brief](../mobile-design-brief.md):

- **Sidebar → bottom-sheet "Books" picker.** The mobile filter sheet (`mobile-filter-sheet.tsx`) gains a **Books** section at the top, above Lists/Labels, mirroring the desktop order. Book rows with counts; tap sets scope and closes the sheet.
- **Detail Books block:** chips wrap full-width; "Add to book" is a full-width row that opens a book picker sheet. Remove ✕ has a 44px touch target; last-book disabled state identical.
- **Private-field lock toggle:** rendered as a 44px trailing toggle on each multi-value entry row; label below at touch size.
- **Migration explainer:** same one-time banner, full-width, above the list.
- Real-device verification required (preview can't emulate touch — see the touch-gestures memory).

---

## 9. States to specify (checklist for build/QA)

- Sidebar: default · empty book · >8 overflow · drag/reorder · shared-book badge (family/teams/read-only) · active.
- Detail Books block: single · multiple · read-only shared book present · last-membership disabled remove.
- Private field: owner view · edit mode (lock toggle) · **shared-member absence** (two seeded accounts).
- Sharing-policy picker: each option · Teams-floor checked+disabled rows.
- Edit-context cue: personal · shared.
- Migration explainer: existing user (once) · never for new account.
- All at desktop / tablet / mobile.

---

## Data notes (for the build)
- Book order persistence: store per-user in `User.preferences` (JSON) as `bookOrder: string[]` — no schema change (mirrors P34B preferences pattern).
- Migration-explainer seen-flag: `User.preferences.p40BooksExplainerDismissedAt` (JSON) — no schema change.
- Membership add/remove/setPrimary: server actions on `ContactBookMembership` (P40-06 helper `src/server/contact-book-membership.ts`).
- Sharing-policy read/resolve: `src/lib/sharing-policy.ts` (P40-03). Private-field merge: `src/lib/contact-private-fields.ts` (P40-02).

## Dependencies
Blocks [P40-08](../build-phase/p40-08-sidebar-redesign-build.md) (sidebar build) and informs [P40-06](../build-phase/p40-06-read-write-cutover.md) (detail Books block writes) and [P40-07](../build-phase/p40-07-edit-context-resolution.md) (edit-context cue). Out of scope: `GroupLabel`/shared lists (§9 defer), per-field overrides beyond the private toggle, sync projection scope UI (P41-DB01).
