# P49-DB01 — Design brief: homepage refresh (more substance, less plain)

Status: Not started · Priority: P1 · Depends: —
Phase: [Phase 49](phase-49-homepage-refresh.md)
Supersedes the homepage section of [P34C-DB01](../design-briefs/p34c-db01-marketing-site-ia.md) (nav, footer and the rest of the IA stay as they are).

## Purpose

The public homepage at getkontax.com reads as plain and thin. It says what
Kontax is, then shows six identical text tiles, three numbers and a button.
A visitor never sees the product doing anything, never learns why Kontax beats
the address book they already have, and gets no reassurance about privacy
before being asked to sign up.

This brief specifies a fuller homepage: more sections, real product visuals,
a clear answer to "why not just iCloud or Google Contacts?", and trust signals.
It keeps the existing brand, type and palette, so the result feels like the same
product with more to say.

## Current state (verified on getkontax.com, 2026-09-25)

Source: `src/app/(marketing)/page.tsx` (402 lines), `homepage.css`.

| # | Section | What it does today |
|---|---|---|
| 1 | Hero | Eyebrow "Contact management, done right", headline "Your contacts. Organised, synced, and always with you.", one-line subhead, **Get started free** / **See how it works ↓**. Right: an HTML mockup of the app's search dropdown ("al" → 3 matches + a label). |
| 2 | Feature tiles | "Everything your contacts need" — 6 equal white cards, each an icon + title + two lines: Search, Labels, Sync everywhere, Share with family or team, Your public card, Developer API. No visuals. |
| 3 | Stat band | "Trusted by people who care about their contacts." — **99.9%** uptime · **4** sync sources · **0** ads, ever. |
| 4 | CTA band | "Ready to get started?" — Free plan, no credit card required. |
| 5 | Footer | Product / Company / Legal links. |

**What works and should stay:** the headline, the calm forest-green palette,
Geist type, the generous whitespace, and the idea of rendering product UI as
live HTML (crisp, themeable, no image weight) rather than screenshots.

**Why it feels plain:**

1. **Almost nothing after the hero.** Five blocks in total, and the only product
   visual is the hero dropdown. Everything below is text in identical cards.
2. **Six equal tiles flatten the story.** Search and "Developer API" get the same
   weight as sync and sharing, which are the reasons people switch. On a phone
   the tiles stack into about six screens of identical white cards.
3. **"See how it works" has nothing to land on.** It scrolls to the tiles; there
   is no how-it-works section.
4. **No differentiation.** P34C-DB01's goal #2 was "what makes it different from
   iCloud Contacts / Google Contacts"; the page never answers it.
5. **The strongest capabilities are missing entirely:** Kontax appears in the
   iPhone and Mac Contacts apps natively over CardDAV (no app to install);
   two-way sync with Google, iCloud and Fastmail; duplicate detection and
   merging; per-contact change history; international phone formatting and
   correct sorting of non-Latin names; an open, documented export format.
6. **The stat band is weak and partly unverifiable.** "Trusted by people…" has no
   people. "99.9% uptime" has no published record behind it. "4 sync sources"
   depends on how you count, and the Outlook/Microsoft connector is **not
   enabled in production** (`MICROSOFT_*` unset).
7. **No trust or privacy content**, although `/security` exists and the product
   has real, verifiable controls (2FA, encrypted sync credentials, no ads,
   export or delete any time).
8. **No pricing signal** on the page, so "free" has no shape.

**Copy bug found while auditing (fix regardless of this brief):** the code
enforces a **500-contact** free plan (`src/server/billing.ts`, `FREE.contactsLimit`),
and the site metadata, JSON-LD and Help FAQ say 500, but the **pricing page,
its FAQ and the features page say 100** (`pricing/page.tsx` ×3,
`pricing/_pricing-toggle.tsx`, `pricing/_faq.tsx`, `features/page.tsx`).
Tracked as P49-01.

## Goals

A first-time visitor should, within one scroll on desktop:

1. **Understand** what Kontax is and who it is for (hero, unchanged job).
2. **See it work**: at least three real product surfaces, not just described.
3. **Know why to switch**: the specific things built-in address books don't do.
4. **Trust it**: privacy stance and security controls, stated plainly.
5. **Know the deal**: free up to 500 contacts, what paid adds.

Measure (we already collect Web Vitals; add simple, privacy-respecting counts
only if an analytics decision is made separately): CTA click-through from the
homepage, scroll depth to the pricing teaser, and sign-ups per homepage visit
before vs after. Keep LCP under 2.5 s on mobile.

