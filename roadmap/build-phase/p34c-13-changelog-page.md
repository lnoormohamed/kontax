# P34C-13 — /changelog Page

## Purpose

Create `src/app/(marketing)/changelog/page.tsx` — a manually maintained list
of product releases in reverse chronological order. Gives users, developers,
and potential customers a clear picture of how actively Kontax is developed and
what has changed recently.

## Background

A changelog is one of the highest-trust signals for developer-adjacent users
(the developer API audience in particular). It also reduces support questions
about new features and gives press/influencers something to reference when
writing about the product.

The content is stored in a data file (`entries.ts`) so non-technical team
members can add entries by editing a TypeScript constant without touching any
JSX. P34C-DB03 specifies the visual design.

## Scope

**In scope**
- `src/app/(marketing)/changelog/page.tsx`.
- `src/app/(marketing)/changelog/entries.ts` — the data file.
- `<MarketingNav>` and `<MarketingFooter>` via the shared layout.
- Seed entries for Phase 33, Phase 31B, Phase 30, and Phase 29.
- Static rendering — the changelog is read at build time from the data file.

**Out of scope**
- RSS feed for the changelog (post-launch improvement).
- Filtering by category or version.
- Per-release anchor URLs (nice to have, but not required for launch).
- Automatic detection of git tags or commits (manual curation only).

## Design / Implementation Spec

### Data file structure

```ts
// src/app/(marketing)/changelog/entries.ts

export type ChangelogCategory = "Added" | "Improved" | "Fixed" | "Security";

export type ChangelogEntry = {
  version: string;          // e.g. "Phase 33"
  date: string;             // ISO 8601: "2026-05-20"
  title: string;            // e.g. "Search experience upgrade"
  changes: {
    category: ChangelogCategory;
    items: string[];
  }[];
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "Phase 33",
    date: "2026-05-20",
    title: "Search experience upgrade",
    changes: [
      {
        category: "Added",
        items: [
          "Grouped search results — matches organised by contact name, email, phone, company, label, and notes",
          "Match-field highlighting — the matching text is highlighted in each result row",
          "Labels are now searchable — search by label name to find all contacts with that label",
          "Unified search core — desktop and mobile search now use the same engine",
        ],
      },
      {
        category: "Improved",
        items: [
          "Phone number search now works for partial number strings (e.g. searching '7700' finds numbers containing it)",
          "Search results load faster on large contact lists",
        ],
      },
      {
        category: "Fixed",
        items: [
          "Search no longer returns different results on mobile vs desktop for the same query",
        ],
      },
    ],
  },
  {
    version: "Phase 31B",
    date: "2026-04-10",
    title: "Labels",
    changes: [
      {
        category: "Added",
        items: [
          "Label registry — create and manage labels across your contacts from Settings → Labels",
          "Label chips on the contacts list and contact detail page",
          "Filter the contacts list by one or more labels",
          "Labels sync to CardDAV and Google Contacts as categories",
        ],
      },
    ],
  },
  {
    version: "Phase 30",
    date: "2026-02-28",
    title: "Public contact card",
    changes: [
      {
        category: "Added",
        items: [
          "Public contact card at /u/yourname — share your contact details without an account",
          "One-tap vCard download from the public card page",
          "QR code for the public card in Settings → Public card",
          "Custom username selection in Settings → Public card",
        ],
      },
      {
        category: "Improved",
        items: [
          "Share link for individual contacts redesigned with a live preview",
        ],
      },
    ],
  },
  {
    version: "Phase 29",
    date: "2026-01-15",
    title: "Developer REST API",
    changes: [
      {
        category: "Added",
        items: [
          "REST API at api.getkontax.com/v1 — CRUD for contacts, labels, and sync accounts",
          "API token management in Settings → API",
          "Per-token rate limiting (1,000 requests/day on Pro, 5,000 on Teams)",
          "API reference documentation at /developers",
        ],
      },
    ],
  },
];
```

### Page layout (desktop)

