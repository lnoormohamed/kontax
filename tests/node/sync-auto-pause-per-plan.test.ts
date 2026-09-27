import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { PLAN_DEFAULTS, resolveSyncAutoPauseThreshold } from "../../src/server/dav/plan-entitlements.mjs";
import {
  FREE_AUTO_PAUSE_FAILURES,
  getConsecutiveFailureStreak,
  getSyncAutoPauseThreshold,
  PAID_AUTO_PAUSE_FAILURES,
  shouldAutoPauseAfterFailure,
  type SyncJobStatus,
} from "../../src/server/sync-health";

/**
 * P49A-19 item 6 (owner decision 2026-09-27): a sync connection auto-pauses
 * after 3 consecutive failures on Free and 5 on paid plans (Pro / Family /
 * Teams; an admin comp counts as paid). One source — the plan matrix — feeds
 * the runner, the settings panel and the help centre.
 */

const DAY = 24 * 60 * 60 * 1000;
const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

type Sub = { plan: "FREE" | "PRO" | "FAMILY" | "TEAMS"; memberSlotsLimit: null; status: string; graceEndsAt: Date | null };

/** Minimal client: one sync account → its owner → their subscriptions. */
const clientFor = (subscriptions: Sub[], accountExists = true) => ({
  syncAccount: {
    findUnique: async () => (accountExists ? { userId: "user_1" } : null),
  },
  user: {
    findUnique: async () => ({ lifecycleState: "ACTIVE", subscriptions, groupMemberships: [] }),
  },
});
const sub = (plan: Sub["plan"], status = "ACTIVE", graceEndsAt: Date | null = null): Sub => ({
  plan,
  memberSlotsLimit: null,
  status,
  graceEndsAt,
});

describe("the per-plan numbers", () => {
  test("3 on Free, 5 on every paid plan", () => {
    assert.equal(FREE_AUTO_PAUSE_FAILURES, 3);
    assert.equal(PAID_AUTO_PAUSE_FAILURES, 5);
    for (const plan of ["PRO", "FAMILY", "TEAMS"] as const) {
      assert.equal(PLAN_DEFAULTS[plan].syncAutoPauseAfterFailures, 5, plan);
      assert.equal(PLAN_DEFAULTS[plan].syncAutoPauseMaxFailures, null, plan);
    }
    assert.equal(PLAN_DEFAULTS.FREE.syncAutoPauseMaxFailures, 3);
  });

  test("an explicit Retry sensitivity is kept within the plan's ceiling", () => {
    const free = PLAN_DEFAULTS.FREE;
    const pro = PLAN_DEFAULTS.PRO;
    // [setting, Free, paid]
    const cases: Array<[number | null, number, number]> = [
      [null, 3, 5], // plan default
      [1, 1, 1], // more sensitive: honoured everywhere
      [3, 3, 3],
      [5, 3, 5], // above Free's ceiling
      [10, 3, 10],
      [0, 3, 0], // "never": paid only
    ];
    for (const [setting, onFree, onPaid] of cases) {
      assert.equal(resolveSyncAutoPauseThreshold(free, setting), onFree, `Free, setting ${setting}`);
      assert.equal(resolveSyncAutoPauseThreshold(pro, setting), onPaid, `paid, setting ${setting}`);
    }
    assert.equal(resolveSyncAutoPauseThreshold(pro, -2), 5, "garbage → plan default");
  });
});

describe("the runner's threshold follows the owner's effective plan", () => {
  test("Free 3; Pro, Family and Teams 5; admin comp counts as paid", async () => {
    assert.equal(await getSyncAutoPauseThreshold(clientFor([]), "acct", null), 3);
    for (const plan of ["PRO", "FAMILY", "TEAMS"] as const) {
      assert.equal(await getSyncAutoPauseThreshold(clientFor([sub(plan)]), "acct", null), 5, plan);
    }
    // P49A-07 admin comp: an ACTIVE row with no Stripe behind it.
    assert.equal(await getSyncAutoPauseThreshold(clientFor([sub("PRO", "ACTIVE")]), "acct", null), 5);
  });

  test("the payment grace applies: paid until it runs out, Free after", async () => {
    const inGrace = clientFor([sub("PRO", "PAST_DUE", new Date(Date.now() + DAY))]);
    const lapsed = clientFor([sub("PRO", "PAST_DUE", new Date(Date.now() - DAY))]);
    assert.equal(await getSyncAutoPauseThreshold(inGrace, "acct", null), 5);
    assert.equal(await getSyncAutoPauseThreshold(lapsed, "acct", null), 3);
    assert.equal(await getSyncAutoPauseThreshold(lapsed, "acct", 0), 3, "'never' needs a paid plan");
  });

  test("a vanished account falls back to the strictest (Free) rule", async () => {
    assert.equal(await getSyncAutoPauseThreshold(clientFor([sub("PRO")], false), "acct", null), 3);
  });
});

describe("replaying consecutive failures", () => {
  /** How many failures in a row until the connection pauses (runner's newest-first streak). */
  const failuresUntilPause = (threshold: number, errorCode = "NETWORK_TIMEOUT") => {
    const history: Array<{ status: SyncJobStatus; errorCode: string | null }> = [
      { status: "SUCCEEDED", errorCode: null },
    ];
    for (let n = 1; n <= 20; n++) {
      history.unshift({ status: "FAILED", errorCode });
      const failureStreak = getConsecutiveFailureStreak(history);
      if (shouldAutoPauseAfterFailure({ threshold, failureStreak, baseFailureStatus: "ERROR", errorCode })) return n;
    }
    return null;
  };

  test("Free pauses on the 3rd failure in a row, paid on the 5th", async () => {
    const free = await getSyncAutoPauseThreshold(clientFor([]), "acct", null);
    const pro = await getSyncAutoPauseThreshold(clientFor([sub("PRO")]), "acct", null);
    assert.equal(failuresUntilPause(free), 3);
    assert.equal(failuresUntilPause(pro), 5);
  });

  test("never on a paid plan never pauses; authentication errors never auto-pause", () => {
    assert.equal(failuresUntilPause(0), null);
    assert.equal(failuresUntilPause(3, "AUTH_FAILED"), null);
  });
});

describe("copy and behaviour share one source", () => {
  test("the runner uses the plan-aware threshold, not a flat constant", () => {
    const runner = read("src/server/sync-runner.ts");
    assert.match(runner, /getSyncAutoPauseThreshold\(/);
    assert.match(runner, /shouldAutoPauseAfterFailure\(/);
    assert.doesNotMatch(runner, /DEFAULT_MAX_ATTEMPTS_BEFORE_PAUSE/);
  });

  test("help and settings copy quote the per-plan rule", async () => {
    const { FACTS } = await import("../../src/app/(marketing)/help/_content/facts");
    assert.equal(FACTS.autoPauseRule, "3 on Free, 5 on paid plans");
    const help = read("src/app/(marketing)/help/_content/articles/sync.ts");
    assert.match(help, /FACTS\.autoPauseRule/);
    assert.doesNotMatch(help, /platform default/i);
    const panel = read("src/app/sync/_components/connection-settings.tsx");
    assert.doesNotMatch(panel, /Platform default \(5 failures\)/);
    assert.match(panel, /autoPause\.planDefault/);
  });
});