## Proposed page structure

Order matters: show, differentiate, reassure, then ask. Sections alternate
white and `--mkt-surface` (`#f4f6f2`) backgrounds, with one dark
`--mkt-green` band near the end for rhythm.

### 1. Hero — keep, tighten

- Keep the headline and subhead.
- Add a **trust line** under the buttons, small and muted:
  "Free for up to 500 contacts · No card needed · Works on iPhone, Android and the web".
- **See how it works ↓** now scrolls to section 3.
- Mockup: keep the search dropdown. Optional enhancement: the query types
  itself ("a", "al", results filter in) once on load, then rests. Static when
  `prefers-reduced-motion` is set; the resting frame must be the full result.

### 2. "Works with" strip — new

One line beneath the hero, `--mkt-mute` text: **Works with** Apple Contacts ·
Google Contacts · iCloud · Fastmail · any CardDAV app.

- Text wordmarks or neutral glyphs, not third-party logos, unless brand-use
  terms are checked (decision D3).
- Only list what is live in production. Outlook appears only once the
  Microsoft connector is enabled.

### 3. How it works — new (the "See how it works" target)

Three numbered steps (a real sequence, so numbering is honest), each with a
small UI vignette:

1. **Bring your contacts in.** Connect Google, iCloud or Fastmail, or import a
   CSV/vCard file. Vignette: the connect-a-source picker.
2. **Kontax tidies them up.** Duplicates found and merged, phone numbers
   formatted for their country, names sorted properly in any script.
   Vignette: a merge suggestion card ("2 contacts look like the same person").
3. **They stay in sync everywhere.** Add Kontax to your iPhone or Mac Contacts
   app with an app password, and changes flow both ways. Vignette: the iOS
   Contacts account row / a sync status chip.

Mobile: vertical steps with the number beside each title.

### 4. Feature showcase — replaces the six equal tiles

Three **alternating rows** (visual left/right, copy opposite), for the reasons
people switch:

| Row | Headline direction | Visual (HTML mockup, like the hero) |
|---|---|---|
| Sync | "One address book, on every device" | Sync connections list: Google ✓, iCloud ✓, iPhone (CardDAV) ✓ with last-synced times |
| Clean-up | "Duplicates, found and fixed" | Merge review: two records side by side, fields chosen, "Merge" button |
| Sharing | "Share a book with family or your team" | A shared "Family" book with member avatars and an edit/view role chip |

Then a **compact secondary grid** (2 × 3 desktop, 2 columns mobile, icon + one
line each, no card chrome) for: Search, Labels, Public card, Change history,
Open export format, Developer API. Link: **See all features →** `/features`.

### 5. Why Kontax — new comparison

Short, factual table: **Kontax** vs **Google Contacts** vs **iCloud Contacts**.
Rows (keep to 5–6, only claims we can defend):

- Syncs with both Google and Apple devices
- Shared address books for a family or team, with roles
- Finds and merges duplicates
- Change history per contact
- Export to an open, documented format
- No ads, contacts never sold

Use ✓ / — marks, and a one-line footnote on how each row was judged and when.
Mobile: turn into three stacked cards or a horizontally scrolling table.
Needs decision D1 (naming competitors) and a claims check before build.

### 6. Privacy & security — new band

Four short facts, each verifiable, linking to `/security`:

- Two-factor sign-in, and a separate app password for each device
- Sync credentials encrypted at rest (AES-256-GCM)
- No ads, no tracking pixels, your contacts are never sold
- Export everything, or delete your account, any time

**Do not** claim encrypted backups here until backup encryption is switched on
(deferred on 2026-09-25; the `/security` page currently over-states this).

### 7. Who it's for — new

Three cards linking to the matching plan: **Just you** (Free / Pro),
**Your family** (Family plan, shared book), **Your team** (Teams, roles and
billing). One sentence and one "what you get" line each.

### 8. Pricing teaser — new

Free vs Pro side by side in miniature: "Free — up to 500 contacts, 1 sync
source" / "Pro — unlimited contacts, every sync source, API". Prices pulled
from the same Stripe catalog the pricing page uses (no hard-coded amounts).
**Compare plans →** `/pricing`.

### 9. FAQ — new

4–6 questions reused from `help-faq-data.ts` (one source of truth), e.g.
"Do I need to install an app?", "What happens to my contacts if I leave?",
"Is Kontax free?", "Does it work with iPhone?". Emit FAQPage JSON-LD.

