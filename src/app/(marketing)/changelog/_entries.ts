// Shared changelog content — consumed by both the /changelog page and the
// /changelog.xml RSS feed (src/app/changelog.xml/route.ts) so the two never
// drift apart. Release-figure mockups (the little product screenshots) are
// presentational only and stay hand-written in page.tsx; everything that is
// actual changelog *content* lives here.
//
// To ship a new release: add an entry to the FRONT of CHANGELOG_ENTRIES below,
// then (if this one has a release figure) add the JSX for it in page.tsx's
// FIGURES map, keyed by the entry's `id`.

export type ChangelogCategoryLabel = "Added" | "Improved" | "Fixed" | "Security";

export interface ChangelogCategory {
  label: ChangelogCategoryLabel;
  items: string[];
}

export interface ChangelogEntry {
  /** Stable slug, also used as the RSS item guid and as an anchor id. */
  id: string;
  version: string;
  /** ISO date (yyyy-mm-dd), used for <time dateTime> and RSS pubDate. */
  date: string;
  /** Human-readable date matching `date`, e.g. "28 May 2026". */
  displayDate: string;
  title: string;
  /** Optional lede shown only on headline (figure) releases. */
  summary?: string;
  categories: ChangelogCategory[];
  /** True when this release has a hand-drawn figure mock in page.tsx. */
  hasFigure?: boolean;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: "v3.3",
    version: "v3.3",
    date: "2026-05-28",
    displayDate: "28 May 2026",
    title: "Search experience upgrade",
    categories: [
      {
        label: "Added",
        items: [
          "Search results are now grouped by match type — name, email, phone, label, and note.",
          "Full keyboard navigation through the search dropdown, with Enter to open.",
        ],
      },
      {
        label: "Improved",
        items: [
          "Search now matches inside notes and company names, not just names.",
          "The exact matched text is highlighted in every result.",
        ],
      },
      {
        label: "Fixed",
        items: [
          'Diacritic-insensitive matching — searching "Perez" now finds "Pérez".',
        ],
      },
    ],
  },
  {
    id: "v3.2",
    version: "v3.2",
    date: "2026-05-09",
    displayDate: "9 May 2026",
    title: "Shared address books & roles",
    summary:
      "Our biggest release this quarter: Family and Teams plans can now share a single address book, with roles that decide who can change what.",
    hasFigure: true,
    categories: [
      {
        label: "Added",
        items: [
          "Shared address books for Family and Teams plans.",
          "Owner, Editor, and Viewer roles with per-book permissions.",
        ],
      },
      {
        label: "Improved",
        items: [
          "Live updates across members — fix a number once and everyone sees it.",
        ],
      },
      {
        label: "Security",
        items: [
          "Share invitations now expire after 7 days and can only be used once.",
        ],
      },
    ],
  },
  {
    id: "v3.1",
    version: "v3.1",
    date: "2026-04-21",
    displayDate: "21 Apr 2026",
    title: "Two-way sync",
    summary:
      "Connect Google and Outlook and Kontax now keeps both sides in step — edits flow in both directions, with a clear status on every connection.",
    hasFigure: true,
    categories: [
      {
        label: "Added",
        items: [
          "Two-way sync for Google Contacts and Outlook.",
          "Per-connection sync status and last-synced time on the Sync page.",
        ],
      },
      {
        label: "Improved",
        items: [
          "Delta sync via CardDAV sync-tokens — far less bandwidth on large books.",
        ],
      },
      {
        label: "Security",
        items: [
          "CardDAV app passwords now revoke immediately, on the client's next request.",
        ],
      },
    ],
  },
  {
    id: "v3.0",
    version: "v3.0",
    date: "2026-04-02",
    displayDate: "2 Apr 2026",
    title: "Merge duplicates & mobile app",
    categories: [
      {
        label: "Added",
        items: [
          "Duplicate detection with a side-by-side merge review.",
          "Installable mobile PWA with offline access to your contacts.",
        ],
      },
      {
        label: "Improved",
        items: [
          "Import mapping now remembers your column choices between files.",
        ],
      },
      {
        label: "Fixed",
        items: [
          "vCard import no longer drops additional phone numbers on some contacts.",
        ],
      },
    ],
  },
];
