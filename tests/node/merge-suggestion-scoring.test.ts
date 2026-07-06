import assert from "node:assert/strict";
import test from "node:test";

import { buildContactMergeSuggestions } from "../../src/server/contact-merge";

const base = {
  firstName: null,
  middleName: null,
  lastName: null,
  namePrefix: null,
  nameSuffix: null,
  nickname: null,
  jobTitle: null,
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

const contact = (
  id: string,
  fullName: string,
  overrides: Partial<{ email: string | null; phone: string | null; company: string | null }> = {},
) => ({
  ...base,
  id,
  fullName,
  email: null,
  phone: null,
  company: null,
  ...overrides,
});

test("shared phone with conflicting names and companies is not suggested", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Layla Hassan", {
      phone: "+353501234567",
      email: "layla.hassan.ae@kontax-seed.test",
      company: "Emerald Logistics",
    }),
    contact("b", "Oksana Melnyk", {
      phone: "+353501234567",
      email: "oksana.melnyk.ua@kontax-seed.test",
      company: "Kyiv Imports",
    }),
  ]);

  assert.equal(suggestions.length, 0);
});

test("shared phone with conflicting names but no company context stays review-only", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Layla Hassan", { phone: "+353501234567" }),
    contact("b", "Oksana Melnyk", { phone: "+353501234567" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "medium");
  assert.equal(suggestion.score, 55); // 95 phone − 40 conflicting name
  assert.ok(suggestion.signals.includes("conflicting-name"));
});

test("shared phone within a household (same surname) is demoted but kept", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Layla Hassan", { phone: "+353501234567" }),
    contact("b", "Omar Hassan", { phone: "+353501234567" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "medium");
  assert.equal(suggestion.score, 75); // 95 phone − 20 given-name conflict
  assert.ok(suggestion.signals.includes("conflicting-given-name"));
});

test("shared phone with matching names keeps high confidence and full score", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Layla Hassan", { phone: "+353501234567", company: "Emerald Logistics" }),
    contact("b", "Layla Hassan", { phone: "+353501234567", company: "Emerald Logistics" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "high");
  assert.ok(suggestion.score >= 95);
  assert.ok(!suggestion.signals.some((signal) => signal.startsWith("conflicting-")));
});

test("shared email with conflicting names is demoted out of high confidence", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Layla Hassan", { email: "shared@kontax-seed.test" }),
    contact("b", "Oksana Melnyk", { email: "shared@kontax-seed.test" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "medium");
  assert.equal(suggestion.score, 55); // 95 email − 40 conflicting name
});

test("fuzzy name variants on a shared phone are not penalized", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Katherine Reid", { phone: "+353501234567" }),
    contact("b", "Catherine Reid", { phone: "+353501234567" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.ok(!suggestion.signals.some((signal) => signal.startsWith("conflicting-")));
  assert.equal(suggestion.confidence, "high");
});

test("different given names at the same company are not a fuzzy match (Thảo vs Hải)", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Thảo Nguyễn", {
      email: "demo.multilingual.034@kontax-seed.test",
      phone: "+84 000 269 246",
      company: "Kontax Demo",
    }),
    contact("b", "Hải Nguyễn", {
      email: "demo.multilingual.022@kontax-seed.test",
      phone: "+84 000 174 218",
      company: "Kontax Demo",
    }),
  ]);

  assert.equal(suggestions.length, 0);
});

