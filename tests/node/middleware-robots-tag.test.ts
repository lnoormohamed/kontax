import assert from "node:assert/strict";
import { test } from "node:test";

import { NextRequest } from "next/server";

import middleware from "../../src/middleware";

// P50A-01: non-production deploys must carry `X-Robots-Tag: noindex,
// nofollow` on every response, as a belt-and-braces backstop to robots.ts's
// `Disallow: /` (in case robots.txt is bypassed or cached stale). Production
// responses must be byte-for-byte unchanged — no X-Robots-Tag header at all.
//
// `isProductionRuntime` (~/lib/site-url) reads process.env at call time, so
// toggling KONTAX_DEPLOY_ENV between these tests in the same process (one
// process per test FILE under node:test) is safe.
const ORIGINAL_DEPLOY_ENV = process.env.KONTAX_DEPLOY_ENV;

function restoreEnv() {
  if (ORIGINAL_DEPLOY_ENV === undefined) delete process.env.KONTAX_DEPLOY_ENV;
  else process.env.KONTAX_DEPLOY_ENV = ORIGINAL_DEPLOY_ENV;
}

test("middleware: non-production tags a public marketing page as noindex", () => {
  process.env.KONTAX_DEPLOY_ENV = "staging";
  try {
    const req = new NextRequest("https://kontax.vexon.co/pricing");
    const res = middleware(req);
    assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow");
  } finally {
    restoreEnv();
  }
});

test("middleware: non-production tags the login redirect as noindex", () => {
  process.env.KONTAX_DEPLOY_ENV = "staging";
  try {
    const req = new NextRequest("https://kontax.vexon.co/contacts");
    const res = middleware(req);
    // No session cookie on this request, so this exercises the redirect path.
    assert.equal(res.status, 307);
    assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow");
  } finally {
    restoreEnv();
  }
});

test("middleware: non-production tags an always-allowed asset path as noindex", () => {
  process.env.KONTAX_DEPLOY_ENV = "staging";
  try {
    const req = new NextRequest("https://kontax.vexon.co/manifest.webmanifest");
    const res = middleware(req);
    assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow");
  } finally {
    restoreEnv();
  }
});

test("middleware: production leaves responses without an X-Robots-Tag header", () => {
  process.env.KONTAX_DEPLOY_ENV = "production";
  try {
    const publicRes = middleware(new NextRequest("https://getkontax.com/pricing"));
    assert.equal(publicRes.headers.get("X-Robots-Tag"), null);

    const redirectRes = middleware(new NextRequest("https://getkontax.com/contacts"));
    assert.equal(redirectRes.status, 307);
    assert.equal(redirectRes.headers.get("X-Robots-Tag"), null);

    const assetRes = middleware(new NextRequest("https://getkontax.com/manifest.webmanifest"));
    assert.equal(assetRes.headers.get("X-Robots-Tag"), null);
  } finally {
    restoreEnv();
  }
});
