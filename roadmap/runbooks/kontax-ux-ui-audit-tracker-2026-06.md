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
| UX-001 | Fixed | Low | Marketing | `/` homepage | Mobile, Desktop | Logged-in homepage still ends with `Get started free` CTA | Pending | Codex |  | Shipped to `staging` in `93ecb73`; confirmed fixed on staging on 2026-06-28 |
| UX-002 | Verified | Medium | App navigation | `/contacts?tab=overview` | Tablet | Tablet left rail is too dense and competes with overview content | [P34U-01](../build-phase/p34u-01-tablet-overview-nav-density.md) | Codex | Codex | Verified on the deployed app at `768x1024` on 2026-06-28; after screenshot captured in `ux-audit-before-after/` |
| UX-003 | Verified | Medium | Contacts list | `/contacts?tab=people&filter=all&sort=name&view=compact` | Mobile | Contact rows expose too many always-visible actions | [P34U-02](../build-phase/p34u-02-mobile-people-row-action-hierarchy.md) | Codex | Codex | Fixed with decluttered compact rows, overflow fallback, and before/after screenshots |
| UX-004 | Verified | Medium | Create contact | `/contacts/new` | Mobile | Phone control is icon-only and underlabelled | [P34U-03](../build-phase/p34u-03-phone-country-selector-clarity.md) | Codex | Codex | Verified on the deployed app at `390x844` on 2026-06-28; labelled `Code` selector and after screenshot captured in `ux-audit-before-after/` |
| UX-005 | Verified | Medium | Auth | `/forgot-password` | Mobile, Desktop | Forgot-password breaks the login/register visual system | Pending | Codex | Codex | Verified on deployed production HTML on 2026-06-28 after `5cd5c6b`; signed-in visits now redirect to `/contacts` as expected |
| UX-006 | Verified | Medium | Sync | `/sync?account=cmq446geh0001j5uhqoo4ps11` | Mobile | Sync history is too repetitive and hard to scan on small screens | Pending | Codex | Codex | Verified on production at `390x844` on 2026-06-28 after `0ad964e`; mobile history now renders as compact cards |
| UX-007 | Verified | Low | Auth | `/forgot-password` | Mobile, Desktop | Metadata description is generic instead of recovery-specific | Pending | Codex | Codex | Verified on deployed production HTML on 2026-06-28 after `5cd5c6b`; reset-specific description, canonical, and sharing metadata are live |
| UX-008 | Verified | Medium | Merge review | `/merge/manual` | Mobile | Manual merge entry layout is still desktop-shaped | [P34U-04](../build-phase/p34u-04-manual-merge-searchable-pickers.md) | Codex | Codex | Verified on the deployed app at `390x844` on 2026-06-28; stacked mobile entry and after screenshot captured in `ux-audit-before-after/` |
| UX-009 | Verified | Low | Contact detail | `/contacts/[id]` | Mobile | Edit action is repeated across header, hero, and FAB | Pending | Codex | Codex | Verified on the deployed app at `390x844` on 2026-06-28; only one visible `Edit` entry remains and after screenshot captured in `ux-audit-before-after/` |
| UX-010 | Verified | Low | Import / export | `/import-export?tab=export` | Mobile, Tablet, Desktop | Export mode still shows import-only quota/history modules | Pending | Codex | Codex | Verified on the deployed app at `390x844` and `1440x900` on 2026-06-28; import-only quota/history are absent and the after artifact was captured in `ux-audit-before-after/` |
| UX-011 | Verified | Medium | Merge review | `/merge/manual` | Mobile, Desktop | Merge pickers imply search but behave like huge native dropdowns | [P34U-04](../build-phase/p34u-04-manual-merge-searchable-pickers.md) | Codex | Codex | Verified on the deployed app at `390x844` and `1440x900` on 2026-06-28; searchable picker inputs and after screenshots captured in `ux-audit-before-after/` |

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
| UX-001 | `93ecb73` | Mobile `390x844`, Desktop `1440x900` | Fixed | Confirmed fixed on staging on 2026-06-28; signed-in CTA now points returning users back into Kontax |
| UX-002 | `9613403` | Tablet `768x1024` | Verified | Verified on production on 2026-06-28; tablet overview rail is lighter and the after screenshot was captured |
| UX-003 | Local preview fix for `P34U-02` | Mobile `390x844` | Verified | Compact mobile rows now prioritize open-contact with a single overflow control; artifacts saved in `ux-audit-before-after/` |
| UX-004 | `7df2027`, `91b673d` | Mobile `390x844` | Verified | Verified on production on 2026-06-28; phone row now uses a labelled `Code` selector and after screenshot was captured |
| UX-005 | `5cd5c6b` | Login/register/forgot-password system | Verified | Verified on production on 2026-06-28 from the deployed unauthenticated HTML; signed-in visits correctly redirect to `/contacts` |
| UX-006 | `0ad964e` | Mobile `390x844` | Verified | Verified on production on 2026-06-28; repeated table labels are gone and history rows read as compact cards |
| UX-007 | `5cd5c6b` | Forgot-password metadata | Verified | Verified on production on 2026-06-28; reset-specific title, description, canonical, Open Graph, and Twitter metadata are live |
| UX-008 | `f5f5a91` | Merge/manual mobile | Verified | Verified on production on 2026-06-28; mobile entry now stacks Contact A and Contact B with searchable inputs, and after screenshot was captured |
| UX-009 | `c74f0bb` | Contact detail mobile | Verified | Verified on production on 2026-06-28; the mobile detail surface now shows a single visible `Edit` entry and the duplicate FAB is gone |
| UX-010 | `f7210dd` | Export tab responsive states | Verified | Verified on production on 2026-06-28 at mobile and desktop breakpoints; export mode no longer shows import-only quota or history content, and the desktop after artifact was captured |
| UX-011 | `f5f5a91` | Merge/manual picker flow | Verified | Verified on production on 2026-06-28 at mobile and desktop breakpoints; the manual-merge selectors now present as searchable picker inputs |
