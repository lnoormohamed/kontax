import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyOtpBackspace,
  applyOtpInput,
  applyOtpPaste,
  sanitizeDigits,
  setDigitAt,
} from "../../src/lib/otp-input-logic";

// P49A-17: the shared OtpInput's paste / backspace / digit-entry rules,
// pulled out of the component so they can be pinned without a DOM.

test("setDigitAt replaces one slot and keeps the rest", () => {
  assert.equal(setDigitAt("123456", 0, "9"), "923456");
  assert.equal(setDigitAt("123456", 5, "9"), "123459");
  assert.equal(setDigitAt("", 0, "9"), "9");
});

test("setDigitAt clears a slot when given an empty string", () => {
  assert.equal(setDigitAt("123456", 2, ""), "12456");
});

test("setDigitAt never grows past length", () => {
  assert.equal(setDigitAt("123456", 5, "9", 6), "123459");
  assert.equal(setDigitAt("12", 5, "9", 6).length <= 6, true);
});

test("sanitizeDigits strips non-digits and truncates", () => {
  assert.equal(sanitizeDigits("12a3-45"), "12345");
  assert.equal(sanitizeDigits("1234567890", 6), "123456");
  assert.equal(sanitizeDigits("abc"), "");
});

test("applyOtpPaste fills every box from a full 6-digit paste", () => {
  const result = applyOtpPaste("", "123456", 6);
  assert.equal(result.value, "123456");
  assert.equal(result.complete, true);
  assert.equal(result.focusIndex, 5);
});

test("applyOtpPaste strips formatting characters from the pasted text", () => {
  const result = applyOtpPaste("", "123 456", 6);
  assert.equal(result.value, "123456");
  assert.equal(result.complete, true);
});

test("applyOtpPaste handles a partial paste by focusing the next empty box", () => {
  const result = applyOtpPaste("", "123", 6);
  assert.equal(result.value, "123");
  assert.equal(result.complete, false);
  assert.equal(result.focusIndex, 3);
});

test("applyOtpPaste is a no-op when the clipboard has no digits", () => {
  const result = applyOtpPaste("12", "abc", 6);
  assert.equal(result.value, "12");
  assert.equal(result.complete, false);
});

test("applyOtpBackspace clears the current digit without moving focus", () => {
  // Box 2 ('3') has a digit — clear it in place (the boxes after it shift
  // left, same as every box being `value[i]`, matching the pre-refactor
  // component's behaviour exactly).
  const result = applyOtpBackspace("123456", 2, 6);
  assert.equal(result.value, "12456");
  assert.equal(result.focusIndex, 2);
});

test("applyOtpBackspace on an empty box moves to and clears the previous one", () => {
  // Only 3 digits entered ("123"): boxes 3-5 are empty. Backspacing on the
  // (empty) box 3 clears box 2 instead and moves focus there.
  const result = applyOtpBackspace("123", 3, 6);
  assert.equal(result.value, "12");
  assert.equal(result.focusIndex, 2);
});

test("applyOtpBackspace on the first box with nothing to clear is a no-op", () => {
  const result = applyOtpBackspace("", 0, 6);
  assert.equal(result.value, "");
  assert.equal(result.focusIndex, 0);
});

test("applyOtpInput: one typed digit fills the slot and advances", () => {
  assert.deepEqual(applyOtpInput("12", 2, "3"), { value: "123", focusIndex: 3, complete: false });
});

test("applyOtpInput: typing the last digit completes (auto-submit)", () => {
  assert.deepEqual(applyOtpInput("12345", 5, "6"), { value: "123456", focusIndex: 5, complete: true });
});

test("applyOtpInput: whole-code autofill into the first box is handled like a paste", () => {
  // iOS "From Messages" / WebOTP / password managers ignore maxLength=1.
  assert.deepEqual(applyOtpInput("", 0, "482913"), { value: "482913", focusIndex: 5, complete: true });
  assert.deepEqual(applyOtpInput("", 0, "482 913"), { value: "482913", focusIndex: 5, complete: true });
});

test("applyOtpInput: typing into a filled slot keeps the new digit, not the old one", () => {
  assert.equal(applyOtpInput("123456", 2, "37").value, "127456");
  assert.equal(applyOtpInput("123456", 2, "73").value, "127456");
});

test("applyOtpInput: non-digits are ignored", () => {
  assert.deepEqual(applyOtpInput("12", 2, "a"), { value: "12", focusIndex: 2, complete: false });
});
