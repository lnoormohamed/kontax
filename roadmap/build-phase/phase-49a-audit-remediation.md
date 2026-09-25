# Phase 49A — Full-audit remediation

## Phase status
Planned — tickets written 2026-09-25 from the full audit
([kontax-full-audit-2026-09-25.md](../runbooks/kontax-full-audit-2026-09-25.md)).

## Phase objective
Fix the defects found by the 2026-09-25 full audit before real users arrive: sync data loss,
billing correctness, one live security hole, an availability risk, backups, false public claims,
and the worst UX/accessibility gaps.

## Production verification (2026-09-25)
Every ticket below was checked against production before it was written:

- **Code:** production runs `main` @ b71a35f. The audited code is identical to it except the two
  P49 files (`api/v1/_lib/auth.ts`, `server/billing.ts`), which do not affect any finding here.
  Each P0 was re-confirmed by reading `origin/main` directly; A-01, A-02, A-13 and A-23 were
  reproduced by running prod's own code locally on sample input.
- **Runtime:** checked on the live prod container (LXC 122) and prod DB host (LXC 129),
  read-only. Google sync, Stripe (incl. Teams prices), SES and MinIO are configured in prod;
  Microsoft/Outlook is **not** configured, so Outlook-only paths are latent in prod.
- **Data:** prod currently holds 3 users, 0 active contacts, 0 sync accounts, 0 subscriptions and
  0 Stripe webhook events (read-only, counts-only queries). **No finding has corrupted real data
  yet** — each one triggers as soon as real users sync, pay or import. That is the window to fix
  them.
- **Live public site:** `/about` and `/contact` redirect to /login, `/u/demo` and
  `/changelog.xml` 404, duplicated page titles — all confirmed on getkontax.com.

## Tickets

| Ticket | Title | Priority | Audit IDs | Depends on |
| --- | --- | --- | --- | --- |
| [P49A-01](p49a-01-google-sync-correctness.md) | Google sync: push mask, paging, false conflicts, per-contact errors | P0 | A-01, A-04, A-05, A-07, A-22, A-23 | — |
| [P49A-02](p49a-02-carddav-server-put-fidelity.md) | CardDAV server PUT: grouped properties, full replace, ETag bumps | P0 | A-02, A-18, A-23 | — |
| [P49A-03](p49a-03-carddav-client-push-fidelity.md) | CardDAV client push: preserve remote-only data, If-Match, duplicate UIDs | P0 | A-03, A-21 | P49A-10 |
| [P49A-04](p49a-04-sync-job-and-conflict-lifecycle.md) | Sync jobs & conflicts: lease reclaim, graceful shutdown, no conflict re-open | P0 | A-06, A-08 | — |
| [P49A-05](p49a-05-stripe-webhook-and-billing-lifecycle.md) | Stripe webhook retries and billing lifecycle | P0 | A-09, A-24 | — |
| [P49A-06](p49a-06-entitlements-teams-caps-locks.md) | Entitlements: Teams personal limits, contact cap everywhere, team lock | P0 | A-10, A-25, A-26 | — |
| [P49A-07](p49a-07-admin-override-and-admin-hardening.md) | Admin plan override without poisoning Stripe; admin hardening | P0 | A-11, A-27, P2-admin | P49A-05 |
| [P49A-08](p49a-08-ses-sns-topic-binding.md) | SES/SNS webhook: bind to our TopicArn | P0 | A-12 | — |
| [P49A-09](p49a-09-duplicate-scoring-performance.md) | Duplicate scoring: blocking, not O(n²), off the web thread | P0 | A-13 | — |
| [P49A-10](p49a-10-multi-value-field-model.md) | One source of truth for emails/phones/addresses | P0 | A-14, A-19 | — |
| [P49A-11](p49a-11-backup-integrity.md) | Backups: pipefail, verified dumps, off-host copy | P0 | A-15 | — |
| [P49A-12](p49a-12-delete-merge-and-change-propagation.md) | Hard delete, merge/undo and non-web edits propagate correctly | P1 | A-16, A-17, A-20 | P49A-10 |
| [P49A-13](p49a-13-account-security-step-up.md) | Step-up for durable credentials; account-security hardening | P1 | A-28, SEC P2 set | — |
| [P49A-14](p49a-14-pricing-truth-from-plan-data.md) | Pricing matrix rendered from plan data; correct false claims | P1 | A-31–A-34 | — |
| [P49A-15](p49a-15-public-site-fixes.md) | Public site: /about & /contact public, dead links, mobile, titles | P1 | A-35–A-37 | — |
| [P49A-16](p49a-16-runtime-ops-and-sync-performance.md) | Runtime & ops: Dockerfile, timeouts, health split, DAV/sync perf, export blobs | P1 | A-29, A-30, A-38–A-42 | P49A-04 |
| [P49A-17](p49a-17-ux-accessibility.md) | UX & accessibility: confirmations, labels, 2FA inputs, focus, loading states — **deferred: reassess after Phase 50** | P1 | A-43–A-47 | P50-06, P50-07 |
| [P49A-18](p49a-18-hardening-and-debt-backlog.md) | Hardening & debt backlog | P2 | P2 list | — |

## Suggested delivery order
1. P49A-15 (S) — can ship with the pending P49 homepage release.
2. P49A-01, -02, -04, -05, -08 — small, stop ongoing loss/stalls.
3. P49A-06, -07, -09, -11.
4. P49A-10 → -03 → -12 (data model first).
5. P49A-13, -14, -16, then -18. P49A-17 is reassessed after Phase 50.

Model roles: Opus/Sonnet implement; Fable reviews every P0 ticket and all security tickets.
Each ticket lands on `staging` first; nothing reaches `main` without an explicit go-ahead.

## Documentation
- [ ] External · users — pricing/help copy (P49A-14, -15)
- [ ] External · developers — /developers rate limits (P49A-14)
- [ ] Internal · admins/ops — runbooks: sync-ops, db-restore, gdpr-erasure, deploy (P49A-04, -11, -16)
- [ ] Internal · engineering — sync field model (P49A-10)
