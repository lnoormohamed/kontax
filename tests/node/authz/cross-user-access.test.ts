// P48-05 / P48-13: regression tests for the cross-user access findings fixed
// in P48-05 — a user must never be able to read or mutate another user's
// rows by supplying that row's id to an action that only checks "does this
// id exist", not "do I own this id".
//
// MUST import ./_env.mjs first (sets DATABASE_URL to TEST_DATABASE_URL
// before anything below dynamically imports ~/server/db) and MUST use
// dynamic `await import(...)` for every module that touches the database —
// see _env.mjs's header comment for why a static import would be too late.
import assert from "node:assert/strict";
import test from "node:test";

import { hasTestDb, skipMessage } from "./_env";
import {
  cleanupTestUsers,
  createTestContact,
  createTestSyncAccount,
  createTestUser,
  fakeSession,
} from "./_helpers";

test(
  "createManualMergeSuggestion throws when either contact belongs to another user",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db } = await import("../../../src/server/db");
    const { createManualMergeSuggestion } = await import("../../../src/app/actions/merge");
    const { __setSessionOverrideForTests } = await import(
      "../../../src/server/auth/require-session"
    );

    const owner = await createTestUser(db);
    const attacker = await createTestUser(db);
    try {
      const ownContact = await createTestContact(db, owner);
      const foreignContact = await createTestContact(db, owner); // still owner's — attacker owns neither

      __setSessionOverrideForTests(async () => fakeSession(attacker));
      try {
        // P48-05's exact defect: pairing a contact you don't own with another
        // contact you don't own (or a mix) must never succeed — before the
        // fix, only pairKey uniqueness gated this, not ownership.
        await assert.rejects(
          () => createManualMergeSuggestion(ownContact.id, foreignContact.id),
          /Contact not found/,
        );

        // Confirm no MergeSuggestion row was created for the attacker either.
        const leaked = await db.mergeSuggestion.findMany({ where: { userId: attacker.id } });
        assert.deepEqual(leaked, []);
      } finally {
        __setSessionOverrideForTests(null);
      }
    } finally {
      await cleanupTestUsers(db, [owner, attacker]);
    }
  },
);

test(
  "createManualMergeSuggestion succeeds when both contacts belong to the caller",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db } = await import("../../../src/server/db");
    const { createManualMergeSuggestion } = await import("../../../src/app/actions/merge");
    const { __setSessionOverrideForTests } = await import(
      "../../../src/server/auth/require-session"
    );

    const owner = await createTestUser(db);
    try {
      const a = await createTestContact(db, owner);
      const b = await createTestContact(db, owner);

      __setSessionOverrideForTests(async () => fakeSession(owner));
      try {
        const suggestionId = await createManualMergeSuggestion(a.id, b.id);
        assert.ok(suggestionId);
        const row = await db.mergeSuggestion.findUnique({ where: { id: suggestionId } });
        assert.equal(row?.userId, owner.id);
      } finally {
        __setSessionOverrideForTests(null);
      }
    } finally {
      await cleanupTestUsers(db, [owner]);
    }
  },
);

test(
  "disconnectSyncAccount throws for a foreign sync account id and leaves it untouched",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db } = await import("../../../src/server/db");
    const { disconnectSyncAccount } = await import("../../../src/app/actions/sync");
    const { __setSessionOverrideForTests } = await import(
      "../../../src/server/auth/require-session"
    );

    const owner = await createTestUser(db);
    const attacker = await createTestUser(db);
    try {
      const account = await createTestSyncAccount(db, owner);

      __setSessionOverrideForTests(async () => fakeSession(attacker));
      try {
        const formData = new FormData();
        formData.set("syncAccountId", account.id);
        // P48-05's exact defect: disconnectSyncAccount looked up the account
        // by id alone and only scoped the JOB cleanup to the caller, so an
        // attacker could cancel another tenant's queued/running sync jobs by
        // guessing (or enumerating) a syncAccountId.
        await assert.rejects(() => disconnectSyncAccount(formData), /Sync account not found/);
      } finally {
        __setSessionOverrideForTests(null);
      }

      const stillActive = await db.syncAccount.findUnique({ where: { id: account.id } });
      assert.equal(stillActive?.status, "ACTIVE");
      assert.equal(stillActive?.disconnectedAt, null);
    } finally {
      await cleanupTestUsers(db, [owner, attacker]);
    }
  },
);

