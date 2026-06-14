# P34C-10 — Pricing Page Feature Comparison Matrix

## Purpose

Add a full feature comparison table below the plan cards on `/pricing`. The
matrix is the most complete answer to "what do I get?" — it lets a visitor
compare all four plans across every feature without having to hunt through
individual card lists.

## Background

Plan card feature lists (P34C-08) are curated highlights, not exhaustive
comparisons. Visitors deciding between Pro and Family, or evaluating whether
to upgrade from Free, want to see every row side-by-side. The matrix is also
the canonical reference that the support team can point to when answering
billing questions.

The matrix data must stay in sync with `pricing-data.ts` (P34C-08). Define
matrix rows in the same file or an adjacent data file.

## Scope

**In scope**
- Feature matrix table component in
  `src/app/(marketing)/pricing/feature-matrix.tsx`.
- Matrix data defined as a typed constant in `pricing-data.ts` or a
  sibling `matrix-data.ts`.
- Rendered below the plan cards and billing toggle in `pricing/page.tsx`.
- Desktop: full table. Mobile: horizontal scroll or collapsible accordion.

**Out of scope**
- FAQ section (P34C-11).
- Billing toggle (P34C-09).
- Plan cards (P34C-08).

## Design / Implementation Spec

### Matrix data

```ts
// In pricing-data.ts or matrix-data.ts

export type MatrixCell = boolean | string | "—";
// boolean true → ✓   boolean false → —   string → the string value

export type MatrixRow = {
  feature: string;
  tooltip?: string;
  free: MatrixCell;
  pro: MatrixCell;
  family: MatrixCell;
  teams: MatrixCell;
};

export type MatrixCategory = {
  category: string;
  rows: MatrixRow[];
};

export const FEATURE_MATRIX: MatrixCategory[] = [
  {
    category: "Core",
    rows: [
      { feature: "Contacts",          free: "100",        pro: "Unlimited", family: "Unlimited", teams: "Unlimited" },
      { feature: "Advanced search",   free: true,         pro: true,        family: true,        teams: true        },
      { feature: "Labels",            free: true,         pro: true,        family: true,        teams: true        },
      { feature: "Import (CSV/vCard)",free: true,         pro: true,        family: true,        teams: true        },
      { feature: "Export (GDPR)",     free: true,         pro: true,        family: true,        teams: true        },
      { feature: "Activity history",  free: "30 days",    pro: "Unlimited", family: "Unlimited", teams: "Unlimited" },
    ],
  },
  {
    category: "Sync",
    rows: [
      { feature: "CardDAV sync",      free: "1 account",  pro: "Unlimited", family: "Unlimited", teams: "Unlimited" },
      { feature: "Google Contacts",   free: false,        pro: true,        family: true,        teams: true        },
      { feature: "Outlook sync",      free: false,        pro: true,        family: true,        teams: true        },
      { feature: "iCloud sync",       free: "CardDAV",    pro: "CardDAV",   family: "CardDAV",   teams: "CardDAV"   },
    ],
  },
  {
    category: "Sharing",
    rows: [
      { feature: "Contact share links",    free: false, pro: true,  family: true,  teams: true  },
      { feature: "Public card (/u/name)",  free: true,  pro: true,  family: true,  teams: true  },
      { feature: "Family shared book",     free: false, pro: false, family: true,  teams: false },
      { feature: "Team shared book",       free: false, pro: false, family: false, teams: true  },
      { feature: "Role-based access",      free: false, pro: false, family: false, teams: true  },
    ],
  },
  {
    category: "Developer",
    rows: [
      { feature: "REST API access",   free: false, pro: true,        family: true,        teams: true        },
      { feature: "API rate limit",    free: "—",   pro: "1,000/day", family: "1,000/day", teams: "5,000/day" },
      { feature: "Webhooks",          free: false, pro: false,       family: false,       teams: false       },
    ],
  },
  {
    category: "Security",
    rows: [
      { feature: "2FA (TOTP)",        free: true,  pro: true,  family: true,  teams: true  },
      { feature: "Session management",free: true,  pro: true,  family: true,  teams: true  },
      { feature: "Audit log",         free: false, pro: false, family: false, teams: true  },
    ],
  },
  {
    category: "Support",
    rows: [
      { feature: "Email support",     free: false, pro: true,  family: true,  teams: true  },
      { feature: "Priority support",  free: false, pro: false, family: true,  teams: true  },
    ],
  },
];
```

