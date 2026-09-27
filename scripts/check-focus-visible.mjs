#!/usr/bin/env node
// P49A-20: static guard against reintroducing invisible keyboard focus.
//
// A bare `outline-none` (Tailwind) or `outline: none` / `outline-style: none`
// (CSS/inline style) removes the browser's default focus ring. That's fine
// when something else takes its place — a `focus:`/`focus-visible:`/
// `focus-within:` companion class, the shared `kx-focus-visible` utility
// (src/styles/globals.css), a `has-[:focus-visible]` ring on a wrapper, or a
// CSS `:focus`/`:focus-visible`/`:focus-within` rule on the same selector
// elsewhere in the file — but plenty of inline-edit inputs across the app
// removed it with nothing to replace it (P49A-20, split from P49A-17), so
// keyboard users had no idea where they were while editing a contact,
// merging, bulk-editing, importing, or configuring a sync connection.
//
// This script scans `src` for `outline-none` / `outline: none` and flags any
// occurrence it can't verify has a replacement, the same way
// scripts/check-session-guard.mjs flags raw `await auth()` calls: a plain
// regex sweep plus a small, justified, documented ALLOWLIST for cases this
// script's simple heuristics can't see (an ancestor wrapper's focus ring, an
// imperative onFocus/onBlur handler, a CSS-in-JS template literal). It is
// not a full CSS/JSX parser, deliberately — see the two check functions
// below for exactly what it can and can't verify on its own.
//
// Run: node scripts/check-focus-visible.mjs   (wired as `npm run check:focus-visible`)

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const OUTLINE_NONE = /\boutline-none\b|outline(?:-style)?\s*:\s*["'`]?none["'`]?/;
const COMPANION_TOKEN = /focus-visible:|focus-within:|focus:|has-\[:focus-visible\]|kx-focus-visible/;

/**
 * Exact, documented exceptions this script's line/selector heuristics can't
 * verify on their own. Each entry is a (relative file path, distinctive
 * substring of the violating line) pair — matched by substring, not line
 * number, so it survives unrelated edits shifting line numbers. Keep this
 * list small and justify every entry; anything else that adds `outline-none`
 * / `outline: none` without a same-line or same-selector companion should be
 * routed through the shared `.kx-focus-visible` class (src/styles/globals.css)
 * or a `has-[:focus-visible]` wrapper ring instead.
 */
const ALLOWLIST = [
  {
    file: "src/app/_components/search-input.tsx",
    match: "data-search-input",
    reason:
      "the <input> itself has no border to recolour; the ancestor wrapper div carries " +
      "has-[:focus-visible]:border-[#4158f4] has-[:focus-visible]:shadow-[...] (P49A-17).",
  },
  {
    file: "src/app/_components/phone-country-input.tsx",
    match: "numberInputClassName ??",
    reason:
      "default fallback className for the number input, which sits flush against this " +
      "component's overflow-hidden wrapper — a direct outline would get clipped, so the " +
      "wrapper carries has-[:focus-visible]:border-[#4158f4] instead (P49A-20).",
  },
  {
    file: "src/app/_components/create-contact-form.tsx",
    match: 'numberInputClassName="h-[42px]',
    reason:
      "call-site override of PhoneCountryInput's number input — covered by the same " +
      "wrapper ring documented in phone-country-input.tsx (P49A-20).",
  },
  {
    file: "src/app/settings/account/username-section.tsx",
    match: "border-none bg-transparent py-0 pr-3 text-[14px] font-semibold",
    reason:
      "the <input> sits flush against this section's overflow-hidden wrapper — a direct " +
      "outline would get clipped, so the wrapper carries has-[:focus-visible]:border-[#4158f4] " +
      "instead (P49A-20).",
  },
  {
    file: "src/app/_components/labels-manage-modal.tsx",
    match: "onFocus={(e) => e.currentTarget.style.borderColor",
    reason:
      "imperative onFocus/onBlur handlers swap the border colour on real focus — a genuine " +
      "(if not :focus-visible-scoped) replacement indicator, pre-dating P49A-20.",
  },
  {
    file: "src/app/_components/auth-card.tsx",
    match: "outline-none transition-[border-color,box-shadow] placeholder:text-[#aab1a9]",
    reason:
      "focus:border-[...] / focus:shadow-[...] are applied by a ternary two lines below this " +
      "one, inside the same multi-line className template literal.",
  },
  {
    file: "src/app/_components/mobile-contact-sheet.tsx",
    match: "outline:none; line-height:1.35;",
    reason:
      "CSS-in-JS template literal (STYLES) this script doesn't parse as CSS — .mcs-input:focus " +
      "a few lines down sets border-color/background/box-shadow on the same selector.",
  },
  {
    file: "src/app/_components/mobile-contact-sheet.tsx",
    match: "outline:none; -webkit-appearance:none; flex:0 0 auto;",
    reason:
      "same CSS-in-JS block as above — .mcs-pill:focus sets border-color on the same selector.",
  },
  {
    file: "src/app/admin/admin.css",
    match: ".ad-search-input {",
    reason: "borderless input inside .ad-search-bar, which has :focus-within { border-color, box-shadow }.",
  },
  {
    file: "src/app/admin/admin.css",
    match: ".ad-filter-search input {",
    reason: "borderless input inside .ad-filter-search, which has :focus-within { border-color, box-shadow }.",
  },
  {
    file: "src/app/admin/admin.css",
    match: ".ad-header-search__input {",
    reason: "borderless input inside .ad-header-search, which has :focus-within { border-color, box-shadow } (P49A-20).",
  },
  {
    file: "src/app/admin/admin.css",
    match: ".ad-select {",
    reason: "borderless select inside .ad-select-wrap, which has :focus-within { border-color, box-shadow } (P49A-20).",
  },
  {
    file: "src/app/(marketing)/help/help.css",
    match: ".hc-search__box input {",
    reason:
      "covered by the marketing site's global `.mkt-wrap :focus-visible { outline: 2px solid " +
      "var(--mkt-focus); ... }` catch-all (marketing.css), which outranks this rule's specificity.",
  },
];

function isAllowlisted(relPath, line) {
  return ALLOWLIST.find((entry) => entry.file === relPath && line.includes(entry.match));
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(tsx?|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * TS/TSX: a violation is safe when a focus companion token (`focus:`,
 * `focus-visible:`, `focus-within:`, `has-[:focus-visible]`, or the shared
 * `kx-focus-visible` class) appears anywhere within the *same JSX element* —
 * not just the same line, since `className` and `style={{ outline: "none" }}`
 * are frequently separate attributes on separate lines of one multi-line
 * element. The element's span is approximated by walking backward to the
 * nearest `<Tag` line and forward to the nearest self-closing `/>` or a lone
 * `>` (bounded to 40 lines either way) — good enough for this codebase's
 * formatting without a real JSX parser. Comments are stripped first so a
 * comment that merely *mentions* `outline-none` (like the ones in this
 * script, or explanatory comments left at a fix site) can't itself satisfy —
 * or accidentally trip — the check.
 */
function stripComments(lines) {
  let inBlock = false;
  return lines.map((line) => {
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end === -1) return "";
      inBlock = false;
      return line.slice(end + 2);
    }
    const blockStart = line.indexOf("/*");
    // A `//` preceded by `:` is almost always a URL scheme (`https://…`),
    // not a line comment — cheap enough to avoid a real JSX/TS tokenizer.
    const lineCommentMatch = line.match(/(?<!:)\/\//);
    const lineCommentIdx = lineCommentMatch ? lineCommentMatch.index : -1;
    if (blockStart !== -1 && (lineCommentIdx === -1 || blockStart < lineCommentIdx)) {
      const end = line.indexOf("*/", blockStart + 2);
      if (end === -1) {
        inBlock = true;
        return line.slice(0, blockStart);
      }
      return line.slice(0, blockStart) + line.slice(end + 2);
    }
    if (lineCommentIdx !== -1) return line.slice(0, lineCommentIdx);
    return line;
  });
}

function elementBounds(lines, idx) {
  const LOOKAROUND = 40;
  let start = idx;
  while (start > 0 && idx - start < LOOKAROUND && !/^\s*</.test(lines[start])) start--;
  let end = idx;
  while (end < lines.length - 1 && end - idx < LOOKAROUND && !/\/>\s*$|^\s*>\s*$/.test(lines[end])) end++;
  return [start, end];
}

function checkScriptFile(file, relPath, violations) {
  const rawLines = readFileSync(file, "utf8").split("\n");
  const codeLines = stripComments(rawLines);

  codeLines.forEach((line, idx) => {
    if (!OUTLINE_NONE.test(line)) return;
    const [start, end] = elementBounds(codeLines, idx);
    const elementSpan = codeLines.slice(start, end + 1).join("\n");
    if (COMPANION_TOKEN.test(elementSpan)) return;
    // Allowlist entries may cite text anywhere in the same JSX element (an
    // aria-label a few lines above, a comment, a sibling prop) — not
    // necessarily the exact flagged line — so match against the whole span.
    const rawSpan = rawLines.slice(start, end + 1).join("\n");
    if (isAllowlisted(relPath, rawSpan)) return;
    violations.push({ file: relPath, line: idx + 1, text: rawLines[idx].trim() });
  });
}

/**
 * CSS: parsed as flat `selector { body }` rules (comments stripped, then
 * whitespace/newlines collapsed to spaces first, so a selector list spread
 * over several source lines is still read as one rule — this only breaks on
 * nested rules, e.g. inside `@media`, which none of this codebase's
 * `outline: none` declarations sit inside). A rule with `outline: none` is
 * safe when either (a) its own selector already includes a `:focus*`
 * pseudo-class (the rule IS the focus treatment, e.g. contact.css's
 * `.ct-input:focus-visible, .ct-input:focus { outline: none; border-color: ... }`),
 * or (b) some other rule in the file targets the exact same selector with a
 * `:focus*` pseudo-class appended (e.g. `.ad-textarea` / `.ad-textarea:focus`).
 * Anything else — most often an ancestor wrapper carrying the focus style
 * instead of the element itself — needs an ALLOWLIST entry.
 */
function checkCssFile(file, relPath, violations) {
  const raw = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const flat = raw.replace(/\s+/g, " ");
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(flat))) {
    const [, selectorText, body] = m;
    if (!OUTLINE_NONE.test(body)) continue;
    const ownSelectorHasFocus = /:focus/.test(selectorText);
    if (ownSelectorHasFocus) continue;

    const selectors = selectorText.split(",").map((s) => s.trim()).filter(Boolean);
    const hasCompanionElsewhere = selectors.some((sel) => {
      const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`${escaped}\\s*:focus`).test(flat);
    });
    if (hasCompanionElsewhere) continue;

    // Report against the original (unflattened) text so the allowlist can
    // match a real, readable line from the file.
    const selectorForMatch = `${selectors[0] ?? selectorText.trim()} {`;
    const lineIdx = raw.split("\n").findIndex((l) => l.includes(selectors[0]?.trim() ?? ""));
    if (isAllowlisted(relPath, selectorForMatch)) continue;

    violations.push({
      file: relPath,
      line: lineIdx >= 0 ? lineIdx + 1 : "?",
      text: `${selectors.join(", ")} { ... outline: none ... }`,
    });
  }
}

