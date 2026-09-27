import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { NextRequest } from "next/server";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-13 step 5 — the smaller account-security items:
 *
 *   - `javascript:` (and other script/embed schemes) never pass website
 *     validation and never render as a link;
 *   - cookie-authed side-effecting GETs refuse cross-site requests, and the
 *     CardDAV book re-discovery is a POST;
 *   - X-Forwarded-For is not trusted in production;
 *   - the username probe needs a session and is rate-limited;
 *   - public-card views are limited per IP (per card and overall);
 *   - REST API: invalid-token spraying is cut off per IP before the lookup,
 *     and a rate-limited request is not counted as a use;
 *   - archive import: size refused from Content-Length, one upload in flight
 *     per user, a per-user hourly limit.
 *
 * The real rate limiter runs (in-memory: no REDIS_URL in tests); the session,
 * DB and billing boundaries are mocked.
 */

let currentDb: unknown;
mock.module("~/server/db", {
  namedExports: {
    db: new Proxy({}, { get: (_t, prop) => (currentDb as Record<string, unknown>)[prop as string] }),
  },
});

class FakeSessionError extends Error {
  code = "UNAUTHENTICATED";
}
let sessionUserId: string | null = "user_1";
let sessionChecks = 0;
mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => {
      sessionChecks += 1;
      if (!sessionUserId) throw new FakeSessionError("UNAUTHENTICATED");
      return sessionUserId;
    },
    isSessionError: (err: unknown) => err instanceof FakeSessionError,
    sessionErrorMessage: () => "",
  },
});

mock.module("~/server/billing", {
  namedExports: {
    getUserBillingContext: async () => ({ entitlements: { apiAccessEnabled: true } }),
  },
});

let validateCalls = 0;
let validToken: string | null = null;
const recordedUses: string[] = [];
mock.module("~/server/api-tokens", {
  namedExports: {
    validateApiToken: async (token: string) => {
      validateCalls += 1;
      return token === validToken ? { userId: "user_1", scope: "READ_ONLY", tokenHash: `hash-of-${token}` } : null;
    },
    recordApiTokenUse: (hash: string) => {
      recordedUses.push(hash);
    },
  },
});

const discoveries: unknown[] = [];
mock.module("~/server/carddav", {
  namedExports: {
    CardDavPreflightError: class CardDavPreflightError extends Error {},
    discoverCardDavAddressBooks: async (args: unknown) => {
      discoveries.push(args);
      return [{ url: "https://dav.example.com/book/", displayName: "Book", ctag: "1", readOnly: false }];
    },
  },
});
mock.module("~/server/sync-credentials", {
  namedExports: { decryptSyncCredentialPayload: () => ({ username: "u", password: "p" }) },
});

const { isSafeWebUrl, hasDangerousUrlScheme, safeExternalHref } = await import("../../src/lib/safe-url");
const { isSameOriginRequest } = await import("../../src/server/same-origin");
const { getClientIp } = await import("../../src/lib/client-ip");
const { clientIpFromNodeHeaders } = await import("../../src/server/dav/client-ip.mjs");
const { checkUsernameAvailability } = await import("../../src/app/actions/username");
const { recordCardView } = await import("../../src/server/public-card/analytics");
const { buildPersonSchema } = await import("../../src/server/public-card/get-card");
const { withApiAuth } = await import("../../src/app/api/v1/_lib/auth");
const { checkApiRateLimit } = await import("../../src/server/api-rate-limit");
const { beginArchiveImport } = await import("../../src/server/archive-import-guard");
const booksRoute = await import("../../src/app/api/sync/[accountId]/books/route");

let fake: ReturnType<typeof createFakePrisma>;
beforeEach(() => {
  fake = createFakePrisma();
  currentDb = fake.client;
  sessionUserId = "user_1";
});

// ── javascript: URLs ─────────────────────────────────────────────────────────