### Table structure (desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│  Feature                   Free    Pro     Family   Teams         │
├──────────────────────────────────────────────────────────────────┤
│  CORE                                                            │
│  Contacts                  100     ∞       ∞        ∞            │
│  Advanced search            ✓      ✓       ✓        ✓            │
│  …                                                               │
├──────────────────────────────────────────────────────────────────┤
│  SYNC                                                            │
│  …                                                               │
└──────────────────────────────────────────────────────────────────┘
```

- `<table>` with `w-full text-left`.
- `<thead>`: sticky column header row with plan names. Uses `position: sticky;
  top: 64px` (below the sticky nav) so it stays visible when scrolling the
  table.
- Category rows: `<tr>` spanning all columns, `bg-[#f4f6f2]`, text
  `text-[11px] font-bold uppercase tracking-[0.1em] text-[#8b938c] py-2 px-4`.
- Data rows: alternating white / `bg-[#f4f6f2]/30` for readability.
- Cell width: feature column `min-w-[200px]`, plan columns `min-w-[100px]`.
- ✓ cells: `text-[#17352e]` Lucide `Check` icon (18px). `—` cells: `text-[#8b938c]`.
- String value cells: `text-[14px] text-[#1d2823]`.

### Mobile (< 768px)

**Option A (recommended)**: wrap the table in a `<div className="overflow-x-auto -mx-4">` container so it scrolls horizontally. Add a subtle fade-gradient on the right edge to indicate scroll.

**Option B (more work)**: collapse to an accordion — each plan gets a section with its own feature list. This is more readable on small screens but significantly more code. Implement Option A for launch; Option B is a post-launch improvement.

### Section heading

Above the table:

```tsx
<h2 className="text-[28px] font-bold text-[#17352e] mb-8 mt-20">
  Compare all features
</h2>
```

### Cell render helper

```tsx
function Cell({ value }: { value: MatrixCell }) {
  if (value === true)  return <Check size={18} className="text-[#17352e]" />;
  if (value === false || value === "—") return <span className="text-[#8b938c]">—</span>;
  return <span className="text-[14px] text-[#1d2823]">{value}</span>;
}
```

## Acceptance Criteria

- [ ] Matrix renders below the plan cards on `/pricing`.
- [ ] All 6 categories and all rows from `FEATURE_MATRIX` render.
- [ ] ✓ / — / string cells render correctly per the data.
- [ ] Category headers span the full table width and have the correct styling.
- [ ] Desktop: full-width table with sticky header row.
- [ ] Mobile: horizontally scrollable table with right-edge fade gradient.
- [ ] Webhooks row shows `—` for all plans (not yet shipped).
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Webhooks row**: included as `false` for all plans because webhooks are not
  yet shipped. If this is confusing ("why show it?"), remove the row pre-launch
  and add it back when webhooks ship.
- **iCloud sync cell**: iCloud is supported via CardDAV (same as Free plan's
  "1 account"). The "CardDAV" string in the cell should have a tooltip
  explaining this.
- **Sticky header**: `position: sticky` on `<thead>` requires the parent
  `<table>` to not have `overflow: hidden`. Verify this doesn't conflict with
  the horizontal-scroll wrapper.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: note that FEATURE_MATRIX is
      the canonical feature list used by the support team
- [x] Internal · engineering — docs/: document matrix-data.ts update process
