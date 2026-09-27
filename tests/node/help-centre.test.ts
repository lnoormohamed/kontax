import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { PLAN_ORDER } from "../../src/app/_components/plan-data";
import {
  allArticles,
  articleHref,
  HELP_CATEGORIES,
  resolveRef,
  TOP_TASKS,
} from "../../src/app/(marketing)/help/_content";
import { LEGACY_HELP_ANCHORS } from "../../src/app/(marketing)/help/_content/anchors";
import { FACTS } from "../../src/app/(marketing)/help/_content/facts";
import { HELP_LINKS } from "../../src/app/(marketing)/help/_content/links";
import { linkTargets } from "../../src/app/(marketing)/help/_content/text";
import type { HelpArticleContent } from "../../src/app/(marketing)/help/_content/types";

// P50A-05 · Help centre integrity: old /help#anchors, related links, inline
// links and in-app deep links all resolve, and mirrored product facts still
// match their source.

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// Every anchor the old single-page /help exposed: the 14 FAQ section ids
// (HELP_ANCHORS) plus the provider-guide cards and their heading.
const OLD_ANCHORS = [
  "contacts",
  "organizing",
  "carddav",
  "sync-oauth",
  "import",
  "sharing",
  "notifications",
  "public-card",
  "family-teams",
  "security",
  "billing",
  "gdpr",
  "mobile",
  "activity",
  "provider-guides",
  "provider-icloud",
  "provider-fastmail",
  "provider-google",
  "provider-microsoft",
  "provider-carddav",
];

const helpPaths = new Set<string>([
  "/help",
  ...HELP_CATEGORIES.map((c) => `/help/${c.id}`),
  ...allArticles().map((a) => articleHref(a)),
]);

// Non-help internal routes articles may link to.
const APP_ROUTES = new Set([
  "/sync",
  "/contacts",
  "/contacts?tab=duplicates",
  "/import-export",
  "/pricing",
  "/privacy",
  "/developers",
  "/developers#export-format",
  "/developers/export-format",
  "/format/spec.md",
]);

function articleText(a: HelpArticleContent): string[] {
  return [
    a.title,
    a.summary,
    a.audience,
    ...a.steps.flatMap((s) => [s.text, ...(s.details ?? [])]),
    ...(a.sections ?? []).flatMap((s) => [
      s.heading,
      ...(s.paragraphs ?? []),
      ...(s.list ?? []),
      ...(s.table ? [...s.table.head, ...s.table.rows.flat()] : []),
    ]),
    ...a.whatToExpect,
    ...a.ifItDoesntWork,
  ];
}

test("every old /help anchor maps to a real help URL", () => {
  for (const anchor of OLD_ANCHORS) {
    const ref = LEGACY_HELP_ANCHORS[anchor];
    assert.ok(ref, `no mapping for #${anchor}`);
    const resolved = resolveRef(ref);
    assert.ok(resolved, `#${anchor} → ${ref} does not resolve`);
    assert.ok(helpPaths.has(resolved.href), `#${anchor} → ${resolved.href} is not a generated page`);
  }
  // Only the provider-guides heading maps to a category; every other anchor lands on an article.
  for (const [anchor, ref] of Object.entries(LEGACY_HELP_ANCHORS)) {
    if (anchor === "provider-guides") continue;
    assert.ok(ref.includes("/"), `#${anchor} should map to an article, got ${ref}`);
  }
});

