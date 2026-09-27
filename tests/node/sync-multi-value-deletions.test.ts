// P49A-10 (A-19): inbound sync tells "field absent / not round-tripped by this
// provider" apart from "field present and empty". A phone removed on Google
// clears in Kontax; a family the provider did not return (or does not hold
// Kontax's values for) is never cleared. Google runs against the in-memory
// sync database and a stubbed People API — no network, no Postgres.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import type { people_v1 } from "@googleapis/people";

import { installFakeSyncDb } from "./_sync-fake-db";

const fake = installFakeSyncDb();
const google = await import("~/server/google-sync");
const { readMultiValueEntries } = await import("~/server/contact-multi-values");
const { mappedContactToWriteData, mappedContactToPortableContact } = await import(
  "~/server/sync-contact-mapping"
);
const { mapGraphContactToKontax } = await import("~/server/microsoft-sync-mapping");
const { resolveSyncProviderCapabilityProfile } = await import("~/server/sync-provider-capabilities");

type Person = people_v1.Schema$Person;
type ListParams = people_v1.Params$Resource$People$Connections$List;

const api = { onList: (() => ({ data: {} })) as (params: ListParams) => { data: people_v1.Schema$ListConnectionsResponse } };

const peopleStub = {
  people: {
    connections: { list: async (params: ListParams) => api.onList(params) },
    updateContact: async () => {
      throw new Error("unexpected push");
    },
    get: async ({ resourceName }: { resourceName: string }) => ({ data: { resourceName, etag: "fresh" } }),
    createContact: async () => {
      throw new Error("unexpected createContact");
    },
    deleteContact: async () => {
      throw new Error("unexpected deleteContact");
    },
  },
};
google.__setGooglePeopleApiFactoryForTests(async () => peopleStub as unknown as people_v1.People);

const account = {
  id: "acct_1",
  userId: "user_1",
  label: "Google (test)",
  credentialReference: "unused-in-tests",
  lastSyncCursor: null as string | null,
  conflictPolicy: "MANUAL" as const,
  syncDirection: "TWO_WAY" as const,
};

const runSync = (people: Person[], token: string) => {
  api.onList = () => ({ data: { connections: people, nextSyncToken: token } });
  return google.runGoogleSync({ ...account, lastSyncCursor: fake.lastCursorFor(account.id) ?? null });
};

const ada = (overrides: Partial<Person> = {}): Person => ({
  resourceName: "people/c1",
  etag: "e1",
  metadata: {},
  names: [{ givenName: "Ada", familyName: "Lovelace", displayName: "Ada Lovelace" }],
  emailAddresses: [{ value: "ada@example.com", type: "home" }],
  phoneNumbers: [
    { value: "+447700900001", type: "mobile", metadata: { primary: true } },
    { value: "+447700900002", type: "work" },
  ],
  addresses: [{ formattedValue: "1 Main St, Springfield", streetAddress: "1 Main St", type: "home" }],
  ...overrides,
});

beforeEach(() => {
  fake.reset();
});

test("removing a phone on Google clears it in Kontax", async () => {
  await runSync([ada()], "t0");
  const seeded = fake.contactByRemoteUid("people/c1")!;
  assert.deepEqual(
    readMultiValueEntries(seeded).phoneEntries.map((e) => e.value),
    ["+447700900001", "+447700900002"],
  );

  // One number deleted on Google → the list shrinks.
  await runSync([ada({ etag: "e2", phoneNumbers: [{ value: "+447700900002", type: "work" }] })], "t1");
  const shrunk = fake.contactByRemoteUid("people/c1")!;
  assert.deepEqual(readMultiValueEntries(shrunk).phoneEntries.map((e) => e.value), ["+447700900002"]);
  assert.equal(shrunk.phone, "+447700900002");
  assert.deepEqual(shrunk.phoneNumbers, ["+447700900002"]);

  // The last number deleted: Google omits the empty `phoneNumbers` family from
  // the Person, which for a requested personField means "none" — Kontax clears.
  const { phoneNumbers: _dropped, ...withoutPhones } = ada({ etag: "e3" });
  const result = await runSync([withoutPhones], "t2");
  assert.equal(result.conflicts, 0);
  const cleared = fake.contactByRemoteUid("people/c1")!;
  assert.deepEqual(readMultiValueEntries(cleared).phoneEntries, []);
  assert.equal(cleared.phone, null);
  // Nothing else moved.
  assert.deepEqual(readMultiValueEntries(cleared).emailEntries.map((e) => e.value), ["ada@example.com"]);
  assert.deepEqual(readMultiValueEntries(cleared).addressEntries.map((e) => e.formatted), [
    "1 Main St, Springfield",
  ]);
  assert.equal(fake.conflicts.length, 0);
});

test("a provider that does not return a family never clears it", () => {
  // Outlook JSON without any phone keys (a partial payload): phones are
  // omitted, so the write leaves them untouched…
  const graph = {
    id: "AAMk1",
    displayName: "Ada Lovelace",
    emailAddresses: [{ name: "Work", address: "ada@work.example" }],
    homeAddress: {},
    businessHomePage: null,
  };
  const mapped = mapGraphContactToKontax(graph)!;
  assert.deepEqual(mapped.omittedFamilies, ["phones"]);
  const microsoft = resolveSyncProviderCapabilityProfile({ provider: "MICROSOFT" });
  const data = mappedContactToWriteData(mapped, microsoft) as Record<string, unknown>;
  for (const key of ["phone", "phoneNumbers", "phoneEntries"]) {
    assert.ok(!(key in data), `${key} is not written`);
  }
  // …and are nulled on the shadow side so they never read as a remote change.
  assert.equal(mappedContactToPortableContact(mapped).phoneEntries, null);

  // Emails were present → applied. An emptied website (key present, null) is
  // a real deletion and clears.
  assert.deepEqual(
    (data.emailEntries as Array<{ value: string }>).map((e) => e.value),
    ["ada@work.example"],
  );
  assert.equal(data.website, null);

  // Outlook addresses are "partial" (the Graph push never sends them): an empty
  // Outlook address list is not evidence of a deletion, so it is left alone.
  assert.equal(microsoft.fields.addresses, "partial");
  for (const key of ["address", "postalAddresses", "addressEntries"]) {
    assert.ok(!(key in data), `${key} is not written`);
  }
  // A non-empty Outlook address still applies, as before.
  const withAddress = mapGraphContactToKontax({ ...graph, homeAddress: { street: "1 Main St", city: "Leeds" } })!;
  const addressData = mappedContactToWriteData(withAddress, microsoft) as Record<string, unknown>;
  assert.equal(addressData.address, "1 Main St, Leeds");
});

test("Google's profile treats every multi-value family as authoritative", () => {
  const googleProfile = resolveSyncProviderCapabilityProfile({ provider: "GOOGLE" });
  for (const family of ["emails", "phones", "addresses", "websites"] as const) {
    assert.equal(googleProfile.fields[family], "full");
  }
  const cardDav = resolveSyncProviderCapabilityProfile({ provider: "CARDDAV", baseUrl: "https://dav.example" });
  assert.equal(cardDav.fields.phones, "full");
});
