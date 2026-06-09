# Design Brief: Contact Detail Page

**Route:** `/contacts/[id]`
**Phase:** P0 core surface
**Last updated:** 2026-06-09

---

## Design language (aligned with the rebuilt contacts list)

This brief was first drafted before the contacts-list redesign shipped. The detail page must match that locked design language — read `01-contacts-list.md` first. Where this document names older values, the list's palette/type win:

- **Palette (from the production kit):** ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, lines `#d8ddd6` / `#e9ece7`, paper `#ffffff`, brand green `#17352e`, CTA blue `#4158f4`, amber `#bf8526`, red `#b5472f`. Background is white/near-white — **not** the older `#f9faf6`. Font: Geist / system sans. Straight, consistent corners.
- **Header chrome matches the list:** same back/wordmark treatment, white header on a `#d8ddd6` border (not a tinted translucent bar).
- **Avatar tints** use the same name-hash colour set as the list rows, so a person looks identical in both places.
- **Row-context icons are one governed system (Phase 15).** This page shows the *expanded* form of the same cluster used on list rows — favourite, plus status badges (family / team / live-shared / emergency). Do not invent separate one-off badges; every badge here is the detail-page expansion of a list badge, with the same glyph and meaning. The "live share" and "family book" items called out under Future Additions are members of that one system.
- Section cards (`rounded` + `border`) are appropriate here — a detail page is allowed more structure than the full-bleed list — but use the palette above, not the old hexes.

---

## Purpose

The contact detail page is the single source of truth for everything Kontax knows about one person. It serves two distinct but unified purposes: reading a contact at a glance and editing it in place. Users land here by tapping a name in the contacts list, following a deep link from a notification, or arriving from merge review. The primary audience is anyone managing a personal or professional address book — they expect the experience to feel like a refined digital Rolodex card: structured, dense with information, but never cluttered. A secondary audience is the user actively editing records: they expect to tap a field and update it immediately without a mode switch or page reload. Sync-aware users (those with CardDAV accounts) also use this page to verify sync status and spot conflicts.

---

## Layout (Desktop ≥ 1280px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STICKY HEADER                                                              │
│  ← Contacts          [Contact name]              [Share] [Archive] [⋯]    │
├──────────────────────┬──────────────────────────────────────────────────────┤
│                      │                                                      │
│   LEFT PANE          │   RIGHT PANE (scrollable)                           │
│   (sticky, 320px)    │                                                      │
│                      │   ┌──────────────────────────────────────────────┐   │
│  ┌────────────────┐  │   │  SECTION: Identity                           │   │
│  │                │  │   │  Full name, phonetic, nickname, prefix/suffix│   │
│  │    AVATAR      │  │   └──────────────────────────────────────────────┘   │
│  │   (88px sq)    │  │                                                      │
│  │                │  │   ┌──────────────────────────────────────────────┐   │
│  └────────────────┘  │   │  SECTION: Contact Methods                    │   │
│                      │   │  Emails, phones, websites                    │   │
│  Full Name           │   └──────────────────────────────────────────────┘   │
│  Job Title           │                                                      │
│  Company             │   ┌──────────────────────────────────────────────┐   │
│                      │   │  SECTION: Work                               │   │
│  ─────────────────   │   │  Company, job title, department              │   │
│                      │   └──────────────────────────────────────────────┘   │
│  QUICK ACTIONS       │                                                      │
│  [📞] [✉] [★] [↗]  │   ┌──────────────────────────────────────────────┐   │
│                      │   │  SECTION: Personal                           │   │
│  ─────────────────   │   │  Birthday, addresses, related people, dates  │   │
│                      │   └──────────────────────────────────────────────┘   │
│  SOURCE BADGES       │                                                      │
│  (future)            │   ┌──────────────────────────────────────────────┐   │
│                      │   │  SECTION: Notes                              │   │
│  METADATA            │   └──────────────────────────────────────────────┘   │
│  Added: date         │                                                      │
│  Modified: date      │   ┌──────────────────────────────────────────────┐   │
│  UID: truncated      │   │  SECTION: Sync                               │   │
│                      │   │  Linked accounts, ETag, last synced          │   │
│                      │   └──────────────────────────────────────────────┘   │
│                      │                                                      │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

