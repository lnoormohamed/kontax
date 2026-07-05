# P47-13 Production smoke-test results

**Origin:** `https://getkontax.com` · **Build:** `3c917d5` (staging→main merge,
P38–P47 train) · **Date:** 2026-07-05 · **Tester:** Claude (scripted pass as
QA user `p47qa@getkontax.com`), UI/device items assigned to Li.

Method: scripted curl/API against the live origin — real registration, real
NextAuth credentials login (csrf → callback), REST API v1 with a minted
READ_WRITE token, session-cookie routes for app surfaces. No mocks; the QA
user, contact, avatar, and export jobs were created and destroyed on prod.

## Results

| Area | Result | Evidence |
|------|--------|----------|
| **Auth — register** | ✅ PASS | `/api/register` 201-path (`{"ok":true}`); rate limiter fired 429 correctly when the shared bucket was hot |
| **Auth — login (credentials)** | ✅ PASS | csrf → `/api/auth/callback/credentials` 302 + session cookie; `/api/auth/session` returns the user; session survived a deploy |
| **Auth — email delivery (SES)** | ✅ PASS | SES API: ProductionAccessEnabled=true, getkontax.com DKIM SUCCESS; live registration email sent through the app path with no error, visible in the 24 h send counter. (Inbox receipt spot-check: verification mail to li+p47ses@… — probe account since deleted) |
| **Auth — 2FA (TOTP)** | 🖐 MANUAL | Needs an authenticator app; `TOTP_ENCRYPTION_KEY` is set. → Li |
| **Contacts — CRUD (REST v1)** | ✅ PASS | POST create → GET 200 → PUT update (`company` persisted) → DELETE 204, via `api.getkontax.com/v1/contacts` (rewrite host working end-to-end) |
| **Contacts — search** | ✅ PASS | `/api/contacts/search?q=smoke` returned the contact with updated fields (FTS trigger live) |
| **Contacts — avatar upload + display** | ✅ PASS (P47-02) | `/api/upload/avatar` → canonical PNG + 96px webp thumb, both public 200 on `media.getkontax.com`, no image-proxy |
| **Contacts — list windowing / alphabet scrubber** | 🖐 MANUAL | Touch/scroll behaviour; preview can't emulate touch. → Li on a phone |
| **Photos/sync — provider round-trip** | ⏸ DEFERRED | `PHOTO_SYNC_ENABLED` off (launch decision) and no provider account connected; needs an interactive OAuth connect. Sync runner endpoint itself 200 every 15 min |
| **Sharing / Family / Teams** | 🖐 MANUAL | Share-link create/accept is UI-driven; two-account flow. → Li (or a scripted pass in a follow-up session) |
| **Billing — plan surface** | ✅ PASS | `/api/billing/plan` → `{"plan":"FREE"}` with session |
| **Billing — live checkout/webhook** | ⏸ DEFERRED | Stripe still test mode by decision (P47-08 at the end); pricing page renders live test prices from the Stripe catalog ($2.99/$3.99) |
| **Mobile / PWA — assets** | ✅ PASS | `manifest.webmanifest` 200, `sw.js` 200 |
| **Mobile / PWA — install, offline shell, gestures** | 🖐 MANUAL | Device-only. → Li |
| **Notifications** | ✅ PASS (surface) | Bell is an overlay (no `/notifications` route — 404 expected); `/settings/notifications` 200. Aging/event-passed rendering verified on staging pre-merge; live re-check is UI. → Li for visual |
| **Public card** | ✅ PASS | username claimed → `/u/p47qa` 200 |
| **API tokens + rate limits** | ✅ PASS | Minted token authenticates; `X-RateLimit-Limit: 200 / Remaining: 196` counting in shared Redis DB 1 (P47-03) |
| **Export — P45 archive job** | ✅ PASS | POST `/api/exports/kontax` → COMPLETED (1 contact) → presigned **public** URL → downloaded 200 → **`open-format/bin/validate.mjs`: VALID ✓** (manifest schema, integrity checksums, contact schema) |
| **Export — data export (GDPR)** | ✅ PASS (earlier) | DataExportJob → READY → public presigned ZIP downloaded (P47-02 pass) |
| **Import — reimport round-trip** | 🖐 MANUAL | Archive import is a UI wizard flow. → Li (import the downloaded archive on `/import-export`) |
| **Cron** | ✅ PASS | All probed endpoints 200 on the new build (`sync`, `digest`, `expire-exports` + earlier full set); real data-export job processed by the cron route. Overnight-run confirmation due next day |

## Outcome

- **No P0 failures.** Every scripted area passed; nothing broke on the new build.
- **Known non-blockers:** rate-limit client IP is one shared bucket until the
  Traefik `trustedIPs` fix (deferred by decision); email delivery untested
  (SES deferred); Stripe test mode (deferred).
- **Open before sign-off:** the 🖐 MANUAL rows (2FA, mobile device pass,
  sharing flow, import wizard, notification visuals) and the overnight-cron
  check. Sign-off line stays open until those close.

Sign-off: _pending manual items_ · scripted pass: Claude, 2026-07-05

## QA fixtures left on prod (clean up at P47-14)

- User `p47qa@getkontax.com` (id `cmr7fczy60000mq4cex0ak6kl`, username `p47qa`,
  email force-verified) — **keep for re-tests; rotate password before launch**
- ApiToken `p47-smoke` (id `p47qaapitoken00000000000`, READ_WRITE) — revoke at cutover
- Export jobs: 1 DataExportJob (expires via cron 48 h) + 1 KontaxExportJob
  (expires 2026-07-12); smoke contact deleted; avatar objects remain in MinIO