function main() {
  const files = walk(SRC);
  /** @type {{file: string, line: number | string, text: string}[]} */
  const violations = [];

  for (const file of files) {
    const relPath = path.relative(ROOT, file).split(path.sep).join("/");
    if (file.endsWith(".css")) {
      checkCssFile(file, relPath, violations);
    } else {
      checkScriptFile(file, relPath, violations);
    }
  }

  if (violations.length > 0) {
    console.error(
      `check-focus-visible: found ${violations.length} "outline-none" / "outline: none" ` +
        `occurrence(s) with no visible focus replacement:\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}: ${v.text}`);
    }
    console.error(
      `\nAdd a same-element focus:/focus-visible: companion class, the shared ` +
        `.kx-focus-visible utility (src/styles/globals.css), or a ` +
        `has-[:focus-visible]:border-[...] ring on the wrapper if the element sits inside an ` +
        `overflow-hidden container — or add a justified entry to the ALLOWLIST in ` +
        `scripts/check-focus-visible.mjs if this really is already covered another way.`,
    );
    process.exit(1);
  }

  console.log(
    `check-focus-visible: OK — scanned ${files.length} file(s) under src/, no unreplaced ` +
      `"outline-none" / "outline: none" found (${ALLOWLIST.length} allowlisted exception(s)).`,
  );
}

main();