**Left pane** is sticky — it remains visible while the user scrolls the right pane. Width: 320px. Background: same near-white as the page. No card border — it reads as part of the page structure, not a floating widget.

**Right pane** is scrollable. Max-width ~800px, centered within remaining space. Padding: 32px top, 40px horizontal. Section cards use a `rounded` card with a `#d8ddd6` border on white — consistent with the app, in the palette above.

**Sticky header** is minimal: back chevron + breadcrumb label on the left, contact display name (truncated) in the centre, utility actions on the right. Solid **white** header with a `#d8ddd6` bottom border — matching the contacts-list header chrome (not a tinted translucent bar).

### App shell — detail lives **inside** the persistent shell (master–detail)

> Added after the latest mock review. The standalone mock dropped the global chrome.

The current mock renders the detail as a **standalone window** with only its own slim 60px header, losing the global app shell that the rebuilt contacts list owns (`contact-dashboard.tsx`): the persistent **left sidebar** (workspace logo + All contacts / Favourites / Labels / Import-Export-Sync) and the user-menu header. Opening a contact must **not** drop the user out of the app chrome.

- Use a **master–detail** layout: the global sidebar **persists**, and the contact detail renders in the **main content area**.
- The detail's own internal header (back-to-Contacts breadcrumb + name + actions) is fine, but it sits **inside** the shell — it does not replace the sidebar/user-menu.
- So the desktop has effectively three columns at ≥1280px: **global sidebar** → detail **left rail (320px)** → detail **right pane**. The 320px rail and right pane are the detail's two panes; the global sidebar is separate chrome shared with the list.

**Header destructive action — archive-first.** Drop the always-visible red **Delete** button from the header. Our model is archive-first; permanent delete is rare. Make **Archive** the primary header action; keep **"Delete permanently"** in the **⋯ More** menu only (it already lives there) so a hard delete is never one stray click away.

---

## Key Components

### Avatar

- Size: 88×88px, `border-radius: 50%` (fully circular).
- Default: initials-based. Two-letter initials (first + last initial, or just first two characters of display name if no last name). Background colour derived deterministically from the contact's name string — hash the name, map to one of 8–10 muted, accessible colours (sage, terracotta, dusty blue, warm purple, etc.). Text colour is white for dark swatches, dark-green `#17352e` for light swatches.
- Photo: if a photo is stored, display it as a circle crop. Hover over avatar shows a subtle "Edit photo" overlay (camera icon, 40% black scrim). Click opens file picker.
- No photo upload skeleton: a dashed circle outline with a "+" icon in the centre, same 88px. Clicking opens file picker.
- Favourite indicator: a small filled star (⭐) rendered in the bottom-right corner of the avatar circle. Only shown when `isFavourite: true`. No star visible otherwise.

### Quick-Action Bar

Rendered below the avatar + name block in the left pane. Contains icon buttons arranged in a horizontal row, spaced evenly.

- **Call** — phone handset icon. Only shown if the contact has at least one phone number. Tapping on desktop copies the number to clipboard with a toast: "Phone number copied". On a future mobile-aware view, initiates a call intent.
- **Email** — envelope icon. Only shown if the contact has at least one email address. Clicking opens the device's default mail client via `mailto:`.
- **Star / Favourite** — star outline (unfavourited) or filled star (favourited). Clicking toggles `isFavourite` via a PATCH call with optimistic UI update. No confirmation needed.
- **Share** (future-ready, present but visually dimmed for now) — export/share icon. Clicking will open a share sheet. For v1, clicking downloads a `.vcf` file.
- **Archive / Restore** — box-with-arrow icon. If contact is active, shows Archive. If archived, shows Restore. A short confirmation toast appears after action. Does not navigate away.
- **More (⋯)** — overflow menu. Opens a small popover with additional actions: "Export as vCard", "Undo merge" (only if this contact was created by a merge), "Delete permanently" (red text, requires confirmation modal).

