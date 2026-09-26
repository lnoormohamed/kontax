import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { GUIDE_PAGES, SECTION_INDEXES } from "../../src/app/(marketing)/guides/_content/pages";

// P50A-06: every guide / comparison page keeps its metadata within search
// limits, has 3+ internal links, and links only to routes that exist or to
// the help articles planned in P50A-05 (roadmap/build-phase/p50a-05-help-centre-split.md).

const ROOT = process.cwd();
const APP = path.join(ROOT, "src", "app");
const MARKETING = path.join(APP, "(marketing)");

// Help-centre articles from the P50A-05 IA (/help/{category}/{slug}), being
// built concurrently. Until P50A-05 ships these URLs are allowed here even
// though no page.tsx exists for them yet; once they exist they are also
// covered by the real-route check below.
const PLANNED_HELP_URLS = new Set([
  "/help/sync/connect-icloud-contacts",
  "/help/sync/connect-google-contacts",
  "/help/sync/connect-fastmail-contacts",
  "/help/sync/connect-android-davx5",
  "/help/sync/what-is-carddav",
  "/help/sync/app-password-problems",
  "/help/sync/duplicate-flood-after-first-sync",
  "/help/duplicates/merge-duplicate-contacts",
  "/help/duplicates/undo-a-merge",
  "/help/import-export/import-from-google-icloud",
  "/help/import-export/export-your-contacts",
  "/help/import-export/kontax-export-format",
  "/help/import-export/download-full-account-export",
  "/help/sharing/live-vs-static-sharing",
  "/help/family-teams/set-up-family-sharing",
  "/help/family-teams/family-vs-teams",
  "/help/account-security/delete-your-account",
]);

/** Static routes from every page.tsx under src/app (route groups stripped). */
function collectRoutes(dir: string, segments: string[] = [], out = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith("_") || entry.startsWith("[")) continue; // private / dynamic
      const seg = entry.startsWith("(") && entry.endsWith(")") ? [] : [entry];
      collectRoutes(full, [...segments, ...seg], out);
    } else if (entry === "page.tsx") {
      out.add(`/${segments.join("/")}`);
    }
  }
  return out;
}

const ROUTES = collectRoutes(APP);

/** Internal hrefs in a page source: href="/…" and href: "/…" (hash and query dropped). */
function internalLinks(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/href(?:=\{?|:\s*)["'`](\/[^"'`]*)["'`]/g)) {
    const target = m[1]!.split("#")[0]!.split("?")[0]!;
    found.add(target === "" ? "/" : target);
  }
  return [...found];
}

const pageFile = (urlPath: string) => path.join(MARKETING, ...urlPath.split("/").filter(Boolean), "page.tsx");

const ALL = [...GUIDE_PAGES, ...Object.values(SECTION_INDEXES)];

test("every guide, comparison and index page has a page.tsx", () => {
  for (const p of ALL) assert.ok(existsSync(pageFile(p.path)), `missing ${pageFile(p.path)}`);
  assert.equal(GUIDE_PAGES.length, 8);
});

test("metadata titles are ≤ 60 chars and descriptions ≤ 160 chars", () => {
  for (const p of ALL) {
    assert.ok(p.title.length > 0 && p.title.length <= 60, `${p.path} title is ${p.title.length} chars`);
    assert.ok(
      p.description.length >= 70 && p.description.length <= 160,
      `${p.path} description is ${p.description.length} chars`,
    );
    assert.ok(p.h1.length > 0, `${p.path} has an H1`);
  }
});

test("titles, descriptions and paths are unique", () => {
  for (const key of ["title", "description", "path", "h1"] as const) {
    const values = ALL.map((p) => p[key]);
    assert.equal(new Set(values).size, values.length, `duplicate ${key}`);
  }
});

test("each page has 3+ internal links, all to real routes or planned help articles", () => {
  for (const p of ALL) {
    const links = internalLinks(readFileSync(pageFile(p.path), "utf8"));
    assert.ok(links.length >= 3, `${p.path} has only ${links.length} internal links`);
    for (const href of links) {
      assert.ok(
        ROUTES.has(href) || PLANNED_HELP_URLS.has(href),
        `${p.path} links to ${href}, which is neither a route nor a planned P50A-05 help article`,
      );
    }
  }
});

test("planned help URLs follow the P50A-05 /help/{category}/{slug} shape", () => {
  const categories = new Set([
    "getting-started",
    "sync",
    "contacts",
    "organising",
    "duplicates",
    "import-export",
    "sharing",
    "family-teams",
    "account-security",
    "billing",
    "developers",
  ]);
  for (const url of PLANNED_HELP_URLS) {
    const [, help, category, slug, extra] = url.split("/");
    assert.equal(help, "help");
    assert.ok(categories.has(category!), `${url}: unknown category`);
    assert.match(slug!, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(extra, undefined);
  }
});

test("page copy avoids claims that are not true of Kontax today", () => {
  // P50-DB01 fact list: no Outlook, webhooks, testimonials, user counts,
  // uptime, backup encryption or automatic trial.
  const banned = [/outlook/i, /webhook/i, /testimonial/i, /uptime/i, /encrypted backup/i, /backup encryption/i, /free trial/i, /trusted by/i];
  const files = [
    ...ALL.map((p) => pageFile(p.path)),
    path.join(MARKETING, "guides", "_components", "guide-article.tsx"),
    path.join(MARKETING, "guides", "_content", "pages.ts"),
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const re of banned) assert.ok(!re.test(source), `${path.relative(ROOT, file)} matches ${re}`);
  }
});
