# Phase 34 Amendments (2026-06-14)

Supersedes and extends `roadmap-20260614-p34-detailed.md` with three decisions:
1. P34C becomes a full multi-page marketing site rebuild (not a single-page refresh).
2. P34B date format preference is display-only — vCard/CardDAV sync is unaffected.
3. New Phase 34E — `api.getkontax.com` subdomain for the developer REST API.

---

## P34B Amendment — Date Format Is Display-Only

No new tickets. Scope clarification only.

**Decision:** The `dateFormat` preference (P34B-05/P34B-09) controls how dates are
*rendered in the UI*. It has zero effect on sync or storage.

**Why this is safe:**

- vCard (RFC 6350) mandates ISO 8601 for all date values: `BDAY:19850714` or
  `BDAY:1985-07-14`. CardDAV, iCloud, Google Contacts, Fastmail, and Outlook all
  produce and consume this format. The sync engine must never deviate from it.
- The DB also stores dates as ISO strings (`1985-07-14`). That never changes.
- The preference only affects the *read-side rendering layer*:

  ```
  DB value:       "1985-07-14"   (always ISO 8601)
  vCard export:   BDAY:19850714  (always RFC 6350)
  UI (UK pref):   14 Jul 1985
  UI (US pref):   07/14/1985
  UI (ISO pref):  1985-07-14
  ```

**Implementation note for P34B-09:** The `formatDate(isoString, format)` utility in
`~/lib/dates.ts` takes the raw ISO string from the DB and formats it for display.
It is called only in React components and server-component renderers — never in any
sync, export, or import code path.

---

## P34C — Full Multi-Page Marketing Site Rebuild

Replaces the single-page refresh plan from the original P34C section.

**Decision:** The current single landing page (`/`) does not have the page depth
needed to support organic search, feature discovery, or developer trust. Moving to a
multi-page marketing site before go-live on getkontax.com.

### Design Briefs (send to designer, replace P34C-DB01)

| Brief | Covers |
|---|---|
| P34C-DB01 | IA + global nav + homepage — page structure, nav bar, hero, feature tiles, social proof, footer |
| P34C-DB02 | Pricing page — updated plan cards with all current features, feature-to-plan matrix, billing toggle (monthly/annual) |
| P34C-DB03 | Feature pages, /security page, /changelog page layout |

### New Page Inventory

| Route | Page | Priority |
|---|---|---|
| `/` | Homepage — hero, feature highlights, social proof, CTA | P0 |
| `/features` | Full feature breakdown | P1 |
| `/pricing` | Pricing — updated plan cards + feature matrix | P0 |
| `/security` | Security & privacy — encryption, 2FA, GDPR, data residency | P1 |
| `/changelog` | What's new — versioned release notes | P1 |
| `/about` | Company / mission (optional for launch) | P2 |
| `/contact` | Support contact form | P1 |
| `/privacy` | Privacy policy (required for Stripe compliance) | P0 |
| `/terms` | Terms of service (required for Stripe compliance) | P0 |

### Tickets