Icon buttons: 36×36px touch target, icon 18px, no label below (left pane is compact). On hover: `bg-slate-100` fill, slight scale (1.05). Active state: icon fills with brand colour or red for destructive.

### Section Cards (Right Pane)

Each section is a card with the shared card style. Internal anatomy:

```
┌──────────────────────────────────────────────────────────┐
│  IDENTITY                             [section header]   │
│  ─────────────────────────────────────────────────────   │
│  Full name         [value or "Not added"]                │
│  First name        [value or "Not added"]                │
│  Last name         [value or "Not added"]                │
│  ...                                                     │
└──────────────────────────────────────────────────────────┘
```

- Section header: uppercase, 11px, `tracking-widest`, `text-slate-400`. Sits at the top of the card flush-left.
- Each field row: label on left (`text-slate-500`, 120px wide, regular 13px), value on right (14px, `text-slate-900`).
- "Not added" placeholder: `text-slate-300 italic`. Not a button — clicking the row activates inline edit mode.
- **Inline editing**: clicking anywhere on a field row (or the "Not added" text) transforms the value into an input field in-place. The row background shifts to `bg-blue-50/30` with a subtle left border `border-l-2 border-[#4158f4]`. Other rows in the section become slightly dimmed (opacity 0.6) to focus attention. Save on blur or Enter; cancel on Escape.
- Multi-value fields (emails, phones, websites, addresses): each value is its own row within the section, preceded by a label pill (e.g. "Home", "Work", "Mobile"). An "+ Add email" link sits at the bottom of the section in `text-[#4158f4]` 13px.
- Label pills: small rounded rectangles (`bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs`). Clicking opens a label picker dropdown (a short list of common labels + "Custom…").

### Identity Section Fields
Full name (display name), first name, middle name, last name, name prefix (Mr/Ms/Dr/etc.), name suffix, phonetic first name, phonetic last name, nickname.

### Contact Methods Section Fields
Emails (multi, labelled), phone numbers (multi, labelled), websites (multi, labelled).

### Work Section Fields
Company name, phonetic company, job title, department.

### Personal Section Fields
Birthday (date picker on click — `<input type="date">` styled to match), addresses (multi, structured: street / city / state / postcode / country), related people (multi, labelled: Spouse / Partner / Child / Parent / etc.), significant dates (multi, labelled: Anniversary / Other).

### Notes Section
Full-width textarea, auto-expanding. Shows rendered plain text when not editing. Click activates edit mode (same left-border treatment as other fields). Character limit: 4000. Count shown in bottom-right of textarea when within 200 characters of limit.

### Sync Section

```
┌──────────────────────────────────────────────────────────┐
│  SYNC                                                    │
│  ─────────────────────────────────────────────────────   │
│  iCloud (CardDAV)    Linked    Last synced 3m ago        │
│  Google (import)     Imported  Jun 5, 2026               │
│                                                          │
│  ETag: "abc123xyz..."  [copy icon]                       │
│  UID:  6f2a1b...        [copy icon]                      │
└──────────────────────────────────────────────────────────┘
```

- Each sync account shows: account display name, sync type (CardDAV live / Import), status (Linked / Conflict / Error), last synced timestamp.
- Status badge: `bg-green-100 text-green-700` for Linked, `bg-amber-100 text-amber-700` for Conflict, `bg-red-100 text-red-700` for Error.
- ETag and UID shown in monospace, truncated to ~20 chars with copy-to-clipboard icon. On copy: icon briefly flashes to a check mark.

---

## States

### Empty / No Data
All optional fields show "Not added" placeholders. The page still renders fully — the card structure is always present. The Notes card shows a single-line hint in `text-slate-300`: "Add notes about this contact…"

### Loading
On initial page load, the left pane shows a skeleton: a grey circle for the avatar, two grey bars for name/title. The right pane shows 4–5 section cards with grey bar skeletons inside, no content. Skeleton bars are animated with a left-to-right shimmer. Actual data replaces skeletons as each section's data resolves.

