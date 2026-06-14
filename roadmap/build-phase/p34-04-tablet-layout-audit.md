# P34-04 — Tablet layout audit

## Purpose

Produce an authoritative, severity-graded findings document of every layout
breakage in the app at 768px, 900px, and 1024px, to feed targeted tablet fix
tickets (P34-05, P34-06, P34-07) and future follow-ons.

## Background

The Kontax desktop layout was designed for ≥1280px screens. The mobile layout
(≤640px, often behind feature flags or separate routes) was built separately.
The gap between 641px and 1279px — iPad portrait through iPad landscape —
has never been formally audited. Multiple two-column splits, fixed sidebars, and
horizontally constrained modals are known to break in this range. This ticket
documents the scope of the problem before work begins.

This is a documentation-only ticket. No code changes. The output file doubles as
a living checklist: implementation tickets check off rows as they fix issues.

## Scope

**In scope**
- Walk all primary app routes at 768px, 900px, and 1024px using Chrome DevTools
  device emulation (responsive mode, no device preset needed, just set width).
- Routes to cover (with login as a standard non-admin user):
  - `/contacts` (contacts list + workspace table)
  - `/contacts/[id]` (contact detail — left panel + right tab panel)
  - `/sync` (account list + detail panel)
  - `/settings` (top-level settings page)
  - `/settings/account`
  - `/settings/security`
  - `/settings/notifications`
  - `/settings/preferences`
  - `/settings/devices`
  - `/settings/developer`
  - `/settings/teams`
  - `/settings/family`
  - `/settings/export-presets`
  - `/settings/import-presets`
  - Import wizard (multi-step)
  - `/help` (if it exists as a route)
  - Admin pages (if accessible)
  - Merge review flow
- For each finding, record: **Page · Breakpoint · What breaks · Severity**.

**Out of scope**
- Any code changes.
- Routes at <640px (mobile layout — separate audit if needed).
- Routes at ≥1280px (desktop layout — assumed working).
- Performance, accessibility, or content audits.

## Design / Implementation Spec

This ticket has no implementation spec. The output is the findings doc at
`roadmap/build-phase/p34-04-tablet-audit-findings.md` (a separate living file).

### Severity definitions
- **P0** — Page is functionally unusable (overlapping elements, horizontal
  overflow that hides content, modals/panels inaccessible).
- **P1** — Significant UX degradation: elements too narrow to read/interact,
  incorrect layout that requires work-around.
- **P2** — Minor visual imperfection: slight overflow, sub-optimal whitespace,
  non-critical element misalignment.

### Audit process
1. Open Chrome DevTools → toggle device toolbar → set width to 768, 900, 1024px
   in turn (height ~1024px for each).
2. Navigate to each route.
3. For each route × breakpoint, record findings using the table format below.
4. Assign severity. P0 and P1 findings each become a ticket or are absorbed into
   P34-05/P34-06/P34-07 if they match those surfaces.

### Findings document format

The findings file (`p34-04-tablet-audit-findings.md`) should use this structure:

```markdown
# P34-04 — Tablet Audit Findings (living doc)

Last updated: YYYY-MM-DD

## Summary
- P0 findings: N
- P1 findings: N
- P2 findings: N

## Findings

| Route | Breakpoint | Finding | Severity | Fixed by |
|-------|-----------|---------|----------|----------|
| /sync | 768px | Two columns each <300px; detail panel unusable | P0 | P34-05 |
| /settings/account | 768px | Sidebar + content both present; content <400px | P1 | P34-06 |
| /contacts/[id] | 768px | Left/right panels side-by-side <350px each | P0 | P34-07 |
| ...  | ...  | ... | ... | ... |
```

The `Fixed by` column is filled in as tickets ship.

## Acceptance Criteria
- `roadmap/build-phase/p34-04-tablet-audit-findings.md` exists with at minimum
  the routes listed above fully audited at all three breakpoints.
- Every P0 and P1 finding has a `Fixed by` ticket reference or is explicitly
  marked `unscheduled` with a rationale.
- The doc is updated (rows marked resolved) each time P34-05, P34-06, or P34-07
  ships a fix.
- No routes are left blank / untested unless explicitly noted as "not applicable".

## Risks / Open Questions
- Some routes may require specific data (a sync account to exist, contacts to be
  present) to reveal layout issues. Use the demo account or seed data.
- The import wizard is multi-step — each step is a separate "page" for audit
  purposes; note which step breaks.
- Admin pages are behind a role check; audit these separately with an admin
  session if possible.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: `p34-04-tablet-audit-findings.md` is the
      primary output of this ticket
