import test from "node:test";
import assert from "node:assert/strict";

import {
  parsePhoneCountryInputValue,
  replacePhoneCallingCode,
} from "../../src/lib/phone-country-input-utils";

test("phone input parsing keeps the detected country for international numbers", () => {
  const parsed = parsePhoneCountryInputValue("+86 138 0000 0102");

  assert.equal(parsed.iso2, "CN");
  assert.match(parsed.value, /^\+86 /);
});

test("replacing the calling code keeps the local digits intact", () => {
  const nextValue = replacePhoneCallingCode("+84 000 079 190", "971");

  assert.equal(nextValue, "+971 0079190");
});
