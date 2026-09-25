// P50A-05 · Help centre registry: categories in hub order, lookups and refs.

import { ACCOUNT_SECURITY } from "./articles/account-security";
import { BILLING } from "./articles/billing";
import { CONTACTS } from "./articles/contacts";
import { DEVELOPERS } from "./articles/developers";
import { DUPLICATES } from "./articles/duplicates";
import { FAMILY_TEAMS } from "./articles/family-teams";
import { GETTING_STARTED } from "./articles/getting-started";
import { IMPORT_EXPORT } from "./articles/import-export";
import { NOTIFICATIONS } from "./articles/notifications";
import { ORGANISING } from "./articles/organising";
import { SHARING } from "./articles/sharing";
import { SYNC } from "./articles/sync";
import { toPlainText } from "./text";
import type {
  HelpArticleContent,
  HelpCategoryContent,
  HelpCategoryId,
  HelpRef,
  HelpShortAnswer,
} from "./types";

export type { HelpArticleContent, HelpCategoryContent, HelpCategoryId, HelpRef, HelpShortAnswer };

/** Hub order: launch-critical (P1) categories first. */
export const HELP_CATEGORIES: readonly HelpCategoryContent[] = [
  GETTING_STARTED,
  SYNC,
  DUPLICATES,
  IMPORT_EXPORT,
  ACCOUNT_SECURITY,
  FAMILY_TEAMS,
  CONTACTS,
  ORGANISING,
  SHARING,
  NOTIFICATIONS,
  BILLING,
  DEVELOPERS,
];

export const HELP_ROOT = "/help";

export const categoryHref = (id: HelpCategoryId) => `${HELP_ROOT}/${id}`;
export const articleHref = (a: Pick<HelpArticleContent, "category" | "slug">) =>
  `${HELP_ROOT}/${a.category}/${a.slug}`;

export function getCategory(id: string): HelpCategoryContent | undefined {
  return HELP_CATEGORIES.find((c) => c.id === id);
}

export function getArticle(category: string, slug: string): HelpArticleContent | undefined {
  return getCategory(category)?.articles.find((a) => a.slug === slug);
}

export function allArticles(): HelpArticleContent[] {
  return HELP_CATEGORIES.flatMap((c) => [...c.articles]);
}

/** Resolve a "category/slug" or "category" ref to its URL and title; undefined if it doesn't exist. */
export function resolveRef(ref: HelpRef): { href: string; title: string; summary: string } | undefined {
  const [cat, slug] = ref.split("/");
  if (!cat) return undefined;
  if (slug === undefined) {
    const c = getCategory(cat);
    return c ? { href: categoryHref(c.id), title: c.title, summary: c.description } : undefined;
  }
  const a = getArticle(cat, slug);
  return a ? { href: articleHref(a), title: a.title, summary: toPlainText(a.summary) } : undefined;
}

/** Short answers visible on this deployment (Outlook items only when Microsoft sync is configured). */
export function visibleShortAnswers(
  category: HelpCategoryContent,
  microsoftSyncEnabled: boolean,
): HelpShortAnswer[] {
  return category.shortAnswers.filter((s) => microsoftSyncEnabled || !s.requiresMicrosoftSync);
}

export type HelpSearchEntry = {
  href: string;
  title: string;
  summary: string;
  category: string;
  /** Lower-cased haystack: title + summary + keywords. */
  text: string;
};

/** Client-side search index over article titles and summaries (plus a few keywords). */
export function buildSearchIndex(): HelpSearchEntry[] {
  return HELP_CATEGORIES.flatMap((c) =>
    c.articles.map((a) => {
      const summary = toPlainText(a.summary);
      return {
        href: articleHref(a),
        title: a.title,
        summary,
        category: c.title,
        text: [a.title, summary, ...(a.keywords ?? [])].join(" ").toLowerCase(),
      };
    }),
  );
}

/** Launch-critical tasks surfaced on the hub. */
export const TOP_TASKS: readonly HelpRef[] = [
  "sync/connect-iphone-or-mac",
  "sync/connect-icloud-contacts",
  "sync/connect-google-contacts",
  "sync/fix-sync-not-working",
  "duplicates/merge-duplicate-contacts",
  "import-export/import-from-google-icloud",
  "import-export/export-your-contacts",
  "account-security/set-up-two-factor-authentication",
];
