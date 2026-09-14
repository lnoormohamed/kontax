import assert from "node:assert/strict";
import { test } from "node:test";

import { buildVCalendar, escapeICalText } from "../../src/server/ical";

// P48-11 item 5: iCal CRLF/property injection. A contact name (synced or
// imported) is attacker-controlled; RFC 5545 uses CRLF as the line
// terminator, so an unescaped \r or \n in a text value lets the rest of the
// string be parsed as a brand-new property (or event) by every subscriber's
// calendar app.

test("escapeICalText collapses CR, LF, and CRLF to the RFC 5545 escaped-newline token", () => {
  assert.equal(escapeICalText("a\r\nb"), "a\\nb");
  assert.equal(escapeICalText("a\nb"), "a\\nb");
  assert.equal(escapeICalText("a\rb"), "a\\nb");
});

test("escapeICalText still escapes backslash, comma, and semicolon", () => {
  assert.equal(escapeICalText("a\\b"), "a\\\\b");
  assert.equal(escapeICalText("a,b"), "a\\,b");
  assert.equal(escapeICalText("a;b"), "a\\;b");
});

test("escapeICalText does not double-escape backslashes introduced by newline collapsing", () => {
  // If backslash-escaping ran *after* newline collapsing, "a\nb" would come
  // out as "a\\\\nb" (double-escaped) instead of "a\\nb".
  assert.equal(escapeICalText("a\nb"), "a\\nb");
});

test("escapeICalText leaves ordinary text untouched", () => {
  assert.equal(escapeICalText("Jane Doe"), "Jane Doe");
});

test("buildVCalendar never emits a raw CR or LF inside a property value — no injected property lines", () => {
  const evilName = "Jane\r\nX-EVIL:1\r\nSUMMARY:pwned";
  const ics = buildVCalendar(
    [
      {
        id: "c1",
        fullName: evilName,
        firstName: null,
        birthday: "1990-05-17",
        significantDates: null,
      },
    ],
    new Date("2026-01-01T00:00:00Z"),
  );

  // Every physical line (CRLF-joined, per RFC 5545) must be a well-formed
  // iCal line: BEGIN/END, a bare PRODID-style line, or "TOKEN[;params]:value"
  // with no embedded control characters — never a line introduced by the
  // attacker-controlled name.
  const lines = ics.split("\r\n");
  assert.ok(!lines.includes("X-EVIL:1"), "the injected property must not appear as its own line");
  assert.ok(!lines.includes("SUMMARY:pwned"), "the injected property must not appear as its own line");

  // The real SUMMARY line carries the whole hostile string, safely escaped,
  // as the value of the *one* SUMMARY property for this birthday.
  const summaryLine = lines.find((line) => line.startsWith("SUMMARY:"));
  assert.ok(summaryLine, "expected exactly one SUMMARY line for the birthday event");
  assert.ok(summaryLine.includes("X-EVIL:1"));
  assert.ok(!/\r|\n/.test(summaryLine.slice("SUMMARY:".length)));
});
