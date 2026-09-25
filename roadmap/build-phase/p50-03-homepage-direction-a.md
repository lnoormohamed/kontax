# P50-03 — Homepage in Direction A, incl. the "three into one" signature

**Phase:** 50 · **Priority:** P1 · **Effort:** M · **Depends on:** P50-02

## Objective
Rebuild the homepage from the Direction A prototype (`?view=home`), keeping P49's section
order and verified copy.

## Scope
- **Hero:** eyebrow with hairline rule, 80px headline left, lede + CTAs + trust line right
  ("Free for up to 500 contacts · No card needed · No app to install").
- **Signature "three into one"** (below the hero, stone panel): three source cards (Google,
  iCloud, Fastmail) → wires → merged Kontax card with per-field source tags and "Merged just
  now · undo for 30 days" → "Syncs back to" iPhone Contacts, Mac Contacts, Google Contacts.
  - Markup is the final frame (server-rendered); a small client script adds the `.pre`
    start state and removes it on the next frame (sources slide in, wires draw, card rises,
    fields tick in; ~1.8 s, transform/opacity only, runs once).
  - Reduced motion / no JS: nothing hidden, no animation. One `role="img"` text alternative;
    inner content `aria-hidden`.
  - Mobile: one source card + caption "+ the same person in iCloud and Fastmail", then the
    merged card.
- **Sections** restyled with the shared components: works-with strip, how it works (numbered
  steps), feature showcase rows + secondary grid, comparison, privacy facts, who it's for,
  pricing teaser, FAQ, stone CTA band.
- **Copy/fact corrections** (exploration "Shared notes"): replace "Works on iPhone, Android and
  the web" with "No app to install", and the comparison row "Works across iPhone and Android"
  with "Keeps Google, iCloud and Fastmail in step" (Android sync isn't a verified fact).
  If the P49 release hasn't shipped yet, make these two copy fixes there first.
- Keep the signed-in hero variant and the signed-in CTA ("Open Kontax").

## Acceptance
- Visual parity with the prototype at 1440, 1024, 768 and 375; no horizontal scroll.
- Signature: reduced-motion and JS-disabled renders show the complete final frame.
- LCP element is the h1; LCP < 2.0 s and CLS < 0.05 on a throttled mobile profile.
- Homepage FAQ JSON-LD unchanged and valid.
