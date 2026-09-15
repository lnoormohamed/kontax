import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SHARING_POLICY,
  projectContactForSharing,
  resolveEffectiveSharingPolicy,
} from "../../src/lib/sharing-policy";

// P48-07 — the four copy/snapshot paths (family copy, team copy, static
// share, initial live-share snapshot) all route through
// projectContactForSharing before persisting. These tests exercise the pure
// projection directly — no DB — against the shapes those paths actually fetch
// (family.ts COPY_SELECT / teams.ts TEAM_COPY_SELECT / shares.ts
// SNAPSHOT_SELECT / contact-shares.ts LIVE_FIELD_SELECT).

test("family copy excludes notes", () => {
  const policy = resolveEffectiveSharingPolicy(null, null);
  const source = {
    fullName: "Jordan Rivera",
    email: "jordan@example.com",
    notes: "Allergic to peanuts — don't mention at the office party.",
  };
  const projected = projectContactForSharing(source, policy, "family");
  assert.equal(projected.notes, null, "notes never travel into a family-book copy");
  assert.equal(projected.fullName, "Jordan Rivera", "non-policy-governed fields pass through");
});

test("team copy excludes personal phone when the policy says so", () => {
  // Default policy: workPhone shared, personalPhone private.
  const policy = resolveEffectiveSharingPolicy(null, null);
  const source = {
    fullName: "Sam Lee",
    phone: "+1-555-0100", // the personal (home) entry happens to be primary
    phoneEntries: [
      { label: "work", value: "+1-555-0199" },
      { label: "home", value: "+1-555-0100", isPrimary: true },
    ],
  };
  const projected = projectContactForSharing(source, policy, "team");
  assert.deepEqual(
    projected.phoneEntries,
    [{ label: "work", value: "+1-555-0199" }],
    "the personal-labeled entry is dropped, the work-labeled entry survives",
  );
  assert.equal(
    projected.phone,
    "+1-555-0199",
    "the scalar convenience field is recomputed from the surviving entries, never leaking the dropped personal value",
  );
});

test("team copy honours a member policy that opts personalPhone in", () => {
  const policy = resolveEffectiveSharingPolicy({ personalPhone: true }, null);
  const source = {
    fullName: "Sam Lee",
    phone: "+1-555-0100",
    phoneEntries: [
      { label: "work", value: "+1-555-0199" },
      { label: "home", value: "+1-555-0100" },
    ],
  };
  const projected = projectContactForSharing(source, policy, "team");
  assert.equal(projected.phoneEntries?.length, 2, "both entries survive once personalPhone is opted in");
});

test("static share snapshot has no notes", () => {
  const policy = resolveEffectiveSharingPolicy(null, null);
  const source = {
    fullName: "Priya Nair",
    notes: "Owes me $20 from the trip",
    // Fields the family/team target WOULD strip under the default policy —
    // a static/live share is a deliberate one-to-one grant, so these must
    // survive untouched; only `notes` is ever dropped for this target.
    address: "1 Main St",
    birthday: "1988-04-02",
    customFields: { favoriteColor: "teal" },
  };
  const projected = projectContactForSharing(source, policy, "static-share");
  assert.equal(projected.notes, null, "notes never travel into a static-share snapshot");
  assert.equal(projected.address, "1 Main St", "a static share is not gated by the family/team policy");
  assert.equal(projected.birthday, "1988-04-02");
  assert.deepEqual(projected.customFields, { favoriteColor: "teal" });
});

// Mirrors LIVE_FIELD_SELECT (src/server/contact-shares.ts) — kept in sync by
// hand since that module pulls in `~/server/db` (env-validated) and isn't
// safe to import from a plain unit test.
const LIVE_FIELD_SELECT_KEYS = [
  "fullName",
  "firstName",
  "middleName",
  "lastName",
  "phoneticFirstName",
  "phoneticLastName",
  "namePrefix",
  "nameSuffix",
  "nickname",
  "email",
  "emailAddresses",
  "emailEntries",
  "phone",
  "phoneNumbers",
  "phoneEntries",
  "company",
  "phoneticCompany",
  "jobTitle",
  "website",
  "websiteEntries",
  "birthday",
  "address",
  "postalAddresses",
  "addressEntries",
  "avatarUrl",
  "labels",
  "significantDates",
  "relatedPeople",
  "customFields",
] as const;

test("live-share projection equals the LIVE_FIELD_SELECT field set", () => {
  const policy = resolveEffectiveSharingPolicy(null, null);
  // Shaped exactly like a LIVE_FIELD_SELECT fetch — no `notes` key, since that
  // select never fetches it in the first place.
  const source: Record<string, unknown> = {};
  for (const key of LIVE_FIELD_SELECT_KEYS) {
    source[key] = `value:${key}`;
  }

  const projected = projectContactForSharing(source, policy, "live-share");

  assert.deepEqual(
    [...Object.keys(projected)].sort(),
    [...LIVE_FIELD_SELECT_KEYS].sort(),
    "no key is added or removed relative to LIVE_FIELD_SELECT",
  );
  for (const key of LIVE_FIELD_SELECT_KEYS) {
    assert.equal(
      projected[key],
      source[key],
      `${key} is a deliberate one-to-one grant and must pass through unchanged`,
    );
  }
});

test("per-contact override that makes birthday shareable is honoured", () => {
  // A member's own sharingPolicy is this ticket's "per-contact" override seam
  // (resolveEffectiveSharingPolicy) — turning a private-by-default field on
  // for their shares still flows through the projection.
  const policy = resolveEffectiveSharingPolicy({ birthday: true }, null);
  assert.equal(policy.birthday, true);
  // Every other private-by-default field is untouched by the override.
  assert.equal(policy.homeAddress, DEFAULT_SHARING_POLICY.homeAddress);

  const source = {
    fullName: "Robin Diaz",
    birthday: "1995-11-30",
    address: "42 Wallaby Way",
  };
  const projected = projectContactForSharing(source, policy, "family");
  assert.equal(projected.birthday, "1995-11-30", "the opted-in field is carried into the copy");
  assert.equal(projected.address, null, "homeAddress is still private — the override is per-field, not blanket");
});