const DANGEROUS = [
  "javascript:alert(1)",
  "JavaScript:alert(document.cookie)",
  "  javascript:alert(1)",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
  "vbscript:msgbox(1)",
  "data:text/html,<script>alert(1)</script>",
  "file:///etc/passwd",
];

test("website validation: only http(s) passes; script and embed schemes never do", () => {
  for (const url of DANGEROUS) {
    assert.equal(isSafeWebUrl(url), false, url);
    assert.equal(hasDangerousUrlScheme(url), true, url);
    assert.equal(safeExternalHref(url), null, url);
  }
  assert.equal(isSafeWebUrl("https://example.com/me"), true);
  assert.equal(isSafeWebUrl("http://example.com"), true);
  assert.equal(isSafeWebUrl("example.com"), false, "the full-URL fields still need a scheme");
  assert.equal(hasDangerousUrlScheme("example.com"), false, "free text is not dangerous");
  assert.equal(hasDangerousUrlScheme("ftp://example.com"), false);
});

test("render: http(s) links pass, bare hosts get https://, everything else is text", () => {
  assert.equal(safeExternalHref("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.equal(safeExternalHref("example.com"), "https://example.com/");
  assert.equal(safeExternalHref("www.example.co.uk/me"), "https://www.example.co.uk/me");
  assert.equal(safeExternalHref("ftp://example.com"), null);
  assert.equal(safeExternalHref("not a url"), null);
  assert.equal(safeExternalHref(""), null);
  assert.equal(safeExternalHref(null), null);
});

test("public card structured data drops a stored javascript: website", () => {
  const schema = buildPersonSchema({
    userId: "u",
    username: "jane",
    displayName: "Jane",
    avatarUrl: null,
    jobTitle: null,
    company: null,
    visibleFields: {} as never,
    emails: [],
    phones: [],
    websites: ["javascript:alert(1)", "https://jane.example"],
  });
  assert.deepEqual(schema.sameAs, ["https://jane.example/"]);
  assert.ok(!JSON.stringify(schema).includes("javascript:"));
});

// ── same-origin for cookie-authed GETs ───────────────────────────────────────

const req = (url: string, headers: Record<string, string>, method = "GET") =>
  new Request(url, { method, headers });

test("isSameOriginRequest reads Sec-Fetch-Site, then Origin", () => {
  const url = "https://app.example.com/api/exports/contacts/csv";
  assert.equal(isSameOriginRequest(req(url, { "sec-fetch-site": "same-origin" })), true);
  assert.equal(isSameOriginRequest(req(url, { "sec-fetch-site": "none" })), true);
  assert.equal(isSameOriginRequest(req(url, { "sec-fetch-site": "cross-site" })), false);
  assert.equal(isSameOriginRequest(req(url, { "sec-fetch-site": "same-site" })), false);
  assert.equal(isSameOriginRequest(req(url, { origin: "https://app.example.com" })), true);
  assert.equal(isSameOriginRequest(req(url, { origin: "https://evil.example" })), false);
  assert.equal(isSameOriginRequest(req(url, {})), true, "no browser signal to judge by");
});

test("book discovery: a cross-site request is refused before auth; refresh is a POST", async () => {
  fake.seed("syncAccount", {
    id: "acct_1",
    userId: "user_1",
    status: "ACTIVE",
    baseUrl: "https://dav.example.com/",
    principalUrl: null,
    credentialReference: "enc",
    credentialRevokedAt: null,
    discoveredBooks: [{ url: "cached" }],
    booksDiscoveredAt: new Date(),
  });
  const context = { params: Promise.resolve({ accountId: "acct_1" }) };
  const url = "https://app.example.com/api/sync/acct_1/books";

  sessionChecks = 0;
  const crossSite = await booksRoute.POST(req(url, { "sec-fetch-site": "cross-site" }, "POST"), context);
  assert.equal(crossSite.status, 403);
  assert.equal(sessionChecks, 0, "refused before the session is even consulted");
  assert.equal(discoveries.length, 0);

  // GET serves the fresh cache and ignores the old ?refresh=1 switch.
  const cached = await booksRoute.GET(req(`${url}?refresh=1`, { "sec-fetch-site": "same-origin" }), context);
  assert.equal(cached.status, 200);
  assert.equal(((await cached.json()) as { cached: boolean }).cached, true);
  assert.equal(discoveries.length, 0);

  // POST forces a re-discovery.
  const refreshed = await booksRoute.POST(req(url, { "sec-fetch-site": "same-origin" }, "POST"), context);
  assert.equal(refreshed.status, 200);
  assert.equal(((await refreshed.json()) as { cached: boolean }).cached, false);
  assert.equal(discoveries.length, 1);
});

// ── X-Forwarded-For ──────────────────────────────────────────────────────────

const withEnv = async (vars: Record<string, string | undefined>, fn: () => void | Promise<void>) => {
  const env = process.env as Record<string, string | undefined>;
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, env[k]]));
  Object.assign(env, vars);
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete env[k];
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }
};

