import assert from "node:assert/strict";
import { test } from "node:test";

import { isAlwaysAllowed, isExactPublicPath, isPublicPath } from "../../src/server/public-paths";

// P49A-15: /about and /contact were missing from the middleware's public-path
// allowlist (both 307'd to /login for a logged-out visitor). The fix adds them
// as EXACT matches rather than startsWith prefixes, because "/contact" is a
// prefix of "/contacts" (the signed-in address-book app) and "/api/contact" is
// a prefix of "/api/contacts" (the signed-in contacts REST route) — a naive
// prefix match would have accidentally made both of those private routes
// public too. These cases pin that distinction.

test("isPublicPath: /about and /contact are public", () => {
  assert.equal(isPublicPath("/about"), true);
  assert.equal(isPublicPath("/contact"), true);
});

test("isPublicPath: /contacts (the signed-in app) stays private", () => {
  assert.equal(isPublicPath("/contacts"), false);
  assert.equal(isPublicPath("/contacts/123"), false);
});

test("isPublicPath: /api/contact (the form submission endpoint) is public", () => {
  assert.equal(isPublicPath("/api/contact"), true);
});

test("isPublicPath: /api/contacts (the signed-in contacts REST route) stays private", () => {
  assert.equal(isPublicPath("/api/contacts"), false);
  assert.equal(isPublicPath("/api/contacts/123"), false);
});

test("isPublicPath: a nested path under an exact public path is still public", () => {
  // Not currently exercised by any real route under /about or /contact, but
  // the matcher is "exact or <path>/…" by design (see EXACT_PUBLIC_PATHS),
  // so pin that a plausible future subpath keeps working.
  assert.equal(isPublicPath("/contact/thanks"), true);
});

test("isPublicPath: an unrelated path that merely starts with the same letters is private", () => {
  assert.equal(isPublicPath("/about-us"), false);
  assert.equal(isPublicPath("/contactless"), false);
});

test("isExactPublicPath matches only the configured exact paths and their subpaths", () => {
  assert.equal(isExactPublicPath("/about"), true);
  assert.equal(isExactPublicPath("/about/team"), true);
  assert.equal(isExactPublicPath("/abouts"), false);
  assert.equal(isExactPublicPath("/contact"), true);
  assert.equal(isExactPublicPath("/contacts"), false);
});

test("isPublicPath: existing prefix-matched public routes are unaffected", () => {
  assert.equal(isPublicPath("/"), true);
  assert.equal(isPublicPath("/pricing"), true);
  assert.equal(isPublicPath("/changelog"), true);
  assert.equal(isPublicPath("/changelog.xml"), true);
  assert.equal(isPublicPath("/u/someuser"), true);
  assert.equal(isPublicPath("/share/abc123"), true);
});

test("isPublicPath: authenticated app routes still require a session", () => {
  assert.equal(isPublicPath("/settings"), false);
  assert.equal(isPublicPath("/shares"), false);
  assert.equal(isPublicPath("/api/exports/contacts"), false);
});

test("isAlwaysAllowed still bypasses gating for static assets and auth endpoints", () => {
  assert.equal(isAlwaysAllowed("/_next/static/chunk.js"), true);
  assert.equal(isAlwaysAllowed("/api/auth/session"), true);
  assert.equal(isAlwaysAllowed("/contact"), false);
});
