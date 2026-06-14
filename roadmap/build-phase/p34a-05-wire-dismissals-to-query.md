# P34A-05 — Wire Dismissals into Duplicate Query

## Purpose

Exclude `MergeDismissal` pairs from the duplicate suggestion list so
dismissed pairs never re-appear, even after a fresh suggestion-generation
run. Also wire the "Not a duplicate" button to call `dismissMergeSuggestion`
and optimistically remove the card from the list.

## Background

`MergeDismissal` rows are created by P34A-04 but the duplicate query that
feeds `/?tab=duplicates` and the suggestion-generation job don't consult
them yet. This ticket is the join/filter step.

The duplicate suggestion query lives in
`src/server/contact-merge.ts` (the same file that runs `findDuplicates` /
`generateMergeSuggestions`). The generation job also lives there or is
called from `src/app/api/merge-suggestions/refresh/route.ts`.

## Scope

**In scope**
- Add a `NOT EXISTS` / `LEFT JOIN + IS NULL` filter on `MergeDismissal` to
  the **suggestion query** so dismissed pairs are excluded when loading the
  duplicates list.
- Add the same filter to the **generation job** so the job never persists a
  new `MergeSuggestion` for a dismissed pair.
- Wire the "Not a duplicate" button (in the duplicates list, not just on the
  review page) to call `dismissMergeSuggestion` + optimistically remove the
  card.
- Optimistic removal: on button click, immediately hide the card (CSS
  transition, fade + slide up), then run the server action in the background.
  On server error, restore the card and show a brief toast.

**Out of scope**
- Un-dismiss UI (deliberate; treat dismissal as permanent for now).
- Bulk dismiss.

## Design / Implementation Spec

### Suggestion query filter

In `src/server/contact-merge.ts`, the function that reads active suggestions
for a user (called when the duplicates list loads) uses Prisma. Extend the
`where` clause:

```ts
// Inside the findMany / query for open merge suggestions:
where: {
  userId,
  status: "OPEN",
  // Exclude dismissed pairs.
  NOT: {
    OR: [
      {
        // Pair exists as (contactAId = A, contactBId = B)
        user: {
          dismissals: {
            some: {
              contactAId: { equals: db.mergeSuggestion.fields.contactAId },
              contactBId: { equals: db.mergeSuggestion.fields.contactBId },
            },
          },
        },
      },
    ],
  },
},
```

The Prisma approach above requires a subquery; it may be cleaner to use a
raw SQL `NOT EXISTS`:

```ts
const dismissed = await db.mergeDismissal.findMany({
  where: { userId },
  select: { contactAId: true, contactBId: true },
});

// Build an exclusion set.
const dismissedSet = new Set(
  dismissed.map((d) => `${d.contactAId}:${d.contactBId}`),
);

// Filter suggestions after fetch (acceptable for small lists ≤ 200 pairs).
const suggestions = rawSuggestions.filter((s) => {
  const [aId, bId] = [s.contactAId, s.contactBId].sort();
  return !dismissedSet.has(`${aId}:${bId}`);
});
```

For the generation job (which may create suggestions in bulk), apply the same
exclusion before calling `db.mergeSuggestion.upsert` / `createMany`:

```ts
const existing = await db.mergeDismissal.findMany({
  where: { userId },
  select: { contactAId: true, contactBId: true },
});
const dismissedKeys = new Set(
  existing.map((d) => `${d.contactAId}:${d.contactBId}`),
);

// Filter candidates before persisting.
const toCreate = candidates.filter((c) => {
  const [aId, bId] = [c.contactAId, c.contactBId].sort();
  return !dismissedKeys.has(`${aId}:${bId}`);
});
```

### Duplicates list "Not a duplicate" button

The duplicates list renders suggestion cards. Each card has a dismiss action.
Locate the dismiss button in:
- `src/app/_components/merge-suggestion-dismiss-button.tsx` (existing), or
- Inline in the duplicates tab list component.

Update the button to also call `dismissMergeSuggestion(contactAId, contactBId)`:

```tsx
async function handleDismiss() {
  // Optimistic: hide card immediately.
  setDismissed(true);
  try {
    await Promise.all([
      dismissSuggestion(suggestionId),       // existing: sets status DISMISSED
      dismissMergeSuggestion(contactAId, contactBId), // P34A-04
    ]);
  } catch {
    setDismissed(false);
    toast.error("Couldn't dismiss — try again");
  }
}
```

Animated card removal: wrap the card in a `<div>` with `transition-all
duration-200` and apply `opacity-0 max-h-0 overflow-hidden` when
`dismissed === true`. This is the same pattern used by other optimistic-remove
lists in the app.

### Review page dismiss button

`src/app/merge-suggestions/[id]/page.tsx` has a `<DismissCard>` (brief 09,
section 8). After this ticket, clicking "Dismiss suggestion" also calls
`dismissMergeSuggestion`. The review page already redirects to
`/?tab=duplicates` on dismiss — no optimistic UI needed there.

## Acceptance Criteria

- [ ] A dismissed pair never reappears in `/?tab=duplicates` after page
      refresh, even if the refresh job re-runs.
- [ ] A dismissed pair is not inserted by the generation job into
      `MergeSuggestion`.
- [ ] The "Not a duplicate" button on the duplicates list card optimistically
      removes the card with a fade/slide animation.
- [ ] On server error, the card is restored and a toast appears.
- [ ] The dismiss on the review page (`/merge-suggestions/[id]`) also creates
      a `MergeDismissal` row.
- [ ] Performance: dismissal exclusion adds ≤ 10ms to the duplicates list
      load (acceptable for ≤ 200 dismissed pairs; the `@@index([userId])` on
      `MergeDismissal` ensures a fast lookup).
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- At very high dismissed counts (>10 000 pairs, unlikely for a personal
  address book app), the in-memory set approach may need to move to a DB-side
  anti-join. Log a warning if `dismissed.length > 1000` and revisit.
- Confirm whether the generation job runs per-user or globally. If globally,
  it must load dismissed pairs per user for each user batch.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: update merge-suggestions concept doc
      to describe the dismissal exclusion layer
