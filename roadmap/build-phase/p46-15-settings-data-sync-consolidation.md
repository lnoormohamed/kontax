# P46-15 (DB07·T4) — Data & sync consolidation

Status: **Pre-plan** · Priority: P1 · Depends: P46-12
Phase: [Phase 46](phase-46-alphabet-scrubber.md) · Spec: DB07 §6

Presets fold into `/import-export` as a **Presets tab** (301s from
`/settings/import-presets` + `/settings/export-presets`); Books hub →
`/settings/data/books` (301) as an **index pointing to owners** (personal
books on the hub; shared CRUD stays in Family/Teams; permission history →
pointer to Teams audit); Devices → `/settings/data/devices` (301), renamed
"Connect a device / CardDAV", app-password **revocation list mirrors to
Security** (cross-linked); "Download your data" → `/settings/data/export`.
`/sync` and `/import-export` stay workspace-level, linked ↗ from the
`/settings/data` index. Resolves smells 1, 6, 8.

Acceptance: presets manageable inside import/export only; every old URL 301s;
data index links render (↗ for the two workspace surfaces); Security shows
the revocation mirror.