### Saving (Inline Edit)
When a field blur triggers a save, the field border transitions from blue to a brief green (`border-green-400`) for 600ms, then back to normal. A minimal toast in the bottom-right corner: "Saved" with a check icon, auto-dismisses after 2s.

### Save Error
If the inline save fails (network error, validation failure), the field border turns red, an inline error message appears below the field in red 12px text. The field value reverts to the previous value. Toast: "Couldn't save — try again."

### Archived Contact
A slim banner at the top of the right pane (above the first section card): amber background, "This contact is archived. It won't appear in your main list." with a "Restore" button inline. The left pane Archive button is replaced with a Restore button.

### Merged Contact
If this contact was the result of a merge, a slim informational banner: "Created from merging 2 contacts." with an "Undo merge" link that triggers confirmation before reverting.

### Contact Not Found
Full-page centred message: "Contact not found" with a subline "It may have been deleted." and a "Back to contacts" button.

---

## Mobile Layout (< 768px)

On mobile, the two-pane layout collapses to a single column.

```
┌─────────────────────────────┐
│  ← [back]        [⋯]       │  ← compact sticky header
├─────────────────────────────┤
│                             │
│   [Avatar 72px]             │
│   Full Name (bold, 20px)    │
│   Job Title · Company       │
│                             │
│  [📞] [✉] [★] [↗] [⋯]     │  ← icon row, full width
│                             │
├─────────────────────────────┤
│  Identity          ›        │  ← collapsed section rows
│  Contact Methods   ›        │     tap to expand in-place
│  Work              ›        │
│  Personal          ›        │
│  Notes             ›        │
│  Sync              ›        │
└─────────────────────────────┘
```

- Sections are collapsible accordion rows. Each shows the section name + a count of filled fields (e.g. "Contact Methods · 3 fields"). Tapping expands inline.
- Avatar shrinks to 72px. Name is 20px semibold. Title and company on one line, separated by a mid-dot.
- Quick-action icons are arranged in a single full-width row, evenly spaced, 44×44px touch targets (no labels — icon only).
- Header: back chevron on left, contact name truncated in centre, ⋯ overflow menu on right. Archive and Delete live inside the overflow menu on mobile.
- Inline editing on mobile: the editing row expands slightly, keyboard appears. The page scrolls to keep the active field visible above the keyboard (`scroll-padding-bottom` + `visualViewport` API).

---

## Birthday in the left summary

Add a compact, **read-only** birthday line to the left pane summary, directly under the `Job title · Company` line — shown **only when a birthday is set** (e.g. a small cake icon + `14 Mar` or `14 Mar 1989`). For a personal address book an upcoming birthday is a genuine at-a-glance fact, so it earns a place in the summary.

- This is a **summary mirror, not editable** — the editable birthday field stays in the Personal section (single source of truth). Do not create two editable copies.
- Keep the rest of the left pane lean — birthday earns this slot; other fields do not. Don't migrate phone/email/etc. up.

## Built in Phase 10 — render as real, always-on (not placeholders)

These three were "future" in the original draft but are now **live data**. They must render on every contact, not be gated behind a demo flag:

### Source badge — `sourceType` / `sourceDetail` (built, P10-03/04)
Below the name/title block in the left pane: a quiet chip showing origin — "Added manually", "Imported from contacts.csv", "Synced from iCloud", etc. **Every contact has a source now**, so this always renders (it is not optional). Use the same source glyphs as the activity log.

### "Last edited by" line — `lastMutatedBy` / `lastMutatedByDetail` (built, P10-03/04)
In the left-pane metadata block: "Last edited by you · 2h ago", "Last edited by iCloud sync · yesterday", and (in shared books) "Last edited by [member] · 2h ago". Real data — always shown.

