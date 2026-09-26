import assert from "node:assert/strict";
import test from "node:test";

import { isTrackablePath } from "~/server/page-view-metrics";

// Fable review M1: only published content pages may be counted, so a beacon
// can't create unbounded Redis hash fields.
test("isTrackablePath accepts real content pages", () => {
  for (const p of [
    "/register",
    "/features",
    "/features/duplicates",
    "/for/families",
    "/help",
    "/help/sync",
    "/help/sync/connect-icloud-contacts",
    "/guides",
    "/guides/what-is-carddav",
    "/compare/kontax-vs-icloud-contacts",
  ]) {
    assert.equal(isTrackablePath(p), true, p);
  }
});

test("isTrackablePath rejects invented, query-stringed or unrelated paths", () => {
  for (const p of [
    "/help/anything",
    "/help/sync/connect-icloud-contacts?x=1",
    "/guides/made-up",
    "/for/whatever",
    "/contacts",
    "/settings",
    "//evil.example",
    "",
    "/help/" + "a".repeat(300),
  ]) {
    assert.equal(isTrackablePath(p), false, p);
  }
});