| Ticket | Title | Priority | Depends On |
|---|---|---|---|
| P34C-01 | Shared marketing nav component — logo, links, CTA button, mobile hamburger | P0 | P34C-DB01 |
| P34C-02 | Shared marketing footer — nav links, legal links, copyright, social icons | P0 | P34C-DB01 |
| P34C-03 | Homepage hero — headline, sub-copy, primary CTA, product screenshot/demo | P0 | P34C-DB01 |
| P34C-04 | Homepage feature tiles — search, labels, sharing, sync, public card, API (6 tiles) | P0 | P34C-DB01 |
| P34C-05 | Homepage social proof — testimonials or "used for X contacts" stat | P1 | P34C-DB01 |
| P34C-06 | Homepage mobile layout — hero + tiles readable at 390px | P0 | P34C-03/04 |
| P34C-07 | `/features` page — detailed feature breakdown with screenshots per feature | P1 | P34C-DB03 |
| P34C-08 | `/pricing` page rebuild — updated plan cards with current feature set | P0 | P34C-DB02 |
| P34C-09 | `/pricing` billing toggle — monthly / annual with annual savings callout | P1 | P34C-08 |
| P34C-10 | `/pricing` feature matrix — full table of which features are on which plan | P0 | P34C-DB02 |
| P34C-11 | `/pricing` FAQ section — common billing questions | P1 | P34C-08 |
| P34C-12 | `/security` page — encryption at rest/transit, 2FA, session management, GDPR | P1 | P34C-DB03 |
| P34C-13 | `/changelog` page — manually-maintained release notes, most recent first | P1 | P34C-DB03 |
| P34C-14 | `/contact` page — support email form, response time expectation | P1 | — |
| P34C-15 | `/privacy` page — privacy policy (required before go-live) | P0 | — |
| P34C-16 | `/terms` page — terms of service (required before go-live) | P0 | — |
| P34C-17 | `/about` page — mission, values, team (can be minimal for launch) | P2 | — |
| P34C-18 | OG images — generate social cards for all marketing pages | P1 | P34C-01 |
| P34C-19 | Meta titles and descriptions — all marketing pages | P0 | P34C-01 |
| P34C-20 | JSON-LD structured data — `Organization`, `SoftwareApplication`, `WebSite` on `/`; `BreadcrumbList` on `/pricing`, `/features` | P1 | P34C-01 |
| P34C-21 | Sitemap update — include all new marketing pages | P0 | P34C-01 |

### Ticket Detail

**P34C-01 — Shared marketing nav:**
- Logo left (K wordmark, links to `/`)
- Nav links: Features · Pricing · Security · Changelog
- Right: "Log in" text link + "Get started" filled button (links to `/register`)
- Mobile: hamburger → full-screen overlay nav
- Sticky on scroll with a subtle shadow at scroll-top 0
- Consistent across all marketing pages

**P34C-02 — Shared marketing footer:**
- Columns: Product (Features, Pricing, Changelog, Security), Company (About, Contact), Legal (Privacy, Terms), Developers (API Docs, API Status)
- Bottom bar: © 2026 Kontax · Built by Vexon
- Mobile: single column stack

**P34C-08 — Pricing page rebuild:**
Current plan cards are stale. Updated feature list per plan:

| Feature | Free | Pro | Family | Teams |
|---|---|---|---|---|
| Contacts | 100 | Unlimited | Unlimited | Unlimited |
| Labels | ✓ | ✓ | ✓ | ✓ |
| Advanced search | ✓ | ✓ | ✓ | ✓ |
| CardDAV sync | 1 account | Unlimited | Unlimited | Unlimited |
| Google / Outlook sync | — | ✓ | ✓ | ✓ |
| Contact sharing | — | ✓ | ✓ | ✓ |
| Family shared book | — | — | ✓ | — |
| Teams shared book | — | — | — | ✓ |
| Public card (`/u/username`) | ✓ | ✓ | ✓ | ✓ |
| Developer API | — | ✓ | ✓ | ✓ |
| Data export (GDPR) | ✓ | ✓ | ✓ | ✓ |
| Activity history | 30 days | Unlimited | Unlimited | Unlimited |

Verify all limits against the live Stripe product config before shipping.

**P34C-10 — Feature matrix:**
Full comparison table below the plan cards. Rows = features grouped by category
(Core, Search, Sync, Sharing, Developer, Security). Columns = Free / Pro / Family / Teams.
Checkmark / dash / limit string per cell. Replaces any "see all features" link.

**P34C-12 — Security page:** Covers:
- Encryption at rest (Postgres, DB volume encryption)
- Encryption in transit (TLS 1.2+, HSTS)
- Authentication (bcrypt passwords, TOTP 2FA, session tokens, step-up auth)
- CardDAV and OAuth token storage (hashed, never logged)
- GDPR: data export, account deletion, data residency (EU/US option)
- Responsible disclosure / bug bounty contact

