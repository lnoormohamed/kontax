# P34A-10 — "Merge with Another Contact" from Contact Detail

## Purpose

Add a user-initiated merge entry point to the contact detail ··· menu so any
user can manually merge two contacts they know are duplicates, without waiting
for the suggestion engine to flag them.

## Background

Design brief 09-merge-duplicates.md documents the "Manual merge" gap:
> The manual route still runs the legacy two-card "keep A / keep B" form
> (`merge-preview-form.tsx`, dark-theme, scalar choices only). Target design:
> a picker step that hands off to the same field-level review component used
> by `/merge-suggestions/[id]`.

This ticket implements that target design. The `··· more` menu on the contact
detail page already exists (both desktop sidebar and mobile action sheet);
this ticket adds the "Merge with another contact" option to it.

## Scope

**In scope**
- Add "Merge with another contact" to the ··· menu on the contact detail page
  (`src/app/contacts/[id]/page.tsx`), visible to contact owners only (not on
  live-received contacts).
- A contact picker overlay: full-screen on mobile, a centred modal (max-width
  540px) on desktop.
- Reuse the existing search infrastructure (the `SearchDropdown` component or
  the mobile search overlay) to find the target contact.
- After selection: show a confirmation step with the side-by-side comparison
  table (reuse P34A-08 `<ComparisonTable>`) to let the user verify they've
  picked the right pair.
- "Confirm & review" → navigate to the merge review page with both contact
  IDs pre-loaded. Do NOT build a separate merge flow — hand off to the
  existing `/merge-suggestions/[id]` (or create a temporary suggestion if
  needed — see implementation note below).
- On successful merge: redirect to the surviving contact.

**Out of scope**
- Updating the legacy `/merge/manual` page (leave it as-is; it is accessed
  directly by its own URL, not via this entry point).
- Merging more than two contacts at once.

## Design / Implementation Spec

### Entry point

In the ··· menu (location: search for the dropdown/sheet that contains
"Delete contact", "Export contact" etc. in `page.tsx` or a sibling
component):

```tsx
{!isLiveReceived && isOwner ? (
  <button
    onClick={() => setMergePickerOpen(true)}
    type="button"
  >
    Merge with another contact
  </button>
) : null}
```

### Contact picker overlay

```
Desktop modal (max-w-[540px], centred with backdrop):
┌─────────────────────────────────────────────────────┐
│  ✕  Merge with another contact                       │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐  │
│  │ 🔍  Search contacts…                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  [Avatar] Jane Smith                          │  │
│  │           jane@example.com                    │  │
│  ├───────────────────────────────────────────────┤  │
│  │  [Avatar] Jane M. Smith                       │  │
│  │           jsmith@work.com                     │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Searching your contacts — 8 results               │
└─────────────────────────────────────────────────────┘

Mobile: full-screen sheet, same search input at top, results fill the viewport
```

Reuse the existing `/api/contacts/search` endpoint (P33-01). Exclude the
current contact (`id !== currentContactId`) from results. Show avatar +
name + email/phone secondary. Keyboard navigable.

### After selection — confirmation step

Once the user selects a target contact, the overlay transitions to a
confirmation view:

```
┌─────────────────────────────────────────────────────┐
│  ← Change contact                                    │
│                                                     │
│  Merge these two contacts?                          │
│  This will open the merge review page where you     │
│  can choose which fields to keep.                   │
│                                                     │
│  [ComparisonTable — read-only, highlights diffs]   │
│                                                     │
│  [Cancel]          [Compare & merge →]              │
└─────────────────────────────────────────────────────┘
```

`<ComparisonTable>` from P34A-08 — reuse the same component with both
contacts' data. Read-only here (no picking, that's on the review page).

### Handoff to review page

**Approach A (preferred if feasible):** Create a temporary `MergeSuggestion`
row with `source: "MANUAL"` and `status: "OPEN"`, then navigate to
`/merge-suggestions/[id]`. The review page already handles the full
resolution flow. Delete the suggestion row after the merge (or mark
`RESOLVED`).

**Approach B (fallback):** Pass the two contact IDs as query params to a new
`/merge/manual?a=[id]&b=[id]` route that loads both contacts and renders the
existing `<MergeReview>` component directly, bypassing the suggestion table.

Prefer Approach A to reuse maximum existing code. Approach B is acceptable if
creating a throwaway suggestion row feels wrong.

### Server action

```ts
// src/app/actions/merge.ts
export async function createManualMergeSuggestion(
  contactAId: string,
  contactBId: string,
): Promise<string> {   // returns the suggestion id
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const [aId, bId] = [contactAId, contactBId].sort();
  const suggestion = await db.mergeSuggestion.create({
    data: {
      userId: session.user.id,
      contactAId: aId,
      contactBId: bId,
      score: 0,
      signals: [],
      status: "OPEN",
      source: "MANUAL",
    },
  });
  return suggestion.id;
}
```

Add `source String @default("AUTO")` to `MergeSuggestion` in the schema if
not already present; run `prisma db push`.

### Success redirect

On merge completion, the review page already redirects to the survivor's
detail page with `?saved=1`. No additional handling needed.

## Acceptance Criteria

- [ ] The ··· menu on the contact detail page (desktop + mobile) shows
      "Merge with another contact" for owned contacts.
- [ ] The option is hidden on live-received contacts.
- [ ] Tapping opens the contact picker overlay.
- [ ] Searching finds contacts from the user's address book (excluding the
      current contact).
- [ ] Selecting a contact transitions to the confirmation view with a read-only
      field comparison.
- [ ] "Compare & merge →" navigates to the merge review page with both
      contacts loaded.
- [ ] The full conflict resolution and merge flow completes successfully.
- [ ] After merge, the user lands on the surviving contact.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- If `MergeSuggestion.source` column doesn't exist, add it (migration-free:
  `prisma db push`). The review page may need a small guard to hide the
  "why this was suggested" panel when `source === "MANUAL"`.
- The contact picker must not show contacts from shared books the user
  doesn't own, or handle the case where the selected contact is a live-shared
  copy (merging it would be confusing).
- Confirm whether `SearchDropdown` can be used inside a modal or if it opens
  its own popover that would clip at the modal boundary.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: update brief 09 to mark the manual
      merge gap as resolved; document the MANUAL source field on
      MergeSuggestion
