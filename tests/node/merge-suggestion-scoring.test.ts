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
