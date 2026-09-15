# P48-06 — Impersonation read-only + `pendingDeletion` enforcement across actions and API routes

**Phase:** 48 · **Workstream:** C · **Priority:** P1 · **Depends on:** P48-01
**Audit severity:** Medium

## Objective

Make the documented "read-only impersonation" guarantee true, and apply the
same central write guard to every mutating server action and API route so
`impersonatedBy` and `pendingDeletion` sessions cannot change data.

## Context

- `src/server/impersonation-guard.ts assertWritable` has **zero callers**.
  17 of 30 action files re-implement the `impersonatedBy` check inline; 11
  skip it entirely. Every one of the 35 `/api/*` routes that call `auth()`
  skips it.
- Unguarded mutators an impersonating admin can call as the victim:
  `api-tokens.ts:18 createApiToken` (mint a `READ_WRITE` token and receive
  the plaintext — persistent, unaudited full API access), `:48 revokeApiToken`;
  `billing.ts:22 createCheckoutSession`, `:185 createBillingPortalSession`
  (change card, cancel); `data-export.ts:24 requestDataExport`;
  `sessions.ts:38 revokeSession`, `:73 revokeAllOtherSessions` (revokes every
  target session since "current" is the admin's own); `account.ts:182,202,341`
  (`resendPendingEmailChange`, `cancelEmailChange`, `cancelAccountDeletion`
  which flips LOCKED→ACTIVE un-audited); `merge.ts` (all 4);
  `username.ts:29 claimUsername`; `card-visibility.ts:7`; `onboarding.ts`
  (3); `preferences.ts:7`. API routes: `upload/avatar`,
  `imports/contacts/commit`, `imports/contacts/rollback`,
  `imports/contacts/kontax/commit`, presets create/update/delete,
  `exports/kontax` POST/DELETE, `merge-suggestions/*`, `sync/run`.
- Impersonation already requires the GOVERNANCE admin tier, so this is not a
  privilege escalation, but it breaks the audit trail and the documented
  guarantee (P21-07).

## Steps

1. Use the P48-01 `requireSession({ write: true })` in every mutating action
   and route listed above (and any other mutator found by grep for
   `db.*.(create|update|delete|upsert|updateMany|deleteMany)` in
   `src/app/actions` and `src/app/api`).
2. Delete the inline `impersonatedBy` checks in the 17 files in favour of the
   helper, so there is one implementation.
3. Read-only actions and routes use `requireSession()` (default) so
   impersonated reads still work for support.
4. Decide `pendingDeletion` semantics with P48-02 (read-only + cancel) and
   encode them in the same helper.
5. Add an `emitAdminEvent` for any remaining write an impersonator *is*
   allowed to perform (there should be none).

## Acceptance

- Start impersonation on a test user; every action/route in the Context list
  returns the `IMPERSONATION_READ_ONLY` error; reads still render.
- `grep -rn impersonatedBy src/app` matches only the helper and the banner
  component.
- A pending-deletion session cannot mutate except to cancel deletion.
- Regression tests: impersonated session × {createApiToken,
  createBillingPortalSession, requestDataExport, revokeAllOtherSessions,
  POST /api/upload/avatar} → refused.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (impersonation: what support can and cannot do)
- [x] Internal · engineering — docs/ (session guard reference)

## References

- Audit report §Medium "Impersonation read-only guarantee is not enforced"
- `src/server/impersonation-guard.ts`, `src/server/auth/index.ts` (impersonation resolution), P21-07
