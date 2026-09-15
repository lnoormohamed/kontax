import assert from "node:assert/strict";
import { test } from "node:test";

import { isSnsHttpsUrl, isSnsTimestampFresh } from "../../src/server/sns-verify";

// P48-17: SNS replay guard — a captured bounce/complaint notification must be
// rejected once it's too old (or implausibly "from the future"), independent
// of whether its signature still verifies. These pin the freshness window
// (±15 min old, +5 min forward skew) without needing a live signed message.

test("isSnsTimestampFresh accepts a timestamp from right now", () => {
  assert.equal(isSnsTimestampFresh(new Date().toISOString()), true);
});

test("isSnsTimestampFresh accepts timestamps just inside the windows", () => {
  const fourteenMinAgo = new Date(Date.now() - 14 * 60 * 1000).toISOString();
  const fourMinForward = new Date(Date.now() + 4 * 60 * 1000).toISOString();
  assert.equal(isSnsTimestampFresh(fourteenMinAgo), true);
  assert.equal(isSnsTimestampFresh(fourMinForward), true);
});

test("isSnsTimestampFresh rejects a replayed (too old) message", () => {
  const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  assert.equal(isSnsTimestampFresh(twentyMinAgo), false);
  assert.equal(isSnsTimestampFresh(oneHourAgo), false);
});

test("isSnsTimestampFresh rejects a message claiming to be from the future", () => {
  const tenMinForward = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  assert.equal(isSnsTimestampFresh(tenMinForward), false);
});

test("isSnsTimestampFresh rejects missing or unparseable timestamps", () => {
  assert.equal(isSnsTimestampFresh(undefined), false);
  assert.equal(isSnsTimestampFresh(""), false);
  assert.equal(isSnsTimestampFresh("not-a-date"), false);
});

test("isSnsHttpsUrl only accepts AWS SNS https hosts", () => {
  assert.equal(isSnsHttpsUrl("https://sns.us-east-1.amazonaws.com/cert.pem"), true);
  assert.equal(isSnsHttpsUrl("http://sns.us-east-1.amazonaws.com/cert.pem"), false);
  assert.equal(isSnsHttpsUrl("https://evil.com/sns.us-east-1.amazonaws.com"), false);
  assert.equal(isSnsHttpsUrl("https://sns.us-east-1.amazonaws.com.evil.com/cert.pem"), false);
  assert.equal(isSnsHttpsUrl(undefined), false);
  assert.equal(isSnsHttpsUrl(null), false);
});
