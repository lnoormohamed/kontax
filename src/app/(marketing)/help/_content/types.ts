// P50A-05 · Help centre content model.
//
// One typed module per category (./articles/*.ts) holds that category's
// articles and short answers. Text fields are plain strings with two bits of
// inline markup, rendered by ../_components/help-rich.tsx and stripped for
// search and JSON-LD by ./text.ts:
//
//   [label](/path)   internal or mailto link
//   **bold**         UI labels ("Settings → Security")
//   `code`           URLs and values to type
//
// Plan badges come from `plans` (PlanKey values from plan-data.ts) and every
// plan number in prose is interpolated from ./facts.ts — never typed by hand.

import type { PlanKey } from "~/app/_components/plan-data";

export type HelpCategoryId =
  | "getting-started"
  | "sync"
  | "contacts"
  | "organising"
  | "duplicates"
  | "import-export"
  | "sharing"
  | "notifications"
  | "family-teams"
  | "account-security"
  | "billing"
  | "developers";

/** A related link or legacy-anchor target, as "category/slug" (article) or "category" (category page). */
export type HelpRef = `${HelpCategoryId}/${string}` | HelpCategoryId;

export type HelpStep = {
  /** One instruction, imperative ("Open **Settings → Security**."). */
  text: string;
  /** Optional sub-points (field values, alternatives). */
  details?: readonly string[];
};

/** A free-form section for explainer/reference articles (tables, lists, paragraphs). */
export type HelpSection = {
  heading: string;
  paragraphs?: readonly string[];
  list?: readonly string[];
  table?: { head: readonly string[]; rows: readonly (readonly string[])[] };
};

export type HelpArticleContent = {
  slug: string;
  /** Task-phrased H1 ("Connect iCloud contacts to Kontax"). */
  title: string;
  category: HelpCategoryId;
  /** Who this is for, shown under the title ("Anyone syncing iCloud"). */
  audience: string;
  /** Plans the task is available on; rendered as badges from plan-data.ts. */
  plans: readonly PlanKey[];
  /** One-sentence answer shown under the H1, used for search and meta description. */
  summary: string;
  /** Numbered steps. Articles with steps also get HowTo structured data. */
  steps: readonly HelpStep[];
  /** Explainer/reference sections, rendered after the steps. */
  sections?: readonly HelpSection[];
  whatToExpect: readonly string[];
  ifItDoesntWork: readonly string[];
  /** 2–3 related articles. */
  related: readonly HelpRef[];
  /** ISO date the content was last checked against the product. */
  lastReviewed: string;
  /** Extra search terms that don't appear in the title or summary. */
  keywords?: readonly string[];
};

/** A short answer shown grouped on a category page (migrated FAQ items too small for an article). */
export type HelpShortAnswer = {
  q: string;
  a: string;
  /** Optional "Read more" link to an article. */
  more?: HelpRef;
  /** Only shown when Microsoft (Outlook) sync is configured — see ~/lib/microsoft-sync-flag. */
  requiresMicrosoftSync?: true;
};

export type HelpCategoryContent = {
  id: HelpCategoryId;
  title: string;
  /** One-line description for the hub card and meta description. */
  description: string;
  /** Launch priority from the ticket (P1 categories are listed first on the hub). */
  articles: readonly HelpArticleContent[];
  shortAnswers: readonly HelpShortAnswer[];
  /** Articles from other categories that belong on this page too. */
  alsoSee?: readonly HelpRef[];
};
