# P50-DB01 — Design brief: marketing site redesign (exploration, homepage first)

Status: **Done — Direction A chosen 2026-09-25** (see [Phase 50](../build-phase/phase-50-marketing-redesign.md)) · Type: Exploration · Priority: P2
Depends: — · Builds on: [P34C-DB01](p34c-db01-marketing-site-ia.md) (IA, tone),
[P49-DB01](../build-phase/p49-db01-design-brief-homepage-refresh.md) (homepage content)
Drafted 25 Sep 2026

## Purpose

P49 gave the homepage substance: ten sections, real product visuals, a comparison, privacy
facts, pricing and an FAQ, all fact-checked against the code. The *content* is now in good
shape. The *look* has not moved since P34C: one dark green, flat white cards, a system font,
and a layout that could belong to almost any SaaS product.

This brief asks for an **exploration of new visual directions for the marketing site**, worked
out properly on the homepage first and then tested on two other pages to prove each direction
scales. Nothing here is committed to build. The output is a set of directions to compare and
choose from; a build phase follows only if one is chosen.

What we want to learn:
1. How far the brand can move while still feeling like Kontax (calm, personal, privacy-first).
2. Which direction makes Kontax memorable and distinct from Google Contacts, iCloud and generic
   SaaS templates.
3. Whether the direction holds up across the site (pricing, content pages, docs-adjacent
   pages), on phones, and within our performance and accessibility bar.

## Current state (verified on staging, 2026-09-25)

The marketing site is 11 public pages sharing one header, one footer and one stylesheet
(`src/app/(marketing)/_components/marketing.css`, `--mkt-*` tokens).

| Page | Length | What it is today |
|---|---|---|
| `/` Homepage | ~1,190 words | P49 refresh (on staging, not yet on prod): hero with live search mockup, works-with strip, how it works, feature showcase, comparison table, privacy facts, who it's for, pricing teaser, FAQ, closing CTA. |
| `/features` | ~570 | Six feature sections with mockups, CTA. |
| `/pricing` | ~730 | Four plan cards, monthly/annual toggle, full comparison matrix, FAQ, CTA. |
| `/security` | ~610 | Encryption, sign-in, data ownership, CTA. |
| `/changelog` | ~430 | Dated entries + RSS. |
| `/about` | ~160 | A few paragraphs. Thin. |
| `/contact` | ~90 | A form. Thin. |
| `/developers` | ~2,260 | API reference (docs layout). |
| `/help` | ~5,300 | FAQ / help centre (docs layout). |
| `/privacy`, `/terms` | legal | Long-form legal text. |
| `/login`, `/register` | — | Auth pages — **a different visual style** (indigo buttons, US spelling "organized"). |

**Brand system today** (brand-assets.md, P34C-DB01):
forest green `#17352e` (headings, primary buttons, footer), ink `#1d2823`, body `#5c655e`,
mute `#8b938c`, surface `#f4f6f2`, hairline `#edf0ea`, card border `#d8ddd6`, link/focus accent
`#4158f4`. Tone: "calm confidence — not aggressive SaaS, not corporate. Personal-first,
privacy-respecting, competently made." Rules: no stock photos, no fake social proof, no
dark theme, no scroll-triggered animation, no gradients or drop shadows.

**What's holding the look back:**
1. **No real typeface.** Every brief specifies Geist, but the site never loads it
   (no `next/font` import); visitors see San Francisco, Segoe UI or Roboto depending on
   device. Type is the cheapest, biggest lever and we're not using it.
2. **One colour doing every job.** Forest green is the headings, the buttons, the footer and
   the only accent. There is no secondary colour, no warm neutral, no way to signal
   sections or states. Pages read as green-on-white or white-on-green.
3. **Flat, template-like layout.** Centred headings over card grids, repeated page after
   page. No distinctive grid, rhythm or signature moment.
4. **No visual identity beyond the logo.** No illustration, iconography system, pattern,
   photography approach or recurring motif. The product mockups are good but carry the
   whole page.
5. **Uneven pages.** `/about` and `/contact` are thin; auth pages look like a different
   product; the dark footer and the light closing bands have to be patched to sit together
   (the P49 CTA band merged into the footer and had to be made light).
6. **Nothing is "ownable".** Swap the logo and the site could be any calm SaaS product.

**What works and should survive any direction:** the calm, trustworthy tone; the honesty of
the copy (every claim traced to code); live HTML product mockups instead of screenshots
(crisp, themeable, light); generous whitespace; fast pages.

