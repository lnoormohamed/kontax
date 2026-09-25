import assert from "node:assert/strict";
import { test, mock } from "node:test";

import { NextRequest } from "next/server";

// P49A-08 — SES_SNS_TOPIC_ARN is optional at boot: production doesn't set it
// today, and a required-at-boot var here would take the whole site down. So
// the route must fail CLOSED instead — reject every SNS message while it's
// unset, rather than accept anything unchecked.
//
// This lives in its own file (not alongside ses-events-topic-binding.test.ts)
// because node:test forks one process per test FILE, and that's the only way
// to guarantee SES_SNS_TOPIC_ARN is truly absent before ~/env parses it —
// sharing a process with a file that sets it would race.
delete process.env.SES_SNS_TOPIC_ARN;

// Signature verification is exercised in tests/node/sns-verify.test.ts; mock
// it to a validly-signed message so this test isolates the fail-closed
// behaviour added by this ticket, not signature checking.
mock.module("~/server/sns-verify", {
  namedExports: {
    verifySnsSignature: async () => true,
    isSnsHttpsUrl: (url: unknown) => typeof url === "string" && url.startsWith("https://sns."),
  },
});

const updateManyCalls: unknown[] = [];
mock.module("~/server/db", {
  namedExports: {
    db: {
      user: {
        updateMany: (args: unknown) => {
          updateManyCalls.push(args);
          return Promise.resolve({ count: 1 });
        },
      },
    },
  },
});

test("POST /api/ses/events rejects every message when SES_SNS_TOPIC_ARN is unset (fail closed)", async () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    fetchCalled = true;
    return originalFetch(...args);
  });

  try {
    const { POST } = await import("../../src/app/api/ses/events/route");

    const req = new NextRequest("http://localhost/api/ses/events", {
      method: "POST",
      body: JSON.stringify({
        Type: "Notification",
        TopicArn: "arn:aws:sns:us-east-1:111111111111:kontax-email-events",
        MessageId: "msg-no-allowlist",
        Message: JSON.stringify({
          notificationType: "Bounce",
          bounce: {
            bounceType: "Permanent",
            bouncedRecipients: [{ emailAddress: "victim@example.com" }],
          },
        }),
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 403);
    assert.equal(updateManyCalls.length, 0, "must not write to the DB");
    assert.equal(fetchCalled, false, "must not fetch anything");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("also rejects a SubscriptionConfirmation when SES_SNS_TOPIC_ARN is unset", async () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    fetchCalled = true;
    return originalFetch(...args);
  });

  try {
    const { POST } = await import("../../src/app/api/ses/events/route");
    const req = new NextRequest("http://localhost/api/ses/events", {
      method: "POST",
      body: JSON.stringify({
        Type: "SubscriptionConfirmation",
        TopicArn: "arn:aws:sns:us-east-1:111111111111:kontax-email-events",
        MessageId: "msg-no-allowlist-sub",
        SubscribeURL: "https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=abc",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 403);
    assert.equal(fetchCalled, false, "must never fetch SubscribeURL with no configured allow-list");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
