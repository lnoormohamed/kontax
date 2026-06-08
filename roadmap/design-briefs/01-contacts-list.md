# 01 — Contacts List

**Route:** `/` (logged in)
**Priority:** P0 — this is the product. Every other page exists to support this one.

---

## Purpose

This is the first screen a user sees after logging in and the screen they return to after every action. It is a personal phone book — the place where all contacts live, where you search, where you browse, and where you land after creating, editing, or merging a contact.

The reference point is **Google Contacts on desktop**: clean white canvas, alphabetically grouped list, avatar circles, one row per person, search always visible, one prominent create action. That familiarity is intentional — users should feel oriented immediately.

---

## Layout

### Overall structure

Three zones, left to right on desktop:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER (sticky)                                        │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  LEFT        │  CONTACT LIST                            │
│  SIDEBAR     │  (scrollable)                            │
│  (fixed)     │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

On tablet: sidebar collapses behind a hamburger or bottom tab strip.
On mobile: sidebar becomes a bottom navigation bar. List takes the full screen.

---

## Zone 1 — Header (sticky)

The header stays fixed at the top as the list scrolls beneath it.

### Left side
- Kontax wordmark / logo mark. Tapping it returns to this page.

### Centre
- **Search bar** — wide, full-width feel. Placeholder: *"Search by name, email, phone, company…"*
- Search is always visible on desktop. On mobile it can collapse behind a search icon.
- Searching filters the visible list in place. No separate search results page.
- Clear (✕) button appears when the field has a value.

### Right side
- **Create contact** button — the single primary CTA. Blue, rounded-pill shape. Always visible.
- **User avatar / initials** — tapping opens a minimal dropdown: Settings, Sign out.
- No other top-level nav items in the header. Keep it clean.

### Header height
- ~56–64px. Tight enough to maximise list space but comfortable for touch.

---

## Zone 2 — Left Sidebar

Fixed width, ~240px on desktop. Contains all navigation and filtering controls.

### Top section: account context
- Small user avatar + name + plan badge (Free / Pro / Family / Teams).
- Tapping this goes to Settings.

### Primary navigation

```
📋  People           [count]
⭐  Favorites
🗂  Archived         [count]
👥  Duplicates       [count, badge if >0]
```

- **People** is the default active state on login.
- Counts shown in muted text or a subtle pill badge.
- Duplicates badge turns amber/orange when there are open suggestions.

### Filters (under People)
When People is active, show secondary filters indented below:

```
    All contacts
    Recently updated
    Missing details
```

### Labels / Tags (future — Phase roadmap)
A collapsible section below filters for user-defined labels:

```
▾ Labels
    Family
    Work
    VIP
    + Create label
```

### Shared books (Family/Teams — future)
For users on Family or Teams plans, show shared address books below personal navigation:

```
▾ Smith Family
    Family book   [count]

▾ Acme Corp (Team)
    Clients       [count]
    Partners      [count]
```

### Bottom of sidebar
- **Import** — secondary link, muted
- **Export** — secondary link, muted
- **Sync** — secondary link, muted. Dot indicator if sync error exists.

---

## Zone 3 — Contact List

The main content area. This is the phone book.

### Section headers (alphabetical grouping)
When sorted by name, contacts are grouped by the first letter of their last name (or first name if no last name).

```
A
──────────────────────────────────────
  [avatar]  Alice Baker           →
  [avatar]  Andrew Chen           →

B
──────────────────────────────────────
  [avatar]  Barbara Nguyen        →
```

- Section letter: large, bold, muted (slate-300 or similar), left-aligned, ~32px.
- A thin divider line separates the letter from the rows below it.
- When sorted by "Recently updated", no alphabetical grouping — flat list in date order.

### Contact row — default state

```
┌────────────────────────────────────────────────────────┐
│  [AV]  Full Name           email@example.com   +44 ... │
└────────────────────────────────────────────────────────┘
```

Left to right:
1. **Avatar circle** — 36–40px. Shows initials (2 chars) with a soft background colour derived from the name. If the contact has a photo, show it. No placeholder image — just initials.
2. **Full name** — semibold, slate-900, ~14–15px.
3. **Company** (if present) — muted text immediately after or below the name. Small, slate-500.
4. **Primary email** — right-aligned or in a secondary column, slate-600.
5. **Primary phone** — right-aligned, slate-600.
6. **Star icon** — far right, visible only if `isFavorite: true`. Filled star, amber.
7. **Sync badge** (future) — small coloured dot indicating sync source (iCloud, Google, etc.) if relevant.

Row height:
- **Compact view**: ~48px. Name + company on one line, email + phone inline.
- **Cozy view**: ~64px. Name on first line, company/email/phone on second line.

### Contact row — hover/focus state
On hover (desktop) or long-press (mobile), reveal inline action buttons on the far right:

```
  [AV]  Full Name  email@example.com   ⭐  ✏️  ⋯
```

- **Star** — toggle favourite
- **Edit** — open contact in edit mode
- **More (⋯)** — dropdown: Archive, Share, Copy link, Delete

