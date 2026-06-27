# Admin Investigation Timeline

## Purpose

Use the investigation timeline on admin user and sync detail pages as the
primary incident-reading surface before jumping between separate cards.

## What the timeline combines

- support notes
- support case lifecycle events
- destructive or support-relevant admin actions
- sync failures, recoveries, conflicts, and connection lineage changes

## How to read it

1. Start with `All` to understand the full sequence quickly.
2. Switch to `Notes`, `Cases`, `Admin actions`, or `Sync activity` when one
   source is creating noise.
3. Use linked entries to jump back to the underlying support queue, audit
   screen, or sync record when deeper inspection is needed.
4. Add new handoff context from the note composer at the top of the timeline so
   future admins keep one coherent history.

## Guardrails

- Treat the timeline as the incident narrative; avoid duplicating the same
  context into multiple separate notes.
- Use support notes for human context and decisions.
- Use support cases for tracked ownership, severity, and follow-up workflow.
