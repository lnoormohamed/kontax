# Admin Support Case Inbox Workbench

## Purpose

Use `/admin/support` as the default support-operations surface for daily triage,
follow-up management, and ownership cleanup.

## Saved queues

- `Open` shows actionable case work across the full operator pool.
- `Unassigned` is the fastest way to grab new triage.
- `Assigned to me` is the personal working set for the signed-in admin.
- `Waiting on customer` and `Waiting on provider` isolate blocked work.
- `Overdue` and `Due today` surface follow-ups using UTC boundaries.
- `Recently resolved` gives a short lookback on recently closed work.

## Operator workflow

1. Start in `Unassigned` to claim new work.
2. Add or tighten the case summary so the next admin can understand the blocker.
3. Set severity, current status, and the next follow-up date before leaving the row.
4. Use `Assigned to me` to work your owned queue in batches.
5. Use the linked record when deeper account or sync investigation is needed.

## Guardrails

- Follow-up timestamps are shown and edited in UTC to keep queue urgency
  consistent across operators and deploy regions.
- Keep summaries short and action-oriented: current blocker, latest finding, and
  next step.
- Resolve the case when support work is complete; archive only when the record
  should leave standard operator views.