Hovering the row should also subtly highlight the background (very light, e.g. slate-50 or a tinted surface colour). The row should feel pressable, not just hoverable.

### Favorites
Favorited contacts float to the top of the list with a subtle "Favorites" section header above them, regardless of sort order. After favorites, the rest of the list continues normally (alphabetical or by date).

```
★ Favorites
──────────────────────────────────────
  [AV]  Alice Baker   ⭐  email  phone
  [AV]  James Liu     ⭐  email  phone

A
──────────────────────────────────────
  [AV]  Alice Baker   email  phone
  ...
```

### Toolbar (above the list, below the sidebar nav or as a sub-bar)
A compact bar directly above the list area, not inside the sidebar:

```
[Sort: Name ▾]  [View: Compact ▾]         342 contacts
```

- Sort dropdown: Name A–Z / Recently updated
- View toggle: Compact / Cozy (or icon toggles: ☰ / ⊞)
- Contact count: right-aligned, muted
- On mobile: these collapse into a single filter/sort icon button

---

## States

### Empty state (no contacts)
Large, friendly illustration or icon centred in the list area.
Headline: *"Your contacts list is empty"*
Subtext: *"Add your first contact or import from Google, Apple, or Outlook."*
Two actions: **Add contact** (primary) / **Import contacts** (secondary)

### Empty state (search returned nothing)
*"No contacts match "[query]""*
Subtext: *"Try a different name, email, or phone number."*
Link to clear search.

### Empty state (filter returned nothing)
Inline empty message within the filter context:
*"No favorites yet"* / *"No contacts with missing details"* / *"No archived contacts"*
Each with a contextual suggestion.

### Search active
- The list filters in real time (or on submit for server-side).
- Matched text is highlighted in the name/email/phone fields.
- A "Clear search" chip appears near the toolbar.

### Loading state
- Skeleton rows matching the Compact or Cozy row height.
- 8–12 skeleton rows visible.
- No spinner — skeleton only.

### Plan limit warning
When the user is approaching or at their contact limit (Free: 500):
- A non-intrusive banner above the list: *"You have 12 contacts remaining on the Free plan. Upgrade for unlimited."*
- Banner closes on dismiss (remembered per session).
- Does not block the list.

### Sync error indicator
If a connected sync account has an error, show a subtle strip or dot near the Sync sidebar link:
- Do not put it in the header or disrupt the list.
- Clicking it goes to the Sync page.

### Account lifecycle states
- **Grace / Past due**: amber banner above the list. *"Your subscription needs attention."* CTA to settings.
- **Locked / Canceled**: contacts become read-only. List visible. Create/edit actions disabled with a tooltip explaining why.

---

## Tabs: Archived and Duplicates

The same list container is reused for Archived and Duplicates tabs. The layout remains identical — only the data and empty states change.

### Archived tab
- Same row format as People.
- Extra column or badge: archived date.
- Row actions change to: **Restore**, **Delete permanently**.

### Duplicates tab
Each item is a **pair card**, not a single row:

```
┌─────────────────────────────────────────────────────────┐
│  [AV] Alice Baker  ↔  [AV] Alice C. Baker              │
│  HIGH CONFIDENCE  ·  Same email address                 │
│                                   [Review]  [Dismiss]   │
└─────────────────────────────────────────────────────────┘
```

- Confidence badge: red for HIGH, amber for MEDIUM, grey for LOW.
- Reasons shown as short one-liners below the names.
- **Review** → goes to the field-level merge page.
- **Dismiss** → removes from list with undo toast.
- If there are many pairs, a **"Accept all high-confidence"** bulk action button appears above the list.

---

## Mobile layout

On mobile (< 768px):

- **Header**: logo left, search icon centre (expands to full-width input), create button right.
- **List**: full-width, Cozy view by default (more space per row, easier tap targets).
- **Bottom navigation bar**: People | Favorites | Archived | Duplicates | More
- Row tap → full-screen contact detail (push navigation, back button in top-left).
- Row swipe-right → Star/unstar.
- Row swipe-left → Archive.
- No persistent sidebar.

---

## Future additions (to design now as placeholder, build later)

These surfaces will appear in this page as new phases ship. Design should account for them structurally even if they are not yet built:

- **Shared book section in sidebar** (Family/Teams plan) — already described above.
- **Family badge on rows** — small pill badge ("Family") on contacts that belong to the family shared book.
- **Team/book badge** — small pill badge ("Clients") on contacts from a team address book.
- **Activity log tab** — a fourth tab alongside People/Archived/Duplicates for Pro users. Activity feed, not a contact list.
- **Incoming share notification** — a badge count on a notification bell in the header. Tapping opens a pending shares sheet.
- **"Live from [Name]" indicator** — a subtle badge on contacts that are live-linked from another user's account.

---

## What this page is NOT

- Not a dashboard with stats and charts.
- Not a CRM with pipeline or deal stages.
- Not a communications hub (no "send message" as a primary action).
- Not a homepage with marketing copy.

The page is a **list of people**. Design everything in service of that.
