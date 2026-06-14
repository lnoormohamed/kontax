# Kontax — Phase 34 Detailed Breakdown (2026-06-14)

Replaces the high-level `roadmap-20260614-p34-p34a.md`. Five sub-phases, each scoped
to a coherent area of work with individually shippable tickets.

---

## Phase 34 — Immediate Visual Fixes

No design review required. Can start and ship this week.

| Ticket | Title | Priority |
|---|---|---|
| P34-01 | Avatar: company-only contacts — derive initial from company name | P0 |
| P34-02 | Avatar: truly empty contacts — show person silhouette instead of blank circle | P0 |
| P34-03 | Remove `/settings/profile` page — add 301 redirect to `/settings/account` | P0 |
| P34-04 | Tablet audit — document every broken layout between 768px–1024px | P1 |
| P34-05 | Tablet fix — `/sync` two-column layout collapses at 768px | P1 |
| P34-06 | Tablet fix — settings sidebar collapse pattern at 768px | P1 |
| P34-07 | Tablet fix — contact detail two-panel split at 768px | P1 |

### Ticket Detail

**P34-01** — When `fullName` is blank/whitespace but `company` is set, use the
company name as the initials source (e.g. "Barclays" → "BA", "General Electric" →
"GE"). Tint hash continues to use `company`. Affects:
- Contact detail hero avatar
- `ContactAvatar` in `contacts-workspace-table.tsx`
- `ContactAvatar` (local copy) in `search-results.tsx`
- Mobile contact detail hero

**P34-02** — When both `fullName` and `company` are blank, show a `WorkspaceIcon`
`person` silhouette (16px, muted colour) centred inside the tinted circle instead of
an empty disc. Applies to all the same surfaces as P34-01.

**P34-03** —
- Identify the current profile page route (likely `/settings/profile` or
  `/settings/account/profile`).
- Add a Next.js permanent redirect in `next.config.js`:
  `{ source: '/settings/profile', destination: '/settings/account', permanent: true }`.
- Remove the route's page file if it's no longer reachable.
- Remove any sidebar nav link pointing to the old route.
- Search codebase for any `href="/settings/profile"` references and update them.

**P34-04** — Open the app in Chrome DevTools at 768px, 900px, and 1024px. Walk
through: contacts list, contact detail, `/sync`, `/settings` (each sub-page), import
wizard, help page. Write a list: page · breakpoint · what breaks. Output is a doc or
comment in a GitHub issue — not a code fix. Feeds P34-05, P34-06, P34-07 and any
follow-on tickets.

**P34-05** — At < 900px the sync page's two-column layout (account list left, detail
right) becomes too cramped. Fix: collapse to a single column at < 900px. On mobile
(<= 640px) the account list is a full-width list; tapping an account navigates to the
detail view (rather than showing side by side). On 768–900px, stack panels vertically
— account list above, detail below.

**P34-06** — Settings pages use a sidebar + content split. Below 900px the sidebar
is too narrow to read. Fix: below 900px hide the sidebar and show a tab strip or
breadcrumb header instead. Each settings route must be directly navigable without the
sidebar visible. Ensure back navigation works on mobile.

**P34-07** — Contact detail at 768px: the left panel (avatar, metadata, actions) and
right panel (Details/Sharing/History tabs) are side by side but both too narrow. Fix:
below 900px collapse to single column — left panel content at top, tabs below.

---

## Phase 34A — Shared Contact & Merge UX

Depends on two design briefs from the designer. Implementation tickets are blocked
until briefs are delivered and approved.

### Design Briefs (send to designer now)

| Brief | Covers |
|---|---|
| P34A-DB01 | "Shared with" card — desktop Sharing tab, mobile Sharing tab, member row style, permission badges |
| P34A-DB02 | Merge review UX — duplicate card, match-reason chips, side-by-side field comparison, conflict picker, "not a duplicate" state |

### Shared-With Tickets (blocked on P34A-DB01)

| Ticket | Title | Priority |
|---|---|---|
| P34A-01 | "Shared with" card — desktop layout rebuild | P1 |
| P34A-02 | "Shared with" card — mobile layout rebuild | P1 |
| P34A-03 | "Shared with" empty state — CTA when contact isn't shared | P2 |

