import assert from "node:assert/strict";
import { test } from "node:test";

import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";

import { checkRateLimit, peekRateLimit } from "../../src/server/rate-limit";

// P48-16: `checkRateLimit` must tell "this key is over its limit" apart from
// "the store is unreachable", and every Redis-backed bucket carries a memory
// insurance limiter so an outage degrades protection to per-process instead of
// removing it. These cases pin both halves of that policy.

/** A store client whose every call fails, as during a Redis outage. */
const brokenStoreClient = () => ({
  // RateLimiterRedis registers its Lua script here; leaving `rlflxIncr` as the
  // rejecting stub below is what simulates the outage.
  defineCommand: () => undefined,
  rlflxIncr: () => Promise.reject(new Error("ECONNREFUSED 127.0.0.1:6379")),
  get: () => Promise.reject(new Error("ECONNREFUSED 127.0.0.1:6379")),
  multi: () => {
    throw new Error("ECONNREFUSED 127.0.0.1:6379");
  },
});

test("checkRateLimit consumes points and reports the block once exhausted", async () => {
  const limiter = new RateLimiterMemory({ points: 2, duration: 60, keyPrefix: "test:basic" });

  const first = await checkRateLimit(limiter, "alice");
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);

  const second = await checkRateLimit(limiter, "alice");
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  const third = await checkRateLimit(limiter, "alice");
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
  assert.ok(third.resetAt.getTime() > Date.now(), "a block must carry a reset time");

  // Buckets are per-key.
  assert.equal((await checkRateLimit(limiter, "bob")).allowed, true);
});

test("peekRateLimit reports the block without consuming a point", async () => {
  const limiter = new RateLimiterMemory({ points: 1, duration: 60, keyPrefix: "test:peek" });

  assert.equal((await peekRateLimit(limiter, "carol")).allowed, true);
  // Peeking twice must not have burned the single point.
  assert.equal((await checkRateLimit(limiter, "carol")).allowed, true);
  assert.equal((await peekRateLimit(limiter, "carol")).allowed, false);
});

test("a Redis outage falls through to the insurance limiter and still limits", async () => {
  const limiter = new RateLimiterRedis({
    storeClient: brokenStoreClient(),
    points: 2,
    duration: 60,
    keyPrefix: "test:insured",
    insuranceLimiter: new RateLimiterMemory({
      points: 2,
      duration: 60,
      keyPrefix: "test:insured",
    }),
  });

  assert.equal((await checkRateLimit(limiter, "dave")).allowed, true);
  assert.equal((await checkRateLimit(limiter, "dave")).allowed, true);

  const blocked = await checkRateLimit(limiter, "dave");
  assert.equal(
    blocked.allowed,
    false,
    "with insurance configured, an unreachable store must not open the gate",
  );
});

test("a store failure with no insurance limiter is treated as a transport error, not a block", async () => {
  const limiter = new RateLimiterRedis({
    storeClient: brokenStoreClient(),
    points: 2,
    duration: 60,
    keyPrefix: "test:uninsured",
  });

  // No insurance → the rejection is an Error, which must read as "store down"
  // (fail open, logged) rather than "limited", or every user is locked out.
  const result = await checkRateLimit(limiter, "erin");
  assert.equal(result.allowed, true);
  assert.equal((await peekRateLimit(limiter, "erin")).allowed, true);
});