test("production trusts CF-Connecting-IP only; X-Forwarded-For is ignored (both twins)", async () => {
  const spoofed = { "x-forwarded-for": "203.0.113.66", "x-real-ip": "203.0.113.67" };
  await withEnv({ NODE_ENV: "production", KONTAX_TRUST_FORWARDED_FOR: undefined }, () => {
    assert.equal(getClientIp(new Headers(spoofed)), null);
    assert.equal(clientIpFromNodeHeaders(spoofed), null);
    assert.equal(getClientIp(new Headers({ ...spoofed, "cf-connecting-ip": "198.51.100.1" })), "198.51.100.1");
  });
  await withEnv({ NODE_ENV: "production", KONTAX_TRUST_FORWARDED_FOR: "1" }, () => {
    assert.equal(getClientIp(new Headers(spoofed)), "203.0.113.66", "explicit opt-in for non-Cloudflare hosts");
    assert.equal(clientIpFromNodeHeaders(spoofed), "203.0.113.66");
  });
  await withEnv({ NODE_ENV: "test", KONTAX_TRUST_FORWARDED_FOR: undefined }, () => {
    assert.equal(getClientIp(new Headers(spoofed)), "203.0.113.66", "dev keeps the fallback");
  });
});

// ── username probe ───────────────────────────────────────────────────────────

test("username availability needs a session", async () => {
  sessionUserId = null;
  fake.seed("user", { id: "someone", username: "taken-name" });
  assert.equal(await checkUsernameAvailability("taken-name"), "invalid", "no answer without a session");
  sessionUserId = "user_1";
  assert.equal(await checkUsernameAvailability("taken-name"), "taken");
  assert.equal(await checkUsernameAvailability("free-name"), "available");
});

test("username availability is rate-limited per user", async () => {
  sessionUserId = "prober";
  let last: string | undefined;
  for (let i = 0; i < 61; i++) last = await checkUsernameAvailability(`name-${i}`);
  assert.equal(last, "rate_limited");
  sessionUserId = "someone-else";
  assert.equal(await checkUsernameAvailability("name-0"), "available", "per-user bucket");
});

// ── public card views ────────────────────────────────────────────────────────

test("a card view counts once per IP per card; one IP can't flood every card", async () => {
  fake.seed("user", { id: "card_owner", publicCardViews: 0 });
  for (let i = 0; i < 5; i++) await recordCardView("card_owner", undefined, "Mozilla/5.0", "198.51.100.10");
  assert.equal(fake.rows("publicCardView").length, 1, "refreshes from one IP count once");
  await recordCardView("card_owner", undefined, "Mozilla/5.0", "198.51.100.11");
  assert.equal(fake.rows("publicCardView").length, 2, "another visitor counts");

  for (let i = 0; i < 130; i++) {
    fake.seed("user", { id: `owner_${i}`, publicCardViews: 0 });
    await recordCardView(`owner_${i}`, undefined, "Mozilla/5.0", "198.51.100.99");
  }
  const fromFlooder = fake.rows("publicCardView").length - 2;
  assert.equal(fromFlooder, 120, "at most 120 counted views per IP per hour");
});

