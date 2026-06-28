# Kontax UX/UI Audit Tracker — June 2026

**Status:** Complete  
**Linked report:** [`kontax-ux-ui-audit-2026-06.md`](kontax-ux-ui-audit-2026-06.md)  
**Date opened:** 2026-06-27

---

## Workflow

1. Mark each route and breakpoint as it is reviewed.
2. Log each issue with a stable audit ID.
3. Convert meaningful findings into implementation tickets.
4. Re-test after fixes and mark them verified.

## Status definitions

| Status | Meaning |
|---|---|
| To audit | Planned but not reviewed yet |
| Auditing | Currently under review |
| Audited | Reviewed with no actionable issue logged |
| Logged | Finding captured and ready for implementation |
| In progress | Fix work has started |
| Fixed | Update completed |
| Verified | Re-tested and confirmed resolved |
| Won't fix | Intentionally left as-is |

## Route coverage tracker

| Area | Route / flow | Mobile | Tablet | Desktop | Owner | Last updated | Notes |
|---|---|---|---|---|---|---|---|
| Marketing | `/` homepage | Audited | Audited | Audited | Codex | 2026-06-27 | Logged-in homepage reviewed across breakpoints |
| Marketing | `/features` | Audited | Audited | Audited | Codex | 2026-06-27 | No additional issue logged |
| Marketing | `/pricing` | Audited | Audited | Audited | Codex | 2026-06-27 | No additional issue logged |
| Marketing | `/security` | Audited | Audited | Audited | Codex | 2026-06-27 | No additional issue logged |
| Marketing | `/changelog` | Audited | Audited | Audited | Codex | 2026-06-27 | No additional issue logged |
| Auth | `/login` | Audited | Audited | Audited | Codex | 2026-06-27 | Unauthenticated HTML plus shared auth component reviewed |
| Auth | `/register` | Audited | Audited | Audited | Codex | 2026-06-27 | Unauthenticated HTML plus shared auth component reviewed |
| Auth | `/forgot-password` | Audited | Audited | Audited | Codex | 2026-06-27 | Visual inconsistency and metadata issue logged |
| App | `/contacts?tab=overview` | Audited | Audited | Audited | Codex | 2026-06-27 | Bottom nav strong on mobile; tablet density issue logged |
| App | `/contacts?tab=people` | Audited | Audited | Audited | Codex | 2026-06-27 | Mobile row-action density issue logged |
| App | Search, filters, sort | Audited | Audited | Audited | Codex | 2026-06-27 | Browser and code-backed control review completed |
| App | `/contacts/new` | Audited | Audited | Audited | Codex | 2026-06-27 | Mobile phone-control issue logged |
| App | `/contacts/[id]` detail | Audited | Audited | Audited | Codex | 2026-06-27 | Mobile edit-entry redundancy logged |
| App | Duplicates / merge | Audited | Audited | Audited | Codex | 2026-06-27 | Manual merge layout and non-search picker behavior logged |
| App | Labels / lists / books | Audited | Audited | Audited | Codex | 2026-06-27 | Covered through sidebar and workspace navigation review |
| App | Import / export | Audited | Audited | Audited | Codex | 2026-06-27 | Export-tab context mixing logged across responsive states |
| App | Sync | Audited | Audited | Audited | Codex | 2026-06-27 | Mobile sync-detail issue logged |
| App | Settings | Audited | Audited | Audited | Codex | 2026-06-27 | No additional issue logged |

## Findings tracker

