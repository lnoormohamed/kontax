# P38-07 — Server Hot-Path Micro-Fixes

## Purpose

Two small, zero-risk fixes on the `/contacts` request path that are cheap to
land and pay on every view of the heaviest page.

## Background

Found during the 2026-07 performance review; both are in or feed
`src/app/contacts/page.tsx`.

## Scope

**In scope**

1. **Hoist `Intl.Collator`** — `compareWorkspaceContacts`
   (`contacts/page.tsx:219`) constructs
   `new Intl.Collator("en", { sensitivity: "base", numeric: true })` inside
   the comparator, so sorting n contacts allocates O(n log n) collators per
   request, server-side. Move it to module scope.

2. **Label suggestions from the registry** — the wave-1 query at
   `contacts/page.tsx:361` fetches the `labels` JSON of up to 2,000 contacts
   and dedupes in JS, purely to offer ≤ 24 suggestions in the bulk "Add label"
   popover. The `Label` registry table (`getLabels()`, fetched in the same
   `Promise.all`) already holds the user's labels — derive suggestions from
   it and delete the scan.

**Out of scope**
- Any change to sort semantics or label filtering behaviour.
- The bigger structural work (P38-01/02/03).

## Design / Implementation Spec

- If P38-02 lands first and moves `compareWorkspaceContacts` into a shared
  module, apply the collator hoist there instead — coordinate, don't duplicate.
- Registry-vs-freeform check before (2): confirm every label on a contact is
  also in the `Label` registry (P31B established the registry as the source;
  verify import/sync paths register labels they attach). If freeform labels
  can exist off-registry, keep the scan but cap it (`select` only, `take` a
  few hundred) and note the follow-up to make the registry authoritative.

## Acceptance Criteria

- Exactly one `Intl.Collator` constructed per process (module scope), sort
  output unchanged on the seeded multilingual account.
- The 2,000-row label query no longer appears in the Prisma query log for
  `/contacts?tab=people`.
- Bulk-edit label suggestions still show the user's labels (spot-check an
  account with labels created via manual edit and via import).

## Risks / Open Questions

- Only the registry question above; everything else is mechanical.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [ ] Internal · engineering — none beyond code
- [ ] Internal · support/admin — none
