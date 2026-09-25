import assert from "node:assert/strict";
import { test } from "node:test";

import robots from "../../src/app/robots";

// P50A-01: kontax.vexon.co (staging) was previously fully indexable —
// robots.ts had no environment branch at all. Non-production deploys must
// now return `Disallow: /` and no sitemap line; production behaviour must be
// byte-for-byte unchanged. `isProductionRuntime` (~/lib/site-url) reads
// process.env at call time (not at import time, unlike ~/env's parsed
// values), so toggling KONTAX_DEPLOY_ENV/NODE_ENV between these two tests in
// the same process is safe.
const ORIGINAL_DEPLOY_ENV = process.env.KONTAX_DEPLOY_ENV;

function restoreEnv() {
  if (ORIGINAL_DEPLOY_ENV === undefined) delete process.env.KONTAX_DEPLOY_ENV;
  else process.env.KONTAX_DEPLOY_ENV = ORIGINAL_DEPLOY_ENV;
}

test("robots(): production allows crawling and points at the sitemap", () => {
  process.env.KONTAX_DEPLOY_ENV = "production";
  try {
    const result = robots();
    assert.deepEqual(result.rules, {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/contacts",
        "/settings",
        "/admin",
        "/api",
        "/sync",
        "/import-export",
        "/merge",
        "/merge-suggestions",
        "/family",
        "/teams",
        "/share",
        "/settings/sharing/shared",
        "/dav",
        "/verify-email",
        "/reset-password",
        "/account-deleted",
        "/account-pending-deletion",
        "/revert-email",
        "/books",
      ],
    });
    assert.equal(result.sitemap, "https://getkontax.com/sitemap.xml");
    assert.equal(result.host, "https://getkontax.com");
  } finally {
    restoreEnv();
  }
});

test("robots(): non-production (staging) disallows everything and omits the sitemap", () => {
  process.env.KONTAX_DEPLOY_ENV = "staging";
  try {
    const result = robots();
    assert.deepEqual(result, {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    });
    assert.equal("sitemap" in result, false);
    assert.equal("host" in result, false);
  } finally {
    restoreEnv();
  }
});