### 10. Final CTA band — keep

Keep "Ready to get started?". Tighten the line under it to match the trust line.

### Stat band — remove or replace

Remove the current band. If kept, only verifiable facts, e.g. "0 ads, ever",
"Export any time", "Made in the UK" (if true, D5). Bring numbers back only when
backed by a public status page or real usage figures.

## Visual direction

- **Same brand:** `--mkt-green` #17352e, `--mkt-ink`, `--mkt-surface` #f4f6f2,
  `--mkt-tile-bg` #eef5ef, Geist / Geist Mono. The accent `#4158f4` stays
  reserved for interactive focus (as in the hero search field).
- **Product visuals as live HTML mockups**, built from the real component styles
  where possible, at a consistent "window" frame like the hero. No stock photos.
- **Rhythm:** alternate backgrounds; vary layouts (split, steps, alternating
  rows, table, band) so no two consecutive sections look alike.
- **Motion:** at most one orchestrated moment (the hero search typing).
  Sections may fade in from an already-visible resting state; nothing parked
  at opacity 0. Respect `prefers-reduced-motion`.
- **Density:** fuller but still calm. Target 9–10 sections at roughly the
  current section spacing; no new colours, no gradients, no emoji markers.

## Mobile (< 768px)

- Total scroll roughly 1.5× today's, not 3×: secondary features as a 2-column
  icon grid, comparison as stacked cards, how-it-works as vertical steps.
- Every mockup must be legible at 375px wide (scale the frame, don't crop text).
- Tap targets ≥ 44px; the sticky nav stays as is.

## Content rules

Every claim on the page must be true of production today, and the brief's
copy deck must list the source for each:

| Claim | Source to verify |
|---|---|
| Free up to 500 contacts | `billing.ts` FREE.contactsLimit (fix the 100s first) |
| Works with Google, iCloud, Fastmail, CardDAV | live connectors; Outlook only when `MICROSOFT_*` is set |
| No app to install on iPhone/Mac | CardDAV + app passwords |
| 2FA, encrypted sync credentials | P18-07, P48-16 |
| Open export format | P45, `/format/` |
| No ads, never sold | privacy policy |

## Performance, SEO, accessibility

- Keep the page **statically rendered** (P38-10); no client data fetching above
  the fold. Mockups are HTML/CSS, not images. LCP < 2.5 s mobile.
- One `h1`; sections in logical `h2` order; comparison table as a real `<table>`
  with headers; mockups `aria-hidden` with a text alternative in the copy.
- JSON-LD: keep SoftwareApplication; add FAQPage for section 9.
- Colour contrast AA for all muted text on `#f4f6f2`.

## Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Name Google and iCloud in a comparison table? | Yes, factual and dated; legal glance before publish |
| D2 | Any real testimonials or user quotes available? | If yes, add a 3-quote row after section 6; if not, skip rather than invent |
| D3 | Provider logos or text wordmarks in the "Works with" strip? | Text wordmarks now; logos only after checking each brand's terms |
| D4 | Pricing teaser on the homepage? | Yes, Free vs Pro only |
| D5 | Any origin or company fact worth stating (e.g. where it's built and hosted)? | Only if accurate and useful |

## Deliverables

1. Annotated desktop (1440) and mobile (375) mockups of the full scroll.
2. Final copy deck with the source for every claim.
3. Specs for the new mockup vignettes (connect picker, merge card, sync list,
   shared book) reusing app component styles.
4. Component list for the build tickets.

## Out of scope

- The logged-in homepage (see `design-briefs/homepage-logged-in-state.md`).
- Other marketing pages (features, pricing, security) beyond the P49-01 copy
  fix and the `/security` backup-claim follow-up.
- Rebrand, new colours or new typefaces.
- Analytics tooling choice.

## Follow-up build tickets (proposed)

- **P49-01** — Fix the free-plan limit copy (100 → 500) on pricing, pricing FAQ,
  pricing toggle and features page. Small; can ship before the redesign.
- **P49-02** — Hero trust line, "Works with" strip, how-it-works section.
- **P49-03** — Feature showcase rows + secondary grid (replaces tiles).
- **P49-04** — Comparison, privacy band, who-it's-for, pricing teaser, FAQ;
  remove the stat band.
- **P49-05** — Mobile pass, reduced-motion, accessibility and performance QA.
