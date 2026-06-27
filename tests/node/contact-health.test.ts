import assert from "node:assert/strict";
import test from "node:test";

import {
  countContactsByHealth,
  hasIncompleteDates,
  hasNoLabels,
  hasSyncAttention,
  hasWeakMetadataCoverage,
  matchesContactHealth,
} from "../../src/server/contact-health";

test("contact health flags missing metadata, labels, and dates", () => {
  const contact = {
    email: "hello@example.com",
    phone: "+44 1234 567890",
    company: "",
    jobTitle: null,
    department: undefined,
    birthday: "",
    labels: [],
    significantDates: [],
  };

  assert.equal(hasWeakMetadataCoverage(contact), true);
  assert.equal(hasNoLabels(contact), true);
  assert.equal(hasIncompleteDates(contact), true);
  assert.equal(matchesContactHealth(contact, "missing-context"), true);
  assert.equal(matchesContactHealth(contact, "unlabeled"), true);
  assert.equal(matchesContactHealth(contact, "missing-dates"), true);
});

test("sync attention catches stale, errored, and paused links", () => {
  const now = new Date("2026-06-27T12:00:00.000Z");
  const staleDate = new Date("2026-04-01T12:00:00.000Z");

  assert.equal(
    hasSyncAttention(
      {
        syncLinks: [{ lastSyncedAt: staleDate, lastErrorCode: null, syncAccount: { status: "ACTIVE", lastSucceededAt: staleDate } }],
      },
      now,
    ),
    true,
  );

  assert.equal(
    hasSyncAttention(
      {
        syncLinks: [{ lastSyncedAt: now, lastErrorCode: "AUTH_FAILED", syncAccount: { status: "ERROR", lastSucceededAt: now } }],
      },
      now,
    ),
    true,
  );

  assert.equal(
    hasSyncAttention(
      {
        syncLinks: [{ lastSyncedAt: now, lastErrorCode: null, syncAccount: { status: "ACTIVE", lastSucceededAt: now } }],
      },
      now,
    ),
    false,
  );
});

test("contact health counts aggregate each queue independently", () => {
  const now = new Date("2026-06-27T12:00:00.000Z");
  const counts = countContactsByHealth(
    [
      { email: "", phone: "", labels: [], birthday: "", significantDates: [] },
      {
        email: "owner@example.com",
        phone: "+44 1111 111111",
        company: "",
        jobTitle: "",
        department: "",
        labels: ["vip"],
        birthday: "1989-10-28",
      },
      {
        email: "sync@example.com",
        phone: "+44 2222 222222",
        syncLinks: [{ lastSyncedAt: new Date("2026-01-01T00:00:00.000Z"), lastErrorCode: null, syncAccount: { status: "ACTIVE", lastSucceededAt: null } }],
      },
    ],
    now,
  );

  assert.deepEqual(counts, {
    "missing-methods": 1,
    "missing-context": 3,
    unlabeled: 2,
    "missing-dates": 2,
    "sync-attention": 1,
  });
});
