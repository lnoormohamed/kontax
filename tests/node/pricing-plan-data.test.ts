import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  API_READ_ONLY_PER_HOUR,
  API_READ_WRITE_PER_HOUR,
  FREE_SHARE_LINK_DAYS,
  PLAN_MATRIX,
  PLAN_ORDER,
  PLAN_ROWS,
  planCardFeatures,
  TEAMS_SEAT_MAX,
  TEAMS_SEAT_MIN,
  type CellValue,
  type PlanKey,
} from "../../src/app/_components/plan-data";
import { PLAN_DEFAULTS } from "../../src/server/dav/plan-entitlements.mjs";

// P49A-14 · the public pricing matrix and plan cards (/pricing) are rendered
// from plan-data.ts. These tests fail if a number shown there diverges from
// the entitlements the product enforces (plan-entitlements.mjs PLAN_DEFAULTS)
// or from the source modules the mirrored constants come from.

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const ENT = {
  Free: PLAN_DEFAULTS.FREE,
  Pro: PLAN_DEFAULTS.PRO,
  Family: PLAN_DEFAULTS.FAMILY,
  Teams: PLAN_DEFAULTS.TEAMS,
} as const;

const cell = (rowId: string, plan: PlanKey): CellValue => {
  const row = PLAN_ROWS[rowId];
  assert.ok(row, `PLAN_MATRIX has no row "${rowId}"`);
  return row.vals[plan];
};

/** Every integer in a cell's text, commas stripped ("1,000/hr · 200/hr" → [1000, 200]). */
const numbersIn = (v: CellValue): number[] => {
  const text = typeof v === "string" ? v : typeof v === "object" ? v.v : "";
  return [...text.replace(/(\d),(\d)/g, "$1$2").matchAll(/\d+/g)].map((m) => Number(m[0]));
};

test("contacts row equals contactsLimit on every plan", () => {
  for (const plan of PLAN_ORDER) {
    const limit = ENT[plan].contactsLimit;
    const v = cell("contacts", plan);
    if (limit === null) assert.equal(v, "Unlimited", plan);
    else assert.deepEqual(numbersIn(v), [limit], plan);
  }
});

test("sync sources and devices equal syncAccountsLimit / appPasswordsLimit", () => {
  for (const plan of PLAN_ORDER) {
    assert.deepEqual(numbersIn(cell("sync", plan)), [ENT[plan].syncAccountsLimit], `sync ${plan}`);
    assert.deepEqual(numbersIn(cell("devices", plan)), [ENT[plan].appPasswordsLimit], `devices ${plan}`);
  }
});

test("members: Family = memberSlotsLimit, Teams = per seat from the checkout minimum", () => {
  assert.equal(cell("members", "Free"), false);
  assert.equal(cell("members", "Pro"), false);
  assert.deepEqual(numbersIn(cell("members", "Family")), [ENT.Family.memberSlotsLimit]);
  const teams = cell("members", "Teams");
  assert.equal(typeof teams, "string");
  assert.match(teams as string, /per seat/i);
  assert.deepEqual(numbersIn(teams), [TEAMS_SEAT_MIN]);
  assert.doesNotMatch(teams as string, /unlimited/i);
});

test("API access and rate limit follow apiAccessEnabled and API_RATE_LIMITS", () => {
  for (const plan of PLAN_ORDER) {
    const enabled = ENT[plan].apiAccessEnabled;
    assert.equal(cell("api", plan), enabled, `api ${plan}`);
    const limit = cell("apilimit", plan);
    if (!enabled) assert.equal(limit, false, `apilimit ${plan}`);
    else assert.deepEqual(numbersIn(limit), [API_READ_ONLY_PER_HOUR, API_READ_WRITE_PER_HOUR], `apilimit ${plan}`);
  }
});

test("per-contact history and activity feed follow historyDisplayCap / activityLogRetentionDays", () => {
  for (const plan of PLAN_ORDER) {
    const cap = ENT[plan].historyDisplayCap;
    const history = cell("history", plan);
    if (cap === null) assert.equal(history, "All changes", plan);
    else assert.deepEqual(numbersIn(history), [cap], plan);

    const days = ENT[plan].activityLogRetentionDays;
    const feed = cell("feed", plan);
    if (days === 0) assert.equal(feed, false, plan);
    else if (days === null) assert.equal(numbersIn(feed).length, 0, plan);
    else assert.deepEqual(numbersIn(feed), [days], plan);
  }
});