test("diacritic variants of the same name are an exact match", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Thảo Nguyễn", { company: "Kontax Demo" }),
    contact("b", "Thao Nguyen", { company: "Kontax Demo" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.ok(suggestions[0]!.signals.includes("exact-name"));
});

test("conflicting birthdays subtract from the score and demote confidence", () => {
  const withBirthday = (id: string, fullName: string, birthday: string) => ({
    ...contact(id, fullName, { phone: "+353501234567" }),
    birthday,
  });
  const suggestions = buildContactMergeSuggestions([
    withBirthday("a", "Layla Hassan", "1983-10-16"),
    withBirthday("b", "Layla Hassan", "1981-10-08"),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.ok(suggestion.signals.includes("conflicting-birthday"));
  assert.equal(suggestion.confidence, "medium");
  assert.ok(suggestion.reasons.some((r) => r.includes("different birthdays")));
});

test("legitimate spelling variants still fuzzy-match at the same company", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Jon Smithe", { company: "Acme" }),
    contact("b", "John Smith", { company: "Acme" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.ok(
    suggestions[0]!.signals.some((signal) => signal.startsWith("fuzzy-name")),
  );
});

test("phonetically-close names with distinct companies, emails, and phones are not suggested", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Árni Jónsson", {
      email: "demo.multilingual.093@kontax-seed.test",
      phone: "+354 000 736 467",
      company: "Reykjavík Studio",
    }),
    contact("b", "Aron Jonsson", {
      email: "aron.jonsson.is@kontax-seed.test",
      phone: "+353 61 11234",
      company: "Reykjavik Retail",
    }),
  ]);

  assert.equal(suggestions.length, 0);
});

test("fuzzy name at the same company survives distinct identifiers as a review item", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Jon Smithe", { company: "Acme", email: "jon@acme-corp.test", phone: "+44 7700 900111" }),
    contact("b", "John Smith", { company: "Acme", email: "john.smith@acme-corp.test", phone: "+44 7700 900222" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "medium");
  assert.ok(suggestion.signals.includes("conflicting-identifiers"));
});

test("exact name at different companies is still suggested for review", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Layla Hassan", { company: "Emerald Logistics" }),
    contact("b", "Layla Hassan", { company: "Kyiv Imports" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "medium");
  assert.equal(suggestion.score, 60); // 80 exact name − 20 conflicting company
});

test("same given name with a different surname is not a fuzzy match (Priya Khan vs Priya Shah)", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Priya Khan", { email: "priya.khan.tt@kontax-seed.test" }),
    contact("b", "Priya Shah", { email: "priya.shah.in@kontax-seed.test" }),
  ]);

  assert.equal(suggestions.length, 0);
});

test("surname change on a shared phone stays a review item, not a confident match", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Priya Khan", { phone: "+353501234567" }),
    contact("b", "Priya Shah", { phone: "+353501234567" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "medium");
  assert.ok(suggestion.signals.includes("conflicting-name"));
});

test("one-edit surname variants still fuzzy-match", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Priya Sha", { company: "Mumbai Health" }),
    contact("b", "Priya Shah", { company: "Mumbai Health" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.ok(suggestions[0]!.signals.some((signal) => signal.startsWith("fuzzy-name")));
});

// ── Non-Latin scripts ────────────────────────────────────────────────────────

test("different Chinese names sharing a phone are demoted, not high confidence", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "张伟", { phone: "+8613912345678" }),
    contact("b", "王芳", { phone: "+8613912345678" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "medium");
  assert.ok(suggestion.signals.includes("conflicting-name"));
});

test("identical CJK names on a shared phone stay high confidence", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "张伟", { phone: "+8613912345678" }),
    contact("b", "张伟", { phone: "+86 139 1234 5678" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "high");
  assert.ok(suggestion.signals.includes("exact-name"));
});

test("different Arabic names sharing a phone are demoted", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "محمد الأحمد", { phone: "+9665012345678" }),
    contact("b", "فاطمة الزهراء", { phone: "+9665012345678" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.confidence, "medium");
});

test("Arabic hamza variants of the same name are an exact match", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "محمد الأحمد", { phone: "+9665012345678" }),
    contact("b", "محمد الاحمد", { phone: "+9665012345678" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.confidence, "high");
  assert.ok(suggestions[0]!.signals.includes("exact-name"));
});

test("different Korean names sharing a phone are demoted", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "김민준", { phone: "+821012345678" }),
    contact("b", "이서연", { phone: "+821012345678" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.confidence, "medium");
});

