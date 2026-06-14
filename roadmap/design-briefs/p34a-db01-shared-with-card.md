# P34A-DB01 — Shared Contact Card (Desktop + Mobile)

**Routes:** `/contacts/[id]?tab=sharing` (desktop column layout + mobile sheet)

**Priority:** P2 — essential for Family/Team plan trust. Members need to know who else can see a shared contact and in what capacity before they edit it.

**Status: SPECCING (2026-06-14).** Tickets P34A-01 (desktop), P34A-02 (mobile), P34A-03 (empty state) implement this brief.

> **Design language:** Kontax system (briefs 01/02) — page bg `#f4f6f2`, white cards, hairline `#d8ddd6` / `#edf0ea`, ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, brand green `#17352e`, brand blue `#4158f4`, amber `#bf8526`. Geist variable. **No dark theme.**

---

## Purpose

Clarify, at a glance, who else can see and edit a shared contact. The card
answers three questions: (1) which shared book contains this contact, (2) who
is in the book, (3) what can each person do. It must be calm and informational
— not alarming — since most users will see it and already understand they're
in a shared book.

Secondary purpose: guide the user toward sharing when a contact isn't shared
yet (empty state), and warn gracefully when the book is no longer accessible.

---

## Layout: Desktop Sharing Tab

The Sharing tab is a right-side column on the contact detail page
(max-width ~380px on desktop). The SharedBookCard sits within the existing
`contact-sharing.tsx` card under the "Add to a shared book" section. The
existing vCard link and Kontax-user share sections appear above it.

