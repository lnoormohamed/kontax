# P34C-05 — Homepage Social Proof Section

## Purpose

Add a social proof section below the feature tiles that gives a new visitor
a reason to trust Kontax before signing up. Keep the section honest — no
fabricated testimonials. Use real stats or honest descriptors until genuine
testimonials are available.

## Background

The homepage currently has no trust signal between the feature overview and
the sign-up CTA. Social proof — whether numbers, logos, or quotes — measurably
improves conversion on SaaS landing pages by confirming that other people use
and value the product.

Kontax does not yet have a library of testimonials. This ticket builds the
section in a way that starts with a stat bar (always honest) and provides a
slot for testimonials when they become available, without requiring a code
change to add them.

## Scope

**In scope**
- Social proof section in `src/app/(marketing)/page.tsx`, between the feature
  tiles section and the bottom CTA band.
- Stat bar as the primary implementation (always safe to ship).
- Testimonial card layout as a conditional: rendered only if `TESTIMONIALS`
  array is non-empty.

**Out of scope**
- Collecting testimonials (a product/marketing task, not engineering).
- Customer logo bar (requires permission from each company displayed).
- The bottom CTA band (separate concern within P34C-03 or a follow-up ticket).

## Design / Implementation Spec

### Section structure

```
┌──────────────────────────────────────────────────────────────┐
│  bg-white  py-20                                             │
│                                                              │
│  "Trusted by people who care about their contacts."          │
│  (section heading, centred, 30px, #17352e)                   │
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                 │
│  │ 10,000+  │   │    3     │   │  Built   │                 │
│  │ contacts │   │  sync    │   │    in    │                 │
│  │ managed  │   │providers │   │  London  │                 │
│  └──────────┘   └──────────┘   └──────────┘                 │
│                                                              │
│  [If TESTIMONIALS.length > 0 — render quote cards here]     │
└──────────────────────────────────────────────────────────────┘
```

### Stat bar

Three stat blocks in a horizontal row (desktop), stacking on mobile:

```tsx
const STATS = [
  { value: "10,000+", label: "contacts managed" },
  { value: "3",       label: "sync providers" },
  { value: "London",  label: "built with care" },
];
```

Each stat block:
```
<div className="text-center flex-1 px-8">
  <p className="text-[48px] font-bold text-[#17352e] leading-none">{value}</p>
  <p className="text-[15px] text-[#8b938c] mt-2">{label}</p>
</div>
```

Dividers between blocks: `border-r border-[#edf0ea]` on all but the last.

**Stat accuracy note**: The "10,000+" figure must be verified against the
actual contacts table count before shipping. If the real figure is lower,
use an accurate number or a softer label ("Thousands of contacts managed" /
"Contacts across 100+ users"). Never inflate. The stats are defined in a
`STATS` constant so they can be updated without touching JSX.

### Testimonial cards (conditional)

```tsx
const TESTIMONIALS: Testimonial[] = [
  // populated when real testimonials are collected
  // { quote: "…", author: "…", role: "…" }
];

{TESTIMONIALS.length > 0 && (
  <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
    {TESTIMONIALS.map(t => <TestimonialCard key={t.author} {...t} />)}
  </div>
)}
```

Testimonial card design:
```
┌──────────────────────────────────┐
│  "                               │
│   Quote text here in 16px,       │
│   italic, #1d2823                │
│                                  │
│  Author Name                     │
│  Role / Company — 13px muted     │
└──────────────────────────────────┘
```

Card: `bg-[#f4f6f2] rounded-[14px] p-8 border border-[#edf0ea]`. Quote mark:
large `"` in `text-[64px] text-[#17352e]/20 font-serif leading-none -mb-4`.
Author: `text-[14px] font-semibold text-[#1d2823]`, role: `text-[13px]
text-[#8b938c]`.

### [QUOTE NEEDED] markers

Until real testimonials are collected, do **not** render placeholder quote
cards with `[QUOTE NEEDED]` text in production. The conditional on
`TESTIMONIALS.length > 0` prevents empty cards from shipping. Add a code
comment:

```ts
// TESTIMONIALS: collect real quotes before populating.
// Once 3 quotes are available, add them here.
// Never fabricate quotes — use only verified, consented customer words.
```

### Mobile (< 640px)

- Stat blocks stack vertically, centred. No dividers on mobile.
- Section heading `text-[26px]`.

## Acceptance Criteria

- [ ] Section heading "Trusted by people who care about their contacts." renders.
- [ ] Three stat blocks render with values from `STATS` constant.
- [ ] Stats are accurate — `10,000+` must reflect a real number or be softened.
- [ ] Testimonial cards render only if `TESTIMONIALS` array is non-empty.
- [ ] No `[QUOTE NEEDED]` placeholder text ships to production.
- [ ] Desktop: horizontal stat row with dividers. Mobile: vertical stack.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Stat accuracy**: "10,000+" must be verified. If the product is pre-public-
  launch, actual contact counts may be far lower. Options: use a lower accurate
  number, use "thousands" language, or remove the contact count stat entirely
  and replace with a different honest metric (e.g., "3 sync providers supported",
  "Available on web, iOS, and Android" once mobile ships).
- **Testimonial collection process**: no engineering work required — but someone
  needs to reach out to early users. Define who does this and by when to avoid
  the section staying as a stat bar forever.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: document the `STATS` and `TESTIMONIALS`
      constants and how to update them without a code change
