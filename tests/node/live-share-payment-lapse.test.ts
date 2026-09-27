import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

/**
 * P49A-19 (Fable review, item 1): a live-share recipient whose paid plan is
 * unpaid past the 3-day payment grace must NOT have the share revoked and the
 * contact converted to a static copy — that is irreversible, and paying must
 * restore everything. The share is paused (RECIPIENT_PAYMENT_LAPSED) and the
 * next propagation after the payment goes through syncs it again. Only a
 * recipient with no paid plan at all is converted (downgrade).
 *
 * Drives the real propagateLiveShares against a programmable Prisma stub.
 */

const DAY = 24 * 60 * 60 * 1000;

type Share = Record<string, unknown> & { id: string };
const state = {
  subs: [] as Array<{ plan: string; status: string; graceEndsAt: Date | null }>,
  share: null as unknown as Share,
  recipientContact: {} as Record<string, unknown>,
  lifecycleState: "ACTIVE",
};

const stub: Record<string, unknown> = {
  contactShare: {
    findMany: async () => (state.share.status === "ACTIVE" ? [{ ...state.share }] : []),
    update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.share, data),
  },
  contact: {
    findUnique: async () => ({
      fullName: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      emailEntries: [],
      phoneEntries: [],
      addressEntries: [],
      websiteEntries: [],
      labels: null,
      significantDates: null,
      relatedPeople: null,
      customFields: null,
    }),
    update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(state.recipientContact, data),
  },
  user: {
    findUnique: async ({ select }: { select: Record<string, unknown> }) =>
      "lifecycleState" in select ? { lifecycleState: state.lifecycleState } : { name: "Owner", email: "o@example.invalid" },
  },
  subscription: { findMany: async () => state.subs },
  $transaction: async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(stub),
};

mock.module("~/server/db", { namedExports: { db: stub } });
mock.module("~/server/sync-dirty", { namedExports: { markSyncLinksDirty: async () => undefined } });
mock.module("~/lib/activity", { namedExports: { emitEvent: async () => undefined } });

const { classifyLiveShareRecipient, propagateLiveShares, RECIPIENT_PAYMENT_LAPSED_CODE } = await import(
  "~/server/contact-shares"
);

beforeEach(() => {
  state.share = {
    id: "share_1",
    recipientUserId: "recipient_1",
    recipientContactId: "rc_1",
    shareType: "LIVE_SYNC",
    status: "ACTIVE",
    lastErrorCode: null,
    lastPushedAt: null,
  };
  state.recipientContact = { sourceType: "SHARED_LIVE" };
  state.lifecycleState = "ACTIVE";
});

test("classification: paid → live, paid past grace → paused, no paid plan → free", () => {
  const now = new Date();
  assert.equal(classifyLiveShareRecipient([{ plan: "PRO", status: "ACTIVE", graceEndsAt: null }], now), "live");
  assert.equal(
    classifyLiveShareRecipient([{ plan: "PRO", status: "PAST_DUE", graceEndsAt: new Date(now.getTime() + DAY) }], now),
    "live",
  );
  assert.equal(
    classifyLiveShareRecipient([{ plan: "PRO", status: "PAST_DUE", graceEndsAt: new Date(now.getTime() - DAY) }], now),
    "paused",
  );
  assert.equal(classifyLiveShareRecipient([], now), "free");
  assert.equal(classifyLiveShareRecipient([{ plan: "FREE", status: "ACTIVE", graceEndsAt: null }], now), "free");
});

test("a recipient past the payment grace: share paused, not revoked; after payment it syncs again", async () => {
  state.subs = [{ plan: "PRO", status: "PAST_DUE", graceEndsAt: new Date(Date.now() - DAY) }];

  await propagateLiveShares("owner_1", "contact_1");

  assert.equal(state.share.status, "ACTIVE", "not revoked");
  assert.equal(state.share.lastErrorCode, RECIPIENT_PAYMENT_LAPSED_CODE);
  assert.equal(state.recipientContact.sourceType, "SHARED_LIVE", "not converted to a static copy");

  // The recipient pays: the next owner edit propagates and clears the pause.
  state.subs = [{ plan: "PRO", status: "ACTIVE", graceEndsAt: null }];
  await propagateLiveShares("owner_1", "contact_1");

  assert.equal(state.share.lastErrorCode, null);
  assert.ok(state.share.lastPushedAt instanceof Date, "pushed again");
  assert.equal(state.recipientContact.fullName, "Ada Lovelace");
  assert.equal(state.recipientContact.sourceType, "SHARED_LIVE");
});

test("a recipient with no paid plan at all is still converted to a static copy", async () => {
  state.subs = [];
  await propagateLiveShares("owner_1", "contact_1");
  assert.equal(state.share.status, "REVOKED");
  assert.equal(state.recipientContact.sourceType, "SHARED_STATIC");
});