**P34A-01** — Desktop Sharing tab. Current issues: badges look like inline text, member
rows have no avatar or consistent height, "Changes you make here…" body text competes
with the list. Target state:
- Book name row: icon + book name, with subtitle "Family · N members".
- Explanatory callout demoted to a caption (12px, muted).
- Member rows: 48px height, 36px avatar (initials tinted), name, role badge right-aligned.
- Role badges: filled pill chips — `Owner` (green), `Can edit` (blue), `Can view` (grey).
- Divider between callout and member list.

**P34A-02** — Mobile Sharing tab. Same structure as desktop but 44px touch-target
rows, full-width layout, no truncation on name. Badge must not wrap to a second line.

**P34A-03** — When a contact is not shared: show a placeholder card in the Sharing tab
that says "Not shared" with a "Share this contact" CTA button that triggers the share
flow. Replaces the current empty state (if any).

### Merge Tickets (blocked on P34A-DB02)

| Ticket | Title | Priority |
|---|---|---|
| P34A-04 | MergeDismissal schema — persistent "not a duplicate" storage | P0 |
| P34A-05 | Wire dismissals to duplicate query — excluded pairs never resurface | P0 |
| P34A-06 | Smarter scoring weights — phone/email exact match → higher confidence | P1 |
| P34A-07 | Match-reason label on each duplicate card | P1 |
| P34A-08 | Side-by-side field comparison expand panel on duplicate card | P1 |
| P34A-09 | Merge conflict resolution — per-field winner picker | P2 |
| P34A-10 | Manual "merge with" from contact detail (more menu → search → merge) | P2 |

**P34A-04** — Add `MergeDismissal` model to schema:
```prisma
model MergeDismissal {
  id          String   @id @default(cuid())
  userId      String
  contactAId  String
  contactBId  String
  dismissedAt DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, contactAId, contactBId])
}
```
Run `prisma db push`. Add `dismissMergeSuggestion` server action.

**P34A-05** — In the duplicate query, `WHERE NOT EXISTS (SELECT 1 FROM MergeDismissal
WHERE (contactAId = a.id AND contactBId = b.id) OR (contactAId = b.id AND contactBId = a.id))`.
"Not a duplicate" button on the card calls `dismissMergeSuggestion` and removes the
card from the list optimistically.

**P34A-06** — Current scoring is too flat. New weights:
- Exact phone match (digit-normalised): 0.95
- Exact email match: 0.95
- Exact full name: 0.80
- Fuzzy name (Levenshtein ≤ 2) + same company: 0.65
- Fuzzy name alone: 0.40
Only surface pairs with score ≥ 0.50. Remove pairs that were previously surfaced at
score < 0.50 from any cached suggestions.

**P34A-07** — Each duplicate card gets a row of small chips below the contact names
showing why it was flagged: "Same phone", "Same email", "Similar name", "Same company".
Derived from which fields triggered the score.

**P34A-08** — Expand button on the duplicate card reveals a two-column field table:
left = contact A values, right = contact B values. Differing fields are highlighted.
Non-differing fields are shown in muted text. Collapsed by default.

**P34A-09** — When merging contacts that have conflicting field values, show a picker
for each conflict: radio button pair (contact A's value vs contact B's value). Default
selects the most recently modified contact's value. User can change any field before
confirming.

**P34A-10** — In the `···` more menu on the contact detail page, add "Merge with
another contact". Opens a search sheet (same component as the share flow). User finds
the target contact. Confirmation step shows the side-by-side diff (P34A-08 component).
Confirm triggers the merge with the conflict resolution from P34A-09.

---

## Phase 34B — Preferences & Settings Depth

Independent of designer. Can run in parallel with 34A implementation.

| Ticket | Title | Priority |
|---|---|---|
| P34B-01 | `UserPreferences` schema — JSON column on `User` | P0 |
| P34B-02 | Preferences settings page — UI shell with save/reset | P0 |
| P34B-03 | Preference: default contact sort (Name A–Z / Last modified) | P1 |
| P34B-04 | Preference: default view mode (Compact / Cozy) | P1 |
| P34B-05 | Preference: date display format (DD MMM YYYY / MM/DD/YYYY / ISO) | P1 |
| P34B-06 | Preference: contact name display order (First Last / Last, First) | P2 |
| P34B-07 | Preference: week starts on (Monday / Sunday) | P2 |
| P34B-08 | Wire default sort + view mode to server render (replace hardcoded defaults) | P1 |
| P34B-09 | Wire date format to all date field renderers | P1 |
| P34B-10 | Wire name display order to list rows and contact detail header | P2 |

