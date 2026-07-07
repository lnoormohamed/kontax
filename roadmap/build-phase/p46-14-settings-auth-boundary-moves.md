# P46-14 (DB07·T3) — Auth-boundary moves (Account = identity, Security = sign-in)

Status: **Built & preview-verified (2026-07-06, d82fd8e)** · Priority: P1 · Depends: P46-12
Phase: [Phase 46](phase-46-alphabet-scrubber.md) · Spec: DB07 §3

Password change → Security; sessions + sign-out card → Security (with T2);
username → the Public card page, which moves to `/settings/account/card`
(301 from `/settings/profile/card`); data export → Data & sync (T4 target,
`/settings/data/export`); Account keeps a Public-card link row. Security's
sync-provider rows drop (live status is `/sync`'s — no duplicate). Resolves
smells 4, 9.

Acceptance: Account = profile/avatar/email + card link only; Security =
password/2FA/sessions/connected sign-ins/app-password revocations (T4
mirror)/delete-account last; old card URL 301s; no sync rows on Security.
