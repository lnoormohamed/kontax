# Capability-token storage

**Cross-cutting concept (P48-18).** How Kontax stores the bearer tokens that
work as a URL on their own, with no session: the calendar feed, public vCard
share links and family/team invites.

---

## The rule

The database must never hold a working credential. Someone with a read-only copy
of it (a stolen backup, a SQL user with too much access, a restored dump on a
laptop) must not be able to build a working URL from what they read.

Every capability token is therefore stored as a **SHA-256 hash**. Some also have
an **encrypted display copy**, but only where the product shows the link to its
owner again.

| Token | Unlocks | Lookup column | Display copy | Plaintext (legacy) |
|---|---|---|---|---|
| Calendar feed | `/api/calendar/birthdays.ics?calToken=…`, every contact's dates | `User.calTokenHash` | `User.calTokenEncrypted` | `User.calToken` |
| vCard share link | `/share/<token>` + `.vcf` | `ContactShare.tokenHash` | `ContactShare.tokenEncrypted` | `ContactShare.token` |
| Family / team invite | accepting the invite (48 h) | `GroupMember.inviteTokenHash` | none (only ever emailed) | `GroupMember.inviteToken` |

Password-reset, email-verification, email-revert, API and recovery tokens
already used hash-only storage before P48-18. This change brings the last three
token types into line.

## Generation and hashing

- Tokens are generated the same way as before: `randomBytes(24).toString("base64url")`,
  which gives 192 bits. P48-18 changed only how they are stored.
- The lookup value is `sha256(token)` as lowercase hex, taken over the exact
  token string. The hash columns are `UNIQUE`.
- The hash is plain SHA-256, not a keyed HMAC. That matches the existing
  `tokenHash` columns, and links keep working when `AUTH_SECRET` or an
  encryption key is rotated. With 192 bits of randomness in each token, nobody
  can brute-force the preimage, so a key would add nothing.
- A presented token is hashed and then looked up. The hash itself is not a
  credential: if someone presents it, it gets hashed again and matches nothing.

## Display copies

The calendar URL (Settings → Notifications) and share links (the contact's
Sharing tab, and the QR modal via `getOrCreateVcardShareLink`) are shown to
their owner again later. For those two token types the token is also stored
encrypted:

- The display copy uses the P48-16 versioned envelope (`encryptEnvelope` /
  `decryptEnvelope` in `src/server/sync-credentials.ts`) with its own prefix,
  `kontax-tok-v1`, and its own HKDF info label, `kontax:display-tokens:v1`. The
  keys come from the sync credential keyring (`SYNC_CREDENTIAL_ENCRYPTION_KEYS`).
  Because the prefix and label differ, a display copy can never be read as a
  sync-credential or TOTP ciphertext, or the reverse.
- Decrypting never throws. If the key has been retired or the value is damaged,
  the result is **unavailable** and the UI shows a **"Regenerate link"** state.
  Regenerating revokes the old token and issues a new one, and the user has to
  ask for it. The app never swaps a link on its own, because the old one may
  still be in use (a calendar subscription, a link someone was sent).
- A decrypted copy is shown only if it hashes to the row's lookup hash. That way
  a display copy moved from another row can never be presented as a working
  link.
- Invite tokens get no display copy. They are emailed once, and resending
  issues a new token.

## Code map

Everything lives in `src/server/capability-tokens.ts`:

- `hashToken`, `encryptDisplayToken`, `decryptDisplayToken`, `resolveDisplayToken`
- write column sets: `calTokenColumns`, `shareTokenColumns`,
  `inviteTokenColumns`, `clearedInviteTokenColumns`. Each one writes the hash
  (and the display copy where there is one) and sets the legacy plaintext column
  to `NULL`.
- display helpers: `calTokenDisplaySelect` + `calDisplayToken`,
  `shareTokenDisplaySelect` + `shareDisplayToken`
- lookups: `findUserByCalToken`, `findShareByToken`, `findMemberByInviteToken`.
  Each one takes a finder callback, so callers keep their own
  `select`/`include`, their transaction client and full Prisma typing.

The module does not import `~/server/db`. That keeps it usable from the backfill
script, which has its own `PrismaClient` and skips app env validation.

## Legacy dual-read window

Rows issued before P48-18 still keep the token in the plaintext column. Until
the backfill has run everywhere:

- each lookup helper queries the hash column first and then falls back to the
  plaintext column;
- each display helper falls back to the plaintext value when there is no display
  copy;
- app code never writes a value to a plaintext column. It only sets one to
  `NULL`, when it rotates or clears a token (regenerate calendar link, resend,
  accept or decline an invite), so an old link stops working along with it.

`scripts/backfill-p48-18-token-hashes.mjs` converts the remaining rows in
batches. In a single conditional `UPDATE` per row it writes the hash (plus the
display copy for calendar and share tokens) and sets the plaintext column to
`NULL`. It runs as a dry run by default, is idempotent, and never prints tokens.
The deploy order is in [roadmap/runbooks/deploy.md](../roadmap/runbooks/deploy.md)
under "P48-18 deploy order".

Once `count(*) … IS NOT NULL` is 0 for all three plaintext columns in every
environment, the follow-up ticket removes the fallbacks marked `LEGACY` in
`capability-tokens.ts` and drops the columns.

## Rules for new capability tokens

1. Generate at least 128 bits of randomness.
2. Store `hashToken(token)` in a `UNIQUE` column and look up by it.
3. Add an encrypted display copy only if the product really has to show the
   token again. Use `encryptDisplayToken`, and handle the unavailable state in
   the UI.
4. Never log a token or a display copy.