**P34C-15/16 — Privacy + Terms:** These are legal documents. Draft with a lawyer or
use a well-reviewed template for SaaS products. Key inclusions for Privacy:
GDPR Article 13 disclosures, data retention periods, third-party processors (Stripe,
AWS SES, Google OAuth). Key inclusions for Terms: acceptable use, subscription terms,
cancellation, liability limitation, governing law.

---

## Phase 34E — `api.getkontax.com` Subdomain

New phase. Infrastructure and developer experience work to give the REST API a
dedicated subdomain. Runs in parallel with 34D (production infra).

**Decision:** The developer-facing REST API (Phase 29, `/api/v1/*`) moves to
`api.getkontax.com`. Internal Next.js API routes (`/api/auth/`, `/api/contacts/search`,
`/api/webhooks/stripe`) stay at `getkontax.com/api/` — they are not public developer
endpoints.

**How it works (no separate deployment needed):**

```
Developer calls:  GET https://api.getkontax.com/v1/contacts
Coolify routes:   api.getkontax.com → same Next.js app
Next.js middleware rewrites: /v1/contacts → /api/v1/contacts
Next.js handler at /api/v1/contacts processes the request
```

### Tickets

| Ticket | Title | Priority |
|---|---|---|
| P34E-01 | DNS — add `api.getkontax.com` CNAME pointing to `getkontax.com` | P0 |
| P34E-02 | Coolify — add `api.getkontax.com` as a second domain on the application | P0 |
| P34E-03 | Next.js middleware — host-based rewrite: `api.*` host + `/v1/*` path → `/api/v1/*` | P0 |
| P34E-04 | CORS headers — `Access-Control-Allow-Origin: *` on all `/api/v1/*` responses | P0 |
| P34E-05 | CORS preflight — handle `OPTIONS` requests on `/api/v1/*` | P0 |
| P34E-06 | Rate limiting — verify per-token limits apply correctly via the new subdomain | P0 |
| P34E-07 | `/developers` docs page — update all code examples to use `api.getkontax.com/v1` | P0 |
| P34E-08 | API token UI — update base URL shown in the token management panel | P1 |
| P34E-09 | OpenAPI / API reference — if a spec file exists, update `servers[].url` | P1 |
| P34E-10 | Smoke test — `GET/POST/DELETE` via `api.getkontax.com` with a live API token | P0 |

### Ticket Detail

**P34E-01 — DNS:**
```
api    CNAME    getkontax.com    TTL 300
```
The CNAME routes `api.getkontax.com` to the same IP as `getkontax.com`. Coolify
terminates TLS for the subdomain via Let's Encrypt (handled in P34E-02).

**P34E-02 — Coolify:**
In the application's domain settings, add `api.getkontax.com` alongside
`getkontax.com` and `www.getkontax.com`. Coolify will provision a separate Let's
Encrypt cert for the subdomain automatically.

**P34E-03 — Middleware rewrite:**
```typescript
// middleware.ts (add to existing middleware)
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host.startsWith("api.")) {
    const url = request.nextUrl.clone();
    // /v1/contacts → /api/v1/contacts
    if (!url.pathname.startsWith("/api/")) {
      url.pathname = `/api${url.pathname}`;
    }
    return NextResponse.rewrite(url);
  }

  // ... existing middleware logic
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**P34E-04/05 — CORS:**
In each `/api/v1/[...].ts` route handler, set response headers:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
```
For `OPTIONS` (preflight): return `200` with the CORS headers immediately, no auth
check. Create a shared `withCors(handler)` wrapper so this isn't duplicated across
every v1 route.

**P34E-06 — Rate limiting:**
The existing rate limiter keys off the API token value from the `Authorization` header.
Verify that the middleware rewrite doesn't strip or alter this header. Test with:
```bash
for i in {1..250}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer kt_test_xxx" \
    https://api.getkontax.com/v1/contacts
done
# Should see 429 after the per-token limit is hit
```

