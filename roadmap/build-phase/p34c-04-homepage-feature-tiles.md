# P34C-04 — Homepage Feature Tiles (6 Tiles)

## Purpose

Add a 6-tile feature grid below the hero section of the homepage. Each tile
communicates one core Kontax capability with an icon, a headline, and two
sentences of description — giving a visitor who scrolled past the hero a fast
overview of what the product does.

## Background

The current homepage has either no features section or a stale one that predates
labels (P31B), grouped search (P33), and the public card (Phase 30). Feature
tiles are a standard conversion pattern for productivity tools: they answer
"what can it do?" before a visitor commits to signing up.

P34C-DB01 specifies the visual treatment. This ticket implements the six tiles
defined in the P34C amendments.

## Scope

**In scope**
- Features section of `src/app/(marketing)/page.tsx`.
- Six tile components in a responsive grid.
- Section heading and sub-copy.
- `id="features"` anchor on the section for the "See how it works" scroll target
  from P34C-03.

**Out of scope**
- Social proof section (P34C-05).
- The `/features` deep-dive page (P34C-07) — tile CTAs can link there.
- Animations or scroll-reveal effects (keep it simple for now).

## Design / Implementation Spec

### Section structure

```tsx
<section id="features" className="bg-[#f4f6f2] py-24">
  <div className="max-w-6xl mx-auto px-6">
    <h2>…section heading…</h2>
    <p>…sub-copy…</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
      {FEATURE_TILES.map(tile => <FeatureTile key={tile.id} {...tile} />)}
    </div>
  </div>
</section>
```

### Section heading

- Heading: `text-[36px] font-bold text-[#17352e] tracking-[-0.02em] text-center`
- Sub-copy: `text-[18px] text-[#5c655e] mt-4 text-center max-w-[560px] mx-auto`
- Placeholder: "Everything your contacts need" / "From first sync to last export,
  Kontax handles it."

### FeatureTile component

```
┌──────────────────────────────┐
│  ┌──────┐                    │
│  │ Icon │  (48px tile, green │
│  └──────┘   wash background) │
│                              │
│  Headline (18px semibold)    │
│                              │
│  Description (15px muted,    │
│  2 sentences)                │
└──────────────────────────────┘
```

```tsx
function FeatureTile({ icon, headline, description }: FeatureTileProps) {
  return (
    <div className="bg-white rounded-[16px] border border-[#d8ddd6] p-8
                    flex flex-col gap-5 hover:shadow-sm transition-shadow">
      <div className="w-12 h-12 rounded-[12px] bg-[#eef5ef] flex items-center
                      justify-center text-[#17352e]">
        {/* icon 24×24 */}
      </div>
      <h3 className="text-[17px] font-semibold text-[#1d2823] leading-snug">
        {headline}
      </h3>
      <p className="text-[14.5px] text-[#5c655e] leading-[1.6]">
        {description}
      </p>
    </div>
  );
}
```

### Tile data

Define as a constant `FEATURE_TILES` in the page file (or a sibling data file):

```ts
const FEATURE_TILES = [
  {
    id: "search",
    icon: SearchIcon,        // from existing icon set
    headline: "Search that actually works",
    description:
      "Find anyone by name, email, phone, company, label, or note. " +
      "Results are grouped and highlighted so you see exactly why a contact matched.",
  },
  {
    id: "labels",
    icon: TagIcon,
    headline: "Labels that organise, not just tag",
    description:
      "Create a label registry once, then filter your list to exactly the people " +
      "you need. Labels sync to your devices alongside the contacts they're on.",
  },
  {
    id: "sync",
    icon: RefreshCwIcon,
    headline: "Sync everywhere",
    description:
      "Connect CardDAV, Google Contacts, Outlook, and iCloud. " +
      "Changes flow in both directions — Kontax stays in sync, even offline.",
  },
  {
    id: "sharing",
    icon: UsersIcon,
    headline: "Share with family or your team",
    description:
      "Create a shared address book that everyone in your family or team can see " +
      "and edit in real time. One contact, always up to date for everyone.",
  },
  {
    id: "public-card",
    icon: IdCardIcon,
    headline: "Your public card",
    description:
      "Share your contact details at /u/yourname. " +
      "Anyone with the link can add you to their phone in one tap — no app required.",
  },
  {
    id: "api",
    icon: CodeIcon,
    headline: "Developer API",
    description:
      "Build on your contacts with the Kontax REST API at api.getkontax.com. " +
      "Create, search, and update contacts from any tool or automation.",
  },
];
```

Use icons already in the app's icon set (Lucide or custom WorkspaceIcons). If
the exact icon does not exist, use the closest semantic match and note it for
design review.

### Grid responsive behaviour

- 1 column at `< 640px` (sm breakpoint).
- 2 columns at `640px–1023px`.
- 3 columns at `≥ 1024px` (lg breakpoint).
- Equal tile heights within each row via CSS grid `align-items: stretch` (default).

## Acceptance Criteria

- [ ] Section renders with `id="features"` so the hero scroll CTA works.
- [ ] All six tiles render with icon, headline, and description.
- [ ] Desktop: 3-column grid. Tablet: 2-column. Mobile: 1-column.
- [ ] Icons are 24×24 inside a 48px green-wash tile (`bg-[#eef5ef]`).
- [ ] Tile cards: white bg, `rounded-[16px]`, `border-[#d8ddd6]`.
- [ ] No placeholder copy in production (copy from P34C-DB01 or the strings
      above are acceptable if they match the final brief).
- [ ] `tsc --noEmit` passes; no layout shift on mobile.

## Risks / Open Questions

- **Icon availability**: confirm all 6 icon names exist in the current icon
  system before implementation. Substitutions are fine but should be noted for
  the designer to review.
- **Copy gate**: same as P34C-03 — hold the PR until copy is approved if the
  placeholder strings above differ from the brief.
- **6th tile (API)**: the API tile only makes sense post-Phase 29. Confirm the
  API is live and the `/developers` page exists before enabling this tile.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: document the `FEATURE_TILES` constant
      location for non-technical copy updates
