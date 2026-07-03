# Phase 34G — Sync Connection Identity, Lifecycle & Retirement Model

> Introduces the backend/data-model foundation for explicit sync-connection
> lifecycle states: reconnecting an existing connection, retiring a replaced
> connection, and preserving a stable logical connection identity for history,
> audit, and support tooling.

## Phase status
Pre-plan

## Phase objective
Kontax currently supports soft-disconnecting sync accounts so a connection can
be restored later without losing settings, links, or history. That works for
the simple case, but it breaks down once the product needs to support two
distinct user intents:

1. reconnect the previous logical connection
2. create a brand-new connection and intentionally retire the old one

Phase 34G defines the persistent model that makes those flows explicit and
auditable. The goal is to stop overloading `DISCONNECTED` to mean both
"temporarily off" and "intentionally replaced", while giving activity/history
surfaces a stable identity to group by.

## Background
- Phase 36 added soft-disconnect (`DISCONNECTED`) for sync accounts so old
  settings and link mappings could be restored when the same provider is added
  again.
- The current add-account flow can restore a matching disconnected connection,
  but there is no first-class concept of "replace this connection with a new
  one".
- Hidden `DISCONNECTED` rows have already created product confusion around plan
  caps and reconnection intent.
- The user has explicitly asked for two branches:
  - `Reconnect existing connection`
  - `Create new connection and permanently retire old connection`

That product shape needs a cleaner underlying model before the UI can be made
trustworthy.

## Success criteria
- Sync connections have a stable logical identity separate from the row primary
  key.
- `DISCONNECTED` and `RETIRED` have distinct meanings and are enforced
  consistently in code.
- A replaced connection chain can be reconstructed later for support/debugging.
- Plan-cap accounting excludes non-active historical rows.
- Activity/audit events can distinguish "reconnected existing connection" from
  "created new connection and retired old one".

## Exit criteria
- `SyncAccount` schema supports logical connection identity and replacement
  lineage.
- `RETIRED` is added as a distinct lifecycle status.
- Billing gates count only active-ish sync accounts.
- Backend service/actions support both:
  - reconnect existing connection
  - create new connection + retire old one
- Old connections marked `RETIRED` are preserved for history/audit and are not
  eligible for normal reconnect flows.
- Backfill plan exists for existing rows.

## Proposed tickets

> This phase is backend/domain-model only. The user-facing choice UI and history
> presentation land in Phase 34H.
>
> Build-ready detail in the standalone files:
> - [P34G-01 — SyncAccount lineage schema](p34g-01-syncaccount-lineage-schema.md)
> - [P34G-02 — Sync connection lifecycle status](p34g-02-sync-connection-lifecycle-status.md)
> - [P34G-03 — Sync-account cap accounting](p34g-03-sync-account-cap-accounting.md)
> - [P34G-04 — Reconnect and replace domain actions](p34g-04-reconnect-and-replace-domain-actions.md)
> - [P34G-05 — Sync connection activity events](p34g-05-sync-connection-activity-events.md)
> - [P34G-06 — Sync lineage backfill, invariants & support](p34g-06-sync-lineage-backfill-and-support.md)

## Suggested implementation order
1. P34G-01 — schema + lineage fields
2. P34G-02 — status semantics
3. P34G-03 — plan-cap accounting
4. P34G-04 — backend reconnect/replace actions
5. P34G-05 — activity/audit events
6. P34G-06 — backfill and support tooling

## Risks / open questions
- **Row reuse vs lineage purity**: reconnecting reuses the same row by design,
  while replacing creates a new row. That split is intentional and should remain
  explicit.
- **Replacement-chain depth**: decide whether multi-generation chains need first
  class UI in v1 or only debug/support visibility.
- **Provider matching**: CardDAV can match on base URL + label; OAuth providers
  may need stronger matching keys later.
- **History retention**: retired rows should remain queryable long enough for
  support and audit needs.

## Documentation
- [ ] External · users — help copy for reconnect vs replace lands in Phase 34H
- [ ] External · developers — none
- [x] Internal · engineering — this phase file is the source of truth for
      lifecycle semantics
- [ ] Internal · ops/admin — add support notes once debug views land
