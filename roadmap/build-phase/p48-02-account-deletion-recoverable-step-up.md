# P48-02 — Account deletion: recoverable grace state + server-side step-up

**Phase:** 48 · **Workstream:** A · **Priority:** P0 · **Depends on:** P48-01
**Audit severity:** High + Medium

## Objective

Make the 30-day deletion grace period actually cancellable by the user, and
require the password server-side for the actions that the UI currently
"protects" with a client-side confirm modal.

## Context

- `src/app/actions/account.ts:276-283` `scheduleAccountDeletion` sets
  `lifecycleState: "LOCKED"`, `scheduledDeleteAt`, and bumps `sessionVersion`.
- `src/server/auth/config.ts:128-130` throws `AccountLockedSigninError` for
  any LOCKED user *before* the `_pendingDeletion` flag at `:142` is reached,
  so sign-in is refused for the whole grace period.
- `account.ts:341 cancelAccountDeletion` requires a session the user cannot
  obtain. UI copy at `account-deleted/page.tsx:19` and
  `delete-account-section.tsx:99` promises "sign back in to cancel".
- `src/app/api/cron/delete-accounts/route.ts:13-17` hard-deletes
  `LOCKED && scheduledDeleteAt <= now`. Only an admin `unsuspendAccount` can
  rescue a user who changed their mind.
- The action itself only checks `confirmEmail` equals the session email
  (`account.ts:222-230`), which the caller already knows. A hijacked session
  (XSS, stolen cookie, or a pending-TOTP session until P48-01) can schedule
  deletion directly.
- `account.ts:368 verifyPasswordForStepUp` returns a boolean bound to nothing;
  `scheduleAccountDeletion`, `createBillingPortalSession` and
  `requestDataExport` mount `ConfirmPasswordModal` but can be called directly.

## Steps

1. **Distinct deletion state.** Either add `PENDING_DELETION` to
   `LifecycleState`, or keep `ACTIVE` + non-null `scheduledDeleteAt` as the
   user-initiated state. Admin-initiated suspension stays `LOCKED`.
2. **Sign-in.** In `authorize`, allow the pending-deletion state through with
   `_pendingDeletion: true`; keep throwing for `LOCKED`.
3. **Gate the app.** The P48-01 `requireSession` helper treats
   `pendingDeletion` as read-only-plus-cancel: allow `/account-pending-deletion`,
   `cancelAccountDeletion`, sign-out; block everything else (or allow reads
   and block writes — decide and document).
4. **Cron.** Key `delete-accounts` on the new state + `scheduledDeleteAt`.
   Keep the LOCKED path only if admin deletion also uses it.
5. **Server-side step-up.** Add `currentPassword: string` to
   `scheduleAccountDeletion` and verify with bcrypt in the action, as
   `changePassword` / `requestEmailChange` already do. Alternatively have
   `verifyPasswordForStepUp` issue a short-lived (5 min) HMAC nonce stored on
   the `UserSession` row and require it in the sensitive actions. Apply the
   same to `createBillingPortalSession` and `requestDataExport`.
6. **Stripe on delete.** See P48-14 for cancelling the subscription when the
   hard delete runs.

## Acceptance

- Schedule deletion → sign out → sign in with password (+2FA) → land on
  `/account-pending-deletion` → cancel → account fully active.
- While pending, mutating actions and API routes are refused.
- Calling `scheduleAccountDeletion` without a valid `currentPassword` (or
  step-up nonce) fails; the same for billing portal and data export.
- Cron deletes only accounts whose grace period has elapsed in the new state.
- Regression tests cover schedule → sign-in → cancel and the step-up refusal.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help ("Cancel a scheduled deletion")
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (lifecycle states, support rescue path)
- [x] Internal · engineering — docs/ (lifecycle state model)

## References

- Audit report §High "Scheduling account deletion locks the user out of cancelling it"; §Medium "Step-up password check is client-side theatre"
- `src/app/actions/account.ts`, `src/server/auth/config.ts`, `src/app/api/cron/delete-accounts/route.ts`
- P18-09 (original deletion flow)
