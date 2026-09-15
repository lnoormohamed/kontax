# P48-17 — Residual hardening & `/security` page truth

**Phase:** 48 · **Workstream:** G · **Priority:** P2 · **Depends on:** P48-01
**Audit severity:** Medium (×2) + Low (×6)

## Objective

Sweep the remaining audit items that are individually small, and make sure
every claim on the public `/security` page is true of the deployment before
launch.

## Context and steps

1. **Unlimited outbound email with attacker-controlled sender text (Medium).**
   `shares.ts:230 createStaticShare` / `:447 createLiveShare` email any
   `recipientEmail` with subject `"${ownerName} shared a contact…"` where
   `ownerName` is the unrestricted 120-char `User.name`; `family.ts:431
   resendFamilyInvite` / `teams.ts:403 resendTeamInvite` have no cap. No
   limiter exists for these in `rate-limit.ts`.
   → Per-user limiters (`shareEmail` 20/h, `inviteResend` 5/h/invite);
   constrain `User.name` to letters, marks, digits, spaces and common
   punctuation; put the name in the body, not the subject.
2. **Plan-limit check-then-act races (Medium).** `contacts.ts:597`,
   `import-export.ts:69-71`, `family.ts:139-142`, `teams.ts:168-171`,
   `app-passwords.ts:51-63`, `sync.ts:679-856`; share/group-book acceptance
   paths skip `assertCanCreateContacts` entirely.
   → Perform the count and the insert inside one `$transaction` with
   `SELECT … FOR UPDATE` on the user row (or an advisory lock keyed on
   userId); apply the cap on the acceptance paths.
3. **Team role gaps (Low, design review).** `teams.ts:182` ADMIN can invite
   ADMIN; `:273-291` ADMIN can demote/remove other ADMINs; `:336` ADMIN can
   grant themselves `canManageBilling` then cancel the org subscription;
   invite acceptance not bound to `invitedEmail`. → Decide the intended
   matrix with product; at minimum owner-only for billing-manager grants and
   ADMIN-on-ADMIN changes; bind acceptance to the invited email or make it
   an explicit product choice.
4. **JSON mass assignment (Low).** `card-visibility.ts:19-21` spreads an
   unvalidated patch into `publicCardFields`; `server/preferences.ts:35`
   whitelists keys but not values and preferences ride in the JWT (4 KB
   cookie self-lockout); `admin.ts:614` stores `actionUrl` unvalidated.
   → zod schemas with booleans/enums and size caps; `actionUrl` must be a
   same-origin path.
5. **Non-production surfaces (Low).** `src/app/wireframes/**` (10 pages)
   reachable by any signed-in user. → `notFound()` unless
   `NODE_ENV !== "production"`, or delete.
6. **PII in logs (Low).** `email.ts:88-91` prints full email bodies (with
   reset/verify links) whenever any SES var is missing regardless of
   `NODE_ENV`; `account.ts:164` logs old and new addresses; `auth.ts:53`
   logs unknown reset emails. → Gate on `NODE_ENV !== "production"`, redact.
7. **SNS replay (Low).** `sns-verify.ts` / `ses/events/route.ts`: add
   `Timestamp` freshness (±15 min) and a `MessageId` dedupe (Redis SETNX,
   24 h TTL); bound `certCache`.
8. **`/security` page (Medium, trust).** `src/app/(marketing)/security/page.tsx`:
   - `:204-205` "Managed PostgreSQL with encryption at the storage layer" and
     `:207-208` "Backups carry the same encryption" — `runbooks/db-restore.md:64-83`
     shows self-hosted Postgres (LXC 129) and plain `pg_dump | gzip` to a
     NAS. Either enable encryption at rest on the Proxmox volume + encrypt
     backups (`age`/`gpg` in the nightly job), or rewrite the claims.
   - `:88` aria-label "stores data encrypted at rest with AES-256" — only
     TOTP secrets and sync credentials are app-encrypted. Reword.
   - `:266` "sign-in rate-limited" — true only with Redis (P48-16).
   - `:330-332` export on Free — confirm the `premiumExportEnabled` gate
     doesn't contradict it.
   - Keep the honest "no badges we haven't earned" section.

## Acceptance

- 21 share emails in an hour from one user → the 21st is refused with a
  clear message; invite resend capped.
- Two parallel contact creates at the Free cap of 500 → exactly one
  succeeds.
- Team matrix documented; tests for owner-only transitions.
- `/wireframes/*` → 404 in production.
- Production logs contain no email bodies or addresses from these paths.
- A replayed SNS bounce notification is ignored.
- Every sentence on `/security` maps to a verifiable control listed in
  `roadmap/runbooks/p47-production-readiness.md`; backups are encrypted or
  the claim is gone.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (sharing/invite limits; `/security` copy)
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (backup encryption; team role matrix)
- [ ] Internal · engineering — docs/

## References

- Audit report §Medium email/races/`/security`; §Low team/JSON/wireframes/logs/SNS
- `src/app/actions/{shares,family,teams,card-visibility,admin,contacts}.ts`, `src/server/{email,sns-verify,preferences}.ts`, `src/app/(marketing)/security/page.tsx`, `roadmap/runbooks/db-restore.md`
- P47-12 (backups)
