import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUpcomingContactDates,
  daysUntilAnnualDate,
  parseStoredAnnualDate,
} from "../../src/lib/contact-date-events";

test("parseStoredAnnualDate accepts full and yearless stored dates", () => {
  assert.deepEqual(parseStoredAnnualDate("1992-11-06"), { month: 11, day: 6 });
  assert.deepEqual(parseStoredAnnualDate("--03-10"), { month: 3, day: 10 });
  assert.equal(parseStoredAnnualDate("not-a-date"), null);
});

test("daysUntilAnnualDate rolls forward into the next year when needed", () => {
  const now = new Date("2026-12-31T10:00:00.000Z");

  assert.equal(daysUntilAnnualDate(12, 31, now), 0);
  assert.equal(daysUntilAnnualDate(1, 1, now), 1);
  assert.equal(daysUntilAnnualDate(12, 30, now), 364);
});

test("buildUpcomingContactDates sorts birthday and significant dates by next occurrence", () => {
  const events = buildUpcomingContactDates(
    {
      birthday: "1992-11-06",
      significantDates: [
        { label: "Anniversary", date: "2020-05-18" },
        { label: "Lunar birthday", date: "1992-12-11" },
        { label: "Custom", date: "--06-01" },
      ],
    },
    {
      now: new Date("2026-05-15T00:00:00.000Z"),
      limit: 3,
    },
  );

  assert.deepEqual(
    events.map((event) => ({
      label: event.label,
      value: event.value,
      daysUntil: event.daysUntil,
    })),
    [
      { label: "Anniversary", value: "2020-05-18", daysUntil: 3 },
      { label: "Custom", value: "--06-01", daysUntil: 17 },
      { label: "Birthday", value: "1992-11-06", daysUntil: 175 },
    ],
  );
});
