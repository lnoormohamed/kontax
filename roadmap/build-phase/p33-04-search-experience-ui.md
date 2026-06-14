# P33-04 — Search Experience UI

## Purpose

Build the search results experience from [P33-DB13](p33-db13-search-experience.md):
as-you-type results, a matched-text snippet per result, grouping by what matched,
and keyboard navigation — across desktop and the mobile overlay.

## Background

With richer matching (phone, notes, labels, fuzzy) a flat result list hides *why*
a contact matched. Users need a snippet ("matched in notes: …") and grouping to
trust the results. Desktop search is the list filter (`page.tsx` +
`search-input.tsx`); mobile is the overlay (`mobile-search-button.tsx` →
`/api/contacts/search`). Both consume the unified core (P33-01).

## Scope

**In scope**
- **As-you-type** debounced results with a loading state (no empty flash).
- **Snippet + highlight** per result: `ts_headline` for text, a digit-aware
  highlighter for phone matches; query terms bolded.
- **Grouping by match type** (Name · Company · Phone · Label · Notes), name first.
- **Keyboard nav** on desktop (↑/↓/Enter/Esc; integrates with P28-05 shortcuts).
- **Empty** state with a "what's searchable" hint; optional **recent searches**.

**Out of scope**
- Backend matching/ranking (P33-01/02/03) — this consumes their output.

## Design / Implementation Spec

### Data from the core
The core (P33-01) returns, per result: contact fields + relevance rank + which
field matched + a snippet (server-rendered via `ts_headline` / phone highlighter).
The route and the desktop loader both return this shape.

### Rendering
- Result row: avatar + highlighted name + secondary line = the match snippet when
  the match isn't the name (company, phone with matched digits bold, notes
  excerpt, or a label chip).
- Group headers per match type; "+N more" to expand long groups.
- Mobile: grouped list in the existing overlay; Desktop: live list update (and/or
  a header results dropdown).

### Behavior
- Debounce (~200–250ms; the search input already debounces — align).
- Loading skeleton; clean empty state; preserve scroll/focus between keystrokes.

## Acceptance Criteria
- Results update as the user types, with a loading state and no flash.
- Non-name matches show a highlighted snippet explaining the match.
- Results are grouped by match type with name matches first.
- ↑/↓/Enter/Esc work on desktop.
- Behaves consistently on desktop and mobile (one core).
- Within the locked design system.

## Risks / Open Questions
- `ts_headline` cost per result — limit result count and headline only the
  matched field.
- Grouping needs per-field match info from the core (P33-01) — confirm that shape
  exists before building.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (P26-12): how to search + reading results
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: search UX (snippet/grouping/keyboard)
