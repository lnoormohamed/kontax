# Phase 50 — Marketing redesign: Direction A (Evolved calm)

## Phase status
**Shipped to production 2026-09-27** (main 0886b69) as a merge of two builds: the owner chose
page by page (homepage, pricing layout and About from one; security, changelog, help centre,
guides and SEO from the other). QA: [p50-07-qa-2026-09-26.md](../runbooks/p50-07-qa-2026-09-26.md)
plus a Chromium sweep of all 107 public URLs on production (clean apart from a pre-existing
/privacy hydration warning caused by Cloudflare Email Address Obfuscation). Not yet covered:
Safari/iPhone and Firefox, and the signed-in header/hero — check manually. P50-08 not started
(needs the owner's go-ahead).

## Decision
From the P50-DB01 exploration ([brief](../design-briefs/p50-db01-marketing-redesign-exploration.md),
[prototypes](../design-briefs/p50-db01-handoff/)), the owner chose **Direction A — Evolved calm**:
today's brand done properly. Geist actually loaded on a real type scale, a six-step green
family, a warm stone neutral for surfaces, an asymmetric editorial grid (headline left, lede
right, mono index labels), hairline "wires" and source tags as the motif, and the dark-green
footer kept. Signature moment: **"three into one"** — the same person from Google, iCloud and
Fastmail wired into one Kontax contact that syncs back to iPhone, Mac and Google.

Not adopted (kept on record in the handoff): B (Personal & warm, the designer's pick) and C
(Precise). C's sync-log console, hero spec list and pricing-table style remain an optional
add-on (P50-08) if A needs more distinctiveness after launch.

## Source of truth
- Prototype: `roadmap/design-briefs/p50-db01-handoff/Direction A - Evolved Calm.html`
  (views: `?view=home|pricing|security|sampler`, `&signed=1` for the signed-in header).
- Styles: `p50-base.css` (shared components) + `dir-a.css` (Direction A skin); behaviour in `p50.js`.
- Tokens and type scale: the "Direction A" block in `P50-DB01 Redesign Exploration.html`.
- Copy and facts: unchanged from P49 (verified), with the fact corrections listed in the
  exploration's "Shared notes" (see P50-03).

## Tickets

| Ticket | Title | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [P50-01](p50-01-type-and-tokens.md) | Load Geist + Geist Mono; Direction A tokens and type scale | P1 | S | — | Done (staging) |
| [P50-02](p50-02-shared-chrome-and-components.md) | Header, footer, buttons, section heads, window frame, source tags | P1 | S–M | P50-01 | Done (staging) |
| [P50-03](p50-03-homepage-direction-a.md) | Homepage in Direction A, incl. the "three into one" signature | P1 | M | P50-02 | Done (staging) |
| [P50-04](p50-04-pricing-and-security.md) | `/pricing` and `/security` in Direction A | P1 | M | P50-02, P49A-14 | Done (staging) — restyle only; P49A-14 still to land |
| [P50-05](p50-05-remaining-marketing-pages.md) | Features, changelog, about, contact; docs/legal chrome | P2 | M | P50-02 | Done (staging) — About copy open |
| [P50-06](p50-06-auth-pages-alignment.md) | Auth pages aligned (green, Geist, UK spelling) | P2 | S | P50-01 | Done (staging) |
| [P50-07](p50-07-qa-accessibility-performance.md) | Accessibility, performance and cross-device QA | P1 | S | P50-03..06 | Done locally; device pass on staging |
| [P50-08](p50-08-optional-c-product-pieces.md) | *Optional:* C's sync-log console, spec list, pricing table style | P3 | M | P50-03, P50-04 | Not started (owner go-ahead) |

## Order
P50-01 → P50-02 → P50-03 and P50-06 in parallel → P50-04 → P50-05 → P50-07.
Ship behind staging review; production only with an explicit go-ahead. P49 + P49A should reach
production first so this phase starts from the live homepage.

## Documentation
- [ ] External · users — all marketing pages
- [x] Internal · engineering — `--mkt-*` token map and component notes in `marketing.css`
