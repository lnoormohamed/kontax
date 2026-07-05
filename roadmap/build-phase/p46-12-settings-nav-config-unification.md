# P46-12 (DB07·T1) — Unify the settings nav definition

Status: **In progress (2026-07-05)** · Priority: P1 · Depends: P46-DB07
Phase: [Phase 46](phase-46-alphabet-scrubber.md) · Spec: DB07 §5 (converged handoff #31)

One ordered `settings-nav` config (the eight groups, Developer plan-gated) is
the single source of truth; `settings-sidebar.tsx` (desktop, incl. its use on
/sync) and `mobile-settings-nav.tsx` both map it — the two hand-maintained
structures are deleted. Mobile index keeps the account identity card on top
and a sign-out shortcut row (sign-out's home = Security, per design).
Preferences / Books / Developer become reachable on mobile; Shared-with-me on
desktop. Thin group-index pages `/settings/data` and `/settings/sharing` are
created so every config route is real; children keep their **old URLs** until
T3–T5 move them (each move lands with its 301). The Plan & billing row points
at the existing `#plan-billing` section until T2 births `/settings/billing`.
Removes the desktop "Jump to" block (Merge review removal = T6's smell,
landed here mechanically). Resolves smells 2, 11, 12.

Acceptance: both breakpoints render the same eight entries from one config
(grep: no nav entry outside it); mobile reaches Preferences/Books/Developer;
desktop reaches Shared-with-me; /sync's sidebar unaffected; typecheck + 375px
+ desktop preview pass.
