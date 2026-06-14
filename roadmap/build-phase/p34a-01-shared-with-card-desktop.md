# P34A-01 — Shared With Card Rebuild (Desktop)

## Purpose

Replace the raw "Shared with the X Family/Team book" text row on the contact
detail Sharing tab with a structured, polished **Shared With card** that names
the book, lists every member with an avatar and role badge, and makes ownership
clear at a glance.

## Background

The `ContactSharing` component (`src/app/_components/contact-sharing.tsx`)
renders an "Add to a shared book" section via `<BookRow>` that shows the book
name + member count, but gives the user no sense of who can see this contact or
what role they each hold. The `Add` button is disabled (`cursor-not-allowed`)
pending Phase 13. The explanatory copy inside the row is long and inline.

Phase 34A-DB01 (design brief) specifies the full visual language for this
card. This ticket implements the **desktop variant** only; P34A-02 handles
mobile. The DB01 brief covers member API shape, avatar tints, and role badge
colours.

## Scope

**In scope**
- Rebuild `<BookRow>` inside `contact-sharing.tsx` (or extract a new
  `<SharedBookCard>` component imported by it).
- Book name row: people icon + book name as semibold 14px ink, subtitle
  line "Family · N members" or "Team · N members" at 12px muted `#8b938c`.
- Explanatory callout demoted below the book name as a 12px muted caption
  (currently it is inline subtitle text that reads too prominently).
- Hairline divider (`#edf0ea`, 1px) between the callout and the member list.
- Member rows (48px row height):
  - 36px avatar: circle, tinted initial (two-letter monogram), background tint
    derived from member's name (use the same deterministic-tint function used
    elsewhere in the app, or the colour map from DB01).
  - Name at 13.5px semibold ink `#1d2823`.
  - Right-aligned role badge pill.
- Role badge colours (filled pill, all white text, 11.5px bold):
  - **Owner** — `#17352e` bg (brand green).
  - **Can edit** — `#4158f4` bg (brand blue).
  - **Can view** — `#5c655e` bg (secondary ink).
- Card container: white, `rounded-[14px]`, `border border-[#d8ddd6]`.

**Out of scope**
- Add/remove member actions (Phase 13+).
- Mobile layout (P34A-02).
- Pending invite state (tracked in DB01 but deferred to a follow-up if the
  invite model isn't live yet).
- Empty state when contact has no shared books (P34A-03).

## Design / Implementation Spec

### Data shape

The `SharedBook` type in `contact-sharing.tsx` currently carries:
```ts
type SharedBook = {
  id: string;
  name: string;
  type: "FAMILY" | "TEAM";
  memberCount: number;
};
```

Extend to include members for the rebuild:
```ts
type SharedBookMember = {
  id: string;
  name: string;
  role: "OWNER" | "CAN_EDIT" | "CAN_VIEW";
  pending?: boolean;   // invited but not yet accepted
};

type SharedBook = {
  id: string;
  name: string;
  type: "FAMILY" | "TEAM";
  memberCount: number;
  members: SharedBookMember[];
};
```

Update the `sharedBooks` query in `src/app/contacts/[id]/page.tsx` (the
`detailTab === "sharing"` branch, currently around line 436) to join the
`GroupMember` (or equivalent) table and return member name + role for each
book the contact belongs to. The contact detail page already loads the book
list; extend the SELECT to include members.

### Component structure

Extract a `<SharedBookCard book={book} />` component (can live in the same
file or a sibling file `shared-book-card.tsx`). Structure:

```
<section> ← white card, rounded-[14px], border-[#d8ddd6]
  <div> ← book name row, flex, items-center, gap-3, px-4 pt-4 pb-3
    <IconTile icon={isFamily ? "users" : "team"} />
    <div>
      <h4> book name, 14px semibold ink </h4>
      <p> "Family · N members" or "Team · N members", 12px muted </p>
    </div>
  </div>
  <p> ← 12px muted caption callout, px-4 pb-3
    "Anyone in this {family|team} book can see and edit this contact."
  </p>
  <div class="mx-4 h-px bg-[#edf0ea]" />  ← divider
  <ul> ← member list
    {members.map(member => <MemberRow member={member} />)}
  </ul>
</section>
```

### MemberRow

```
<li class="flex items-center gap-3 px-4" style="min-height: 48px">
  <Avatar name={member.name} size={36} />
  <span class="flex-1 text-[13.5px] font-semibold text-[#1d2823] truncate">
    {member.name}
  </span>
  <RoleBadge role={member.role} />
</li>
```

### Avatar tint

Use a deterministic colour derived from the member's name. A simple approach:
`hashCode(name) % TINTS.length` where TINTS is the same palette used by the
`<LiveFromPanel>` (`bg: "#d6e7dc", color: "#17352e"` for green). Extend to
cover at least 5 distinct tints (see DB01 palette spec).

### RoleBadge

```tsx
const ROLE_STYLES = {
  OWNER:    { bg: "#17352e", label: "Owner" },
  CAN_EDIT: { bg: "#4158f4", label: "Can edit" },
  CAN_VIEW: { bg: "#5c655e", label: "Can view" },
};

function RoleBadge({ role }: { role: SharedBookMember["role"] }) {
  const s = ROLE_STYLES[role];
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[11.5px] font-bold text-white whitespace-nowrap"
      style={{ background: s.bg }}
    >
      {s.label}
    </span>
  );
}
```

## Acceptance Criteria

- [ ] The "Add to a shared book" section on the Sharing tab (desktop) renders
      the new SharedBookCard when the contact belongs to one or more books.
- [ ] Each card shows: book icon, book name, subtitle with type + member count,
      muted callout caption, hairline divider, and member rows.
- [ ] Each member row shows: 36px tinted-initial avatar, name, right-aligned
      role badge with correct colour for OWNER / CAN_EDIT / CAN_VIEW.
- [ ] The old disabled `Add` button is removed from the card.
- [ ] Row height is visually ≥ 48px.
- [ ] No TypeScript errors (`tsc --noEmit` passes).
- [ ] No visual regression on the vCard link, static share, and live share
      sections (they are sibling sections in the same component).

## Risks / Open Questions

- The `GroupMember` table might not currently expose a `role` enum; confirm
  the Prisma schema has role info on book membership (or add it).
- Avatar tint function: decide whether to reuse an existing utility or add a
  small new one. Keep it pure (no DB call).
- If a book has 7 or more members, clamp the visible list to 5 + "And N more
  members" overflow row (N = total − 5). Rows are never partially clipped.
  Aligned to DB01 artboard — supersedes the earlier "6 + overflow at >8" rule.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: update "Sharing" component docs to
      reflect SharedBookCard and extended SharedBook type
