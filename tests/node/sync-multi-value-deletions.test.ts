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
const { mapGooglePersonToContact } = await import("~/server/google-sync-mapping");
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
  // The last sync saw Outlook holding a value in every family.
  const heldEverything = {
    emailEntries: [{ label: "Work", value: "old@work.example", isPrimary: true }],
    phoneEntries: [{ label: "Mobile", value: "+15550100", isPrimary: true }],
    addressEntries: [{ label: "Home", formatted: "9 Old Rd", isPrimary: true }],
    websiteEntries: [{ label: "Work", value: "https://old.example", isPrimary: true }],
  };
  const data = mappedContactToWriteData(mapped, microsoft, heldEverything) as Record<string, unknown>;
  for (const key of ["phone", "phoneNumbers", "phoneEntries"]) {
    assert.ok(!(key in data), `${key} is not written`);
  }
  // …and are nulled on the shadow side so they never read as a remote change.
  assert.equal(mappedContactToPortableContact(mapped).phoneEntries, null);

  // Emails were present → applied. An emptied website (key present, null)
  // that Outlook held at the last sync is a real deletion and clears.
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
  const addressData = mappedContactToWriteData(withAddress, microsoft, heldEverything) as Record<
    string,
    unknown
  >;
  assert.equal(addressData.address, "1 Main St, Leeds");
});

test("an empty remote list never clears values the provider did not hold at the last sync", () => {
  // Fable review scenario, unit level: the link's shadow shows Google held no
  // phone, so an empty inbound phone list is not a deletion — whatever phone
  // the contact has locally was added in Kontax and not pushed (yet).
  const googleProfile = resolveSyncProviderCapabilityProfile({ provider: "GOOGLE" });
  const { phoneNumbers: _none, ...person } = ada();
  const mapped = mapGooglePersonToContact(person)!;
  const noPhonesShadow = { emailEntries: [{ label: "Home", value: "ada@example.com", isPrimary: true }], phoneEntries: [] };
  const kept = mappedContactToWriteData(mapped, googleProfile, noPhonesShadow) as Record<string, unknown>;
  assert.ok(!("phoneEntries" in kept) && !("phone" in kept), "phones untouched");

  // No shadow at all (a link never synced, or a create) = no evidence.
  const noEvidence = mappedContactToWriteData(mapped, googleProfile, null) as Record<string, unknown>;
  assert.ok(!("phoneEntries" in noEvidence));

  // A pre-P49A-10 shadow (legacy keys only) still counts as evidence.
  const legacyShadow = { phone: "+447700900001", phoneNumbers: ["+447700900001"] };
  const cleared = mappedContactToWriteData(mapped, googleProfile, legacyShadow) as Record<string, unknown>;
  assert.equal(cleared.phone, null);
});

const runSyncWith = (people: Person[], token: string, conflictPolicy: "MANUAL" | "SERVER_WINS") => {
  api.onList = () => ({ data: { connections: people, nextSyncToken: token } });
  return google.runGoogleSync({ ...account, conflictPolicy, lastSyncCursor: fake.lastCursorFor(account.id) ?? null });
};

// Fable review scenario, end to end: Google has no phone; a phone arrives
// through a non-web writer (Kontax CardDAV PUT / REST API) and has not reached
// Google yet (this stub refuses pushes); then Google gets an unrelated edit.
// Since P49A-12 (A-17) that edit is a pending local change, not anchored away,
// so the outcome depends on the conflict policy — but the phone must survive
// either way, because Google never held a phone (P49A-10 evidence guard).
for (const policy of ["MANUAL", "SERVER_WINS"] as const) {
  test(`a phone added locally without a push survives an unrelated remote edit (${policy})`, async () => {
    const { phoneNumbers: _none, ...noPhone } = ada();
    await runSyncWith([noPhone], "t0", policy);
    const contact = fake.contactByRemoteUid("people/c1")!;
    assert.deepEqual(readMultiValueEntries(contact).phoneEntries, []);

    await new Promise((resolve) => setTimeout(resolve, 3));
    Object.assign(contact, {
      phoneEntries: [{ label: "Mobile", value: "+447700900555", isPrimary: true }],
      phone: "+447700900555",
      phoneNumbers: ["+447700900555"],
      lastMutatedBy: "API",
      updatedAt: new Date(),
    });

    await runSyncWith([noPhone], "t1", policy);
    await runSyncWith(
      [{ ...noPhone, etag: "e2", organizations: [{ name: "Analytical Engines Ltd" }] }],
      "t2",
      policy,
    );
    const after = fake.contactByRemoteUid("people/c1")!;
    assert.deepEqual(
      readMultiValueEntries(after).phoneEntries.map((e) => e.value),
      ["+447700900555"],
      "the unpushed phone is kept",
    );
    assert.equal(after.phone, "+447700900555");
    if (policy === "MANUAL") {
      // Both sides changed: surfaced for review, not silently resolved.
      assert.equal(fake.conflicts.length, 1);
    } else {
      // Remote wins for the fields it changed; the phone it never held stays.
      assert.equal(after.company, "Analytical Engines Ltd");
    }
  });
}

test("Google's profile treats every multi-value family as authoritative", () => {
  const googleProfile = resolveSyncProviderCapabilityProfile({ provider: "GOOGLE" });
  for (const family of ["emails", "phones", "addresses", "websites"] as const) {
    assert.equal(googleProfile.fields[family], "full");
  }
  const cardDav = resolveSyncProviderCapabilityProfile({ provider: "CARDDAV", baseUrl: "https://dav.example" });
  assert.equal(cardDav.fields.phones, "full");
});