| Audit ID | Status | Severity | Area | Route / flow | Device | Summary | Ticket | Owner | Verified by | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| UX-001 | Logged | Low | Marketing | `/` homepage | Mobile, Desktop | Logged-in homepage still ends with `Get started free` CTA | Pending |  |  | Session-aware CTA recommended |
| UX-002 | Fixed | Medium | App navigation | `/contacts?tab=overview` | Tablet | Tablet left rail is too dense and competes with overview content | [P34U-01](../build-phase/p34u-01-tablet-overview-nav-density.md) | Codex |  | Shipped to `staging` in `9613403`; tablet re-test and after screenshot still pending |
| UX-003 | Verified | Medium | Contacts list | `/contacts?tab=people&filter=all&sort=name&view=compact` | Mobile | Contact rows expose too many always-visible actions | [P34U-02](../build-phase/p34u-02-mobile-people-row-action-hierarchy.md) | Codex | Codex | Fixed with decluttered compact rows, overflow fallback, and before/after screenshots |
| UX-004 | Fixed | Medium | Create contact | `/contacts/new` | Mobile | Phone control is icon-only and underlabelled | [P34U-03](../build-phase/p34u-03-phone-country-selector-clarity.md) | Codex |  | Shipped to `staging` in `7df2027` with interaction follow-up in `91b673d`; responsive re-test still pending |
| UX-005 | Logged | Medium | Auth | `/forgot-password` | Mobile, Desktop | Forgot-password breaks the login/register visual system | Pending |  |  | Layout and CTA styling diverge from main auth surfaces |
| UX-006 | Verified | Medium | Sync | `/sync?account=cmq446geh0001j5uhqoo4ps11` | Mobile | Sync history is too repetitive and hard to scan on small screens | Pending | Codex | Codex | Verified on production at `390x844` on 2026-06-28 after `0ad964e`; mobile history now renders as compact cards |
| UX-007 | Logged | Low | Auth | `/forgot-password` | Mobile, Desktop | Metadata description is generic instead of recovery-specific | Pending |  |  | Small clarity and SEO/content issue |
| UX-008 | Fixed | Medium | Merge review | `/merge/manual` | Mobile | Manual merge entry layout is still desktop-shaped | [P34U-04](../build-phase/p34u-04-manual-merge-searchable-pickers.md) | Codex |  | Shipped to `staging` in `f5f5a91`; live mobile re-test still pending |
| UX-009 | Logged | Low | Contact detail | `/contacts/[id]` | Mobile | Edit action is repeated across header, hero, and FAB | Pending |  |  | Reduce redundant primary actions |
| UX-010 | Logged | Low | Import / export | `/import-export?tab=export` | Mobile, Tablet, Desktop | Export mode still shows import-only quota/history modules | Pending |  |  | Consider task-focused tab-specific secondary content |
| UX-011 | Fixed | Medium | Merge review | `/merge/manual` | Mobile, Desktop | Merge pickers imply search but behave like huge native dropdowns | [P34U-04](../build-phase/p34u-04-manual-merge-searchable-pickers.md) | Codex |  | Shipped to `staging` in `f5f5a91`; live picker-flow re-test still pending |

## Ticket template

```md
Title: [Device] [Route/flow] Short issue summary

Audit ID:
Severity:
Area:
Route / flow:
Device:

Summary
- One-sentence description of the issue

Impact
- Why this matters to usability, trust, conversion, or task completion

Steps to reproduce
1.
2.
3.

Expected
- What should happen

Actual
- What currently happens

Evidence
- Screenshot / recording / notes

Recommendation
- Suggested change or direction

Acceptance check
- What to verify once fixed
```

## Verification log

| Audit ID | Fix shipped in | Re-tested on | Result | Notes |
|---|---|---|---|---|
| UX-001 |  | Mobile `390x844`, Desktop `1440x900` |  |  |
| UX-002 | `9613403` | Tablet `768x1024` | Fixed | Condensed tablet overview rail shipped to `staging`; capture/re-test still pending |
| UX-003 | Local preview fix for `P34U-02` | Mobile `390x844` | Verified | Compact mobile rows now prioritize open-contact with a single overflow control; artifacts saved in `ux-audit-before-after/` |
| UX-004 | `7df2027`, `91b673d` | Mobile `390x844` | Fixed | Country selector clarity and follow-up interaction fix shipped to `staging`; artifact capture still pending |
| UX-005 |  | Login/register/forgot-password system |  |  |
| UX-006 | `0ad964e` | Mobile `390x844` | Verified | Verified on production on 2026-06-28; repeated table labels are gone and history rows read as compact cards |
| UX-007 |  | Forgot-password metadata |  |  |
| UX-008 | `f5f5a91` | Merge/manual mobile | Fixed | Mobile stacked manual-merge entry shipped to `staging`; live breakpoint re-test still pending |
| UX-009 |  | Contact detail mobile |  |  |
| UX-010 |  | Export tab responsive states |  |  |
| UX-011 | `f5f5a91` | Merge/manual picker flow | Fixed | Searchable manual-merge picker shipped to `staging`; live interaction re-test still pending |