**P34B-01** — Add `preferences Json?` column to `User` model. Default `null` (all
preferences use hardcoded defaults until explicitly set). Schema:
```typescript
type UserPreferences = {
  defaultSort?: "name" | "updated";
  defaultViewMode?: "compact" | "cozy";
  dateFormat?: "DD MMM YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  nameDisplayOrder?: "first-last" | "last-first";
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
};
```

**P34B-02** — Add a "Preferences" section to `/settings/account` (or a new
`/settings/preferences` sub-page). Shell: section header, description, save button,
"Reset to defaults" link. Individual preference controls added in P34B-03 through
P34B-07. Save calls a `updatePreferences` server action. Optimistic UI on save.

**P34B-03** — Sort preference: radio group "Name A–Z" / "Last modified". Saved to
`preferences.defaultSort`.

**P34B-04** — View mode preference: segmented control "Compact" / "Cozy". Saved to
`preferences.defaultViewMode`.

**P34B-05** — Date format preference: dropdown with three options. Saved to
`preferences.dateFormat`.

**P34B-06** — Name display order: radio group. Saved to `preferences.nameDisplayOrder`.
Note: this is a display-only preference — it does not change how names are stored.

**P34B-07** — Week start: toggle "Monday" / "Sunday". Saved to
`preferences.weekStartsOn`. Used in date pickers (birthday field etc.).

**P34B-08** — In `contacts/page.tsx` (server component), read
`session.user.preferences` and use `preferences.defaultSort` and
`preferences.defaultViewMode` as the fallback when the URL params are absent.
Currently both fall back to hardcoded `"name"` and `"compact"`.

**P34B-09** — Create a `formatDate(date, format)` utility in `~/lib/dates.ts`. Replace
all raw `date.toLocaleDateString()` and manual date strings in contact detail, activity
log, history tab with calls to `formatDate`. Read the format from the user's preference
(passed as a prop or read from context).

**P34B-10** — When `preferences.nameDisplayOrder === "last-first"`, derive display
name as `${lastName}, ${firstName}`. Affects list rows, search results, contact detail
header. Only applies when both first and last name exist — company-only and
single-name contacts are unaffected.

---

## Phase 34C — Homepage & Marketing Refresh

Depends on P34C-DB01 design brief. Infrastructure tickets (OG image pipeline) can
start without the brief.

### Design Brief

| Brief | Covers |
|---|---|
| P34C-DB01 | Homepage hero, feature section (updated screenshots), search feature tile, pricing section, footer, all marketing OG images |

### Tickets

| Ticket | Title | Priority |
|---|---|---|
| P34C-01 | Homepage hero — updated headline, sub-copy, and CTA | P0 |
| P34C-02 | Homepage features section — replace screenshots with current UI | P0 |
| P34C-03 | Homepage — add Search feature tile (P33 upgrade highlight) | P1 |
| P34C-04 | Homepage — add Labels feature tile | P1 |
| P34C-05 | Pricing section — verify plan limits match live Stripe config | P0 |
| P34C-06 | Footer — update links (help, developers, privacy, terms) and copyright year | P0 |
| P34C-07 | Homepage mobile layout polish — ensure hero and features read well at 390px | P1 |
| P34C-08 | OG image — regenerate `/` homepage social card | P1 |
| P34C-09 | OG image — regenerate `/pricing` social card | P1 |
| P34C-10 | OG image — regenerate `/developers` social card | P2 |
| P34C-11 | `<meta description>` audit — update all public page meta descriptions | P1 |
| P34C-12 | Structured data (JSON-LD) — verify `SoftwareApplication` schema on `/` is current | P1 |

**P34C-01** — New headline and sub-copy to be supplied by P34C-DB01. Implement against
the approved copy. No placeholder copy in production.

