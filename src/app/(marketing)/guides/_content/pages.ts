/**
 * P50A-06 · Registry of the guide and comparison pages.
 *
 * One entry per URL: the metadata title (≤ 60 chars) and description
 * (≤ 160 chars), the task-phrased H1, the breadcrumb name and the index-card
 * summary. Pages read their metadata from here, the /guides and /compare
 * index pages list from here, and tests/node/guides-and-comparisons.test.ts
 * checks the limits and every internal link on each page.
 *
 * Plain TS (no JSX, no Next imports) so the node test can import it.
 */

export type GuideSectionKey = "guides" | "compare";

export type GuidePage = {
  section: GuideSectionKey;
  /** Absolute path, e.g. "/guides/what-is-carddav". */
  path: string;
  /** <title> — absolute, ≤ 60 characters. */
  title: string;
  /** Meta description, ≤ 160 characters. */
  description: string;
  /** The page's single H1, phrased as the task or question. */
  h1: string;
  /** Short name for the breadcrumb trail. */
  crumb: string;
  /** One or two sentences for the index card. */
  summary: string;
};

export type GuideSectionIndex = {
  section: GuideSectionKey;
  path: string;
  title: string;
  description: string;
  h1: string;
  crumb: string;
  lede: string;
};

/**
 * "Last reviewed" date shown on every page and used as the Article
 * dateModified. Update it whenever a page's facts are re-checked.
 */
export const LAST_REVIEWED_ISO = "2026-09-25";
export const LAST_REVIEWED_LABEL = "25 September 2026";
/** First publication of this set of pages (Article datePublished). */
export const FIRST_PUBLISHED_ISO = "2026-09-25";
/** When Apple and Google product details were last checked against their help pages. */
export const THIRD_PARTY_CHECKED_LABEL = "September 2026";

export const SECTION_INDEXES: Record<GuideSectionKey, GuideSectionIndex> = {
  guides: {
    section: "guides",
    path: "/guides",
    title: "Contact guides: sync, duplicates and export — Kontax",
    description:
      "Practical guides to syncing iCloud and Google contacts, merging duplicates on iPhone, exporting contacts, CardDAV and sharing contacts with family.",
    h1: "Guides to keeping your contacts in order",
    crumb: "Guides",
    lede: "Step-by-step answers for the jobs people search for most. Each one starts with what you can do with the tools you already have, then says where Kontax helps.",
  },
  compare: {
    section: "compare",
    path: "/compare",
    title: "Compare Kontax, iCloud Contacts and Google Contacts",
    description:
      "Honest, dated comparisons of Kontax, iCloud Contacts and Google Contacts: what each does well, where each stops, and when you don’t need Kontax.",
    h1: "Honest comparisons",
    crumb: "Compare",
    lede: "Factual, dated comparisons. Each one says what the other product does well and when you don’t need Kontax at all.",
  },
};

export const GUIDE_PAGES: readonly GuidePage[] = [
  {
    section: "guides",
    path: "/guides/sync-icloud-and-google-contacts",
    title: "How to sync iCloud and Google contacts — Kontax",
    description:
      "Three honest ways to get iCloud and Google contacts in step: a one-off vCard copy, both accounts on your iPhone, or one address book that syncs with both.",
    h1: "How to sync iCloud and Google contacts",
    crumb: "Sync iCloud and Google contacts",
    summary: "A one-off vCard copy, both accounts side by side on your iPhone, or one address book that syncs with both.",
  },
  {
    section: "guides",
    path: "/guides/merge-duplicate-contacts-iphone",
    title: "How to merge duplicate contacts on iPhone — Kontax",
    description:
      "Merge duplicate contacts with the iPhone’s built-in View Duplicates, link the ones it misses, tidy Google and iCloud copies, and undo a merge if you need to.",
    h1: "How to merge duplicate contacts on iPhone",
    crumb: "Merge duplicate contacts on iPhone",
    summary: "Use the built-in merge first, then deal with copies spread across Google and iCloud, and how to undo.",
  },
  {
    section: "compare",
    path: "/compare/kontax-vs-icloud-contacts",
    title: "Kontax vs iCloud Contacts: an honest comparison",
    description:
      "Kontax and iCloud Contacts side by side, checked September 2026: where iCloud is all you need, what Kontax adds, and how to move over or leave.",
    h1: "Kontax vs iCloud Contacts",
    crumb: "Kontax vs iCloud Contacts",
    summary: "Use iCloud if everything you own is Apple. Use Kontax if your contacts also live elsewhere or you want to share them.",
  },
  {
    section: "compare",
    path: "/compare/kontax-vs-google-contacts",
    title: "Kontax vs Google Contacts: an honest comparison",
    description:
      "Kontax and Google Contacts side by side, checked September 2026: where Google Contacts is all you need, what Kontax adds, and how to move over or leave.",
    h1: "Kontax vs Google Contacts",
    crumb: "Kontax vs Google Contacts",
    summary: "Google Contacts is hard to beat on Android. Kontax is for address books spread across more than one provider.",
  },
  {
    section: "guides",
    path: "/guides/what-is-carddav",
    title: "What is CardDAV? A plain-English guide — Kontax",
    description:
      "CardDAV is the open standard that syncs contacts between servers and devices. What it is, who supports it, how to set it up on iPhone, Mac and Android.",
    h1: "What is CardDAV?",
    crumb: "What is CardDAV?",
    summary: "The open standard behind contact sync: what it is, who supports it and why app passwords matter.",
  },
  {
    section: "guides",
    path: "/guides/export-contacts",
    title: "How to export contacts from iPhone, Google or iCloud",
    description:
      "Export your contacts from iPhone, Google Contacts, iCloud.com or a Mac as vCard or CSV, choose the right format, and import the file somewhere else.",
    h1: "How to export your contacts from iPhone, Google and iCloud",
    crumb: "Export your contacts",
    summary: "Step-by-step exports from iPhone, Google, iCloud.com and Mac, and which format to choose.",
  },
  {
    section: "compare",
    path: "/compare/google-contacts-vs-icloud",
    title: "Google Contacts vs iCloud Contacts: which to use?",
    description:
      "A neutral comparison of Google Contacts and iCloud Contacts, checked September 2026: devices, limits, duplicates, undo, export and sharing.",
    h1: "Google Contacts vs iCloud Contacts",
    crumb: "Google Contacts vs iCloud",
    summary: "A neutral head-to-head: which one suits your devices, and what to do if you need both.",
  },
  {
    section: "guides",
    path: "/guides/share-contacts-with-family-iphone",
    title: "How to share contacts with family on iPhone — Kontax",
    description:
      "Every way to share contacts with your family on iPhone: Share Contact, AirDrop, NameDrop, a shared account, or a shared family address book.",
    h1: "How to share contacts with your family on iPhone",
    crumb: "Share contacts with family on iPhone",
    summary: "Send one card, swap details with NameDrop, or keep a shared family address book everyone can edit.",
  },
];

export function getGuidePage(path: string): GuidePage {
  const page = GUIDE_PAGES.find((p) => p.path === path);
  if (!page) throw new Error(`Unknown guide page: ${path}`);
  return page;
}

export function pagesInSection(section: GuideSectionKey): GuidePage[] {
  return GUIDE_PAGES.filter((p) => p.section === section);
}
