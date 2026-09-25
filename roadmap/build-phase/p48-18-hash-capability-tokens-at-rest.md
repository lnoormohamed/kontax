# P48-18 — Hash capability tokens at rest (calendar, invite, share)

**Phase:** 48 · **Workstream:** G · **Priority:** P2 · **Depends on:** P48-14, P48-16
**Audit severity:** Low (split out of P48-14 item 6, which was skipped as too large)

## Objective

A read-only leak of the database (a stolen backup, a mis-scoped SQL user, a
restored dump on a laptop) must not hand an attacker working URLs. Today three
capability tokens are stored in plaintext and are directly usable:

| Column | What it unlocks | Shown again after issue? |
|---|---|---|
| `User.calToken` | the iCal birthday feed (names + birthdays of every contact) | yes — settings page shows the subscribe URL |
| `ContactShare.token` | the public `/share/<token>` contact card + `.vcf` | yes — owner copies the link from the sharing panel; `createStaticShare` returns the existing link |
| `GroupMember.inviteToken` | accepting a family or team invite (48 h) | no — only emailed; resend issues a new one |

Reset, verification, API and recovery tokens are already stored as SHA-256
hashes; these three are the remaining gap.

## Design

- **Lookup by hash.** New nullable `@unique` columns hold `sha256(token)` as
  lowercase hex: `User.calTokenHash`, `ContactShare.tokenHash`,
  `GroupMember.inviteTokenHash`. Every lookup hashes the presented token and
  queries the hash column. Plain SHA-256 (not a keyed HMAC) matches the existing
  `tokenHash` columns and keeps links valid across `AUTH_SECRET` rotation; the
  tokens are ≥ 144 bits of randomness, so the hash is not brute-forceable.
- **Display copy only where the product shows the link again.** Calendar and
  share tokens also get an encrypted copy (`User.calTokenEncrypted`,
  `ContactShare.tokenEncrypted`) using the P48-16 envelope/keyring primitives
  in `src/server/sync-credentials.ts` (own prefix + HKDF info label, e.g.
  `kontax-tok-v1` / `kontax:display-tokens:v1`). The UI decrypts it to show the
  URL. If decryption fails (key retired), the UI offers "Regenerate link"
  instead of crashing. Invite tokens get **no** display copy — nothing shows
  them again.
- **Plaintext columns stop being written.** New and regenerated tokens set the
  hash (+ encrypted copy where applicable) and leave the plaintext column
  `NULL`.
- **Dual-read window.** Lookups try the hash column first and fall back to the
  legacy plaintext column, so links issued before the deploy keep working until
  the backfill runs. The fallback is one helper per token type so it is easy to
  delete later.
- **Backfill.** `scripts/backfill-p48-18-token-hashes.mjs` (dry-run default,
  `--apply`): for every row with a plaintext token and no hash, write the hash
  (+ encrypted copy for calendar/share) and set the plaintext column to `NULL`,
  in batches, idempotent. It must use the app's own crypto (re-exec with the
  repo TS loader, as `scripts/rotate-sync-credential-key.mjs` does).
- **Dropping the plaintext columns** is a follow-up migration after the backfill
  has run everywhere and the fallback path has been removed — out of scope here.

## Steps

1. Additive migration `prisma/migrations/<ts>_p48_18_token_hashes/` — nullable
   columns + unique indexes, `IF NOT EXISTS` style so it applies to any
   environment. Update `schema.prisma`.
2. `src/server/capability-tokens.ts`: `hashToken`, `encryptDisplayToken`,
   `decryptDisplayToken`, and lookup helpers `findUserByCalToken`,
   `findShareByToken`, `findMemberByInviteToken` implementing hash-first +
   legacy fallback.
3. Route every read/write through them: `actions/notifications.ts`
   (ensure/regenerate cal token), `api/calendar/birthdays.ics/route.ts`,
   `settings/notifications/page.tsx` (+ `calendar-feed-section.tsx`),
   `actions/shares.ts` (create/reuse link), `server/public-share.ts`,
   `share/[token]/vcard/route.ts`, `_components/contact-sharing.tsx`,
   `actions/family.ts`, `actions/teams.ts`, `family/join/[token]/page.tsx`,
   `teams/join/[token]/page.tsx`. `git grep` for `calToken`, `inviteToken`,
   `ContactShare` `token` must show no remaining direct plaintext read/write
   outside the helpers, the backfill and the P48-14 precheck.
4. Backfill script as above.
5. Tests (`tests/node/`): helper unit tests; authz-harness tests against the CI
   Postgres for: new tokens stored hash-only; lookup by hash; legacy plaintext
   row still resolves; backfill converts a legacy row and it still resolves;
   wrong token 404s.

## Acceptance

- After deploy + backfill, `SELECT count(*) FROM "User" WHERE "calToken" IS NOT NULL`
  (and the equivalents) returns 0 in every environment.
- An existing calendar subscription URL, share link and pending invite link
  issued before the deploy still work after the backfill.
- The settings page still shows the calendar URL; the sharing panel still shows
  the share link.
- A dump of the DB alone contains no usable calendar, share or invite token.

## Deploy order (production uses `KONTAX_SCHEMA_MODE=validate`)

1. Apply the migration to prod and staging (`npm run db:migrate`).
2. Push `main` → Coolify deploys the dual-read code.
3. Run the backfill `--apply` on prod and staging.
4. Verify acceptance, then open the follow-up ticket to drop the plaintext
   columns and the fallback.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (backfill + deploy order)
- [x] Internal · engineering — docs/ (capability-token storage model)