**P34C-02** — Replace any static UI screenshots or illustrations used in the features
section with current-product images (search dropdown in use, labels on contact rows,
sharing panel, mobile overlay). Screenshots should be production screenshots, not
mockups. Optimise as WebP.

**P34C-03** — New feature tile: "Find anyone, instantly" (or approved copy from brief).
Shows the search dropdown with grouped results and highlighted match. Positioned after
the primary feature list.

**P34C-04** — New feature tile: "Organise with labels". Shows the label filter bar and
label chips on contact rows.

**P34C-05** — Open Stripe dashboard and verify: plan names, monthly/annual prices,
contact limits, and included features match what the pricing page displays. If any
discrepancy, update the pricing page copy (not the Stripe config — Stripe is source
of truth).

**P34C-06** — Footer updates:
- Copyright year → 2026.
- Add `/help` link.
- Add `/developers` link.
- Privacy policy and Terms links — ensure these pages exist (even as stubs); if not,
  create minimal placeholder pages before go-live (required for Stripe compliance).
- Remove any "Coming soon" links.

**P34C-07** — Test the homepage at 390px (iPhone 14 viewport). Fix: hero text
truncation, CTA button width, feature tile horizontal scroll (should stack vertically),
any overlapping elements.

**P34C-08–10** — Use the existing `@vercel/og` pipeline from P26-10. Update the image
content to reflect the current product. Regenerate and verify with a link preview tool
(e.g. opengraph.xyz) before shipping.

**P34C-11** — Audit `<meta name="description">` on: `/`, `/pricing`, `/login`,
`/register`, `/help`, `/developers`, `/u/[username]`. Write descriptions under 160
chars that accurately describe the page. Replace any auto-generated or placeholder
descriptions.

**P34C-12** — Open the existing `SoftwareApplication` JSON-LD on the landing page.
Verify `name`, `url`, `description`, `applicationCategory`, `operatingSystem`,
`offers` (price + currency). Update any stale values.

---

## Phase 34D — Pre-Launch Infrastructure & Go-Live

Can start immediately — no design or UI work required. Runs in parallel with 34A–34C.

### Tickets

| Ticket | Title | Priority |
|---|---|---|
| P34D-01 | Smoke test — auth flows | P0 |
| P34D-02 | Smoke test — contacts CRUD and search | P0 |
| P34D-03 | Smoke test — sync (CardDAV + Google + Outlook) | P0 |
| P34D-04 | Smoke test — sharing and family/teams | P0 |
| P34D-05 | Smoke test — billing (Stripe sandbox) and admin | P0 |
| P34D-06 | Smoke test — mobile and PWA | P0 |
| P34D-07 | Smoke test — public card, developer API, and notifications | P0 |
| P34D-08 | Smoke test — sign off: all P0 failures resolved | P0 |
| P34D-09 | Production DB — provision PostgreSQL, create database and user | P0 |
| P34D-10 | Production DB — run `prisma db push`, verify indexes, test backup restore | P0 |
| P34D-11 | Production env vars — configure all variables in Coolify | P0 |
| P34D-12 | OAuth redirect URIs — add getkontax.com to Google Cloud Console and Azure Portal | P0 |
| P34D-13 | Stripe webhook — register production webhook endpoint on getkontax.com | P0 |
| P34D-14 | Domain setup — getkontax.com DNS A record, www CNAME, Coolify host config | P0 |
| P34D-15 | TLS — Let's Encrypt cert provisioned via Coolify, HTTPS verified end-to-end | P0 |
| P34D-16 | In-app URL audit — replace every hardcoded `kontax.vexon.co` reference | P0 |
| P34D-17 | Security headers — HSTS, CSP, X-Frame-Options, X-Content-Type-Options | P0 |
| P34D-18 | Redirect — `kontax.vexon.co` → `getkontax.com` (301 permanent) | P1 |
| P34D-19 | Pre-prod checklist — security pass | P0 |
| P34D-20 | Pre-prod checklist — performance pass (Lighthouse ≥ 90, search < 500ms) | P0 |
| P34D-21 | Pre-prod checklist — SEO pass (sitemap, robots, OG, GSC property added) | P0 |
| P34D-22 | Pre-prod checklist — uptime monitoring configured | P1 |
| P34D-23 | Cutover execution — DNS flip and go-live | P0 |
| P34D-24 | Post-launch 24h review — error logs, Stripe events, user registrations | P0 |

