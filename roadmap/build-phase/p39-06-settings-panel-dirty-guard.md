# P39-06 — Settings panel dirty guard

Status: Done — built against P39-DB01 (2026-07-03) · Priority: P2 · Depends: [P39-DB01](p39-db01-design-brief-sync-enforcement-states.md)
Phase: [Phase 39](phase-39.md)

## Problem

The P36-DB01 brief's intended "Discard unsaved settings?" prompt was never
built — today, selecting another account, opening Edit credentials, or
closing the sync-settings panel silently discards a dirty draft.

## Change

Navigating away from a dirty settings draft asks before discarding. Reuse
`ConfirmDialog`. Triggers: selecting another account in the rail, opening the
Edit-credentials form (the two panels are mutually exclusive), closing the
panel ([×] or Cancel is *not* a trigger — Cancel is an explicit discard).
Buttons per the brief: [Keep editing] (default) / [Discard changes].

## Acceptance

- Each trigger with a dirty draft shows the prompt; [Keep editing] returns to
  the intact draft; [Discard changes] proceeds.
- A clean (non-dirty) panel never prompts.
- Cancel and [×] behave as before (explicit discard, no prompt).