test("different Russian names sharing a phone are demoted; same name matches exactly", () => {
  const conflicting = buildContactMergeSuggestions([
    contact("a", "Иван Петров", { phone: "+79161234567" }),
    contact("b", "Ольга Смирнова", { phone: "+79161234567" }),
  ]);
  assert.equal(conflicting.length, 1);
  assert.equal(conflicting[0]!.confidence, "medium");

  const matching = buildContactMergeSuggestions([
    contact("a", "Иван Петров", { email: "ivan@example.test" }),
    contact("b", "Иван Петров", { email: "ivan@example.test" }),
  ]);
  assert.equal(matching.length, 1);
  assert.equal(matching[0]!.confidence, "high");
  assert.ok(matching[0]!.signals.includes("exact-name"));
});

test("simplified vs traditional Chinese record of one person still hard-matches on identifier", () => {
  // 陈志强 (simplified) vs 陳志強 (traditional): no Unicode fold maps between
  // them, so name signals stay silent — but the shared email still surfaces
  // the pair for review rather than losing it.
  const suggestions = buildContactMergeSuggestions([
    contact("a", "陈志强", { email: "chen@example.test" }),
    contact("b", "陳志強", { email: "chen@example.test" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.ok(suggestions[0]!.hardMatch);
});

test("one-character difference in short CJK names is not a fuzzy match", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "王磊", { company: "北京科技", email: "wang.lei@dupe-qa.test", phone: "+8613900000031" }),
    contact("b", "王芳", { company: "北京科技", email: "wang.fang@dupe-qa.test", phone: "+8613900000032" }),
  ]);

  assert.equal(suggestions.length, 0);
});

test("short Latin given names still match via phonetics, not edit distance", () => {
  // "Jon"/"John" is 3 chars — below the one-edit length floor — but remains
  // compatible through the phonetic key, so real spelling variants survive.
  const suggestions = buildContactMergeSuggestions([
    contact("a", "Jon Smith", { company: "Acme" }),
    contact("b", "John Smith", { company: "Acme" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.ok(suggestions[0]!.signals.some((signal) => signal.startsWith("fuzzy-name")));
});

// ── Round 2 scripts: Indic, Thai, Japanese, Greek, Hebrew, special Latin ─────

test("different Hindi names sharing a phone are demoted (vowel signs preserved)", () => {
  // राम vs रीमा differ only in combining vowel signs — stripping marks in
  // Indic scripts folds different people into an exact-name match.
  const suggestions = buildContactMergeSuggestions([
    contact("a", "राम शर्मा", { phone: "+919812345678" }),
    contact("b", "रीमा शर्मा", { phone: "+919812345678" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.confidence, "medium");
  assert.ok(!suggestions[0]!.signals.includes("exact-name"));
});

test("katakana and hiragana spellings of one Japanese name match exactly", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "タナカ タロウ", { phone: "+819012345678" }),
    contact("b", "たなか たろう", { phone: "+81 90 1234 5678" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.confidence, "high");
  assert.ok(suggestions[0]!.signals.includes("exact-name"));
});

test("Greek accent variants match; different Greek names on a shared phone demote", () => {
  const matching = buildContactMergeSuggestions([
    contact("a", "Ελένη Παπαδοπούλου", { email: "eleni@example.test" }),
    contact("b", "Ελενη Παπαδοπουλου", { email: "eleni@example.test" }),
  ]);
  assert.equal(matching[0]!.confidence, "high");
  assert.ok(matching[0]!.signals.includes("exact-name"));

  const conflicting = buildContactMergeSuggestions([
    contact("a", "Ελένη Παπαδοπούλου", { phone: "+306912345678" }),
    contact("b", "Νίκος Οικονόμου", { phone: "+306912345678" }),
  ]);
  assert.equal(conflicting[0]!.confidence, "medium");
});

test("Hebrew niqqud variants match exactly", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "דָּוִד כהן", { phone: "+972501234567" }),
    contact("b", "דוד כהן", { phone: "+972 50 123 4567" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.confidence, "high");
  assert.ok(suggestions[0]!.signals.includes("exact-name"));
});

test("Turkish dotless-i and Polish ł fold to their Latin base", () => {
  const turkish = buildContactMergeSuggestions([
    contact("a", "İlker Yıldız", { email: "ilker@example.test" }),
    contact("b", "Ilker Yildiz", { email: "ilker@example.test" }),
  ]);
  assert.ok(turkish[0]!.signals.includes("exact-name"));

  const polish = buildContactMergeSuggestions([
    contact("a", "Łukasz Wójcik", { email: "lukasz@example.test" }),
    contact("b", "Lukasz Wojcik", { email: "lukasz@example.test" }),
  ]);
  assert.ok(polish[0]!.signals.includes("exact-name"));
});

test("different Thai names sharing a phone are demoted", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "สมชาย ใจดี", { phone: "+66812345678" }),
    contact("b", "สมหญิง ใจดี", { phone: "+66812345678" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.confidence, "medium");
});

// ── P46-20: cross-script romanized matching ──────────────────────────────────

test("simplified and traditional Chinese records of one person are high confidence", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "陈志强", { email: "chen@example.test" }),
    contact("b", "陳志強", { email: "chen@example.test" }),
  ]);

  assert.equal(suggestions.length, 1);
  const suggestion = suggestions[0]!;
  assert.equal(suggestion.confidence, "high");
  assert.ok(suggestion.signals.includes("romanized-name"));
  assert.ok(!suggestion.signals.some((s) => s.startsWith("conflicting-")));
});

