# P50A-05 — Help centre: hub → categories → one URL per article

**Phase:** 50A · **Priority:** P1 · **Effort:** M–L · **Depends on:** P50-02 (chrome)

## Problem (verified 2026-09-25)
`/help` is one page of ~5,300 words and ~90 questions (`src/app/_components/help-faq-data.ts`) plus
five provider guides. It can only rank for "Kontax help"; how-to searches ("connect iCloud contacts
CardDAV") land on competitors. Some answers are outdated (Outlook presented as available).

## Structure
- `/help` hub: search, categories, top tasks.
- `/help/{category}` pages: short answers grouped, links to articles.
- `/help/{category}/{slug}` articles for anything substantial. First: provider setup
  `/help/sync/{icloud,google,fastmail,carddav}` (content exists).
- Article template: task-phrased H1, one-sentence answer, numbered steps, "What to expect",
  "If it doesn't work", plan badge, "Last reviewed {date}", 2–3 related links, Article/HowTo schema
  (P50A-03). UK English; no unverifiable claims.
- Keep old `#anchor` links working (map anchors to new URLs); add all articles to the sitemap.
- In-app contextual links from the screens that need them (sync errors, app passwords, limits).

## Content (help-content review, 2026-09-25)

**Audit of today's 86 Q&As (14 sections):** Outlook presented as live (wrong); monthly import cap
(3/mo on Free), the 50-open-conflict auto-pause, the 3-failure auto-pause and
`CONTACT_LIMIT_REACHED` are real, user-hittable states with no help coverage; "How do I export"
doesn't say vCard is Pro-only; downgrade consequences (fully modelled in `plan-data.ts`
DOWNGRADE_COPY) appear nowhere; "CardDAV & sync" and "Google & Outlook sync" overlap each other and
the connection-guides widget. Long answers that should be articles: the CardDAV connect guides,
sync conflicts, GDPR export contents, Family vs Teams, downgrade consequences.

**Categories and articles** (M = migrate existing, N = new):
- `/help/getting-started` (P1): add-first-contact N · install-as-app-iphone-android M ·
  understand-free-plan-limits N · set-up-two-factor-authentication M
- `/help/sync` (P1): connect-icloud-contacts M · connect-google-contacts M ·
  connect-fastmail-contacts M · connect-android-davx5 M · what-is-carddav N ·
  fix-sync-not-working N · app-password-problems N · duplicate-flood-after-first-sync N ·
  resolve-sync-conflicts N · sync-account-paused-or-needs-reauth N · google-connection-expired M
- `/help/contacts` (P2): add-edit-contacts · search-contacts · favourites-and-emergency-contacts ·
  bulk-edit-contacts · keyboard-shortcuts · archive-delete-contacts (all M)
- `/help/organising` (P2): labels-vs-books · create-manage-labels · smart-lists ·
  move-contacts-between-books (all M)
- `/help/duplicates` (P1): merge-duplicate-contacts M · undo-a-merge N ·
  review-merge-suggestions-in-bulk N
- `/help/import-export` (P1): import-from-google-icloud M · csv-format-reference N ·
  export-your-contacts M (state vCard = Pro) · kontax-export-format N ·
  download-full-account-export M · contact-limit-reached N
- `/help/sharing` (P2): share-a-contact · accept-a-shared-contact · live-vs-static-sharing ·
  revoke-a-share · public-contact-card-and-qr-code (all M)
- `/help/family-teams` (P1 Family, P2 Teams): set-up-family-sharing M ·
  invite-remove-family-members M · family-vs-teams M · teams-roles-and-permissions M ·
  teams-audit-log M · downgrade-consequences N (incl. the 7-day Family notice)
- `/help/account-security` (P1): two-factor-authentication-setup M · 2fa-lockout-recovery-codes N ·
  review-active-sessions M · reset-your-password M · suspicious-sign-in-alert M ·
  delete-your-account M (30-day grace) · gdpr-data-export-and-erasure M
- `/help/billing` (P2): free-vs-pro-plan · manage-subscription · failed-payment-grace-period ·
  family-billing (M; drop any "automatic no-card trial" wording unless P49A-14 makes it true)
- `/help/developers` (P3): generate-an-api-token N · api-rate-limits N (thin, link to /developers)

**Launch-critical 20 (outlines in the review):** connect iCloud / Google / Fastmail / Android
(DAVx⁵); what-is-carddav; fix-sync-not-working (map each `SyncSupportBucket` in
`src/server/sync-health.ts` — authentication, connectivity, rate-limit, conflict, provider policy,
protocol/data — to plain English + fix); app-password-problems; duplicate-flood-after-first-sync;
resolve-sync-conflicts (incl. 50-conflict auto-pause); sync-account-paused-or-needs-reauth
(incl. 3-failure auto-pause); merge-duplicate-contacts; undo-a-merge; import;
export-your-contacts; contact-limit-reached; set-up-family-sharing; 2FA setup;
2fa-lockout-recovery-codes; delete-your-account; failed-payment-grace-period.

**Beyond articles:** link each onboarding-checklist step to its article; annotated static
screenshots, no video pre-launch; contextual deep links — Sync page → fix-sync-not-working /
app-password-problems, Duplicates flood state → duplicate-flood-after-first-sync, contact-limit
banner → contact-limit-reached, 2FA setup → 2fa-lockout-recovery-codes, downgrade modal →
downgrade-consequences; client-side search over titles and bodies; "Was this helpful?" as an
aggregate server-side counter per article (no cookies, no per-user tracking); "last reviewed" date
per article, with plan facts rendered from `plan-data.ts` (plan badges never typed by hand).

**First sprint:** (1) remove/gate Outlook in help; (2) hub + category + article templates;
(3) the four connect articles as URLs; (4) fix-sync-not-working; (5) app-password-problems and
duplicate-flood-after-first-sync; (6) contact-limit-reached and undo-a-merge;
(7) 2fa-lockout-recovery-codes and delete-your-account; (8) plan badges from plan-data;
(9) the five in-app deep links; (10) "last reviewed" field in the template.

## Acceptance
- Every current question is reachable (migrated or redirected); no 404s from old anchors.
- Provider setup articles live at their own URLs with HowTo schema.
- Outlook guide noindexed or "coming soon" until Outlook is enabled in production.
