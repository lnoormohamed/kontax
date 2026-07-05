import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildProviderCapabilityDiagnostics,
  buildProviderSupportedContactShadow,
  describeProviderFieldFamilies,
  getCardDavVCardFlavor,
  projectPortableContactForProvider,
  providerSupportedShadowsEqual,
  resolveSyncProviderCapabilityProfile,
} from "../../src/server/sync-provider-capabilities";
import { contactsToVCard, type PortableContactInput } from "../../src/server/contact-portability";

const loadFixture = <T>(path: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), path), "utf8"),
  ) as T;

const contactFixture = loadFixture<PortableContactInput>(
  "tests/fixtures/provider-fixtures/multi-date-contact.json",
);

test("generic-safe CardDAV strips unsupported significant dates and reports diagnostics", () => {
  const profile = resolveSyncProviderCapabilityProfile({
    provider: "CARDDAV",
    baseUrl: "https://dav.example.net/addressbooks/user/default",
  });
  const projected = projectPortableContactForProvider(contactFixture, profile);
  const diagnostics = buildProviderCapabilityDiagnostics(contactFixture, profile);

  assert.equal(profile.id, "carddav-generic-safe");
  assert.equal(projected.significantDates, undefined);
  assert.deepEqual(diagnostics, {
    unsupportedFieldFamilies: ["significantDates"],
    unsupportedFieldCount: 2,
  });
});

test("iCloud keeps significant dates in the supported contact shadow", () => {
  const profile = resolveSyncProviderCapabilityProfile({
    provider: "CARDDAV",
    baseUrl: "https://contacts.icloud.com",
  });
  const shadow = buildProviderSupportedContactShadow(contactFixture, profile);

  assert.equal(profile.id, "carddav-icloud");
  assert.equal(shadow.significantDates?.length, 2);
  assert.equal(shadow.significantDates?.[0]?.label, "Anniversary");
});

test("phone formatting differences do not manufacture supported-field drift", () => {
  const profile = resolveSyncProviderCapabilityProfile({
    provider: "CARDDAV",
    baseUrl: "https://carddav.fastmail.com/dav/addressbooks/user/x/Default",
  });
  const withPhone = (raw: string): PortableContactInput => ({
    ...contactFixture,
    phone: raw,
    phoneNumbers: [raw],
    phoneEntries: [{ label: "phone", value: raw, isPrimary: true }],
  });

  // kontax stores space-stripped; CardDAV round-trips the spaces — same number.
  const local = buildProviderSupportedContactShadow(withPhone("+447799720622"), profile);
  const remote = buildProviderSupportedContactShadow(withPhone("+44 7799 720622"), profile);
  assert.equal(providerSupportedShadowsEqual(local, remote), true);

  // A national-format local vs international-format remote of the same number.
  const localNational = buildProviderSupportedContactShadow(withPhone("07799720622"), profile);
  assert.equal(providerSupportedShadowsEqual(localNational, remote), true);

  // A genuinely different number must still register as drift.
  const other = buildProviderSupportedContactShadow(withPhone("+44 7700 900123"), profile);
  assert.equal(providerSupportedShadowsEqual(local, other), false);
});

test("generic address labels do not manufacture supported-field drift, but explicit ones do", () => {
  const profile = resolveSyncProviderCapabilityProfile({
    provider: "CARDDAV",
    baseUrl: "https://carddav.fastmail.com/dav/addressbooks/user/x/Default",
  });
  const withAddressLabel = (label: string): PortableContactInput => ({
    ...contactFixture,
    postalAddresses: [{ label, formatted: "26 Kings Drive, Eastbourne, BN21 2NU" }],
    addressEntries: [
      { label, formatted: "26 Kings Drive, Eastbourne, BN21 2NU", isPrimary: true },
    ],
  });

  // kontax's generic placeholder labels vs the CardDAV round-trip default "home".
  const local = buildProviderSupportedContactShadow(withAddressLabel("address"), profile);
  const localPrimary = buildProviderSupportedContactShadow(withAddressLabel("primary"), profile);
  const remote = buildProviderSupportedContactShadow(withAddressLabel("home"), profile);
  assert.equal(providerSupportedShadowsEqual(local, remote), true);
  assert.equal(providerSupportedShadowsEqual(localPrimary, remote), true);

  // An explicit "work" label is a genuine difference — must still register.
  const work = buildProviderSupportedContactShadow(withAddressLabel("work"), profile);
  assert.equal(providerSupportedShadowsEqual(work, remote), false);
});

test("generic-safe roundtrips supported fields without turning unsupported dates into drift", () => {
  const profile = resolveSyncProviderCapabilityProfile({
    provider: "CARDDAV",
    baseUrl: "https://dav.example.net/addressbooks/user/default",
  });
  const originalShadow = buildProviderSupportedContactShadow(contactFixture, profile);
  const remoteProjectionShadow = buildProviderSupportedContactShadow(
    projectPortableContactForProvider(contactFixture, profile),
    profile,
  );

  assert.equal(
    providerSupportedShadowsEqual(originalShadow, remoteProjectionShadow),
    true,
  );
});

test("generic CardDAV exports custom website labels via X-ABLABEL", () => {
  const vcard = contactsToVCard([contactFixture], { flavor: "generic" });

  assert.match(vcard, /X-ABLABEL:Press/);
  assert.match(vcard, /X-ABLABEL:Calendar/);
});

test("Fastmail exports custom website labels as online services", () => {
  const profile = resolveSyncProviderCapabilityProfile({
    provider: "CARDDAV",
    baseUrl: "https://carddav.fastmail.com/dav/addressbooks",
  });
  const vcard = contactsToVCard([contactFixture], {
    flavor: getCardDavVCardFlavor(profile),
  });

  assert.match(vcard, /X-CYRUS-ONLINESERVICE;X-SERVICE-TYPE=Press/);
  assert.match(vcard, /X-CYRUS-ONLINESERVICE;X-SERVICE-TYPE=Calendar/);
});

test("provider field-family diagnostics mark unsupported significant dates as local-only", () => {
  const googleProfile = resolveSyncProviderCapabilityProfile({
    provider: "GOOGLE",
  });
  const icloudProfile = resolveSyncProviderCapabilityProfile({
    provider: "CARDDAV",
    baseUrl: "https://contacts.icloud.com",
  });

  const googleDates = describeProviderFieldFamilies(googleProfile).find(
    (field) => field.key === "significantDates",
  );
  const icloudDates = describeProviderFieldFamilies(icloudProfile).find(
    (field) => field.key === "significantDates",
  );

  assert.equal(googleDates?.support, "local_only");
  assert.match(googleDates?.detail ?? "", /stay in Kontax/i);
  assert.equal(icloudDates?.support, "two_way");
  assert.match(icloudDates?.detail ?? "", /sync with iCloud/i);
});
