// P50A-04 — shared logic for checking public marketing page titles/descriptions.
//
// Used by scripts/check-marketing-titles.mjs (CLI) and
// tests/node/marketing-titles.test.ts (runs with `npm run test:repo`).
//
// This is deliberately a small regex-based reader, not a TypeScript/JSX
// parser: every page in scope declares `export const metadata: Metadata = {
// title: ..., description: ... }` in the same handful of shapes (a plain
// string, a `{ absolute: ... }` object that bypasses the layout's title
// template, or a top-level `const TITLE = "...";` referenced by name), so a
// targeted regex is enough and avoids a real TS parser as a dependency of a
// build-time check.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** @typedef {{ file: string, inMarketingGroup: boolean }} PageFile */
/** @typedef {{ value: string | null, isAbsolute: boolean }} MetadataField */
/** @typedef {{ file: string, title: string | null, description: string | null }} PageResult */

// Root layout (src/app/layout.tsx) applies "%s · Kontax" to any page that
// doesn't override the title template and sets a plain string/absolute
// title. The marketing layout (src/app/(marketing)/layout.tsx) overrides
// that to the identity template "%s" specifically so marketing page titles
// (which already end "— Kontax") aren't double-suffixed. `metadata.title:
// { absolute: ... }` bypasses both templates outright (used by the homepage
// and other pages that want a title unlike anything a template would build).
/** @param {string} title @returns {string} */
const ROOT_TITLE_TEMPLATE = (title) => `${title} · Kontax`;

// Every file below is a public marketing/content page with its own
// `export const metadata`. Not a live directory walk of all of `src/app`,
// which would also sweep up authenticated app pages, wireframes, and pages
// that deliberately have no page-level metadata (nothing to check there).
/** @param {string} rootDir @returns {PageFile[]} */
function marketingGroupFiles(rootDir) {
  const groupDir = path.join(rootDir, "src/app/(marketing)");
  /** @type {PageFile[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === "page.tsx") {
        out.push({ file: full, inMarketingGroup: true });
      }
    }
  };
  walk(groupDir);
  return out;
}

// Public content pages that live outside the (marketing) route group (so
// they get the ROOT title template, not the marketing group's identity one).
const EXTRA_PUBLIC_PAGES = ["src/app/help/page.tsx", "src/app/developers/page.tsx"];

/** @param {string} rootDir @returns {PageFile[]} */
export function findMarketingPageFiles(rootDir) {
  const extra = EXTRA_PUBLIC_PAGES.map((rel) => ({
    file: path.join(rootDir, rel),
    inMarketingGroup: false,
  })).filter(({ file }) => {
    try {
      return statSync(file).isFile();
    } catch {
      return false;
    }
  });
  return [...marketingGroupFiles(rootDir), ...extra];
}

/** @param {string} source @param {string} identifier @returns {string | null} */
function findConstString(source, identifier) {
  const re = new RegExp(`const\\s+${identifier}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const match = re.exec(source);
  return match?.[1] ?? null;
}

// Pulls the value assigned to `key` inside the first `export const metadata`
// object — a plain quoted string, or the quoted string held by an
// `{ absolute: ... }` wrapper (either inline or via a referenced constant).
/** @param {string} source @param {string} key @returns {MetadataField} */
function extractMetadataField(source, key) {
  const metadataStart = source.indexOf("export const metadata");
  if (metadataStart === -1) return { value: null, isAbsolute: false };
  const scoped = source.slice(metadataStart);

  const absoluteRe = new RegExp(`${key}\\s*:\\s*\\{\\s*absolute\\s*:\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|([A-Za-z_][A-Za-z0-9_]*))`);
  const absoluteMatch = absoluteRe.exec(scoped);
  if (absoluteMatch) {
    const value = absoluteMatch[1] ?? findConstString(source, absoluteMatch[2] ?? "");
    return { value, isAbsolute: true };
  }

  const stringRe = new RegExp(`\\b${key}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const stringMatch = stringRe.exec(scoped);
  if (stringMatch) return { value: stringMatch[1] ?? null, isAbsolute: false };

  const identRe = new RegExp(`\\b${key}\\s*:\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*[,}]`);
  const identMatch = identRe.exec(scoped);
  if (identMatch) return { value: findConstString(source, identMatch[1] ?? ""), isAbsolute: false };

  return { value: null, isAbsolute: false };
}

/**
 * @param {string} rootDir repo root
 * @returns {{ pages: PageResult[], violations: string[] }}
 */
export function checkMarketingTitles(rootDir) {
  const files = findMarketingPageFiles(rootDir);
  /** @type {PageResult[]} */
  const pages = [];
  /** @type {string[]} */
  const violations = [];

  for (const { file, inMarketingGroup } of files) {
    const rel = path.relative(rootDir, file);
    const source = readFileSync(file, "utf8");

    const titleField = extractMetadataField(source, "title");
    const descriptionField = extractMetadataField(source, "description");

    if (titleField.value === null) {
      violations.push(`${rel}: no "title" found in its metadata export`);
      pages.push({ file: rel, title: null, description: descriptionField.value });
      continue;
    }

    const effectiveTitle =
      titleField.isAbsolute || inMarketingGroup
        ? titleField.value
        : ROOT_TITLE_TEMPLATE(titleField.value);

    if (effectiveTitle.length > TITLE_MAX) {
      violations.push(
        `${rel}: title is ${effectiveTitle.length} chars (max ${TITLE_MAX}): "${effectiveTitle}"`,
      );
    }

    if (descriptionField.value === null) {
      violations.push(`${rel}: no "description" found in its metadata export`);
    } else if (descriptionField.value.length > DESCRIPTION_MAX) {
      violations.push(
        `${rel}: description is ${descriptionField.value.length} chars (max ${DESCRIPTION_MAX})`,
      );
    }

    pages.push({ file: rel, title: effectiveTitle, description: descriptionField.value });
  }

  /** @type {Map<string, string>} */
  const seenTitles = new Map();
  for (const page of pages) {
    if (page.title === null) continue;
    const owner = seenTitles.get(page.title);
    if (owner) {
      violations.push(`Duplicate title "${page.title}" on both ${owner} and ${page.file}`);
    } else {
      seenTitles.set(page.title, page.file);
    }
  }

  return { pages, violations };
}