## Scope of the exploration

**In scope**
- **Homepage** — fully designed per direction, desktop (1440) and mobile (375), top to bottom,
  including hero, all sections, closing CTA, nav and footer.
- **Two proving pages per direction:** `/pricing` (dense, comparative, conversion-critical)
  and **one content page** — `/security` or `/features` (long-form, trust-building).
- **Shared chrome:** header/nav (desktop + mobile menu, signed-out and signed-in states),
  footer.
- **A small component sampler** per direction: type scale, colour tokens, buttons, links,
  cards, section headers/eyebrows, the product "window" mockup frame, badges/tags, form
  field (for `/contact`), table style (for pricing).

**Out of scope (note the implications only)**
- The signed-in app UI. (A direction may note what it would mean for the app, but do not
  design app screens.)
- Docs-style pages (`/help`, `/developers`) and legal pages — show only how the header,
  footer and type would apply.
- Auth pages — flag how they'd be brought in line; don't design them yet.
- Logo — **frozen** (owner decision 2). Use the current "K" monogram and wordmark as they
  are; no logo proposals.
- Copywriting rewrite — use the P49 copy deck as the baseline (see Content).

## Directions to explore

Please produce **three distinct directions**. The prompts below are starting points, not
specs; push each one far enough that the differences are obvious at a glance. If a better
third idea emerges, replace C and say why.

### A. Evolved calm
The current brand, done properly. Geist actually loaded and used with a real type scale;
a richer green family (tints, a deep and a light) plus one warm neutral; an editorial grid
with asymmetric layouts; bigger, more confident product visuals; restrained detail
(hairlines, subtle texture). Low risk, fastest to build, least distinctive.

### B. Personal & warm
Lean into "your address book, yours to keep". A warmer palette (paper, ink, a secondary
accent such as terracotta or ochre alongside the green), a display serif or humanist face for
headlines, and a recurring motif drawn from address books, index cards, envelopes or
contact cards. Could introduce a simple illustration style for people and relationships
(no stock photos). Feels human and private rather than "software". Must stay credible to
families and teams, not twee.

### C. Precise & product-forward
For the switching, power-user and developer audience. Crisp, dense, product UI front and
centre (an interactive or animated hero mockup, keyboard shortcuts, sync status in mono),
tight grid, stronger contrast, a sharper accent. **Stays light** — no dark hero or dark
bands (owner decision 3); get the precision from ink, grid, mono type and the product UI
itself. Feels fast and engineered, in the vein of well-made developer tools, without copying
any of them.

For each direction, include one **signature moment** — the thing someone would remember or
screenshot (a hero interaction, a motif, a layout device). Motion is allowed for this moment
(owner decision 5): keep it to one purposeful animation per page, GPU-cheap (transform and
opacity), no scroll-jacking or parallax, and give it a complete static fallback for
reduced-motion users and a no-JavaScript render that still carries the message.

Illustration is on the table (owner decision 4): each direction may define an illustration or
iconography style (people, relationships, devices, sync). Keep it vector/CSS, light on
weight, and consistent with the direction; no stock photography.

## Content baseline

Use the P49 homepage content (sections, headlines, verified facts) as the starting point.
Directions may reorder, merge or cut sections and propose better headlines, but **every
factual claim must stay true to the product**. Product facts to rely on (checked against
`src/server/billing.ts`, 2026-09-25):

- Free: up to **500 contacts**, **1** sync source, **1** phone or Mac over CardDAV, CSV export.
- Pro: unlimited contacts, **up to 5** sync sources, **5** devices, developer API,
  vCard/Kontax export. Family: shared book, up to 6 members, no API. Teams: shared books,
  up to 25 members, audit log, API.
- Sync: Google, iCloud and Fastmail (and any CardDAV server). **Outlook is not enabled in
  production** — don't feature it unless marked "coming soon".
- Kontax appears in the iPhone and Mac Contacts apps over CardDAV; no app to install.
- Duplicate merge with 30-day undo; per-contact change history; 2FA; sync credentials
  encrypted (AES-256-GCM); no ads or tracking; export or delete any time (deletion after a
  30-day grace period).
- **Not claimable:** backup encryption (deferred), uptime figures, user counts,
  testimonials (none collected yet), outbound webhooks (not built).

UK English throughout ("organised", "centre"). Tone rules from P34C still apply.

## Constraints

