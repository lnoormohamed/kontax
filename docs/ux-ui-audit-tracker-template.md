# UX/UI Audit Tracker Template

**Audience:** Product, design, engineering  
**Use when:** Tracking audit progress from discovery through fix verification

---

## Recommended workflow

1. Record the audit scope and routes to test.
2. Mark each route and device combination as it is reviewed.
3. Log each actionable issue with a stable audit ID.
4. Convert important findings into implementation tickets.
5. Re-test after fixes and mark findings as verified.

## Status definitions

| Status | Meaning |
|---|---|
| To audit | Planned but not reviewed yet |
| Auditing | Currently being reviewed |
| Audited | Reviewed, no issue or notes only |
| Logged | Finding captured and ready for implementation |
| In progress | Fix work has started |
| Fixed | Code/design update completed |
| Verified | Re-tested and confirmed resolved |
| Won't fix | Intentionally not being addressed |

## Route coverage tracker

| Area | Route / flow | Mobile | Tablet | Desktop | Owner | Last updated | Notes |
|---|---|---|---|---|---|---|---|
| Marketing | `/` homepage | To audit | To audit | To audit |  |  |  |
| Marketing | `/features` | To audit | To audit | To audit |  |  |  |
| Marketing | `/pricing` | To audit | To audit | To audit |  |  |  |
| Marketing | `/security` | To audit | To audit | To audit |  |  |  |
| Marketing | `/changelog` | To audit | To audit | To audit |  |  |  |
| Auth | `/login` | To audit | To audit | To audit |  |  |  |
| Auth | `/register` | To audit | To audit | To audit |  |  |  |
| Auth | `/forgot-password` | To audit | To audit | To audit |  |  |  |
| App | Contacts overview | To audit | To audit | To audit |  |  |  |
| App | Contacts list | To audit | To audit | To audit |  |  |  |
| App | Search and filters | To audit | To audit | To audit |  |  |  |
| App | Create contact | To audit | To audit | To audit |  |  |  |
| App | Contact detail | To audit | To audit | To audit |  |  |  |
| App | Labels / lists / books | To audit | To audit | To audit |  |  |  |
| App | Duplicates / merge | To audit | To audit | To audit |  |  |  |
| App | Import / export | To audit | To audit | To audit |  |  |  |
| App | Sync | To audit | To audit | To audit |  |  |  |
| App | Settings | To audit | To audit | To audit |  |  |  |

## Findings tracker

| Audit ID | Status | Severity | Area | Route / flow | Device | Summary | Ticket | Owner | Verified by | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| UX-001 | Logged | High | App navigation | `/contacts` | Mobile | Sidebar/navigation too dense for first viewport |  |  |  |  |
| UX-002 | Logged | Medium | Signup | `/register` | Desktop | CTA hierarchy is weak |  |  |  |  |

## Ticket template

Copy this block into your issue tracker for each real finding:

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

## Prioritization view

Use this quick list when planning fix batches:

### Must fix first

- All `Critical` findings
- Any `High` issue in signup, login, create/edit, navigation, or destructive actions

### Fix next

- `High` and `Medium` issues clustered in the same route
- Responsive issues affecting both tablet and mobile

### Batch later

- Low-severity polish
- Copy cleanup
- Non-blocking visual consistency work

## Verification log

| Audit ID | Fix shipped in | Re-tested on | Result | Notes |
|---|---|---|---|---|
| UX-001 |  | Mobile `390x844` |  |  |
| UX-002 |  | Desktop `1440x900` |  |  |
