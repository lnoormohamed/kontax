import assert from "node:assert/strict";
import { test } from "node:test";

import { escapeCsvCell } from "../../src/server/contact-portability";

// P48-11 item 3: CSV formula injection. A contact export (or the
// deletion-hold export) can carry attacker-controlled text — a shared
// contact's name, a synced note — straight into a cell that Excel,
// LibreOffice, and Google Sheets will execute as a formula if it starts
// with =, +, -, or @ (or a tab/CR that leading whitespace can hide before
// one of those). escapeCsvCell prefixes a `'` in that case, which forces
// spreadsheet apps to treat the cell as literal text.

test("escapeCsvCell prefixes cells that start with a formula-trigger character", () => {
  // The HYPERLINK formula also contains double quotes, so it's both
  // guard-prefixed *and* CSV-quoted (with the inner quotes doubled) — see
  // the "quotes and guards together" case below for the simpler version of
  // this interaction.
  assert.equal(
    escapeCsvCell('=HYPERLINK("http://evil.example")'),
    `"'=HYPERLINK(""http://evil.example"")"`,
  );
  assert.equal(escapeCsvCell("+1 555 0100"), "'+1 555 0100");
  assert.equal(escapeCsvCell("-3+4"), "'-3+4");
  assert.equal(escapeCsvCell("@SUM(A1:A9)"), "'@SUM(A1:A9)");
  assert.equal(escapeCsvCell("\tmalicious"), "'\tmalicious");
  assert.equal(escapeCsvCell("\rmalicious"), "'\rmalicious");
});

test("escapeCsvCell only guards the leading character, not one appearing mid-value", () => {
  // "Jane = Doe" doesn't start with a trigger char, so it's left alone.
  assert.equal(escapeCsvCell("Jane = Doe"), "Jane = Doe");
});

test("escapeCsvCell still quotes cells containing a comma, quote, or newline", () => {
  assert.equal(escapeCsvCell("Doe, Jane"), '"Doe, Jane"');
  assert.equal(escapeCsvCell('Say "hi"'), '"Say ""hi"""');
  assert.equal(escapeCsvCell("line1\nline2"), '"line1\nline2"');
});

test("escapeCsvCell quotes and guards together when a cell needs both", () => {
  // Starts with "=" AND contains a comma — the quote-prefixed value must
  // still be wrapped in quotes because of the embedded comma.
  assert.equal(escapeCsvCell("=A1,B1"), `"'=A1,B1"`);
});

test("escapeCsvCell leaves ordinary values untouched", () => {
  for (const value of ["Jane Doe", "jane@example.com", "Acme Inc.", "555-0100", ""]) {
    assert.equal(escapeCsvCell(value), value);
  }
});

test("escapeCsvCell guards a leading '-' even for an otherwise ordinary-looking negative number", () => {
  // Phone numbers and other numeric-looking values that start with a
  // formula-trigger character are guarded too — Excel safety wins over
  // display fidelity for these (the leading `'` is invisible once opened).
  assert.equal(escapeCsvCell("-100"), "'-100");
});