- **Accessibility:** WCAG 2.2 AA — text contrast ≥ 4.5:1 (3:1 large), visible focus (keep
  `#4158f4` or propose an equivalent), 44px touch targets, no information by colour alone,
  full reduced-motion fallback.
- **Performance budget:** LCP < 2.0 s on a mid-range phone over 4G; CLS < 0.05; at most two
  font families (variable preferred) with `font-display: swap` and subsetting; no hero
  video; images ≤ 150 KB each (AVIF/WebP); product mockups stay live HTML/CSS where possible.
- **Build reality:** Next.js 15 app router with plain CSS (`--mkt-*` tokens, no Tailwind on
  marketing pages, no UI framework). Designs should be expressible as tokens + a handful of
  components; say so where something would need new tooling (e.g. a motion library).
- **Theming:** light only — **no dark theme, dark hero or dark bands** (owner decision 3).
  The existing dark-green footer is the one dark element; a direction may restyle the footer
  but must not add more dark sections.
- **Honesty — no social proof exists yet** (owner decision 6: Kontax is new; there are no
  customers, quotes, logos or usage numbers). Designs must work without testimonials,
  "trusted by" strips, logo walls, ratings, user counts or uptime figures, and must not use
  placeholders for them. Build trust from verifiable product facts instead: open standards
  (CardDAV, vCard, documented export format), the privacy facts, transparent pricing, the
  public changelog, and "export or delete any time".
- **Responsive:** design at 1440 and 375, and check 768 and 1024 don't break.

## How directions will be judged

1. **Five-second test** (from P34C): what Kontax is, why it's different from iCloud/Google
   Contacts, how to start.
2. **Distinctiveness:** would it be recognisable with the logo covered?
3. **Trust:** does it feel private, calm and competent — safe to hand your contacts to?
4. **Scales:** does it hold up on pricing and a long-form page, on mobile, and with the
   signed-in header?
5. **Accessible and fast** within the constraints above.
6. **Buildable:** rough effort to implement in the current stack (S/M/L), and what it would
   imply for the app and auth pages later.

## Deliverables

Delivered as a handoff bundle like P49 (HTML/CSS prototypes + a spec page):

1. **Per direction**
   - One-page rationale: principles, what it keeps, what it changes, risks.
   - Tokens: colour, type scale, spacing, radii, as CSS custom properties.
   - Homepage, full scroll, desktop 1440 + mobile 375 (live HTML preferred; static frames
     acceptable for C's interactions if annotated).
   - `/pricing` and one content page (`/security` or `/features`), desktop + mobile.
   - Header (signed-out, signed-in, mobile menu) and footer.
   - Component sampler.
   - Signature moment, with its reduced-motion fallback.
   - Effort estimate and app/auth implications.
2. **Comparison sheet:** the three directions side by side on the same hero and the same
   pricing section, scored against the judging criteria, with a recommendation.

## Owner decisions (answered 2026-09-25)

1. **Appetite for change: either.** Directions may range from an evolution of today's look
   (A) to a clearly new identity (B, C), as long as the logo and core tone survive.
2. **Logo: frozen.** Keep the current "K" monogram and wordmark as is; no logo proposals.
3. **Dark theme: no.** Light only — no dark hero, no dark bands. The existing dark-green
   footer is the only dark element (it may be restyled, not multiplied).
4. **Illustration: yes.** Directions may introduce an illustration/iconography style
   (vector/CSS, no stock photography).
5. **Motion: try it.** One restrained signature animation per page is allowed, with a full
   reduced-motion fallback (this relaxes P34C's "no scroll-triggered animation" rule for the
   signature moment only).
6. **Social proof: none.** Kontax is a new product with no customers, quotes or numbers yet;
   designs must earn trust without testimonials or "trusted by" content.

## Out of scope for this brief

Building anything; app UI; logo redesign; new copy beyond
headline proposals; SEO restructuring; new pages. The P49 homepage stays as the live
homepage until a direction is chosen and built.

## Likely follow-ups (only if a direction is chosen)

- P50-01 Load the chosen type properly (`next/font`), migrate `--mkt-*` tokens.
- P50-02 Header, footer and shared components.
- P50-03 Homepage build in the chosen direction.
- P50-04 Pricing, features, security, changelog, about, contact.
- P50-05 Auth pages and docs chrome aligned to the new system.
- P50-06 Accessibility, performance and cross-device QA.

Independent of any direction: loading Geist via `next/font` is a quick fix and could ship
on its own (tracked in P49A-18).
