# P50-05 — Features, changelog, about, contact; docs and legal chrome

**Phase:** 50 · **Priority:** P2 · **Effort:** M · **Depends on:** P50-02

## Objective
Carry Direction A to the rest of the marketing site so no page looks like the old system.

## Scope
- **/features:** feature rows with product windows and source tags; secondary grid.
- **/changelog:** mono dates, hairline list; keep RSS (`/changelog.xml`).
- **/about** and **/contact:** currently thin (≈160 and ≈90 words). Apply the layout; add a
  short, honest "why Kontax exists" section to About (owner to supply or approve copy — no
  invented history, team or numbers). Contact keeps its form + rate limit.
- **/help, /developers, /privacy, /terms:** header, footer and type scale only; keep their
  docs layouts.
- Not designed in the prototype — follow the component rules from P50-02 and the section-head
  grid; show screenshots for review before merging.

## Acceptance
- Every public page uses the new header, footer and type; no leftover old tokens (grep for the
  retired values).
- No horizontal scroll at 375 on any page; all inputs ≥ 16px.
