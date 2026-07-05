import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPrivateOverlay,
  hasVisiblePrivateFields,
  mergeContactPrivateFields,
  selectVisiblePrivateFields,
  type ContactPrivateFieldRow,
} from "../../src/lib/contact-private-fields";

type PhoneEntry = { number: string; label: string | null };

const OWNER = "user_owner";
const OTHER = "user_other";

// Two accounts share a book. The owner has a private phone overlay; the other
// member has none. Both read the same contact.
const privateFields: ContactPrivateFieldRow<PhoneEntry>[] = [
  {
    userId: OWNER,
    fieldType: "PHONE",
    label: "home",
    position: 1,
    value: { number: "+1-555-0100", label: "home" },
  },
  {
    userId: OWNER,
    fieldType: "PHONE",
    label: "cell",
    position: 0,
    value: { number: "+1-555-0199", label: "cell" },
  },
];

const shared = {
  PHONE: [{ number: "+1-555-0000", label: "work" }] as PhoneEntry[],
};

test("owner sees the shared row merged with their own overlay, ordered by position", () => {
  const merged = mergeContactPrivateFields({
    shared,
    privateFields,
    viewerUserId: OWNER,
  });
  assert.deepEqual(
    merged.PHONE.map((e) => e.number),
    ["+1-555-0000", "+1-555-0199", "+1-555-0100"],
    "shared first, then private ordered by position (cell=0 before home=1)",
  );
});

test("another book member sees the shared (base) row only", () => {
  const merged = mergeContactPrivateFields({
    shared,
    privateFields,
    viewerUserId: OTHER,
  });
  assert.deepEqual(
    merged.PHONE.map((e) => e.number),
    ["+1-555-0000"],
  );
});

test("an anonymous / null viewer sees the shared row only", () => {
  const merged = mergeContactPrivateFields({
    shared,
    privateFields,
    viewerUserId: null,
  });
  assert.deepEqual(merged.PHONE.map((e) => e.number), ["+1-555-0000"]);
});

test("visibility gate returns only the viewer's own rows", () => {
  assert.equal(selectVisiblePrivateFields(privateFields, OWNER).length, 2);
  assert.equal(selectVisiblePrivateFields(privateFields, OTHER).length, 0);
  assert.equal(hasVisiblePrivateFields(privateFields, OWNER), true);
  assert.equal(hasVisiblePrivateFields(privateFields, OTHER), false);
});

test("buildPrivateOverlay groups by field type and drops unknown types", () => {
  const rows: ContactPrivateFieldRow[] = [
    { userId: OWNER, fieldType: "EMAIL", position: 0, value: { address: "a@b.c" } },
    { userId: OWNER, fieldType: "MYSTERY", position: 0, value: { x: 1 } },
  ];
  const overlay = buildPrivateOverlay(rows, OWNER);
  assert.deepEqual(Object.keys(overlay), ["EMAIL"]);
  assert.equal(overlay.EMAIL?.length, 1);
});