**P34E-07 — Docs update:**
Replace every instance of `getkontax.com/api/v1` in the `/developers` page with
`api.getkontax.com/v1`. Update all `curl` examples, code snippets, and the auth
section. Final base URL in docs:
```
Base URL: https://api.getkontax.com/v1
```

**P34E-10 — Smoke test:**
```bash
# Create a token first via the UI, then:

# List contacts
curl -H "Authorization: Bearer kt_live_xxx" \
  https://api.getkontax.com/v1/contacts

# Create a contact
curl -X POST \
  -H "Authorization: Bearer kt_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"API Test","email":"api@test.com"}' \
  https://api.getkontax.com/v1/contacts

# Confirm rate-limit headers present
curl -I -H "Authorization: Bearer kt_live_xxx" \
  https://api.getkontax.com/v1/contacts
# → X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

# Confirm CORS headers present
curl -I -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  https://api.getkontax.com/v1/contacts
# → Access-Control-Allow-Origin: *
```

---

## Updated Phase Summary

| Phase | Focus | Tickets | Notes |
|---|---|---|---|
| 34 | Immediate visual fixes | 7 | Unchanged |
| 34A | Shared contact + merge UX | 13 | Unchanged |
| 34B | Preferences & settings depth | 10 | Date format is display-only (no new tickets) |
| 34C | Multi-page marketing site rebuild | 21 | Expanded from 12 tickets; 3 design briefs |
| 34D | Pre-launch infrastructure & go-live | 24 | Unchanged |
| 34E | `api.getkontax.com` subdomain | 10 | New phase |
| **Total** | | **85** | |

## Design Briefs to Send Now

| Brief | Phase | Covers |
|---|---|---|
| P34A-DB01 | 34A | "Shared with" card |
| P34A-DB02 | 34A | Merge review UX |
| P34C-DB01 | 34C | Marketing site IA + nav + homepage |
| P34C-DB02 | 34C | Pricing page + feature matrix |
| P34C-DB03 | 34C | Feature pages + security + changelog |

## Immediate Start (no blockers, no design needed)

| Ticket | Phase | What |
|---|---|---|
| P34-01/02/03 | 34 | Avatar fallbacks + remove profile page |
| P34-04 through P34-07 | 34 | Tablet audit + fixes |
| P34B-01/02 | 34B | UserPreferences schema + settings UI shell |
| P34B-03 through P34B-07 | 34B | Individual preference controls |
| P34C-14/15/16 | 34C | /contact, /privacy, /terms — no design needed |
| P34D-09/10 | 34D | Production DB setup |
| P34D-11 through P34D-17 | 34D | Env vars, OAuth URIs, Stripe webhook, domain, TLS, security headers |
| P34E-01/02 | 34E | DNS + Coolify domain config |
| P34E-03 through P34E-06 | 34E | Middleware, CORS, rate limit verify |

---

## Phase 34F — Shared-Book Ownership Semantics (Family vs. Teams)

New phase. Makes the **Family-vs-Teams ownership distinction explicit and complete** in
both behaviour and UI. The two models intentionally diverge on what happens when a
member leaves or a plan ends:

- **Family books fan out into personal copies.** A family book is jointly held; when
  the group dissolves *or* a single member leaves, that member keeps a private
  `AddressBook` copy. Plumbing already exists: `GroupAddressBook.dissolvedToBookId`,
  `AddressBook.sourceGroupBookId` (see `roadmap/build-phase/p18-11-personal-address-books.md`).
- **Team books belong to the team/org.** A team contact is owned (nominally) by the
  team owner. When a member leaves or the owner downgrades, the member loses access
  and **no copy is made** — the book stays with the team
  (see `roadmap/design-briefs/14-teams-plan-surfaces.md`).

### Decisions (2026-06-16)