```
┌──────────────────────────────────────────────────────────────┐
│  "What's new in Kontax"  (page heading, 38px bold, #17352e) │
│  "Every update, in order."  (sub-copy, 17px muted)           │
│                                                              │
│  ─── 2026-05-20 ──────────────────────────────────────────  │
│  Phase 33 · Search experience upgrade                        │
│                                                              │
│  Added                                                       │
│  • Grouped search results …                                  │
│  • Match-field highlighting …                                │
│                                                              │
│  Improved                                                    │
│  • Phone number search …                                     │
│                                                              │
│  Fixed                                                       │
│  • Search no longer returns …                                │
│                                                              │
│  ─── 2026-04-10 ──────────────────────────────────────────  │
│  Phase 31B · Labels                                          │
│  …                                                           │
└──────────────────────────────────────────────────────────────┘
```

Two-column on desktop: date left (fixed `w-40`), content right. Single column
on mobile.

### Date column (desktop `≥ 768px`)

```tsx
<aside className="hidden md:block w-40 shrink-0 pt-1 text-right pr-8">
  <time
    dateTime={entry.date}
    className="text-[14px] text-[#8b938c] font-mono"
  >
    {formatDate(entry.date)} {/* e.g. "20 May 2026" */}
  </time>
</aside>
```

On mobile, date appears above the version/title heading.

### Category badge

```tsx
const CATEGORY_STYLES: Record<ChangelogCategory, string> = {
  Added:    "bg-[#eef5ef] text-[#17352e]",
  Improved: "bg-[#edf2ff] text-[#4158f4]",
  Fixed:    "bg-[#fef3e2] text-[#8a5f0a]",
  Security: "bg-[#fde8e8] text-[#b5472f]",
};

function CategoryBadge({ category }: { category: ChangelogCategory }) {
  return (
    <span className={`inline-block text-[11px] font-bold uppercase
                      tracking-[0.1em] rounded-[6px] px-2 py-1
                      ${CATEGORY_STYLES[category]}`}>
      {category}
    </span>
  );
}
```

### Entry version/title

```tsx
<h2 className="text-[20px] font-bold text-[#1d2823] mb-4">
  <span className="text-[#8b938c] font-normal text-[15px] mr-2">
    {entry.version}
  </span>
  {entry.title}
</h2>
```

### Item list

```tsx
<ul className="mt-2 space-y-1.5 ml-4">
  {change.items.map((item, j) => (
    <li key={j} className="text-[15px] text-[#5c655e] leading-[1.6]
                           list-disc list-outside">
      {item}
    </li>
  ))}
</ul>
```

### SEO

```tsx
export const metadata: Metadata = {
  title: "Changelog | Kontax",
  description:
    "Every Kontax update, in order — new features, improvements, and fixes.",
};
```

## Acceptance Criteria

- [ ] Page exists at `/changelog` and renders via the `(marketing)` layout.
- [ ] All four seed entries (P33, P31B, P30, P29) render in reverse
      chronological order.
- [ ] Each entry shows: date, version, title, category badges, and bullet lists.
- [ ] Category badges use correct colours (Added green, Improved blue,
      Fixed amber, Security red).
- [ ] Desktop: two-column date-left layout. Mobile: stacked.
- [ ] `metadata` title and description are set.
- [ ] `tsc --noEmit` passes.
- [ ] Adding a new entry to `CHANGELOG_ENTRIES` causes it to appear on the page
      without any JSX changes (only the data file changes).

## Risks / Open Questions

- **Date accuracy**: the seed entry dates above are approximate. Verify the
  actual ship dates from git history before publishing.
- **"Phase N" versioning**: the version labels use internal phase names that
  may not be meaningful to users. Consider adding a user-facing version number
  (e.g. "v1.4") in a follow-up. For launch, the phase names are acceptable.
- **RSS**: a frequent request from developer users. Implement as a follow-up
  (`/changelog/feed.xml`) rather than blocking launch.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: add a "How to add a changelog
      entry" runbook (edit entries.ts → commit → deploy)
- [x] Internal · engineering — docs/: document the entries.ts format and the
      category types
