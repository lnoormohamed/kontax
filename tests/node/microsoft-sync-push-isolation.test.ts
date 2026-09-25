// P49A-01 (A-07): one failing Outlook contact must not abort the push phase
// or starve the import. In-memory database + stubbed fetch, no network.
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { installFakeSyncDb } from "./_sync-fake-db";

const fake = installFakeSyncDb();
const microsoft = await import("~/server/microsoft-sync");

microsoft.__setMicrosoftAccessTokenProviderForTests(async () => "test-token");

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Call = { method: string; url: string };

const graphContact = (n: number, etag = `W/"e${n}"`) => ({
  id: `c${n}`,
  "@odata.etag": etag,
  givenName: `Given${n}`,
  surname: `Family${n}`,
  displayName: `Given${n} Family${n}`,
  emailAddresses: [{ name: "Home", address: `p${n}@example.com` }],
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const installGraph = (handler: (call: Call) => Response) => {
  const calls: Call[] = [];
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const call = { method: init?.method ?? "GET", url };
    calls.push(call);
    return handler(call);
  };
  return calls;
};

const account = {
  id: "acct_ms",
  userId: "user_1",
  label: "Outlook (test)",
  credentialReference: "unused-in-tests",
  lastSyncCursor: null as string | null,
  conflictPolicy: "MANUAL" as const,
  syncDirection: "TWO_WAY" as const,
};

test("a 400 on contact N leaves N+1 pushed, records the error, and still imports", async () => {
  // Seed three linked contacts via a full delta import.
  installGraph(() =>
    json(200, {
      value: [graphContact(1), graphContact(2), graphContact(3)],
      "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/contacts/delta?$deltatoken=d1",
    }),
  );
  await microsoft.runMicrosoftSync(account);
  assert.equal(fake.links.size, 3);

  for (const n of [1, 2, 3]) {
    await fake.editContact(fake.contactByRemoteUid(`c${n}`)!.id, { nickname: `Nick${n}` });
  }

  const calls = installGraph((call) => {
    if (call.method === "PATCH") {
      if (call.url.endsWith("/me/contacts/c2")) {
        return json(400, { error: { code: "ErrorInvalidProperty", message: "bad nickname" } });
      }
      const id = call.url.split("/").at(-1)!;
      return json(200, { id, "@odata.etag": `W/"${id}-pushed"` });
    }
    return json(200, {
      value: [],
      "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/contacts/delta?$deltatoken=d2",
    });
  });

  const result = await microsoft.runMicrosoftSync({
    ...account,
    lastSyncCursor: fake.lastCursorFor(account.id) ?? null,
  });

  assert.deepEqual(
    calls.filter((c) => c.method === "PATCH").map((c) => c.url.split("/").at(-1)),
    ["c1", "c2", "c3"],
  );
  assert.equal(result.pushedUpdated, 2);
  assert.equal(result.pushFailed, 1);
  assert.ok(
    calls.some((c) => c.method === "GET" && c.url.includes("deltatoken=d1")),
    "the import phase still ran",
  );
  assert.equal(fake.linkByRemoteUid("c2")!.lastErrorCode, "MICROSOFT_SYNC_FAILED");
  assert.equal(fake.linkByRemoteUid("c3")!.lastErrorCode, null);
});

test("an auth failure during push still aborts the whole run", async () => {
  fake.reset();
  installGraph(() =>
    json(200, {
      value: [graphContact(1), graphContact(2)],
      "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/contacts/delta?$deltatoken=d1",
    }),
  );
  await microsoft.runMicrosoftSync(account);
  for (const n of [1, 2]) {
    await fake.editContact(fake.contactByRemoteUid(`c${n}`)!.id, { nickname: "x" });
  }

  const calls = installGraph(() => json(401, { error: { code: "InvalidAuthenticationToken" } }));
  await assert.rejects(
    microsoft.runMicrosoftSync({ ...account, lastSyncCursor: fake.lastCursorFor(account.id) ?? null }),
    (error: unknown) =>
      error instanceof microsoft.MicrosoftSyncError && error.code === "MICROSOFT_AUTH_FAILED",
  );
  assert.equal(calls.length, 1, "stops at the first account-level failure");
});