test("article slugs are unique, well-formed and filed under their category", () => {
  const seen = new Set<string>();
  for (const c of HELP_CATEGORIES) {
    for (const a of c.articles) {
      assert.equal(a.category, c.id, `${a.slug} is listed under ${c.id} but says ${a.category}`);
      assert.match(a.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      const href = articleHref(a);
      assert.ok(!seen.has(href), `duplicate article ${href}`);
      seen.add(href);
      assert.match(a.lastReviewed, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(a.plans.length > 0, `${a.slug} has no plans`);
      for (const p of a.plans) assert.ok(PLAN_ORDER.includes(p), `${a.slug}: unknown plan ${p}`);
      assert.ok(a.whatToExpect.length > 0 && a.ifItDoesntWork.length > 0, `${a.slug} is missing a template section`);
    }
  }
});

test("every article has 2–3 related links and they all resolve", () => {
  for (const a of allArticles()) {
    assert.ok(a.related.length >= 2 && a.related.length <= 3, `${a.slug} has ${a.related.length} related links`);
    for (const ref of a.related) {
      assert.ok(resolveRef(ref), `${a.slug}: related ${ref} does not resolve`);
      assert.notEqual(ref, `${a.category}/${a.slug}`, `${a.slug} links to itself`);
    }
  }
});

test("inline links in articles and short answers point at real pages", () => {
  const check = (where: string, text: string) => {
    for (const href of linkTargets(text)) {
      if (href.startsWith("mailto:") || href.startsWith("https://")) continue;
      assert.ok(helpPaths.has(href) || APP_ROUTES.has(href), `${where}: unknown link ${href}`);
    }
  };
  for (const a of allArticles()) for (const t of articleText(a)) check(a.slug, t);
  for (const c of HELP_CATEGORIES) {
    for (const s of c.shortAnswers) {
      check(`${c.id} short answer`, s.a);
      if (s.more) assert.ok(resolveRef(s.more), `${c.id}: short answer link ${s.more} does not resolve`);
    }
    for (const ref of c.alsoSee ?? []) assert.ok(resolveRef(ref), `${c.id}: alsoSee ${ref} does not resolve`);
  }
});

test("in-app help links and hub top tasks resolve to articles", () => {
  for (const [key, href] of Object.entries(HELP_LINKS)) {
    assert.ok(
      allArticles().some((a) => articleHref(a) === href),
      `HELP_LINKS.${key} → ${href} is not an article`,
    );
  }
  for (const ref of TOP_TASKS) assert.ok(resolveRef(ref), `top task ${ref} does not resolve`);
});

test("Outlook only appears in content gated behind Microsoft sync", () => {
  for (const a of allArticles()) {
    for (const t of articleText(a)) assert.doesNotMatch(t, /outlook|microsoft/i, `${a.slug} mentions Outlook`);
  }
  for (const c of HELP_CATEGORIES) {
    for (const s of c.shortAnswers) {
      if (s.requiresMicrosoftSync) continue;
      assert.doesNotMatch(`${s.q} ${s.a}`, /outlook|microsoft/i, `${c.id}: "${s.q}" mentions Outlook`);
    }
  }
});

test("no help content promises an automatic or no-card trial", () => {
  // New accounts don't get a trial: src/app/actions/billing.ts only sets
  // trial_period_days on a first Pro checkout, where a card is collected. Help
  // may say "doesn't start a trial" / "not a trial", and may describe the Pro
  // checkout trial, but must never offer one on sign-up or without a card.
  const denies = /doesn't start a trial|not a trial|isn't a trial/i;
  const promisesTrial = (text: string): boolean =>
    text
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => /trial/i.test(sentence) && !denies.test(sentence))
      .some(
        (sentence) =>
          /automatic|no card|without a card|on sign-?up|free trial (is )?included/i.test(sentence) ||
          (/\d+-day/.test(sentence) && !/subscribe to Pro|checkout/i.test(sentence)),
      );
  for (const a of allArticles()) {
    for (const t of articleText(a)) assert.ok(!promisesTrial(t), `${a.slug} promises a trial: ${t}`);
  }
  for (const c of HELP_CATEGORIES) {
    for (const s of c.shortAnswers) assert.ok(!promisesTrial(s.a), `${c.id}: "${s.q}" promises a trial`);
  }
  // The regression the old wording had: a no-card trial on sign-up.
  assert.ok(promisesTrial("Every new account gets a 14-day Pro trial automatically, no card needed."));
  assert.ok(!promisesTrial("Kontax doesn't start a trial when you sign up, and Free needs no card."));
});

test("mirrored product facts match their source", () => {
  const cases: Array<[string, RegExp, number]> = [
    ["src/app/actions/account.ts", /scheduledDeleteAt = new Date\(Date\.now\(\) \+ (\d+) \* 24 \* 60 \* 60 \* 1000\)/, FACTS.deletionGraceDays],
    ["src/server/stripe-handlers.ts", /TEAMS_GRACE_MS = (\d+) \* DAY_MS/, FACTS.teamsGraceDays],
    ["src/server/family-lifecycle.ts", /FAMILY_DISSOLVE_NOTICE_MS = (\d+) \* 24 \* 60 \* 60 \* 1000/, FACTS.familyNoticeDays],
    ["src/app/actions/family.ts", /INVITE_TTL_MS = (\d+) \* 60 \* 60 \* 1000/, FACTS.inviteHours],
    ["src/app/actions/teams.ts", /INVITE_TTL_MS = (\d+) \* 60 \* 60 \* 1000/, FACTS.inviteHours],
    ["src/app/actions/auth.ts", /expiresAt = new Date\(Date\.now\(\) \+ (\d+) \* 60 \* 1000\); \/\/ 15 minutes/, FACTS.passwordResetMinutes],
    ["src/app/actions/shares.ts", /FREE_LINK_TTL_MS = (\d+) \* 24 \* 60 \* 60 \* 1000/, FACTS.freeVcardLinkDays],
    ["src/server/contact-merge.ts", /MERGE_UNDO_WINDOW_DAYS = (\d+)/, FACTS.mergeUndoDays],
  ];
  for (const [file, re, expected] of cases) {
    const m = read(file).match(re);
    assert.ok(m, `${file}: pattern ${re} not found — update facts.ts and this test`);
    assert.equal(Number(m[1]), expected, `${file}: source says ${m[1]}, help says ${expected}`);
  }

  const totp = read("src/app/actions/totp.ts");
  const codes = /Array\.from\(\{ length: (\d+) \}, generateRecoveryCode\)/.exec(totp) ?? /RECOVERY_CODE_COUNT = (\d+)/.exec(totp);
  assert.ok(codes, "src/app/actions/totp.ts: recovery code count not found — update facts.ts and this test");
  assert.equal(Number(codes[1]), FACTS.recoveryCodes);

  const api = read("src/server/api-rate-limit.ts");
  const rl = /READ_ONLY: ([\d_]+),\s*READ_WRITE: ([\d_]+)/.exec(api);
  assert.ok(rl, "src/server/api-rate-limit.ts: API_RATE_LIMITS not found");
  assert.equal(Number(rl[1]!.replace(/_/g, "")).toLocaleString("en-GB"), FACTS.apiReadPerHour);
  assert.equal(Number(rl[2]!.replace(/_/g, "")).toLocaleString("en-GB"), FACTS.apiWritePerHour);
});
