# P38-01 — Contact List Payload Diet

## Status
Implemented & verified 2026-07-02.

**Close-out numbers** (production build, seeded account `p3801-perf@example.com`
on staging DB: 1,000 contacts, 500 with ~330-char notes):
- `/contacts?tab=people` HTML+RSC payload: **774 KB → 378 KB (−51%)**
- `notes`, `syncLinks`, `significantDates`, phonetic fields: 0 occurrences in
  payload (was 1,000 each)
- Notes search (`?q=marmalade`): row excerpts render with highlight; payload
  carries ~90-char excerpts instead of full note text
- Health-card counts verified exact against the seed distribution
  (Weak metadata 400, Missing labels 667)
- `notes` now leaves the DB only when a search query is active

The seeded perf account was left in place on the staging DB for P38-02/03
measurements (password `demo1234`; delete via
`DELETE FROM "Contact" WHERE "userId"='p3801perfuser0000000000'; DELETE FROM "User" WHERE id='p3801perfuser0000000000';`).

## Purpose

Stop shipping heavy per-contact fields to the contacts workspace list. The list
view only needs what a row renders plus what filtering/health chips derive —
today it also carries full note text, raw significant-date JSON, and a nested
sync join for every contact, all serialized into the RSC payload on every view
and every revalidation.

## Background

`contactListSelect` in `src/app/contacts/page.tsx` (~line 290) selects `notes`,
`significantDates`, `labels`, and a `syncLinks { syncAccount { … } }` join for
every row, across all three scope queries (private, family, team) and the
archived query. The array is passed through `ContactDashboard` into the
client component `ContactsWorkspaceTable` ("use client"), so everything in the
select crosses the wire as RSC payload. Rendering is virtualized; the payload
is not.

`notes` exists in the select only so `matchesContactHealth` /
`countContactsByHealth` (`src/server/contact-health.ts`) can test for missing
context, and so search highlighting has something to show. Full note bodies for
thousands of contacts is the single largest avoidable chunk of the payload.

## Scope

**In scope**
- Replace `notes` in the list select with a derived boolean (e.g. `hasNotes`)
  or a short excerpt capped at ~120 chars, whichever the row UI actually needs.
- Audit each remaining field in `contactListSelect` against what
  `ContactsWorkspaceTable` and the health helpers actually read; drop or slim
  anything unused (e.g. collapse the `syncLinks` join to the derived
  per-contact sync status the row displays).
- Compute health-card counts (`countContactsByHealth`) from the slimmed shape;
  adjust `contact-health.ts` signatures accordingly.
- Apply the same slimming to the archived-tab query.

**Out of scope**
- Pagination / `take` limits (P38-02).
- Query-count reduction (P38-03).
- Any change to the contact detail page.

## Design / Implementation Spec

- Prefer deriving flags in the select (Prisma computed via `_count` or a
  post-map on the server) over shipping raw data and deriving on the client.
- `syncLinks` today feeds the "sync attention" health chip and per-row sync
  badge. Reduce to a server-computed enum per contact
  (`syncState: "ok" | "stale" | "error" | null`) before the array is handed to
  the client boundary.
- Keep the server-side type explicit so future fields must be consciously
  added (a named `ContactRow` type shared with the table component).

## Acceptance Criteria

- RSC payload for `/contacts?tab=people` (measure via `curl -H "RSC: 1"` or
  browser devtools) drops materially on a seeded 2,000-contact account —
  record before/after bytes in the ticket close-out.
- No visual or behavioural change to rows, health cards, or filters
  (health counts identical before/after on the seeded account).
- `notes` no longer appears in any list-view select.

## Risks / Open Questions

- Health semantics must not drift: `missing-context` currently checks note
  presence — a `hasNotes` boolean preserves it exactly.
- Verify nothing in bulk-edit or the mobile sheets reads the dropped fields
  from the row object (grep for the field names in `_components`).

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — note the `ContactRow` contract in code comments
- [ ] Internal · support/admin — none