test(
  "disconnectSyncAccount succeeds for the owner",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db } = await import("../../../src/server/db");
    const { disconnectSyncAccount } = await import("../../../src/app/actions/sync");
    const { __setSessionOverrideForTests } = await import(
      "../../../src/server/auth/require-session"
    );

    const owner = await createTestUser(db);
    try {
      const account = await createTestSyncAccount(db, owner);

      __setSessionOverrideForTests(async () => fakeSession(owner));
      try {
        const formData = new FormData();
        formData.set("syncAccountId", account.id);
        await disconnectSyncAccount(formData);
      } finally {
        __setSessionOverrideForTests(null);
      }

      const disconnected = await db.syncAccount.findUnique({ where: { id: account.id } });
      assert.equal(disconnected?.status, "DISCONNECTED");
      assert.ok(disconnected?.disconnectedAt);
    } finally {
      await cleanupTestUsers(db, [owner]);
    }
  },
);

// P48-05's fourth cross-user finding — avatar delete via a caller-supplied
// `prevUrl` (src/app/api/upload/avatar/route.ts) — is authorization logic
// wrapped in an upload flow that needs a real MinIO/S3 endpoint to exercise
// end-to-end (normalizeContactPhoto → storeContactPhoto → deleteContactPhoto
// all do real object-storage I/O, which CI's Postgres-only service container
// doesn't provide). Rather than skip the case, this reproduces the route's
// EXACT authorization predicate — the two Prisma reads gating whether
// `deleteContactPhoto(prevUrl)` fires — word-for-word against real rows in
// the test DB, which is where the P48-05 bug actually lived (it was an
// ownership check that didn't check ownership, not an upload-flow bug):
//
//   const [me, ownedContact] = await Promise.all([
//     db.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } }),
//     db.contact.findFirst({ where: { userId, avatarUrl: prevUrl }, select: { id: true } }),
//   ]);
//   const canDelete = me?.avatarUrl === prevUrl || !!ownedContact;
//
// See src/app/api/upload/avatar/route.ts's P48-05 comment for the production
// code this mirrors.
test(
  "avatar-delete ownership predicate refuses a prevUrl the caller does not own",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db } = await import("../../../src/server/db");

    const owner = await createTestUser(db, { avatarUrl: "https://media.example.invalid/owner.jpg" });
    const attacker = await createTestUser(db, {
      avatarUrl: "https://media.example.invalid/attacker.jpg",
    });
    try {
      const ownerContact = await createTestContact(db, owner, {
        avatarUrl: "https://media.example.invalid/owner-contact.jpg",
      });

      const canDeleteAsAttacker = async (prevUrl: string | null) => {
        const [me, ownedContact] = await Promise.all([
          db.user.findUnique({ where: { id: attacker.id }, select: { avatarUrl: true } }),
          db.contact.findFirst({ where: { userId: attacker.id, avatarUrl: prevUrl }, select: { id: true } }),
        ]);
        return me?.avatarUrl === prevUrl || Boolean(ownedContact);
      };

      // The attacker's own avatar: allowed.
      assert.equal(await canDeleteAsAttacker(attacker.avatarUrl), true);
      // Another user's profile avatar: refused.
      assert.equal(await canDeleteAsAttacker(owner.avatarUrl), false);
      // Another user's CONTACT avatar: refused (this was the actual P48-05 gap
      // — the pre-fix code only checked the caller's own User.avatarUrl).
      assert.equal(await canDeleteAsAttacker(ownerContact.avatarUrl), false);
    } finally {
      await cleanupTestUsers(db, [owner, attacker]);
    }
  },
);
