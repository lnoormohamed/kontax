import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AGED_AFTER_DAYS,
  deriveAging,
  deriveEventAffix,
  resolveShareInviteOutcome,
} from "../../src/app/_components/notification-categories";

// P46-DB03: the two aging triggers are computed independently. These pin the
// invariant so P46-06's render treatment (and the emitters that set eventAt /
// expiresAt) stay in agreement.

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 5, 12, 0, 0); // 2026-07-05 12:00 UTC
const iso = (ms: number) => new Date(ms).toISOString();

test("aged fires on createdAt older than the threshold, not before", () => {
  const fresh = deriveAging({ createdAt: iso(NOW - 3 * DAY) }, NOW);
  assert.equal(fresh.aged, false);
  assert.equal(fresh.muted, false);

  // Exactly at the boundary counts as aged (>=).
  const boundary = deriveAging({ createdAt: iso(NOW - AGED_AFTER_DAYS * DAY) }, NOW);
  assert.equal(boundary.aged, true);

  const old = deriveAging({ createdAt: iso(NOW - 8 * DAY) }, NOW);
  assert.equal(old.aged, true);
  assert.equal(old.eventPassed, false);
  assert.equal(old.muted, true);
});

test("event-passed can fire on a fresh row and is independent of aged", () => {
  // Created 1 day ago (fresh), but its eventAt is already behind us → passed-only.
  const passedFresh = deriveAging(
    { createdAt: iso(NOW - 1 * DAY), eventAt: iso(NOW - 2 * DAY) },
    NOW,
  );
  assert.equal(passedFresh.aged, false);
  assert.equal(passedFresh.eventPassed, true);
  assert.equal(passedFresh.muted, true);

  // A future event on a fresh row → neither trigger.
  const upcoming = deriveAging(
    { createdAt: iso(NOW - 1 * DAY), eventAt: iso(NOW + 2 * DAY) },
    NOW,
  );
  assert.equal(upcoming.eventPassed, false);
  assert.equal(upcoming.muted, false);
});

test("expiresAt is used when eventAt is absent; both-null never passes", () => {
  assert.equal(deriveAging({ createdAt: iso(NOW), expiresAt: iso(NOW - DAY) }, NOW).eventPassed, true);
  assert.equal(deriveAging({ createdAt: iso(NOW), expiresAt: iso(NOW + DAY) }, NOW).eventPassed, false);
  // No event source → aged-only, never event-passed.
  assert.equal(deriveAging({ createdAt: iso(NOW - 30 * DAY) }, NOW).eventPassed, false);
});

test("affix: merely-aged gets none; event-passed gets Passed (live) or Expired (disabled)", () => {
  const agedOnly = deriveAging({ createdAt: iso(NOW - 8 * DAY) }, NOW);
  assert.equal(deriveEventAffix({ category: "REMINDERS" }, agedOnly), null);

  const reminderPassed = deriveAging(
    { createdAt: iso(NOW - DAY), eventAt: iso(NOW - DAY) },
    NOW,
  );
  assert.deepEqual(deriveEventAffix({ category: "REMINDERS" }, reminderPassed), {
    label: "Passed",
    disableAction: false,
  });

  // An expired SHARING invite → Expired + disabled deep-link.
  const invitePassed = deriveAging(
    { createdAt: iso(NOW - 10 * DAY), expiresAt: iso(NOW - DAY) },
    NOW,
  );
  assert.deepEqual(
    deriveEventAffix({ category: "SHARING", expiresAt: iso(NOW - DAY) }, invitePassed),
    { label: "Expired", disableAction: true },
  );
});

test("share outcome is derived from the entity: live / expired / accepted", () => {
  // Pending & valid → live (age/date rules still apply, link untouched).
  assert.deepEqual(
    resolveShareInviteOutcome({ status: "ACTIVE", recipientContactId: null, expiresAt: null }, NOW),
    { outcome: "live", actionUrl: null },
  );
  // Revoked / declined / expired-status → gone.
  for (const status of ["REVOKED", "DECLINED", "EXPIRED"]) {
    assert.equal(
      resolveShareInviteOutcome({ status, recipientContactId: null, expiresAt: null }, NOW).outcome,
      "expired",
    );
  }
  // Still ACTIVE but past its date → gone.
  assert.equal(
    resolveShareInviteOutcome(
      { status: "ACTIVE", recipientContactId: null, expiresAt: iso(NOW - DAY) },
      NOW,
    ).outcome,
    "expired",
  );
  // Accepted (recipientContactId set) → consumed, link repointed to the copy.
  assert.deepEqual(
    resolveShareInviteOutcome({ status: "ACTIVE", recipientContactId: "c_123", expiresAt: null }, NOW),
    { outcome: "accepted", actionUrl: "/contacts/c_123" },
  );
});

test("entity-passed forces muted register + drives affix even with no date hint", () => {
  // A revoked invite: no eventAt/expiresAt date, but entityPassed → muted.
  const gone = deriveAging({ createdAt: iso(NOW - 2 * DAY), entityPassed: true }, NOW);
  assert.equal(gone.eventPassed, true);
  assert.equal(gone.muted, true);
  assert.deepEqual(deriveEventAffix({ category: "SHARING", shareOutcome: "expired" }, gone), {
    label: "Expired",
    disableAction: true,
  });

  // An accepted invite: consumed → Passed, link stays live (repointed server-side).
  const consumed = deriveAging({ createdAt: iso(NOW - 2 * DAY), entityPassed: true }, NOW);
  assert.deepEqual(deriveEventAffix({ category: "SHARING", shareOutcome: "accepted" }, consumed), {
    label: "Passed",
    disableAction: false,
  });

  // Still-pending old invite: aged but no entity-pass → live link, no affix.
  const pendingOld = deriveAging({ createdAt: iso(NOW - 10 * DAY) }, NOW);
  assert.equal(pendingOld.aged, true);
  assert.equal(deriveEventAffix({ category: "SHARING", shareOutcome: null }, pendingOld), null);
});

test("reminder eventAt flips to passed the day AFTER the date, not on the day", () => {
  // reminders.ts stores eventAt = start-of-day(occurrence) + 1 day, so a date
  // reads live all through the day itself and only flips to "Passed" once it's
  // fully behind us. Mirror that encoding for a birthday that lands today.
  const startOfToday = Date.UTC(2026, 6, 5); // 2026-07-05 00:00 UTC
  const eventAt = iso(startOfToday + DAY); // start of the following day

  const onTheDay = deriveAging({ createdAt: iso(NOW - DAY), eventAt }, NOW); // today 12:00
  assert.equal(onTheDay.eventPassed, false, "not passed on the event day itself");

  const nextDayNoon = NOW + DAY;
  const afterward = deriveAging({ createdAt: iso(NOW - DAY), eventAt }, nextDayNoon);
  assert.equal(afterward.eventPassed, true, "passed the day after");
});
