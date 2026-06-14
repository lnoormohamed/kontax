# P34A-03 — Sharing Tab Empty State

## Purpose

When a contact has no active shares of any kind — not in a shared book, no
live or static shares sent, no vCard link — the Sharing tab currently renders
only the "Add to a shared book" section with its disabled `Add` button (now
removed in P34A-01) and an empty dashed card. Add a proper empty state with
an illustrative icon, clear heading, sub-copy, and two contextual CTAs.

## Background

The `ContactSharing` component (`src/app/_components/contact-sharing.tsx`)
always renders all three sections (vCard link, Share with a Kontax user, Add
to a shared book). When a contact has never been shared, the "Share with a
Kontax user" section shows empty collapsed ActionRows and the "Add to a
shared book" section shows the dashed "No shared books yet" card. Together
these give a sparse, confusing impression.

The goal is not to remove the sections entirely — it's to add a warm,
actionable empty state **at the top of the card** (or as the card's only
content when nothing is active) that guides the user toward the most common
first action.

## Scope

**In scope**
- Detect "nothing shared" state: `vcardLinks.length === 0 &&
  staticShares.every(s => s.status !== "ACTIVE") &&
  liveShares.every(s => s.status !== "ACTIVE") && books.length === 0`.
- When that condition is true, render an **EmptySharing** section at the top
  of the card, above the existing sections.
- Icon: a muted people/share icon (use `WorkspaceIcon name="users"` or
  `"share"`, size 36, `text-[#aeb4ac]`).
- Heading: "This contact isn't shared yet" (16px semibold `#1d2823`).
- Sub-copy: "Share with a family member or generate a share link" (13px
  muted `#8b938c`).
- Two CTAs:
  1. **"Share link"** — primary outlined button, triggers the vCard link
     creation (`createVcardShareLink` server action). Reuse the existing
     `<form action={createVcardShareLink}>` pattern from the vCard link
     section.
  2. **"Add to shared book"** — secondary outlined button, shown **only** if
     the user has at least one family or team book available (i.e.
     `books.length > 0` — but the contact isn't in it yet). Scrolls to or
     opens the "Add to a shared book" section.
- The existing sections remain below the empty state; the empty state is an
  additive callout, not a replacement.

**Out of scope**
- "Shared but no activity" state (contact is in a book but no individual
  shares): handled by P34A-01/02 card.
- Mobile-specific layout differences (the component is shared; the empty
  state should work on both). If needed, mobile can hide the second CTA.

## Design / Implementation Spec

### Detection logic

```tsx
const isCompletelyUnshared =
  vcardLinks.length === 0 &&
  !staticShares.some((s) => s.status === "ACTIVE") &&
  !liveShares.some((s) => s.status === "ACTIVE") &&
  books.length === 0;
```

This goes in `ContactSharing` (and its mobile counterpart used in
`mobile-contact-detail.tsx`).

### Empty state component

```tsx
function EmptySharingState({
  contactId,
  hasBooks,
}: {
  contactId: string;
  hasBooks: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <span className="grid size-[52px] place-items-center rounded-full bg-[#f2f4f0] text-[#aeb4ac]">
        <WorkspaceIcon name="users" size={26} strokeWidth={1.5} />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-[#1d2823]">
          This contact isn't shared yet
        </p>
        <p className="mt-1 text-[13px] text-[#8b938c]">
          Share with a family member or generate a share link
        </p>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <form action={createVcardShareLink}>
          <input name="contactId" type="hidden" value={contactId} />
          <button
            className="rounded-[9px] border border-[#d8ddd6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            type="submit"
          >
            Share link
          </button>
        </form>
        {hasBooks ? (
          <a
            className="rounded-[9px] border border-[#d8ddd6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            href="#contact-sharing-books"
          >
            Add to shared book
          </a>
        ) : null}
      </div>
    </div>
  );
}
```

Place this immediately after the `<h3>Share this contact</h3>` heading and
divider in `ContactSharing`, before the first `<GroupLabel>`:

```tsx
{isCompletelyUnshared ? (
  <EmptySharingState contactId={contactId} hasBooks={books.length > 0} />
) : null}
```

Add `id="contact-sharing-books"` to the "Add to a shared book" `<GroupLabel>`
or its container so the anchor link works.

### "Share link" CTA behaviour

Submitting the form calls `createVcardShareLink` (already imported). On
success, Next.js re-validates the page and the vCard link section appears.
The empty state disappears because `vcardLinks.length > 0`.

### Mobile

`mobile-contact-detail.tsx` renders sharing separately. After P34A-01/02 the
mobile sharing uses `<ContactSharing>` or its own section. Apply the same
`isCompletelyUnshared` logic and `<EmptySharingState>` component in both
places, or pass it as a prop.

## Acceptance Criteria

- [ ] When a contact has never been shared (no vCard links, no static/live
      shares, no shared books), the Sharing tab opens to the empty state icon
      + heading + sub-copy + CTAs.
- [ ] "Share link" button on the empty state successfully creates a vCard
      link (same as the existing flow in the vCard section).
- [ ] "Add to shared book" button is shown only when the user has a family or
      team book; it is hidden when `books.length === 0`.
- [ ] After creating a share link from the empty state, the empty state
      disappears and the vCard link section is visible.
- [ ] The existing sections (vCard, static share, live share, books) still
      render correctly when the contact IS shared.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- The `books` prop currently reflects books the user has, not books the
  contact is in. Confirm this remains the right prop to check for "has books
  to add to". If `books` only contains books the contact is already in, the
  "Add to shared book" CTA gating logic needs the user's book list separately.
- Smooth scroll to the books section may require `scroll-behavior: smooth` on
  the parent container.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: note empty state condition in sharing
      component
