import test from "node:test";
import assert from "node:assert/strict";

import { clientIpFromNodeHeaders, getRequestIp } from "../../src/server/dav/client-ip.mjs";
import { getClientIp } from "../../src/lib/client-ip";
import {
  davCredentialCacheKey,
  davCredentialMemoryDeleteByAppPasswordId,
  davCredentialMemoryDeleteByUserId,
  davCredentialMemoryGet,
  davCredentialMemorySet,
} from "../../src/server/dav/credential-cache.mjs";

// --- client IP precedence ---------------------------------------------------

test("cf-connecting-ip wins over x-forwarded-for and x-real-ip", () => {
  assert.equal(
    clientIpFromNodeHeaders({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      "x-real-ip": "10.0.0.3",
    }),
    "203.0.113.7",
  );
});

test("x-forwarded-for falls back to its first hop, then x-real-ip, then the socket", () => {
  assert.equal(
    clientIpFromNodeHeaders({ "x-forwarded-for": "203.0.113.9, 10.0.0.2" }),
    "203.0.113.9",
  );
  assert.equal(clientIpFromNodeHeaders({ "x-real-ip": " 203.0.113.11 " }), "203.0.113.11");
  assert.equal(clientIpFromNodeHeaders({}), null);

  assert.equal(
    getRequestIp({ headers: {}, socket: { remoteAddress: "198.51.100.4" } }),
    "198.51.100.4",
  );
  assert.equal(getRequestIp({ headers: {}, socket: {} }), "unknown");
  assert.equal(
    getRequestIp({
      headers: { "cf-connecting-ip": "203.0.113.7" },
      socket: { remoteAddress: "198.51.100.4" },
    }),
    "203.0.113.7",
  );
});

test("node:http array-valued headers take the first value", () => {
  assert.equal(clientIpFromNodeHeaders({ "cf-connecting-ip": ["203.0.113.7", "x"] }), "203.0.113.7");
});

test("the DAV server and the Next side resolve the same IP", () => {
  // `src/server/dav/client-ip.mjs` is the node:http twin of `src/lib/client-ip.ts`
  // (server.mjs is plain ESM and cannot import TypeScript). They must not drift.
  const cases: Array<Record<string, string>> = [
    { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.1", "x-real-ip": "10.0.0.3" },
    { "x-forwarded-for": "203.0.113.9, 10.0.0.2", "x-real-ip": "10.0.0.3" },
    { "x-real-ip": "203.0.113.11" },
    { "cf-connecting-ip": "   ", "x-forwarded-for": "203.0.113.9" },
    {},
  ];

  for (const headers of cases) {
    const webHeaders = new Headers(headers);
    assert.equal(
      clientIpFromNodeHeaders(headers),
      getClientIp(webHeaders),
      `divergence on ${JSON.stringify(headers)}`,
    );
  }
});

// --- verified-credential cache ---------------------------------------------

test("credential cache keys never contain the plaintext token", () => {
  const key = davCredentialCacheKey("user@example.com", "AbCdEfGhIjKlMnOpQrStUvWx");

  assert.match(key, /^[0-9a-f]{64}$/);
  assert.ok(!key.includes("AbCdEfGhIjKlMnOpQrStUvWx"));
  assert.notEqual(key, davCredentialCacheKey("other@example.com", "AbCdEfGhIjKlMnOpQrStUvWx"));
  assert.notEqual(key, davCredentialCacheKey("user@example.com", "different-token"));
});

test("memory cache round-trips, expires and invalidates by app password", () => {
  const key = davCredentialCacheKey("cache@example.com", "token-1");
  davCredentialMemorySet(key, { userId: "usr_1", appPasswordId: "ap_1" });

  assert.equal(davCredentialMemoryGet(key)?.userId, "usr_1");
  assert.equal(davCredentialMemoryGet(key)?.appPasswordId, "ap_1");

  assert.deepEqual(davCredentialMemoryDeleteByAppPasswordId("ap_1"), [key]);
  assert.equal(davCredentialMemoryGet(key), null, "revoke takes effect immediately");

  // Expired entries are evicted on read rather than served.
  davCredentialMemorySet(key, { userId: "usr_1", appPasswordId: "ap_1" }, -1);
  assert.equal(davCredentialMemoryGet(key), null);
});

test("memory cache invalidates by user (lifecycle change)", () => {
  const a = davCredentialCacheKey("lifecycle@example.com", "token-a");
  const b = davCredentialCacheKey("lifecycle@example.com", "token-b");

  davCredentialMemorySet(a, { userId: "usr_2", appPasswordId: "ap_2" });
  davCredentialMemorySet(b, { userId: "usr_2", appPasswordId: "ap_3" });

  assert.equal(davCredentialMemoryDeleteByUserId("usr_2").length, 2);
  assert.equal(davCredentialMemoryGet(a), null);
  assert.equal(davCredentialMemoryGet(b), null);
});
