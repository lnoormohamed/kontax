# P50-01 — Load Geist + Geist Mono; Direction A tokens and type scale

**Phase:** 50 · **Priority:** P1 · **Effort:** S · **Depends on:** —

## Objective
Make the site use the typeface every brief has specified, and put Direction A's colour and
type system behind the existing `--mkt-*` tokens so every marketing page picks it up.

## Context
- Geist is referenced in CSS but never loaded (no `next/font` import); visitors see system
  fonts. Same fix is listed in P49A-18.
- Direction A tokens (exploration page, "Direction A" block): green family `--g900 #0f2620`,
  `--g800 #17352e` (brand), `--g600 #2f6b52`, `--g400 #6f9c86`, `--g200 #cfe1d6`, `--g100 #e8f0eb`;
  `--stone #f4f1ea`, `--stone-line #e3ddd0`, `--bg #fcfcfa`, `--ink #1d2823`, `--head #14231d`,
  `--body #4e5851`, `--mute #646c65`, `--line #e5e8e1`, `--line-strong #d4d9d0`, `--focus #4158f4`.
- Type: `--h1 700 clamp(44px,5.6vw,80px)/1.0 -.04em`, `--h2 700 clamp(32px,3.6vw,50px)/1.06 -.03em`,
  `--h3 650 clamp(26px,2.6vw,34px)/1.14`, `--h4 650 22px/1.25`, body 16–19px/1.55–1.6,
  mono labels Geist Mono 500 13px. Radii 8/10/16/14; max width 1240; gutter 48 (20 mobile);
  section spacing 112/88/72.

## Steps
1. Add `next/font` Geist (variable, 400–700) and Geist Mono (500) in the root layout, exposing
   CSS variables; subset Latin; `display: swap`. Point `--mkt-sans`/`--mkt-mono` (and the app's
   `--font-sans`) at them.
2. Add the Direction A tokens to `marketing.css` and remap existing `--mkt-*` names onto them
   (e.g. `--mkt-surface → --stone`, `--mkt-green → --g800`), so current pages keep working while
   later tickets restyle them. Record the mapping in a comment block.
3. Add the type scale as utility custom properties / classes used by P50-02.

## Acceptance
- Network panel shows the two self-hosted font files; no Google Fonts request; CLS unchanged.
- Every marketing page renders in Geist with no layout breakage (visual pass on staging).
- Contrast of every text token on `--bg` and `--stone` ≥ 4.5:1 (record the values).
