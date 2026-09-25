// P49A-09 — duplicate scoring must stay fast and must not hog the event loop.
// Before P49A-09, 1,000 contacts took ~55 s of one uninterrupted synchronous
// block (5,000 ≈ 25 min) on the process that also serves web + CardDAV + sync.
import assert from "node:assert/strict";
import test from "node:test";

import { buildContactMergeSuggestionsAsync } from "../../src/server/contact-merge";
import { buildBenchmarkContacts } from "./_merge-fixtures";

// Acceptance: < 2 s total and no synchronous slice > 50 ms. The engine yields
// every ~8 ms and takes ~0.3–0.6 s locally, so both bounds leave CI headroom.
const TOTAL_BUDGET_MS = 2_000;
const SLICE_LIMIT_MS = 50;

test("5,000 synthetic contacts score in < 2 s with no synchronous slice over 50 ms", async () => {
  // Warm-up: JIT and the romanization dictionaries' first-use cost aren't
  // what this test measures.
  await buildContactMergeSuggestionsAsync(buildBenchmarkContacts(300, 7));

  const contacts = buildBenchmarkContacts(5_000);
  const slices: number[] = [];
  let ticks = 0;
  const ticker = setInterval(() => {
    ticks += 1;
  }, 1);

  const started = performance.now();
  const suggestions = await buildContactMergeSuggestionsAsync(contacts, {
    onSlice: (durationMs) => slices.push(durationMs),
  });
  const totalMs = performance.now() - started;
  clearInterval(ticker);

  const longestSlice = Math.max(...slices);
  assert.ok(suggestions.length > 0, "the benchmark book contains duplicates");
  assert.ok(totalMs < TOTAL_BUDGET_MS, `took ${totalMs.toFixed(0)} ms (budget ${TOTAL_BUDGET_MS} ms)`);
  assert.ok(
    longestSlice < SLICE_LIMIT_MS,
    `longest synchronous slice ${longestSlice.toFixed(1)} ms (limit ${SLICE_LIMIT_MS} ms)`,
  );
  // Timers actually got to run in between slices.
  if (slices.length > 1) {
    assert.ok(ticks > 0, "the event loop never serviced a timer while scoring");
  }
});
