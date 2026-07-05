# Phase 34H — Reconnect vs New Connection UX, History & Retired State

> Builds the user-facing flow on top of Phase 34G: when Kontax detects a
> previous matching connection, the user can explicitly choose whether to
> reconnect that connection or create a new connection and retire the old one.

## Phase status
Pre-plan

## Phase objective
Make sync-account restoration behavior understandable and intentional.

Today, restoring a previously disconnected connection is an internal behavior.
The user does not get a clear choice between "continue this old connection" and
"start fresh". Phase 34H turns that into a visible product flow with clear
labels, safe defaults, and audit-friendly history.

## Background
Phase 34G introduces:
- stable `connectionId`
- `RETIRED` lifecycle status
- replacement lineage
- explicit reconnect and replace domain actions

Phase 34H uses that backend model to deliver the actual product behavior the
user asked for:

- `Reconnect existing connection`
- `Create new connection and retire old one`

The common path should remain simple, but the destructive or history-splitting
path must be explicit.

## Success criteria
- Users are clearly told when Kontax has found a matching previous connection.
- The default choice is safe and preserves continuity.
- Users can intentionally create a fresh connection without silently mutating
  the old one.
- Active sync lists stay uncluttered.
- History and detail views explain what happened in human terms.

## Exit criteria
- Add-account flow detects a reconnectable historical match.
- User can choose:
  - reconnect existing
  - create new and retire old
- Retired connections are hidden from the active rail but visible in
  history/detail/audit contexts.
- Connection history uses plain language and replacement pointers.
- QA covers reconnect, replace, and plan-cap edge cases.

## Proposed tickets

> Build-ready detail in the standalone files:
> - [P34H-01 — Reconnect match detection & choice-needed state](p34h-01-reconnect-match-detection-state.md)
> - [P34H-02 — Reconnect vs new connection chooser UI](p34h-02-reconnect-vs-new-connection-chooser-ui.md)
> - [P34H-03 — Reconnect existing connection flow](p34h-03-reconnect-existing-connection-flow.md)
> - [P34H-04 — Create new connection and retire old flow](p34h-04-create-new-and-retire-old-flow.md)
> - [P34H-05 — Retired state in history and detail](p34h-05-retired-state-in-history-and-detail.md)
> - [P34H-06 — Sync activity copy and support surface](p34h-06-sync-activity-copy-and-support-surface.md)
> - [P34H-07 — Reconnect / replace QA and smoke test](p34h-07-reconnect-replace-qa-and-smoke-test.md)

## Suggested implementation order
1. P34H-01 — match detection state
2. P34H-02 — chooser UI
3. P34H-03 — reconnect path
4. P34H-04 — replace path
5. P34H-05 — retired history/detail presentation
6. P34H-06 — activity/support copy
7. P34H-07 — QA and documentation

## Product decisions captured here
- Default action should be **Reconnect existing connection**
- `Retired` is the preferred user-facing status label
- `DISCONNECTED` means "temporarily off / can come back"
- `RETIRED` means "intentionally replaced / kept for history"
- creating a new connection after retiring the old one should be treated as a
  fresh connection in sync/activity history

## Risks / open questions
- **Choice fatigue**: avoid showing the chooser unless Kontax has a real match.
- **Provider-specific matching**: OAuth and CardDAV may want different copy or
  matching confidence rules later.
- **History density**: if multiple replacements happen over time, history views
  may need a compact chain presentation instead of repeated verbose messages.
- **Retired visibility**: decide whether retired rows appear only in per-account
  history or also in a dedicated "past connections" section.

## Documentation
- [ ] External · users — add reconnect/replace help copy in sync-account docs/help
- [ ] External · developers — none
- [x] Internal · engineering — this phase file is the UX/source-of-truth layer on
      top of Phase 34G
- [ ] Internal · support/admin — add "how to read retired/replaced connections"
      notes once shipped