### Smoke Test Details (P34D-01 through P34D-08)

Each smoke test ticket is a structured checklist run. Run against the staging environment
(kontax.vexon.co) first; re-run critical paths on production after cutover.

**P34D-01 — Auth flows:**
- [ ] Register with email/password → receive verification email → click link → account verified
- [ ] Log in with credentials
- [ ] Log out → redirected to /login
- [ ] Forgot password → receive reset email → set new password → log in with new password
- [ ] Enrol TOTP 2FA → verify with authenticator app → log in with 2FA challenge
- [ ] Disable 2FA
- [ ] View active sessions → revoke a session
- [ ] Change email → receive re-verification email → verify new email
- [ ] Change password → old password no longer works

**P34D-02 — Contacts CRUD and search:**
- [ ] Create contact with all field types (all name parts, multi-value phone, email, address, birthday, notes, custom label)
- [ ] Edit every field type on the contact detail page
- [ ] Archive contact → appears in Archived tab → restore
- [ ] Delete contact permanently
- [ ] Search by name — dropdown shows name group, opens correct contact
- [ ] Search by email — shows email group with email snippet
- [ ] Search by phone — digit match, shows phone snippet
- [ ] Search by company — shows company group
- [ ] Search by label name — shows label group with chip
- [ ] Search by notes keyword — shows notes excerpt
- [ ] Keyboard nav in search dropdown (↑↓↵Esc)
- [ ] "/" global shortcut focuses search input
- [ ] Recently viewed appears in blank search
- [ ] Recent searches appear in blank search
- [ ] Mobile search overlay — open, type, result groups render, tap opens contact
- [ ] In-list snippet: search a notes keyword → matching row shows notes excerpt below subtitle

**P34D-03 — Sync:**
- [ ] Add iCloud CardDAV account → sync runs → contacts imported
- [ ] Add Fastmail CardDAV account → sync runs → contacts imported
- [ ] Add Google Contacts OAuth → authorise → initial import completes
- [ ] Add Outlook OAuth → authorise → initial import completes
- [ ] Edit a contact → confirm change propagates to sync source on next sync
- [ ] Sync error state — disconnect from network → sync status shows error
- [ ] Disconnect a sync account → confirm contacts remain in Kontax

**P34D-04 — Sharing and family:**
- [ ] Share a contact via one-time link → recipient opens link → vCard download works
- [ ] Create family group → invite member by email → invitee accepts
- [ ] Shared book appears in both accounts' sidebars
- [ ] Edit a shared contact as member → owner sees update immediately
- [ ] Remove a member from family group

**P34D-05 — Billing and admin:**
- [ ] Upgrade from Free to Pro (Stripe sandbox) → plan updates in UI
- [ ] Open customer portal via "Manage subscription" link
- [ ] Downgrade plan → confirmation dialog shown
- [ ] Log in as admin → user search finds a test user
- [ ] Admin plan override → user's plan changes
- [ ] Admin audit log shows the override action

**P34D-06 — Mobile and PWA:**
- [ ] Install PWA from Chrome on Android (Add to Home Screen)
- [ ] PWA opens without browser chrome
- [ ] Offline mode: disconnect → open app → cached contact list visible
- [ ] Swipe-to-archive on a contact row (test on real device)
- [ ] Swipe-to-favourite on a contact row
- [ ] Bottom nav tabs all navigate correctly
- [ ] Mobile contact detail: all sections readable, Edit FAB present
- [ ] Mobile create contact: full-screen form, all fields reachable
- [ ] Mobile search overlay: search icon → overlay → type → results grouped → tap opens contact

**P34D-07 — Public card, API, and notifications:**
- [ ] Claim username in settings → `/u/{username}` is publicly accessible without login
- [ ] Toggle visibility fields on public card → changes reflected immediately on public page
- [ ] "Add to Kontax" button on public card: signed-in user → pre-fills create form; signed-out → vCard download
- [ ] Create API token → token shown once → copy → make `GET /api/v1/contacts` with Bearer token → 200 response
- [ ] API rate limit headers present (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)
- [ ] Birthday reminder: add a contact with birthday = tomorrow → notification appears within the next scheduled run (or trigger manually)
- [ ] Notification bell badge count matches unread notifications