test("native script and romanized record pair up even without a shared identifier", () => {
  const chinese = buildContactMergeSuggestions([
    contact("a", "李娜", { phone: "+8613900000101" }),
    contact("b", "Li Na", { phone: "+8613955555555" }),
  ]);
  assert.equal(chinese.length, 1);
  assert.equal(chinese[0]!.confidence, "medium");
  assert.ok(chinese[0]!.signals.includes("romanized-name"));

  const cyrillic = buildContactMergeSuggestions([
    contact("a", "Ольга Смирнова", { email: "olga.a@example.test" }),
    contact("b", "Olga Smirnova", { email: "olga.b@example.test" }),
  ]);
  assert.equal(cyrillic.length, 1);
  assert.ok(cyrillic[0]!.signals.includes("romanized-name"));
});

test("kana record matches its romaji spelling via romanized fuzzy", () => {
  const suggestions = buildContactMergeSuggestions([
    contact("a", "タナカ タロウ", { email: "tanaka@example.test" }),
    contact("b", "Tanaka Taro", { email: "tanaka@example.test" }),
  ]);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]!.confidence, "high");
  assert.ok(
    suggestions[0]!.signals.some((s) => s.startsWith("romanized-")),
  );
  assert.ok(!suggestions[0]!.signals.some((s) => s.startsWith("conflicting-")));
});

test("romanization does not revive in-script negatives", () => {
  // 王芳/王磊 → "wang fang"/"wang lei" and राम/रीमा → "raam"/"riimaa" must
  // stay distinct after romanization.
  const chinese = buildContactMergeSuggestions([
    contact("a", "王磊", { company: "北京科技", email: "wl@dupe-qa.test", phone: "+8613900000031" }),
    contact("b", "王芳", { company: "北京科技", email: "wf@dupe-qa.test", phone: "+8613900000032" }),
  ]);
  assert.equal(chinese.length, 0);

  const hindi = buildContactMergeSuggestions([
    contact("a", "राम शर्मा", { phone: "+919812345678" }),
    contact("b", "रीमा शर्मा", { phone: "+919812345678" }),
  ]);
  assert.equal(hindi.length, 1);
  assert.equal(hindi[0]!.confidence, "medium");
  assert.ok(hindi[0]!.signals.some((s) => s.startsWith("conflicting-")));
});
