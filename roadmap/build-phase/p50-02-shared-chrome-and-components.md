# P50-02 — Header, footer and shared components (Direction A)

**Phase:** 50 · **Priority:** P1 · **Effort:** S–M · **Depends on:** P50-01

## Objective
Rebuild the shared marketing chrome and the component set from the Direction A prototype so
page tickets only compose them.

## Source
`p50-base.css` + `dir-a.css` + the header/footer builders in `p50.js`
(`roadmap/design-briefs/p50-db01-handoff/`). Component sampler: `?view=sampler`.

## Scope
- **Header:** signed-out (Log in + Get started free), signed-in (name + avatar + Open Kontax),
  mobile menu below 980px. Nav: Features, Security, Pricing, Changelog. Keep the existing
  session logic in `marketing-nav.tsx`.
- **Footer:** keep dark green; four columns (Product, Company, Resources, Legal) + base line
  "Export or delete your data any time, from Settings". A hairline separates any stone band
  from the footer (the prototype's fix for the P49 band/footer clash).
- **Components:** primary/secondary buttons; section head (asymmetric 5/7 grid, mono index
  label like `01 — How it works`); band + stone band; product window frame; source tag (mono
  "iCloud"/"Google" pill); hairline wire connector (SVG, `vector-effect: non-scaling-stroke`);
  card; comparison table; plan card; FAQ accordion; CTA band (stone).
- Keep plain CSS under `(marketing)/_components`, `mkt-`/`hp-` prefixes, no new libraries.

## Acceptance
- Sampler parity: each component matches the prototype at 1440 and 375 (side-by-side
  screenshots attached to the PR).
- Keyboard: header, mobile menu and accordion fully operable; visible `--focus` ring.
- No page regressions on the existing marketing pages after the swap.
