import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SHARING_POLICY,
  isFieldShared,
  normalizeSharingPolicy,
  policyKeyForField,
  resolveEffectiveSharingPolicy,
} from "../../src/lib/sharing-policy";

// §5 — the default policy: work-context fields shared, personal fields private.
test("default policy shares work fields and keeps personal fields private", () => {
  const p = resolveEffectiveSharingPolicy(null, null);
  assert.deepEqual(p, DEFAULT_SHARING_POLICY);
  assert.equal(p.name, true);
  assert.equal(p.workEmail, true);
  assert.equal(p.workPhone, true);
  assert.equal(p.personalPhone, false);
  assert.equal(p.homeAddress, false);
  assert.equal(p.notes, false);
});

// §5 — a member may restrict further than the default (turn a shared field private).
test("member policy overrides the default per field", () => {
  const p = resolveEffectiveSharingPolicy({ workPhone: false, notes: true }, null);
  assert.equal(p.workPhone, false, "member turned an un-floored field private");
  assert.equal(p.notes, true, "member opted a private-by-default field in");
  assert.equal(p.workEmail, true, "unspecified keys fall back to the default");
});

// §3.4 — the Teams floor forces a field shared; a member cannot loosen it.
test("book floor overrides a looser member default", () => {
  const p = resolveEffectiveSharingPolicy(
    { workEmail: false, personalPhone: true },
    { workEmail: true },
  );
  assert.equal(p.workEmail, true, "floor forces workEmail shared despite member=false");
  assert.equal(
    p.personalPhone,
    true,
    "member may still loosen a field the floor does not pin",
  );
});

// §3.4 — the floor is a floor, not a ceiling: it never forces a field private.
test("floor does not force a field private", () => {
  const p = resolveEffectiveSharingPolicy({ notes: true }, { notes: false });
  assert.equal(p.notes, true, "floor=false is a no-op; member's true wins");
});

test("normalizeSharingPolicy drops non-boolean and unknown keys", () => {
  const clean = normalizeSharingPolicy({
    name: true,
    workPhone: "yes",
    bogus: true,
    notes: false,
  });
  assert.deepEqual(clean, { name: true, notes: false });
});

// §5 — the entry label drives the work/personal split for email and phone.
test("policyKeyForField splits work vs personal by entry label", () => {
  assert.equal(policyKeyForField("PHONE", "work"), "workPhone");
  assert.equal(policyKeyForField("PHONE", "home"), "personalPhone");
  assert.equal(policyKeyForField("PHONE", null), "personalPhone");
  assert.equal(policyKeyForField("EMAIL", "Office"), "workEmail");
  assert.equal(policyKeyForField("EMAIL", "personal"), "personalEmail");
  assert.equal(policyKeyForField("ADDRESS", "work"), "homeAddress");
  assert.equal(policyKeyForField("CUSTOM", null), "customFields");
});

test("isFieldShared resolves a concrete entry against the effective policy", () => {
  const p = resolveEffectiveSharingPolicy(null, null);
  assert.equal(isFieldShared("PHONE", "work", p), true);
  assert.equal(isFieldShared("PHONE", "home", p), false);
  assert.equal(isFieldShared("EMAIL", "personal", p), false);
});