test("vCard export follows premiumExportEnabled; CSV/Kontax archive export on every plan", () => {
  for (const plan of PLAN_ORDER) {
    assert.equal(cell("export", plan), ENT[plan].premiumExportEnabled, plan);
    assert.equal(cell("kontaxexport", plan), true, plan);
  }
});

test("no Webhooks row, no 'Minimum events kept', no vCard import", () => {
  const labels = PLAN_MATRIX.flatMap((g) => g.rows.map((r) => r.label));
  assert.ok(!labels.some((l) => /webhook/i.test(l)), "Webhooks are not built");
  assert.ok(!labels.some((l) => /minimum events/i.test(l)));
  const importRow = cell("import", "Free");
  assert.equal(importRow, true);
  assert.doesNotMatch(PLAN_ROWS.import!.label, /vcard/i);
});

test("plan-card bullets quote the entitlement numbers", () => {
  const cards = planCardFeatures(false);
  const text = (plan: PlanKey) =>
    cards[plan].map((f) => `${f.pre ?? ""}${f.strong ?? ""}${f.text ?? ""}`).join(" | ");
  assert.match(text("Free"), new RegExp(`Up to ${ENT.Free.contactsLimit} contacts`));
  assert.match(text("Free"), new RegExp(`${ENT.Free.syncAccountsLimit} sync source`));
  assert.match(text("Pro"), new RegExp(`up to ${ENT.Pro.syncAccountsLimit} sync sources`, "i"));
  assert.match(text("Pro"), new RegExp(`up to ${ENT.Pro.appPasswordsLimit} iPhones or Macs`));
  assert.match(text("Family"), new RegExp(`Up to ${ENT.Family.memberSlotsLimit} members`));
  assert.match(text("Teams"), new RegExp(`Minimum ${TEAMS_SEAT_MIN} seats`));
  assert.doesNotMatch(text("Family"), /API/, "Family has no API");
  assert.doesNotMatch(text("Free"), /Outlook/);
  assert.match(planCardFeatures(true).Free.map((f) => f.text ?? "").join(" "), /Outlook/);
});

test("mirrored constants match their source modules", () => {
  const billingActions = read("src/app/actions/billing.ts");
  const seats = /seats: z\.number\(\)\.int\(\)\.min\((\d+)\)\.max\((\d+)\)/.exec(billingActions);
  assert.ok(seats, "src/app/actions/billing.ts: seats bounds not found — update plan-data.ts and this test");
  assert.equal(Number(seats[1]), TEAMS_SEAT_MIN);
  assert.equal(Number(seats[2]), TEAMS_SEAT_MAX);

  const shares = read("src/app/actions/shares.ts");
  const ttl = /FREE_LINK_TTL_MS = (\d+) \* 24 \* 60 \* 60 \* 1000/.exec(shares);
  assert.ok(ttl, "src/app/actions/shares.ts: FREE_LINK_TTL_MS not found");
  assert.equal(Number(ttl[1]), FREE_SHARE_LINK_DAYS);

  const api = read("src/server/api-rate-limit.ts");
  const rl = /READ_ONLY: ([\d_]+),\s*READ_WRITE: ([\d_]+)/.exec(api);
  assert.ok(rl, "src/server/api-rate-limit.ts: API_RATE_LIMITS not found");
  assert.equal(Number(rl[1]!.replace(/_/g, "")), API_READ_ONLY_PER_HOUR);
  assert.equal(Number(rl[2]!.replace(/_/g, "")), API_READ_WRITE_PER_HOUR);
});

test("/pricing renders the matrix from plan data and has no placeholder prices", () => {
  const page = read("src/app/(marketing)/pricing/page.tsx");
  const toggle = read("src/app/(marketing)/pricing/_pricing-toggle.tsx");
  assert.match(page, /PLAN_MATRIX\.map/);
  assert.match(toggle, /planCardFeatures\(/);
  for (const src of [page, toggle]) {
    assert.doesNotMatch(src, /DEFAULT_STRIPE_PRICES|FALLBACK_PRICES/);
    assert.doesNotMatch(src, /monthly: \d+, annual: \d+/);
  }
});
