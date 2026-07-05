# P46-16 (DB07·T5) — Sharing & groups restructure

Status: **Pre-plan** · Priority: P1 · Depends: P46-12
Phase: [Phase 46](phase-46-alphabet-scrubber.md) · Spec: DB07 §6/§5c

`/shares` → `/settings/sharing/shared` (301; now on both breakpoints);
Family → `/settings/sharing/family` (301); Teams → `/settings/sharing/teams`
(301) **split into child pages Books · Permissions · Audit** (audit 301s from
`/settings/teams/audit`); seats become read-only usage + link to Plan &
billing; group-membership shortcut card moves in from the old billing root.
Update every in-code deep link (mobile nav rows, books-page links,
DB06-era `/shares` back-target). Resolves smell 5.

Acceptance: all old URLs 301; Teams page no longer carries books + seats +
billing + audit at once; Shared-with-me reachable from the desktop sidebar;
/shares' mobile Detail header back-target updated to the new parent.
