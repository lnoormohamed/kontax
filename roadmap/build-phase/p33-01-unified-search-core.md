# P33-01 — Unified Search Core

## Purpose

Collapse the two contact-search code paths into one shared core, give the ILIKE
fallback the same phone matching as the main path, and make **labels**
searchable — so search behaves identically everywhere and there's a single place
to change it.

## Background

P28-07 left two entry points: the desktop list query in `src/app/contacts/page.tsx`
(uses `searchContactIds` + a `getSearchConditions` ILIKE fallback) and the mobile
overlay route `src/app/api/contacts/search/route.ts` (its own ILIKE fallback).
They were fixed for phone separately; keeping them in sync by hand is the bug
factory that caused "works on desktop, not mobile". Labels (`Contact.labels`)
aren't in the search document at all.

## Scope

**In scope**
- A single `searchContacts(scope, q, opts)` in `~/server/contact-search` that
  returns ranked contact ids (and is the only search entry both callers use).
- Move the ILIKE fallback into the core and give it the **digit-phone substring**
  match (so short/symbol queries on the shared path also find phone numbers).
- Add **labels** to the searchable document (`coalesce("labels"::text,'')` now;
  canonical label names once the registry lands — depends on [P31B-01]).
- Both `page.tsx` and `/api/contacts/search` call only the core.

**Out of scope**
- Fuzzy/stemming (P33-02), the stored index (P33-03), the results UI (P33-04).

## Design / Implementation Spec

### One core, two scopes
`searchContacts(scope: { userId } | { groupBookIds }, q, opts)` already exists in
spirit (`searchContactIds`). Promote it to *the* API:
- It owns: eligibility (`buildTsQuery`), the FTS document, the phone digit-match,
  and the ILIKE fallback for non-eligible queries.
- Callers pass scope; `page.tsx` merges private + shared results (as it does now),
  the API route does the same. No search SQL lives in the callers anymore.

### Labels in the document
Add labels to the weight-C section of the tsvector:
`… || coalesce("labels"::text, '')`. When the label registry (P31B-01) exists,
prefer canonical label names. A label match should be distinguishable for the
P33-04 grouping (track which field matched, or expose per-field match flags).

### ILIKE fallback parity
The fallback (1-char / symbol-only queries) must include the same phone
digit-substring condition the main path uses, so e.g. a 2-digit area-code search
behaves consistently across desktop and mobile.

## Acceptance Criteria
- Desktop and mobile search return the same results for the same query + scope.
- There is exactly one search implementation; callers contain no search SQL.
- Searching a label name returns contacts carrying that label.
- The ILIKE fallback also matches phone digit substrings.
- Existing P28-07 behavior (name/company/notes/phone) is unchanged or better.

## Risks / Open Questions
- Returning per-field match info (for grouping) adds shape to the core's result —
  design it now so P33-04 doesn't require another refactor.
- Label search quality depends on [P31B-01] canonicalization; ship raw
  `labels::text` first, upgrade when the registry lands.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: "Contact search" concept doc (one core, scopes, document)

[P31B-01]: p31b-01-label-registry-and-model.md
