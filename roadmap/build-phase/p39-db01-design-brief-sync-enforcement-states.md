# P39-DB01 — Design Brief: Sync Enforcement States, Dirty Guard & Mobile Sheet

Status: Done — brief delivered at
[roadmap/design-briefs/p39-db01-sync-enforcement-states.md](../design-briefs/p39-db01-sync-enforcement-states.md)
(2026-07-03, imported from the Claude Design handoff).

## Purpose

Specify the UX for what the user *sees* when Phase 39's runner enforcement
kicks in. P36 designed the settings panel (the controls); this brief designs
the **consequences**: an account paused by the deletion-safety threshold, a
sync deferred by the sync window, an account auto-paused by retry sensitivity —
plus the two P36-DB01 follow-ups that were never built (the dirty guard and the
mobile bottom-sheet layout).

Without this brief, enforcement ships as raw status codes. The whole point of
the advanced settings is *trust* — the moment a safety rail fires is exactly
when the UI must be clearest.

## Background

- [P36-DB01](../design-briefs/p36-db01-sync-account-settings.md) is the parent
  brief; its "Runner integration notes" and two "Not yet built" callouts are
  this brief's scope. The locked design language and the existing sync-page
  status conventions (status pills, history rows, error banners) apply.
- The deletion-threshold pause (P39-02) introduces a **new kind of paused
  state**: not an error, not user-initiated — a protective stop that requires
  review before resuming.

## Scope

### In scope

1. **Deletion-safety pause surface** — the account detail when status is
   `PAUSED` with `DELETION_THRESHOLD_EXCEEDED`:
   - A distinct banner (amber, not red — protective, not broken): "Sync paused:
     this sync would have deleted N contacts (your limit is M)."
   - A review affordance: what would have been deleted (list or count by book),
     and two explicit actions — **[Resume and allow deletions]** (destructive
     styling + confirm) vs **[Resume without deleting]** / adjust the threshold.
   - The history row treatment for the halted run.
2. **Sync-window deferral copy** — account header / next-run line when a run
   was skipped: "Next sync at 08:00 (outside your sync window)". No error
   styling; this is configured behaviour. "Sync now" remains available and its
   tooltip notes it bypasses the window.
3. **Auto-pause by retry sensitivity** — banner + history copy when
   `maxAttemptsBeforePause` trips: failure count, last error, [Resume] and
   [Open settings] actions. Distinguish visually from `NEEDS_REAUTH`.
4. **Notification templates** — in-app notification + email copy for: deletion
   pause, auto-pause, needs-reauth (align with the P20 email template system;
   one layout, variable body).
5. **Dirty guard** — the "Discard unsaved settings?" prompt (reuse
   `ConfirmDialog`): triggered by selecting another account, opening Edit
   credentials, or closing the panel with unsaved changes. Buttons: [Keep
   editing] (default) / [Discard changes].
6. **Mobile bottom sheet (< 768px)** — the P36-DB01 mobile layout, finally:
   full-screen sheet, drag handle, "Sync settings" + close ×, sections stacked
   at 24px, full-width Save pinned above the safe area. Follow the existing
   mobile create-contact sheet patterns (roadmap/mobile-design-brief.md).

### Out of scope
- The settings controls themselves (P36-DB01 owns them).
- Projection-scope / destination-book controls (P41-DB01).
- Admin-side views of paused accounts (34-series admin phases).

## States to specify

For each of surfaces 1–3: default, first-occurrence (with notification badge),
after-resume success toast, and the mobile rendering. For the deletion review:
loading, empty (deletions already reconciled), and >50-items truncation.

## Deliverables

A `p39-db01` brief in `roadmap/design-briefs/` following the P36-DB01 format:
exact copy for every banner/notification, layout blocks, color tokens (reuse
the amber callout tokens from P36-DB01 §3), and the mobile sheet spec — ready
for P39-02/05/06/07 to build against without further design decisions.

## Dependencies
Blocks P39-02, P39-05, P39-06, P39-07 (build tickets consume this spec).
Informed by, but does not block, P39-01/03/04 (their UX is copy-only).
