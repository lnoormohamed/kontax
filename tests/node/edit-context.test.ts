import test from "node:test";
import assert from "node:assert/strict";

import {
  partitionEditByLayer,
  resolveEditContext,
  resolveFieldLayer,
  type EditContext,
  type EditOrigin,
} from "../../src/lib/edit-context";
import { resolveEffectiveSharingPolicy } from "../../src/lib/sharing-policy";

const policy = resolveEffectiveSharingPolicy(null, null); // default: work shared, personal private

const ctx = (origin: EditOrigin, contactInSharedBook = true): EditContext => ({
  origin,
  contactInSharedBook,
  policy,
});

const personalPhone = { fieldType: "PHONE", label: "home" } as const;
const workPhone = { fieldType: "PHONE", label: "work" } as const;
const notes = { fieldType: "NOTE", label: null } as const;
const name = { fieldType: "NAME", label: null } as const;

// §6 row 1 — personal book context: policy applies.
test("personal-ui: policy applies (personal→PRIVATE, work→SHARED)", () => {
  const c = ctx({ kind: "personal-ui" });
  assert.equal(resolveFieldLayer(c, personalPhone), "PRIVATE");
  assert.equal(resolveFieldLayer(c, workPhone), "SHARED");
  assert.equal(resolveFieldLayer(c, notes), "PRIVATE");
  assert.equal(resolveFieldLayer(c, name), "SHARED");
});

// §6 row 2 — shared book context: explicit intent, always shared.
test("shared-ui: every field lands on the shared row regardless of policy", () => {
  const c = ctx({ kind: "shared-ui" });
  assert.equal(resolveFieldLayer(c, personalPhone), "SHARED");
  assert.equal(resolveFieldLayer(c, notes), "SHARED");
  assert.equal(resolveFieldLayer(c, workPhone), "SHARED");
});

// §6 row 3 — personal sync inbound: policy applies, private stays private.
test("personal-sync: policy applies (private stays private)", () => {
  const c = ctx({ kind: "personal-sync", syncLink: { syncAccountId: "acct_1" } });
  assert.equal(resolveFieldLayer(c, personalPhone), "PRIVATE");
  assert.equal(resolveFieldLayer(c, workPhone), "SHARED");
});

// §6 row 4 — shared-book sync inbound: shared row only.
test("shared-sync: shared row only", () => {
  const c = ctx({ kind: "shared-sync", syncLink: { syncAccountId: "acct_2" } });
  assert.equal(resolveFieldLayer(c, personalPhone), "SHARED");
  assert.equal(resolveFieldLayer(c, notes), "SHARED");
});

// Short-circuit — a contact in no shared book never uses the private layer.
test("no shared membership: everything is SHARED even for personal fields", () => {
  const c = ctx({ kind: "personal-ui" }, /* contactInSharedBook */ false);
  assert.equal(resolveFieldLayer(c, personalPhone), "SHARED");
  assert.equal(resolveFieldLayer(c, notes), "SHARED");
});

test("partitionEditByLayer splits a mixed edit in one pass", () => {
  const c = ctx({ kind: "personal-ui" });
  const { shared, private: priv } = partitionEditByLayer(c, [
    name,
    workPhone,
    personalPhone,
    notes,
  ]);
  assert.deepEqual(
    shared.map((f) => f.fieldType + ":" + (f.label ?? "")),
    ["NAME:", "PHONE:work"],
  );
  assert.deepEqual(
    priv.map((f) => f.fieldType + ":" + (f.label ?? "")),
    ["PHONE:home", "NOTE:"],
  );
});

test("resolveEditContext surfaces share-context and sync-link for callers (P41 seam)", () => {
  const personal = resolveEditContext(ctx({ kind: "personal-ui" }));
  assert.equal(personal.shareContext, "personal");
  assert.equal(personal.fromSync, false);
  assert.equal(personal.syncLink, null);

  const link = { syncAccountId: "acct_9", syncLinkId: "link_9" };
  const synced = resolveEditContext(ctx({ kind: "shared-sync", syncLink: link }));
  assert.equal(synced.shareContext, "shared");
  assert.equal(synced.fromSync, true);
  assert.deepEqual(synced.syncLink, link);
  assert.equal(synced.layerFor(personalPhone), "SHARED");
});