### History tab — per-contact activity feed (built, P10-04)
The Details / History tab bar is correct. The History panel is **not a placeholder** — mock it as the real feed: rows of *actor icon + summary + relative time*, with **expandable field diffs** for updates/syncs ("phone changed from — → +44…"). Real event vocabulary: Created · Updated (N fields) · Archived/Restored · Merged with [name] · Imported from [file] · Synced from [account] · Conflict detected/resolved. Include the empty state ("History starts from …") and a "Load more" control. Available on all plans (no Pro gate on per-contact history).

## Sharing & shared books (Phases 12–14) — design now, wire later

The contact detail page is where a user shares a contact and sees its shared status. The mock currently has only passive badges and a vCard-only "Share" action — the collaborative share is missing. Design the following as quiet placeholders now; the live feature lands in Phases 12 (sharing), 13 (family), 14 (teams).

### Share action + share sheet
A **Share action** (in the header actions and/or quick-action bar) that opens a share sheet with these distinct options — keep them separate, do not conflate with vCard export:
- **Add to a shared book → Family book / Team book ([name])** — the collaborative case: *any member of that group can view and edit this contact* (update details, etc.). This is the headline feature.
- **Share with a Kontax user** → static copy (snapshot) or live link (stays in sync).
- **vCard link / download** — anyone, no account needed. Distinct from the collaborative share.

#### Share sheet must be **data-driven** — not hardcoded books

> Added after the latest mock review. The mock hardcoded one family ("Castellanos Family") and one team ("Acme Corp") as if every account has exactly those — that's seed data leaking in as the model.

- A user can **own/belong to multiple** family and team books. The "Add to a shared book" section lists the **user's actual books**, one row each — driven from real membership, not a fixed pair.
- **Row label = the book's real name** with a small **Family / Team** type chip. Drop the redundant `Family book ·` / `Team book ·` prefix — "Castellanos Family" already reads as a family book.
- **Distinguish "add to" from "already in."** A checkmark on an add-row conflates the two states:
  - Books the contact is **not** in → **"Add to [book]"** (action row).
  - Books the contact **is** in → render as added, with **Manage** / **Remove from book** — not a re-add row.
- Empty state: if the user owns no shared books yet, show a "Create a family/team book" affordance instead of an empty list.

### "Sharing" card (right pane) — shown when the contact is in a shared book or shared live
- Which book it lives in: **Family** or **Team · [book name]**.
- **"Anyone in [group] can edit"** framing so it's clear edits affect everyone.
- **Member access**: avatars / list of who can see and edit; per-member edit vs view where Teams permissions apply.
- **Live shares**: "Live from [owner] — owner edits, you view", with the source fields rendered read-only and subtly marked.
- Pairs with the "Last edited by [member]" line, which becomes genuinely useful in a shared book.

### Row-context badge cluster (Phase 15 — keep consistent with the list)
The left-pane badges are the **expanded form of the list's row-badge cluster**, one governed system: **family · team · live-shared · emergency** (+ the source chip). The current mock has source / live / family — **add Team and Emergency** so the detail page matches the list. Same glyphs and meanings across both surfaces; "Family book" / "Team book" badges navigate to the relevant group management page.

**Cluster order (mock review):** lead with the **sharing/status** chips (Family → Team → Live), then **Emergency** (red), and put the always-on **Source** chip **last**. The mock currently pushes Source first, which buries the chips the user actually scans for. The glyphs, colours, and order must match the list's inline icon slot (the slot immediately after the name) exactly — same contact, same badges, both surfaces.

---

## Interaction Notes

- **No separate edit mode.** The page does not have a distinct "view mode" vs "edit mode". All fields are always editable by clicking. This keeps the flow frictionless.
- **Auto-save on blur.** Every field save is triggered by losing focus (blur event) or pressing Enter. No "Save" button for individual fields.
- **Keyboard navigation.** Tab moves focus through fields in reading order. Pressing Enter on a non-editing row activates that row's edit mode.
- **Scroll anchoring.** When the user is editing a field and the page scrolls, the edited field stays visible.
- **Destructive actions.** Archive is one-click (reversible). Delete requires a confirmation modal: "Delete [Name] permanently? This can't be undone." with a red "Delete" button and a "Cancel" link.
