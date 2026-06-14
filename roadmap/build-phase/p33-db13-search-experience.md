# P33-DB13 — Design Brief: Search Experience

## Purpose

Specify the search results experience for both the desktop contacts list and the
mobile search overlay: live as-you-type results, a matched-text snippet per
result, grouping by what matched, keyboard navigation, and the empty/loading
states. Backend matching is covered by the other Phase 33 tickets; this brief is
the UX.

## Background

Today search is a filtered list (desktop) and a flat result list (mobile,
`mobile-search-button.tsx` → `/api/contacts/search`). With richer matching coming
(phone, notes, labels, fuzzy), users need to *see why* a contact matched —
otherwise a result that matched on a note or a secondary phone looks like a
mystery. The locked design language applies; reuse existing list-row and overlay
styling.

## Scope

### In scope
1. **As-you-type results** — debounced live results (desktop list + mobile
   overlay), with a clear loading state.
2. **Match snippet** — each result shows the matched text with the query
   highlighted (e.g. the matching note line, or "📞 …7882 539146"), via
   `ts_headline` / a highlight helper.
3. **Grouping by match type** — sections like *Name · Company · Phone · Notes ·
   Label*, so it's obvious why a result appears. Name matches lead.
4. **Keyboard navigation** — ↑/↓ to move, Enter to open, Esc to close (desktop;
   ties to the P28-05 shortcuts).
5. **Empty & recent** — a clean "no results" state and (optional) recent searches.

### Out of scope
- Saved searches (that's a smart list — P28-01).
- Filters inside the overlay (scope/book toggles) beyond what exists.

## Design / Implementation Spec

### Result row
- Avatar + name (query highlighted) + a secondary line that is the **match
  snippet** when the match wasn't the name (e.g. company, a phone number with the
  matched digits highlighted, a notes excerpt, or a label chip).
- A small label/indicator of the match field when helpful ("matched in notes").

### Grouping
- Group results by primary match field; order groups Name → Company → Phone →
  Label → Notes. Within a group, order by relevance rank.
- Collapse groups with a "+N more" if long.

### States
- **Loading:** skeleton rows or a subtle spinner; don't flash empty.
- **Empty:** "No contacts match '<q>'." with a hint (search name, company, phone,
  email, notes, labels).
- **Recent (optional):** last few queries when the box is focused and empty.

### Highlight
- Use Postgres `ts_headline` for text snippets and a digit-aware highlighter for
  phone matches (bold the matched digit run within the formatted number).

### Mobile vs desktop
- Mobile: full-overlay results list (existing overlay), grouped, large tap rows.
- Desktop: the list updates as-you-type; consider an optional results dropdown for
  global search from the header.

## Acceptance Criteria
- Results update as the user types (debounced), with a loading state.
- Each non-name match shows a highlighted snippet explaining the match.
- Results are grouped by match type; name matches first.
- Keyboard nav works on desktop (↑/↓/Enter/Esc).
- Empty state is clear; no layout flash between keystrokes.
- No new colors / outside the locked system.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (P26-12): how search works + what's searchable
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: search UX + highlight/grouping approach