```
┌──────────────────────────────────────────────────────────────────┐
│  Share this contact                                               │
├──────────────────────────────────────────────────────────────────┤
│  ▸ vCard link (existing)                                         │
│  ▸ Share with a Kontax user (existing)                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SHARED BOOKS                                                    │
│  ─────────────────────────────────────────────────────────────  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  [👥]  The Smith Family                                    │ │
│  │        Family · 4 members                                  │ │
│  │                                                            │ │
│  │  Anyone in this family book can see and edit this contact. │ │
│  │  ─────────────────────────────────────────────────────     │ │
│  │  [SL]  Sarah Lim                            [Owner     ]  │ │
│  │  [JA]  James Appleseed                      [Can edit  ]  │ │
│  │  [MP]  Maya Patel                           [Can view  ]  │ │
│  │  [TL]  Thomas Lim                           [Can view  ]  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Card anatomy:**
- Outer card: white, `rounded-[14px]`, `border border-[#d8ddd6]`, no shadow.
- Book name row: 16px left padding, `py-3`, flex row, gap-3.
  - Icon: 36px tile, `bg-[#f2f4f0] border-[#e9ece7] rounded-[9px]`, `text-[#5c655e]`.
  - Book name: 14px semibold `#1d2823`, single line.
  - Subtitle: 12px `#8b938c` — "Family · N members" or "Team · N members".
- Callout caption: 12px `#8b938c`, `px-4 pb-3`, wraps naturally, max 2 lines.
- Divider: 1px `#edf0ea`, `mx-4`.
- Member list: `<ul>` flush to card edges, `py-1`.
- Member row: `min-height: 48px`, `px-4`, flex, items-center, gap-3.
  - Avatar: 36px circle, tinted initial, deterministic colour.
  - Name: 13.5px semibold `#1d2823`, `flex-1 truncate min-w-0`.
  - Role badge: right-aligned, `shrink-0`.

---

## Layout: Mobile Sharing Tab

Mobile contact detail (`mobile-contact-detail.tsx`) renders the Sharing tab
as a full-screen sheet (or inline scroll section). The SharedBookCard is
full-width, no max-width constraint.

```
┌─────────────────────────────────────────┐
│  Sharing                                │
│  ─────────────────────────────────────  │
│  ┌─────────────────────────────────┐    │
│  │  [👥]  The Smith Family         │    │
│  │        Family · 4 members       │    │
│  │                                 │    │
│  │  Anyone in this family book     │    │
│  │  can see and edit this contact. │    │
│  │  ───────────────────────────    │    │
│  │  [SL]  Sarah Lim  [Owner    ]   │    │
│  │  [JA]  James App… [Can edit ]   │    │
│  │  [MP]  Maya Patel [Can view ]   │    │
│  │  [TL]  Thomas Lim [Can view ]   │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

Mobile-specific rules:
- Card `mx-4` (16px gutter left and right).
- Row `min-height: 44px` (iOS HIG touch target).
- Role badge: `whitespace-nowrap`, never wraps. Name `truncate` with
  `min-w-0 flex-1` ensures badge always gets its space.
- Callout caption full-width, 13px on mobile (one size up from desktop 12px
  for readability).

---

## Key Components

### 1. Book Name Row

```
[Icon tile]  [Book name, 14px semibold]
             [Subtitle: "Family · N members", 12px muted]
```

The icon tile uses `WorkspaceIcon name="users"` for FAMILY and `"team"` (or
`"building"`) for TEAM. Tile is 36px, not the standard 40px, to keep the row
compact while the rest of the contact detail UI uses 40px tiles. The slight
size reduction signals this is metadata, not an action.

### 2. Explanatory Callout

A short text block below the book name row. Copy:
- Family: "Anyone in this family book can see and edit this contact."
- Team: "Members with edit access can update this contact."

Font: 12px (13px mobile), `#8b938c`. This was previously shown as a subtitle
line inside the book row — demoting it to a separate block makes the book name
more scannable and reduces visual clutter.

### 3. Member Row

```
[Avatar]  [Name]  ···  [Role badge]
```

**Avatar:** 36px circle. Two-letter monogram (first initial of given name +
first initial of family name). Background tint derived deterministically from
the member's name using a `hashCode(name) % TINTS.length` function. Tint
palette (5 colours):

| Index | Background | Text |
|---|---|---|
| 0 | `#d6e7dc` | `#17352e` |
| 1 | `#d6dffb` | `#2036a4` |
| 2 | `#fbe9d6` | `#8c5010` |
| 3 | `#f0d6fb` | `#6b1a9c` |
| 4 | `#f0f0d6` | `#6b6b10` |

The tint function must be deterministic so a member's avatar colour is
consistent across page loads and devices.

**Name:** `text-[13.5px] font-semibold text-[#1d2823] truncate`. On desktop
the column is ~260px wide; most names fit but edge cases truncate gracefully.

**Role badge:** Filled pill, white text, `11.5px bold`, `h-[22px]`,
`px-2 rounded-[6px]`. Three states:

| Role | Badge label | Background | Text |
|---|---|---|---|
| OWNER | "Owner" | `#17352e` (brand green) | white |
| CAN_EDIT | "Can edit" | `#4158f4` (brand blue) | white |
| CAN_VIEW | "Can view" | `#5c655e` (secondary ink) | white |

### 4. Overflow Row

If a book has more than 6 members, show 5 members and an overflow row:

```
  [+3]  And 3 more members
```

The `[+3]` circle uses the muted tint (`bg-[#f2f4f0] text-[#5c655e]`).
"And N more members" in 12px muted. Non-interactive for now (expand in a
future ticket).

---

## States

### Default (contact in a shared book)

The SharedBookCard renders as above. If the contact is in multiple books,
stack multiple cards with a gap-3 between them.

### Empty State (contact not shared, P34A-03)

Rendered above the section GroupLabel when `books.length === 0 &&
vcardLinks.length === 0 && no active shares`:

```
┌───────────────────────────────────────────┐
│                                           │
│          [👥 large muted icon]            │
│                                           │
│   This contact isn't shared yet           │
│   Share with a family member or           │
│   generate a share link                   │
│                                           │
│   [Share link]   [Add to shared book]     │
│                                           │
└───────────────────────────────────────────┘
```

- Icon: 52px muted circle `bg-[#f2f4f0]`, `WorkspaceIcon name="users"` size
  26 `text-[#aeb4ac]`.
- Heading: 15px semibold `#1d2823`.
- Sub-copy: 13px `#8b938c`.
- "Add to shared book" button: shown only if `books.length > 0` (user has a
  book, but this contact isn't in it yet).

### Pending Invite State

A member who has been invited but hasn't accepted yet:

```
  [--]  sarah@example.com         [Invited  ]
```

- Avatar: dashed border `border-dashed border-[#d8ddd6]`, monogram from email
  prefix, lighter tint (`bg-[#f2f4f0] text-[#8b938c]`).
- Name/email in `#8b938c` (muted, not full ink).
- Badge: "Invited", `bg-[#f2f4f0] text-[#5c655e]`.

### Error State (book no longer accessible)

If the book query returns an error (e.g. the family book was dissolved or the
user was removed):

```
┌───────────────────────────────────────────────────────┐
│  [!]  This book is no longer accessible               │
│       Contact your account owner to restore access.   │
└───────────────────────────────────────────────────────┘
```

- Amber tone: `bg-[#f6edd9] border border-[#ecdcb6] text-[#7a5a1a] rounded-[12px] px-4 py-3`.
- `WorkspaceIcon name="alertTriangle"` size 16 `text-[#bf8526]`.
- The error replaces the member list only; the book name row still renders.

---

## Spacing & Typography Reference

| Element | Size | Weight | Color |
|---|---|---|---|
| Book name | 14px | 600 | `#1d2823` |
| Book subtitle | 12px | 400 | `#8b938c` |
| Callout caption | 12px (13px mobile) | 400 | `#8b938c` |
| Member name | 13.5px | 600 | `#1d2823` |
| Role badge | 11.5px | 700 | white |
| Overflow label | 12px | 400 | `#5c655e` |
| Empty state heading | 15px | 600 | `#1d2823` |
| Empty state sub-copy | 13px | 400 | `#8b938c` |

Card internal spacing:
- Book name row: `pt-4 pb-3 px-4`
- Callout: `px-4 pb-3`
- Divider: `mx-4`
- Member list: `pt-1 pb-2`
- Member row: `px-4`, `min-height 48px` desktop / `44px` mobile

---

## Notes for the Designer

- **Keep it calm.** The card is informational. People in a shared book aren't
  doing anything unusual — don't make the card feel like a warning. Neutral
  white card, muted icon, conversational caption copy. The role badges use
  colour to communicate access level, not urgency.
- **Owner badge is green** (brand green `#17352e`) to signal trust and
  authority, not danger. The user who is viewing the page is often the Owner
  themselves.
- **"Can edit" in blue** (`#4158f4`) matches the CTA colour — it reads as
  "active, empowered". "Can view" in grey reads as "passive, read-only".
- **Avatar tints** are purely decorative. The colour assignment must be
  consistent across sessions (deterministic hash) so the user builds a mental
  map: "purple avatar = Maya, green avatar = Thomas". Don't randomise.
- **Pending invite** uses dashed avatar border to signal incompleteness —
  the person hasn't actually joined yet. Keep this subtle; don't make it look
  broken.
- **Empty state icon:** use the people/group icon (not a lock or share icon)
  because the message is about the absence of people, not about access or
  external sharing.
- **Mobile:** the key constraint is the role badge never wrapping. On a 375px
  viewport with `px-4` on both sides (32px), avatar (36px) + gap (12px) = 80px,
  leaving 263px for name + badge. The widest badge is "Can edit" (~64px).
  Remaining for name: 199px — enough for ~22 chars before truncation. This is
  fine for 99% of names; the truncation is graceful.
- **Do not** show an "Add to book" or "Remove from book" button on this card
  in Phase 34A. Those actions are Phase 13+ and the earlier disabled `Add`
  button added confusion. The card is informational only for now.
