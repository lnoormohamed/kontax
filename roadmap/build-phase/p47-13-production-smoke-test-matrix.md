# P47-13 — Production smoke-test matrix

**Phase:** 47 · **Workstream:** D · **Priority:** P0 · **Depends on:** P47-02 … P47-11

## Objective

Run a structured pass/fail smoke test of every major feature area **against the
live production origin**, after the infra is wired but before (and again after)
the go-live cutover. This is the gate that converges the whole phase.

## Approach

Reuse the existing runbooks rather than rewriting cases:
- [../runbooks/full-smoke-test-and-field-edit-audit.md](../runbooks/full-smoke-test-and-field-edit-audit.md)
- [../runbooks/smoke-test-results-v1.md](../runbooks/smoke-test-results-v1.md) (P34D results format)
- Subsystem runbooks: `p34f-09-smoke-test.md`, `p34h-reconnect-replace-smoke-test.md`,
  `contact-photo-profile-picture-qa.md`, `stripe-billing.md`.

Record results in a new `roadmap/runbooks/smoke-test-results-p47.md`. All P0
failures must be closed before P47-14 go-live.

## Matrix (each area = pass/fail on prod)

| Area | Must verify (prod-specific) |
|------|------------------------------|
| Auth | register, login, password reset **email actually delivers** (SES prod, P47-09), 2FA (needs `TOTP_ENCRYPTION_KEY`, P47-05) |
| Contacts | CRUD, search, list windowing/scrubber, **avatar upload + display over `media.getkontax.com`** (P47-02) |
| Photos/sync | a real sync run pulls+pushes; **synced photo displays** (P44 / P47-02/04) |
| Sharing / Family / Teams | share link, accept, org-anchored billing surfaces (P34F) |
| Billing | **live** checkout, webhook received, entitlement updates, portal (P47-08) |
| Mobile / PWA | install, offline shell, contacts list, scrubber, notifications overlay |
| Notifications | bell, aging/event-passed treatment (P46-06) |
| Public card / API | public card loads, API token works, rate limits shared (P47-03) |
| Export/import | export job runs → artifact in MinIO → download; reimport round-trip (P45) |
| Cron | overnight jobs ran (check next-day, or trigger manually) (P47-04) |

## Acceptance

- Every area exercised on the live origin; results recorded with pass/fail.
- All P0 failures closed (re-test to green).
- Sign-off line in the results doc (tester + date) gating P47-14.

## References

- [../runbooks/full-smoke-test-and-field-edit-audit.md](../runbooks/full-smoke-test-and-field-edit-audit.md)
- P34D smoke-test workstream (P34D-01 → P34D-08) — reused, not rewritten
</content>
