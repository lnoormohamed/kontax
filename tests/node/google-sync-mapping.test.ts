// P49A-01 (A-01, A-23): Google push body and update mask stay in lockstep.
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGoogleUpdatePersonFields,
  type GoogleContactSource,
  googlePersonFamiliesPresent,
  mapContactToGooglePerson,
  mapGooglePersonToContact,
} from "../../src/server/google-sync-mapping";
import { googleUpdateFieldsFor } from "../../src/server/sync-field-exclusions";
import {
  buildProviderSupportedContactShadow,
  resolveSyncProviderCapabilityProfile,
} from "../../src/server/sync-provider-capabilities";
import { mappedContactToPortableContact } from "../../src/server/sync-contact-mapping";

const GOOGLE = resolveSyncProviderCapabilityProfile({ provider: "GOOGLE" });

const maskOf = (mask: string) => new Set(mask.split(",").filter(Boolean));

// The audit's reproduction: an address, a website and a job title without a
// company. Prod's mapper sent only names/emails/phones/birthdays while masking
// addresses/urls/organizations — wiping them on Google on every push.
const auditContact: GoogleContactSource = {
  fullName: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  nickname: "Countess",
  jobTitle: "Analyst",
  company: null,
  emailEntries: [{ label: "Work", value: "ada@example.com", isPrimary: true }],
  phoneEntries: [{ label: "Mobile", value: "+447700900123", isPrimary: true }],
  websiteEntries: [{ label: "Work", value: "https://ada.example.com", isPrimary: true }],
  addressEntries: [
    {
      label: "Home",
      formatted: "12 St James's Square, London, SW1Y 4JH, United Kingdom",
      isPrimary: true,
      streetLine1: "12 St James's Square",
      cityOrTown: "London",
      postcode: "SW1Y 4JH",
      countryOrRegion: "United Kingdom",
    },
  ],
  birthday: "1815-12-10",
  notes: "Wrote the first program.",
};

test("push body carries addresses, urls, nicknames and a title without a company", () => {
  const body = mapContactToGooglePerson(auditContact);

  assert.deepEqual([...googlePersonFamiliesPresent(body)].sort(), [
    "addresses",
    "biographies",
    "birthdays",
    "emailAddresses",
    "names",
    "nicknames",
    "organizations",
    "phoneNumbers",
    "urls",
  ]);
  assert.equal(body.organizations?.[0]?.title, "Analyst");
  assert.equal(body.organizations?.[0]?.name, undefined);
  assert.equal(body.urls?.[0]?.value, "https://ada.example.com");
  assert.equal(body.urls?.[0]?.type, "work");
  assert.equal(body.addresses?.[0]?.streetAddress, "12 St James's Square");
  assert.equal(body.addresses?.[0]?.postalCode, "SW1Y 4JH");
  assert.equal(body.nicknames?.[0]?.value, "Countess");
});

test("Kontax -> Google -> Kontax round-trip keeps addresses, urls, title and nickname", () => {
  const body = mapContactToGooglePerson(auditContact);
  // What Google hands back on the next pull (resourceName/etag/metadata added).
  const mapped = mapGooglePersonToContact({
    ...body,
    resourceName: "people/c1",
    etag: "e1",
    metadata: {},
  });
  assert.ok(mapped);
  assert.equal(mapped.nickname, "Countess");
  assert.equal(mapped.jobTitle, "Analyst");
  assert.equal(mapped.company, null);
  assert.equal(mapped.website, "https://ada.example.com");
  assert.deepEqual(
    mapped.websiteEntries.map((e) => [e.label, e.value]),
    [["Work", "https://ada.example.com"]],
  );
  assert.equal(mapped.address, auditContact.addressEntries?.[0]?.formatted);
  assert.equal(mapped.addressEntries[0]?.label, "Home");
  assert.equal(mapped.addressEntries[0]?.streetLine1, "12 St James's Square");
  assert.equal(mapped.addressEntries[0]?.cityOrTown, "London");
  assert.equal(mapped.addressEntries[0]?.postcode, "SW1Y 4JH");
  assert.equal(mapped.addressEntries[0]?.countryOrRegion, "United Kingdom");
  assert.equal(mapped.birthday, "1815-12-10");
  assert.equal(mapped.notes, "Wrote the first program.");
});

test("legacy single-string address and website are pushed when no entries exist", () => {
  const body = mapContactToGooglePerson({
    fullName: "Grace Hopper",
    firstName: "Grace",
    address: "1 Navy Way, Arlington",
    website: "https://grace.example.com",
  });
  assert.equal(body.addresses?.[0]?.formattedValue, "1 Navy Way, Arlington");
  assert.equal(body.urls?.[0]?.value, "https://grace.example.com");
});

test("a display-name-only contact pushes an unstructured name instead of an empty one", () => {
  const body = mapContactToGooglePerson({ fullName: "Cher" });
  assert.deepEqual(body.names, [{ unstructuredName: "Cher" }]);
});

test("pull maps Google nicknames (A-23)", () => {
  const mapped = mapGooglePersonToContact({
    resourceName: "people/c9",
    names: [{ givenName: "Robert" }],
    nicknames: [{ value: "Bob" }],
  });
  assert.equal(mapped?.nickname, "Bob");
});

test("mask never names a family missing from the body when nothing was cleared", () => {
  const sparse: GoogleContactSource = {
    fullName: "Sparse Person",
    firstName: "Sparse",
    emailEntries: [{ label: "Home", value: "s@example.com", isPrimary: true }],
  };
  const body = mapContactToGooglePerson(sparse);
  // No shadow (legacy link) and a shadow that matches the body: same mask.
  for (const shadow of [null, { firstName: "Sparse", emailEntries: [{ value: "s@example.com" }] }]) {
    const mask = maskOf(buildGoogleUpdatePersonFields(body, shadow));
    assert.deepEqual([...mask].sort(), ["emailAddresses", "names"]);
    for (const family of mask) {
      assert.ok(googlePersonFamiliesPresent(body).has(family as never), `${family} masked but absent`);
    }
  }
});

test("mask adds an intentional clear only for families Google held at the last sync", () => {
  // Last sync: Google had an address, a URL and a title.
  const lastSynced = buildProviderSupportedContactShadow(
    mappedContactToPortableContact(
      mapGooglePersonToContact({
        resourceName: "people/c1",
        ...mapContactToGooglePerson(auditContact),
      })!,
    ),
    GOOGLE,
  );
  // The user then deleted the website and the address in Kontax.
  const edited: GoogleContactSource = {
    ...auditContact,
    website: null,
    websiteEntries: [],
    address: null,
    postalAddresses: [],
    addressEntries: [],
  };
  const body = mapContactToGooglePerson(edited);
  const mask = maskOf(buildGoogleUpdatePersonFields(body, lastSynced));

  assert.equal(body.urls, undefined);
  assert.equal(body.addresses, undefined);
  assert.ok(mask.has("urls"), "cleared website must be masked to clear it on Google");
  assert.ok(mask.has("addresses"), "cleared address must be masked to clear it on Google");
  assert.ok(mask.has("organizations"));
  // Relations were never pushed, so they can never be cleared by a push.
  assert.ok(!mask.has("relations"));
});

test("excluded families are withheld from the mask even when cleared", () => {
  const body = mapContactToGooglePerson({ fullName: "X", firstName: "X" });
  const mask = googleUpdateFieldsFor(
    buildGoogleUpdatePersonFields(body, { firstName: "X", address: "old", notes: "old" }),
    new Set(["ADR", "NOTE"]),
  );
  assert.deepEqual([...maskOf(mask)].sort(), ["names"]);
});
