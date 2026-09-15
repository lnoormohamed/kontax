import assert from "node:assert/strict";
import test from "node:test";

// P48-01 / P48-06 / P48-13: requireSession({write:true}) is the single gate
// every mutating server action and API route call through (enforced
// statically by scripts/check-session-guard.mjs). This exercises the real
// function, not a re-implementation of its rules. No database needed — the
// checks below are pure in-memory logic over the (test-supplied) session
// object, so this file doesn't import ./_env.
import {
  __setSessionOverrideForTests,
  isSessionError,
  requireSession,
  requireUserId,
} from "../../../src/server/auth/require-session";
import { DEFAULT_PREFERENCES } from "../../../src/lib/preferences-shared";

// Shaped to satisfy `Session["user"]` (see the `declare module "next-auth"`
// augmentation in src/server/auth/config.ts) without pulling in a real DB
// row — this file intentionally has no database dependency.
const baseUser = {
  id: "authz-test-user",
  email: "authz-test@example.invalid",
  name: null,
  emailVerified: null,
  avatarUrl: null,
  role: "USER" as const,
  preferences: DEFAULT_PREFERENCES,
};

test.afterEach(() => {
  __setSessionOverrideForTests(null);
});

test("requireSession() throws UNAUTHENTICATED for no session", async () => {
  __setSessionOverrideForTests(async () => null);
  await assert.rejects(() => requireSession(), (err: unknown) => {
    assert.ok(isSessionError(err));
    assert.equal((err).code, "UNAUTHENTICATED");
    return true;
  });
});

test("requireSession({write:true}) throws IMPERSONATION_READ_ONLY for an impersonation session", async () => {
  __setSessionOverrideForTests(async () => ({
    user: baseUser,
    expires: new Date(Date.now() + 60_000).toISOString(),
    impersonatedBy: "some-admin-id",
  }));

  await assert.rejects(() => requireSession({ write: true }), (err: unknown) => {
    assert.ok(isSessionError(err));
    assert.equal((err).code, "IMPERSONATION_READ_ONLY");
    return true;
  });

  // A read (no write:true) is still allowed for an impersonation session —
  // that's the whole point of P48-06 (read-only, not no-access).
  const readSession = await requireSession();
  assert.equal(readSession.user.id, baseUser.id);
});

test("requireSession({write:true}) throws PENDING_DELETION for a pending-deletion session", async () => {
  __setSessionOverrideForTests(async () => ({
    user: baseUser,
    expires: new Date(Date.now() + 60_000).toISOString(),
    pendingDeletion: true,
  }));

  await assert.rejects(() => requireSession({ write: true }), (err: unknown) => {
    assert.ok(isSessionError(err));
    assert.equal((err).code, "PENDING_DELETION");
    return true;
  });

  // Reads still work during the grace period.
  const readSession = await requireSession();
  assert.equal(readSession.pendingDeletion, true);
});

test("requireSession({write:true}) succeeds for an ordinary session", async () => {
  __setSessionOverrideForTests(async () => ({
    user: baseUser,
    expires: new Date(Date.now() + 60_000).toISOString(),
  }));

  const session = await requireSession({ write: true });
  assert.equal(session.user.id, baseUser.id);
});

test("requireUserId mirrors requireSession's rules and returns just the id", async () => {
  __setSessionOverrideForTests(async () => ({
    user: baseUser,
    expires: new Date(Date.now() + 60_000).toISOString(),
  }));
  assert.equal(await requireUserId(), baseUser.id);

  __setSessionOverrideForTests(async () => ({
    user: baseUser,
    expires: new Date(Date.now() + 60_000).toISOString(),
    impersonatedBy: "some-admin-id",
  }));
  await assert.rejects(() => requireUserId({ write: true }));
});