// ── REST API ─────────────────────────────────────────────────────────────────

const apiRequest = (token: string, ip: string) =>
  new NextRequest("https://app.example.com/api/v1/contacts", {
    headers: { authorization: `Bearer ${token}`, "cf-connecting-ip": ip },
  });

const ok = async () => new (await import("next/server")).NextResponse("ok");

test("invalid-token spraying is cut off per IP before the token lookup", async () => {
  validToken = "ktx_live_valid";
  validateCalls = 0;
  for (let i = 0; i < 30; i++) {
    const res = await withApiAuth(apiRequest(`ktx_live_guess${i}`, "203.0.113.5"), ok);
    assert.equal(res.status, 401);
  }
  assert.equal(validateCalls, 30);

  const blocked = await withApiAuth(apiRequest("ktx_live_guess31", "203.0.113.5"), ok);
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get("retry-after"));
  assert.equal(validateCalls, 30, "no lookup once the IP is blocked");

  // A different IP, and valid tokens, are unaffected.
  assert.equal((await withApiAuth(apiRequest("ktx_live_guess", "203.0.113.6"), ok)).status, 401);
  assert.equal((await withApiAuth(apiRequest("ktx_live_valid", "203.0.113.7"), ok)).status, 200);
});

test("usage is recorded only for requests that pass the rate limit", async () => {
  validToken = "ktx_live_counted";
  recordedUses.length = 0;
  // Exhaust this token's hourly read bucket directly.
  for (let i = 0; i < 1000; i++) await checkApiRateLimit("hash-of-ktx_live_counted", "READ_ONLY");

  const limited = await withApiAuth(apiRequest("ktx_live_counted", "203.0.113.8"), ok);
  assert.equal(limited.status, 429);
  assert.deepEqual(recordedUses, [], "a 429 is not a use");

  validToken = "ktx_live_fresh";
  const served = await withApiAuth(apiRequest("ktx_live_fresh", "203.0.113.8"), ok);
  assert.equal(served.status, 200);
  assert.deepEqual(recordedUses, ["hash-of-ktx_live_fresh"]);
});

// ── archive import ───────────────────────────────────────────────────────────

const MB = 1024 * 1024;
const upload = (bytes: number) =>
  new Request("https://app.example.com/api/imports/contacts/kontax/commit", {
    method: "POST",
    headers: { "content-length": String(bytes) },
  });

test("archive import: oversize refused from Content-Length, one in flight, hourly limit", async () => {
  const tooBig = await beginArchiveImport("importer", upload(80 * MB), 64 * MB);
  assert.deepEqual(tooBig.ok ? null : tooBig.status, 413);

  const first = await beginArchiveImport("importer", upload(10 * MB), 64 * MB);
  assert.ok(first.ok);
  const concurrent = await beginArchiveImport("importer", upload(10 * MB), 64 * MB);
  assert.equal(concurrent.ok ? null : concurrent.status, 429, "second upload while the first runs");
  const otherUser = await beginArchiveImport("someone-else", upload(10 * MB), 64 * MB);
  assert.ok(otherUser.ok, "the gate is per user");
  if (otherUser.ok) otherUser.release();
  first.release();

  // 20 per hour; one was used above, the refused concurrent one didn't count.
  let admitted = 1;
  for (;;) {
    const gate = await beginArchiveImport("importer", upload(MB), 64 * MB);
    if (!gate.ok) {
      assert.equal(gate.status, 429);
      break;
    }
    gate.release();
    admitted += 1;
    assert.ok(admitted <= 20, "more than 20 uploads admitted in an hour");
  }
  assert.equal(admitted, 20);
});