- **Org-anchored Teams billing (full re-anchor).** Today billing is hard-anchored to
  a single human: `SubscriptionCustomer.userId @unique` and `Subscription.userId`
  (`prisma/schema.prisma`). For a Teams plan the Stripe **customer is the Group/org**,
  not a person, so billing survives members joining and leaving. Personal plans
  (FREE/PRO/FAMILY) stay user-anchored — only Teams moves to the org. The seam
  already exists: `Group.subscriptionId` links the team to its subscription.
- **Billing access is permission-gated, not owner-only.** Add a per-member
  `canManageBilling` flag on `GroupMember` (independent of the Admin role) so a
  designated finance/billing manager can open the Stripe portal, change plan/seats,
  and update the payment method without full admin powers. All members can *view*
  plan + renewal read-only.
- **Owner transfer becomes a role change — NOT a Stripe operation.** This SUPERSEDES
  the earlier "re-assign the Stripe customer" decision. Because the customer is the
  org, transferring the human "owner" is just `Group.ownerId` + role updates; no
  Stripe customer/subscription surgery, no billing gap.
- **Family copy-on-leave = yes.** A member who *leaves* a family group (not just on
  full dissolution) keeps a personal snapshot copy of the family book. This is new
  behaviour beyond the Phase 13 dissolution spec — `leaveFamilyGroup`
  (`src/app/actions/family.ts`) currently only deletes the membership row.

### Tickets

| Ticket | Title | Priority | Depends on |
|---|---|---|---|
| P34F-DB01 | **Design brief** — org-billing architecture: schema (org customer + `canManageBilling`), Stripe metadata/webhook routing by `groupId`, migration plan for existing teams | P0 | — |
| P34F-01 | Schema — org-anchored billing: allow `SubscriptionCustomer`/`Subscription` to belong to a Group (not just a user); add `GroupMember.canManageBilling` | P1 | P34F-DB01 |
| P34F-02 | Stripe re-route — set customer metadata to `groupId`, route webhooks by group, attribute seat quantity to the org subscription | P1 | P34F-01 |
| P34F-03 | Migration — backfill existing Teams: move owner's Stripe customer/subscription onto the Group; idempotent, dry-run first | P1 | P34F-01/02 |
| P34F-04 | Billing access UI — gate the Stripe portal + plan/seat/payment controls on `canManageBilling`; admin matrix gets a "Billing manager" toggle | P1 | P34F-01 |
| P34F-05 | Owner transfer — "Make owner" on admin rows = `Group.ownerId` + role change only (no Stripe writes) | P1 | P34F-01 |
| P34F-06 | Member billing visibility — all members see "Run by {owner} · Teams · {n}/25 seats · renews {date}" read-only | P2 | P34F-01 |
| P34F-07 | Family copy-on-leave — `leaveFamilyGroup` snapshots the family book into a personal `AddressBook` (set `sourceGroupBookId`; slug-collision suffix) before removing membership | P1 | — |
| P34F-08 | Settings copy — make ownership semantics explicit: Family books "stay with you as a copy", Team books "belong to the team and are removed when you leave" | P2 | — |
| P34F-09 | Smoke test — transfer ownership + change billing as a non-owner billing manager on staging; verify webhooks, seats, member access | P1 | P34F-01..05 |

### Notes

- **P34F-DB01 lands first.** The re-anchor touches money and webhooks — design the
  schema, Stripe metadata, and migration before writing code. Coordinate with the
  deferred Stripe smoke test (`project_stripe-smoke-test-deferred`).
- **Migration risk (P34F-03):** existing teams have their customer on the owner's
  user. The backfill must be idempotent and dry-runnable; a half-migrated team
  must not double-bill or lose webhook routing. Keep the old `userId` link readable
  during transition rather than dropping it immediately.
- **P34F-07/08 are independent** of the billing re-anchor and can ship in parallel.
  P34F-07 must distinguish *leave* (one member → one personal copy) from
  *dissolution* (whole group → copy for every member, Phase 13); reuse one snapshot
  helper for both paths.