**P34D-08 — Sign off:**
- Tally all failures from P34D-01 through P34D-07.
- P0 failures block go-live. All must be fixed before P34D-23.
- P1 failures must have a fix plan and timeline.
- Written sign-off from the person running the test suite before P34D-23 proceeds.

### Infrastructure Detail (P34D-09 through P34D-18)

**P34D-09** — On production server:
```bash
# Create database and role
psql -U postgres -c "CREATE USER kontax_prod WITH PASSWORD 'strong-random-password';"
psql -U postgres -c "CREATE DATABASE kontax_prod OWNER kontax_prod;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE kontax_prod TO kontax_prod;"
```
Record connection string: `postgresql://kontax_prod:<password>@localhost:5432/kontax_prod`.

**P34D-10** —
```bash
DATABASE_URL="postgresql://kontax_prod:..." npx prisma db push
```
Then verify:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'Contact';
-- Must include the GIN index on searchVector
```
Test backup: `pg_dump kontax_prod > backup_test.sql`. Test restore on a throw-away DB.
Set up daily cron: `0 2 * * * pg_dump kontax_prod | gzip > /backups/kontax_$(date +%Y%m%d).sql.gz`.

**P34D-11** — In Coolify, set every environment variable from the checklist in
`P34A-05` of the previous roadmap doc. Key items:
- `NEXTAUTH_URL=https://getkontax.com`
- `NEXTAUTH_SECRET=<fresh 32-byte secret>`
- `DATABASE_URL=<production DB URL>`
- `STRIPE_SECRET_KEY=sk_live_...`
- All Google and Azure OAuth credentials.
Trigger a deployment after setting. Confirm app starts without env errors.

**P34D-12** — In Google Cloud Console: add `https://getkontax.com/api/auth/callback/google`
to authorised redirect URIs for the OAuth client. Do the same in Azure Portal for the
Microsoft OAuth app. Keep the existing staging URIs active during transition.

**P34D-13** — In Stripe Dashboard → Developers → Webhooks:
- Add endpoint: `https://getkontax.com/api/webhooks/stripe`
- Select events: `customer.subscription.*`, `invoice.payment_failed`, `invoice.payment_succeeded`
- Copy the webhook signing secret → set as `STRIPE_WEBHOOK_SECRET` in Coolify.

**P34D-14** — DNS configuration at registrar for getkontax.com:
```
@ A → <production server IP>   TTL 300
www CNAME → getkontax.com       TTL 300
```
In Coolify: add `getkontax.com` and `www.getkontax.com` as domains for the application.

**P34D-15** — Coolify handles Let's Encrypt automatically when the domain is
configured. Verify: `curl -I https://getkontax.com` returns `200` with
`strict-transport-security` header.

**P34D-16** —
```bash
grep -r "kontax.vexon.co" src/ --include="*.ts" --include="*.tsx" --include="*.js"
```
Replace every hardcoded instance with `process.env.NEXT_PUBLIC_APP_URL` or the
env-injected value. Check: email templates, vCard share links, OG image `url` props,
sitemap generator, API docs page, any README or config docs checked into `src/`.

**P34D-17** — In `next.config.js` `headers()` config, add to all routes:
```js
{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
{ key: 'X-Frame-Options', value: 'DENY' },
{ key: 'X-Content-Type-Options', value: 'nosniff' },
{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
```
CSP: start with a report-only header to audit violations before enforcing.

**P34D-18** — If kontax.vexon.co is served by the same Coolify instance: add a
redirect rule in Coolify or an Nginx config block:
```nginx
server {
  listen 80;
  server_name kontax.vexon.co;
  return 301 https://getkontax.com$request_uri;
}
```

### Pre-Prod Checklists (P34D-19 through P34D-22)

