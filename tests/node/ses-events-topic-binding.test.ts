import assert from "node:assert/strict";
import { test, mock } from "node:test";

import { NextRequest } from "next/server";

// P49A-08 — SES/SNS webhook: bind to our TopicArn.
//
// node:test forks one process per test FILE, so this file (unlike
// ses-events-topic-binding-missing-env.test.ts, which needs the opposite) can
// safely set SES_SNS_TOPIC_ARN before anything imports ~/env (which parses
// env vars once, at import time) without racing another file's env.
process.env.SES_SNS_TOPIC_ARN =
  "arn:aws:sns:us-east-1:111111111111:kontax-email-events," +
  "arn:aws:sns:eu-west-1:111111111111:kontax-email-events-eu";

const OUR_TOPIC = "arn:aws:sns:us-east-1:111111111111:kontax-email-events";
const OTHER_TOPIC = "arn:aws:sns:us-east-1:222222222222:evil-topic";

// Signature verification is exercised in tests/node/sns-verify.test.ts — this
// ticket adds the TopicArn allow-list check that must run strictly AFTER it
// (TopicArn is only trustworthy once the signature verifies), so every case
// here mocks a validly-signed message to isolate the new topic-binding logic.
mock.module("~/server/sns-verify", {
  namedExports: {
    verifySnsSignature: async () => true,
    isSnsHttpsUrl: (url: unknown) => typeof url === "string" && url.startsWith("https://sns."),
  },
});

// The route module (and its top-level `import { db } from "~/server/db"`
// binding) is only ever loaded ONCE per process — the ESM cache returns the
// same instance on every subsequent `await import(...)` below. So rather than
// re-mocking "~/server/db" per test (which wouldn't reach an already-bound
// import), `db.user.updateMany` is a stable wrapper that forwards to a
// swappable closure, letting each test observe/control writes independently.
let updateManyImpl: (args: unknown) => Promise<{ count: number }> = async () => ({ count: 0 });
const updateManyCalls: unknown[] = [];
mock.module("~/server/db", {
  namedExports: {
    db: {
      user: {
        updateMany: (args: unknown) => {
          updateManyCalls.push(args);
          return updateManyImpl(args);
        },
      },
    },
  },
});

function bounceBody(topicArn: string, messageId: string) {
  return {
    Type: "Notification",
    TopicArn: topicArn,
    MessageId: messageId,
    Message: JSON.stringify({
      notificationType: "Bounce",
      bounce: {
        bounceType: "Permanent",
        bouncedRecipients: [{ emailAddress: "victim@example.com" }],
      },
    }),
  };
}

function withMockedFetch<T>(run: (calledWith: () => boolean) => Promise<T>): Promise<T> {
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    called = true;
    return original(...args);
  });
  return run(() => called).finally(() => {
    globalThis.fetch = original;
  });
}

test("rejects (403) a validly-signed Bounce notification from another topic — no DB write, no fetch", async () => {
  updateManyImpl = async () => ({ count: 0 });
  updateManyCalls.length = 0;

  await withMockedFetch(async (fetchWasCalled) => {
    const { POST } = await import("../../src/app/api/ses/events/route");
    const req = new NextRequest("http://localhost/api/ses/events", {
      method: "POST",
      body: JSON.stringify(bounceBody(OTHER_TOPIC, "msg-other-topic-bounce")),
    });

    const res = await POST(req);
    assert.equal(res.status, 403);
    assert.equal(updateManyCalls.length, 0, "must not write to the DB");
    assert.equal(fetchWasCalled(), false, "must not fetch anything");
  });
});

test("rejects (403) a SubscriptionConfirmation from another topic — never fetches SubscribeURL", async () => {
  updateManyCalls.length = 0;

  await withMockedFetch(async (fetchWasCalled) => {
    const { POST } = await import("../../src/app/api/ses/events/route");
    const req = new NextRequest("http://localhost/api/ses/events", {
      method: "POST",
      body: JSON.stringify({
        Type: "SubscriptionConfirmation",
        TopicArn: OTHER_TOPIC,
        MessageId: "msg-other-topic-sub",
        SubscribeURL: "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=abc",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 403);
    assert.equal(fetchWasCalled(), false, "must never fetch SubscribeURL for a foreign topic");
    assert.equal(updateManyCalls.length, 0);
  });
});

test("processes a validly-signed Bounce notification from our own allow-listed topic", async () => {
  updateManyImpl = async () => ({ count: 1 });
  updateManyCalls.length = 0;

  const { POST } = await import("../../src/app/api/ses/events/route");
  const req = new NextRequest("http://localhost/api/ses/events", {
    method: "POST",
    body: JSON.stringify(bounceBody(OUR_TOPIC, `msg-ours-${Date.now()}`)),
  });

  const res = await POST(req);
  const json = (await res.json()) as unknown;
  assert.equal(res.status, 200);
  assert.deepEqual(json, { processed: true });
  assert.equal(updateManyCalls.length, 1, "must write BOUNCED for the recipient");
  assert.deepEqual((updateManyCalls[0] as { data: unknown }).data, { emailStatus: "BOUNCED" });
});

test("accepts our topic via the second entry in a multi-topic allow-list", async () => {
  updateManyImpl = async () => ({ count: 1 });
  updateManyCalls.length = 0;

  const { POST } = await import("../../src/app/api/ses/events/route");
  const req = new NextRequest("http://localhost/api/ses/events", {
    method: "POST",
    body: JSON.stringify(
      bounceBody("arn:aws:sns:eu-west-1:111111111111:kontax-email-events-eu", `msg-ours-eu-${Date.now()}`),
    ),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  assert.equal(updateManyCalls.length, 1);
});
