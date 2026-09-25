// P49A-09 — the blocked + precomputed duplicate scorer must suggest EXACTLY
// what the old O(n²) scan suggested: same pairs, same order, same scores,
// reasons, signals and confidence. `_legacy-merge-suggestions.ts` is a frozen
// copy of the old scan used as the oracle.
import assert from "node:assert/strict";
import test from "node:test";

import { phoneticNameKey } from "../../src/lib/duplicate-signals";
import type { MergeCandidateContact } from "../../src/server/contact-merge";
import {
  buildContactMergeSuggestions,
  buildContactMergeSuggestionsAsync,
} from "../../src/server/contact-merge";
import { legacyBuildContactMergeSuggestions } from "./_legacy-merge-suggestions";
import { buildFuzzyGroupContacts, buildSyntheticContacts } from "./_merge-fixtures";

const assertEquivalent = (label: string, contacts: MergeCandidateContact[]) => {
  const expected = legacyBuildContactMergeSuggestions(contacts);
  const actual = buildContactMergeSuggestions(contacts);
  const expectedKeys = new Set(expected.map((suggestion) => suggestion.pairKey));
  const actualKeys = new Set(actual.map((suggestion) => suggestion.pairKey));
  const missing = [...expectedKeys].filter((key) => !actualKeys.has(key));
  const extra = [...actualKeys].filter((key) => !expectedKeys.has(key));
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `${label}: suggestion pairs differ`);
  // Full structural equality: order, scores, reasons, signals, contributions.
  assert.deepStrictEqual(actual, expected, `${label}: suggestion details differ`);
  return actual;
};

test("equivalence: dense synthetic books (typos, nicknames, shared phones/emails, scripts)", () => {
  for (const seed of [1, 2]) {
    const contacts = buildSyntheticContacts({
      count: 150,
      seed,
      duplicateRate: 0.35,
      phonePool: 25,
      emailPool: 25,
      wholeNameRate: 0.4,
    });
    const suggestions = assertEquivalent(`dense seed ${seed}`, contacts);
    assert.ok(suggestions.length > 20, "fixture should produce plenty of suggestions");
  }
});

test("equivalence: default-shaped synthetic books", () => {
  for (const seed of [1001, 1002]) {
    assertEquivalent(`default seed ${seed}`, buildSyntheticContacts({ count: 150, seed }));
  }
});

test("equivalence: fuzzy names that only the company/domain-scoped keys can find", () => {
  let fuzzyOnly = 0;
  for (const kind of ["short", "long"] as const) {
    for (const seed of [7, 8]) {
      const suggestions = assertEquivalent(`${kind} seed ${seed}`, buildFuzzyGroupContacts(kind, 110, seed));
      fuzzyOnly += suggestions.filter(
        (suggestion) =>
          (suggestion.signals.includes("fuzzy-name-company") ||
            suggestion.signals.includes("email-domain-and-name")) &&
          !suggestion.hardMatch &&
          phoneticNameKey(suggestion.leftContact.fullName) !==
            phoneticNameKey(suggestion.rightContact.fullName),
      ).length;
    }
  }
  // Guard the fixture itself: it must contain pairs that no exact / phonetic
  // key would surface, or this test proves nothing about the fuzzy keys.
  assert.ok(fuzzyOnly > 0, "expected fuzzy-only pairs in the stress fixture");
});

test("equivalence: sound-alike names found only by the phonetic key", () => {
  let phoneticOnly = 0;
  for (const seed of [11, 12]) {
    const suggestions = assertEquivalent(`phonetic seed ${seed}`, buildFuzzyGroupContacts("phonetic", 110, seed));
    phoneticOnly += suggestions.filter(
      (suggestion) => suggestion.signals.includes("phonetic-name") && !suggestion.hardMatch,
    ).length;
  }
  assert.ok(phoneticOnly > 0, "expected phonetic-only pairs in the stress fixture");
});

test("equivalence: the scoring-test fixture names, all compared with each other", () => {
  // Every whole-name fixture from merge-suggestion-scoring.test.ts (and more),
  // each in a few identifier contexts, all in one book so every name meets
  // every other name.
  const contacts = buildSyntheticContacts({
    count: 200,
    seed: 4242,
    duplicateRate: 0.3,
    phonePool: 12,
    emailPool: 12,
    wholeNameRate: 0.9,
  });
  assertEquivalent("fixture names", contacts);
});

test("equivalence: sparse arrays, empty names and a declared sourceKind", () => {
  const base = {
    email: null,
    phone: null,
    company: null,
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  };
  const contacts = [
    { ...base, id: "a", fullName: "", phone: "+353501234567" },
    { ...base, id: "b", fullName: "   ", phone: "+353 50 123 4567" },
    { ...base, id: "c", fullName: "Layla Hassan", importJobId: "imp" },
    { ...base, id: "d", fullName: "Layla Hassan", sourceKind: "manual" as const },
    { ...base, id: "e", fullName: "Layla Hasan", company: "Emerald", email: "l@emerald.test" },
    { ...base, id: "f", fullName: "Layla Hassan", company: "Emerald", email: "x@emerald.test" },
  ] as MergeCandidateContact[];
  // A hole in the array must be skipped the way the old loop skipped it.
  const withHole = [...contacts];
  withHole.splice(2, 0, undefined as unknown as MergeCandidateContact);
  assertEquivalent("edge cases", contacts);
  assertEquivalent("edge cases with hole", withHole);
});

test("async driver returns exactly what the sync driver returns", async () => {
  const contacts = buildSyntheticContacts({ count: 400, seed: 99, duplicateRate: 0.3 });
  const sync = buildContactMergeSuggestions(contacts);
  const chunked = await buildContactMergeSuggestionsAsync(contacts, { sliceBudgetMs: 1 });
  assert.deepStrictEqual(chunked, sync);
});
