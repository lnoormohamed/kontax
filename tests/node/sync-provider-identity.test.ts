import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  formatProviderIdentitySecondaryText,
  resolveSyncProviderIdentity,
} from "../../src/server/sync-provider-identity";
import { resolveSyncProviderCapabilityProfile } from "../../src/server/sync-provider-capabilities";

const loadFixture = <T>(path: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), path), "utf8"),
  ) as T;

test("verified providers come only from trusted host mappings", () => {
  const identity = resolveSyncProviderIdentity({
    provider: "CARDDAV",
    label: "Personal DAV",
    baseUrl: "https://contacts.icloud.com",
  });

  assert.equal(identity.providerVerificationState, "VERIFIED");
  assert.equal(identity.providerDisplayName, "iCloud");
  assert.equal(identity.providerBrandKey, "icloud");
  assert.equal(
    formatProviderIdentitySecondaryText(identity),
    "Verified provider: iCloud",
  );
});

test("untrusted labels do not promote a generic host into a verified provider", () => {
  const fixture = loadFixture<{
    provider: "CARDDAV";
    label: string;
    baseUrl: string;
    addressBookUrl: string;
  }>("tests/fixtures/provider-identity/carddav-generic-safe.json");

  const identity = resolveSyncProviderIdentity(fixture);
  const profile = resolveSyncProviderCapabilityProfile(fixture);

  assert.equal(identity.providerVerificationState, "GENERIC");
  assert.equal(identity.providerDisplayName, null);
  assert.equal(identity.providerHost, "carddav.example.net");
  assert.equal(profile.id, "carddav-generic-safe");
});

test("detected-but-unverified hosts remain neutral while still being distinguishable", () => {
  const fixture = loadFixture<{
    provider: "CARDDAV";
    label: string;
    baseUrl: string;
    addressBookUrl: string;
  }>("tests/fixtures/provider-identity/carddav-clickup.json");

  const identity = resolveSyncProviderIdentity(fixture);

  assert.equal(identity.providerVerificationState, "DETECTED_UNVERIFIED");
  assert.equal(identity.providerDisplayName, "ClickUp");
  assert.equal(identity.providerBrandKey, "clickup");
  assert.equal(
    formatProviderIdentitySecondaryText(identity),
    "Detected from dav.clickup.com",
  );
});
