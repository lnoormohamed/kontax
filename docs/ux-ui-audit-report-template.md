# UX/UI Audit Report Template

**Audience:** Product, design, engineering  
**Use when:** Running a structured UX/UI audit across public pages, sign-up, onboarding, and signed-in product flows

---

## Audit metadata

- **Product:** Kontax
- **Audit owner:**
- **Date started:**
- **Date completed:**
- **Environment:** `production` / `staging`
- **Version / commit / release tag:**
- **Browsers tested:**
- **Accounts used:**
  - Existing account:
  - Fresh sign-up account:

## Goal

Describe what this audit is trying to answer.

Example:

> Identify usability issues, responsive layout problems, accessibility gaps,
> visual inconsistencies, and workflow friction across mobile, tablet, and
> desktop for the public site, sign-up journey, onboarding, and core signed-in
> contact-management flows.

## Scope

### Included

- Public marketing pages
- Login / register / forgot-password flows
- Onboarding and first-run states
- Core signed-in journeys
- Mobile, tablet, and desktop breakpoints

### Excluded

- Areas not reachable in the audit window
- Admin-only routes unless explicitly included
- Browser-specific edge cases not covered in this pass

## Devices and breakpoints

| Label | Viewport | Notes |
|---|---|---|
| Mobile narrow | `320x568` | Optional stress check |
| Mobile standard | `390x844` | Primary iPhone-sized audit |
| Mobile alt | `360x800` | Primary Android-sized audit |
| Tablet portrait | `768x1024` | Main tablet breakpoint |
| Desktop standard | `1280x720` | Lower desktop bound |
| Desktop wide | `1440x900` | Main desktop breakpoint |

## Severity scale

| Severity | Meaning | Expected action |
|---|---|---|
| Critical | Blocks task completion or creates serious trust risk | Fix immediately |
| High | Strongly degrades task completion, clarity, or confidence | Prioritize in next sprint |
| Medium | Noticeable friction, inconsistency, or design debt | Schedule and batch |
| Low | Cosmetic, polish, or minor clarity issue | Fix opportunistically |

## Test matrix

| Area | Route / flow | Mobile | Tablet | Desktop | Notes |
|---|---|---:|---:|---:|---|
| Marketing | `/` homepage |  |  |  |  |
| Marketing | `/features` |  |  |  |  |
| Marketing | `/pricing` |  |  |  |  |
| Marketing | `/security` |  |  |  |  |
| Marketing | `/changelog` |  |  |  |  |
| Auth | `/login` |  |  |  |  |
| Auth | `/register` |  |  |  |  |
| Auth | `/forgot-password` |  |  |  |  |
| App | `/contacts?tab=overview` |  |  |  |  |
| App | `/contacts?tab=people` |  |  |  |  |
| App | Search, filters, sort |  |  |  |  |
| App | `/contacts/new` |  |  |  |  |
| App | `/contacts/[id]` detail |  |  |  |  |
| App | Duplicates / merge review |  |  |  |  |
| App | Labels / lists / books |  |  |  |  |
| App | Import / export |  |  |  |  |
| App | Sync |  |  |  |  |
| App | Settings |  |  |  |  |

Use:
- `Done`
- `Partial`
- `Not tested`

## Method

### What was evaluated

- Information architecture
- Navigation clarity
- Content hierarchy
- Visual consistency
- Responsive layout behavior
- Touch targets and input ergonomics
- Form usability and validation
- Loading, empty, success, and error states
- Accessibility basics
- Overall trust and product clarity

### How evidence was captured

- Screenshots
- Screen recordings if needed
- Route and viewport notes
- Reproduction steps

## Executive summary

### Overall read

Write a short paragraph summarizing the product's current UX quality and the
highest-level risks.

### Biggest strengths

- 
- 
- 

### Biggest risks

- 
- 
- 

## Findings summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

## Findings

| ID | Severity | Area | Route / flow | Device | Issue | Why it matters | Recommendation | Evidence | Ticket |
|---|---|---|---|---|---|---|---|---|---|
| UX-001 | High | App navigation | `/contacts` | Mobile |  |  |  |  |  |
| UX-002 | Medium | Signup | `/register` | Desktop |  |  |  |  |  |

## Detailed findings

### Finding `UX-001` — [Short title]

- **Severity:** 
- **Area:** 
- **Route / flow:** 
- **Device:** 
- **Steps to reproduce:**
  1. 
  2. 
  3. 
- **Observed behavior:** 
- **Expected behavior:** 
- **Why it matters:** 
- **Recommendation:** 
- **Evidence:** 
- **Linked ticket:** 

Repeat this block for any finding that needs more than the summary table.

## Quick wins

- Small fixes that improve clarity, spacing, hierarchy, copy, or touch usability
- Changes that can likely ship without large workflow redesign
- Bugs or polish issues with high visible impact

## Larger opportunities

- Structural navigation improvements
- Flow redesigns
- Information architecture changes
- Onboarding improvements

## Open questions

- 
- 
- 

## Recommended next steps

1. Log all `Critical` and `High` issues as implementation tickets.
2. Group `Medium` issues into fix batches by area or route.
3. Re-test key journeys after fixes on the same breakpoint matrix.
4. Run a smaller verification pass before release.

## Appendix

### Screenshot naming

Use a stable pattern such as:

```text
YYYY-MM-DD_route_device_issue-shortname.png
```

Example:

```text
2026-06-27_contacts-mobile-sidebar-density.png
```

### Status legend

- `Open` = finding recorded, not yet fixed
- `In progress` = actively being addressed
- `Fixed` = implementation merged
- `Verified` = re-tested and confirmed resolved