**P34D-19 — Security:**
- [ ] All pages served over HTTPS; HTTP redirects automatically
- [ ] HSTS header present on every response
- [ ] `X-Frame-Options: DENY` on every response
- [ ] `X-Content-Type-Options: nosniff` on every response
- [ ] `/admin/**` returns 403 for non-admin session
- [ ] `/api/contacts` returns 401 without a valid session
- [ ] Rate limiting active: 5 failed logins → temporary lockout
- [ ] `NEXTAUTH_SECRET` is unique to production (not reused from staging)
- [ ] Stripe webhook signature verified on every webhook call

**P34D-20 — Performance:**
- [ ] Lighthouse score on `/`: LCP < 2.5s, CLS < 0.1, FCP < 1.8s
- [ ] Contact list with 400+ contacts loads within 2 seconds
- [ ] Search API returns results in < 500ms for a typical query
- [ ] No JavaScript bundle > 500kB (check with Next.js build output)

**P34D-21 — SEO:**
- [ ] `https://getkontax.com/sitemap.xml` returns XML listing public routes
- [ ] `https://getkontax.com/robots.txt` blocks `/contacts`, `/settings`, `/admin`, `/api`
- [ ] OG tags correct on `/`, `/pricing`, `/u/{username}` (verify with opengraph.xyz)
- [ ] `<title>` and `<meta description>` correct on all public pages
- [ ] Google Search Console property added for getkontax.com; sitemap submitted

**P34D-22 — Monitoring:**
- [ ] UptimeRobot (or equivalent) pinging `https://getkontax.com/api/health` every 5 minutes
- [ ] Alert email configured for downtime notification
- [ ] Coolify logs accessible and showing recent requests
- [ ] Stripe dashboard shows webhook events received correctly

### Cutover (P34D-23 through P34D-24)

**P34D-23 — Cutover sequence:**
1. Confirm all P34D-08 smoke test P0 failures resolved.
2. Confirm P34D-19 through P34D-22 checklists fully signed off.
3. Final deploy from `main` — confirm startup logs clean, health check passes.
4. Lower DNS TTL to 60s at least 1 hour before flip (if not already done during P34D-14).
5. Update DNS A record to production server IP (if staged to a different IP than what was set in P34D-14).
6. Wait up to 5 minutes for propagation. Verify via `dig getkontax.com +short`.
7. Open `https://getkontax.com` in an incognito window. Confirm load, login, create a test contact, run a search.
8. Check Coolify logs for 5xx errors. Check Stripe dashboard for any failed webhook deliveries.
9. Announce go-live.

**Rollback plan:** If a critical issue is found < 1h after cutover: revert DNS A record
to the previous staging IP (TTL is 60s so propagates within 1–2 minutes). Old staging
environment remains live for 48h post-launch for exactly this scenario.

**P34D-24 — Post-launch 24h review:**
- Review Coolify error logs for any 5xx patterns.
- Check Stripe dashboard: are new subscription events flowing through?
- Check for new user registrations — confirm verification emails are being delivered.
- Check uptime monitoring — no downtime events.
- Review any user-reported issues.
- Write a brief post-launch note: what worked, what didn't, what to fix in the next deploy.

---

## Summary: Ticket Counts

| Phase | Tickets | Design Brief? | Blocks |
|---|---|---|---|
| 34 | 7 | No | Can start now |
| 34A | 13 | Yes (2 briefs) | Blocked on P34A-DB01/02 |
| 34B | 10 | No | Can start now |
| 34C | 12 | Yes (1 brief) | P34C-01–04 blocked; P34C-05–12 can start |
| 34D | 24 | No | P34D-01–08 need Phase 34 done; infra (09–18) can start now |
| **Total** | **66** | **3 briefs** | |

## Immediate start list (no blockers, no design needed)

- P34-01, P34-02, P34-03 (avatar fixes + profile page removal)
- P34-04 (tablet audit — just observation and documentation)
- P34B-01, P34B-02 (UserPreferences schema + settings UI shell)
- P34C-05, P34C-06 (pricing check + footer update — copy only)
- P34D-09, P34D-10 (production DB setup)
- P34D-11, P34D-12, P34D-13 (env vars, OAuth URIs, Stripe webhook)
- P34D-14, P34D-15 (domain + TLS)
- P34D-17 (security headers)

Send to designer immediately:
- P34A-DB01 (Shared with card)
- P34A-DB02 (Merge review UX)
- P34C-DB01 (Homepage & marketing refresh)
