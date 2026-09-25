// P48-18 / P48-13: calendar, share and invite tokens are stored hash-only (plus
// an encrypted display copy for calendar/share), resolve by hash, still resolve
// for legacy plaintext rows issued before the deploy, survive the backfill, and
// a wrong token never resolves.
//
// MUST import ./_env first (points DATABASE_URL at TEST_DATABASE_URL before
// anything below dynamically imports ~/server/db) and MUST use dynamic
// `await import(...)` for every module that touches the database.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { hasTestDb, skipMessage } from "./_env";
import { cleanupTestUsers, createTestContact, createTestUser, fakeSession } from "./_helpers";

import type { User } from "../../../generated/prisma";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// The display copy is encrypted under the sync credential keyring; the keyring
// is read from process.env on every call, so setting it here is enough.
const DISPLAY_KEYS = `t1:${"5a".repeat(32)}`;
process.env.SYNC_CREDENTIAL_ENCRYPTION_KEYS = DISPLAY_KEYS;

const newToken = () => randomBytes(24).toString("base64url");

const load = async () => {
  const { db } = await import("../../../src/server/db");
  const { __setSessionOverrideForTests } = await import(
    "../../../src/server/auth/require-session"
  );
  const tokens = await import("../../../src/server/capability-tokens");
  return { db, setSession: __setSessionOverrideForTests, tokens };
};

const asUser = async <T>(
  setSession: Awaited<ReturnType<typeof load>>["setSession"],
  user: User,
  fn: () => Promise<T>,
): Promise<T> => {
  setSession(async () => fakeSession(user));
  try {
    return await fn();
  } finally {
    setSession(null);
  }
};

const icsStatus = async (token: string) => {
  const { GET } = await import("../../../src/app/api/calendar/birthdays.ics/route");
  const { NextRequest } = await import("next/server");
  const res = await GET(
    new NextRequest(`http://localhost/api/calendar/birthdays.ics?calToken=${encodeURIComponent(token)}`),
  );
  return res.status;
};

const vcardStatus = async (token: string) => {
  const { GET } = await import("../../../src/app/share/[token]/vcard/route");
  const res = await GET(new Request(`http://localhost/share/${token}/vcard`), {
    params: Promise.resolve({ token }),
  });
  return res.status;
};

/** Server actions end in redirect(), which throws NEXT_REDIRECT. */
const expectRedirect = async (fn: () => Promise<unknown>) => {
  await assert.rejects(fn, (error: unknown) => {
    const digest = (error as { digest?: unknown } | null)?.digest;
    return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
  });
};

const runBackfill = (...args: string[]) =>
  spawnSync(process.execPath, ["scripts/backfill-p48-18-token-hashes.mjs", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      SYNC_CREDENTIAL_ENCRYPTION_KEYS: DISPLAY_KEYS,
    },
  });

// ── Calendar feed ────────────────────────────────────────────────────────────

test(
  "calendar token: issued hash-only, resolves by hash, wrong token 401s, regenerate revokes",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db, setSession, tokens } = await load();
    const { ensureCalTokenAction, regenerateCalTokenAction } = await import(
      "../../../src/app/actions/notifications"
    );
    const user = await createTestUser(db);
    try {
      const token = await asUser(setSession, user, () => ensureCalTokenAction());

      const row = await db.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { calToken: true, calTokenHash: true, calTokenEncrypted: true },
      });
      assert.equal(row.calToken, null, "plaintext column never written");
      assert.equal(row.calTokenHash, tokens.hashToken(token));
      assert.ok(row.calTokenEncrypted && !row.calTokenEncrypted.includes(token));
      assert.deepEqual(tokens.calDisplayToken(row), { status: "ok", token });

      // Idempotent: a second ensure returns the same (decrypted) token.
      assert.equal(await asUser(setSession, user, () => ensureCalTokenAction()), token);

      assert.equal(await icsStatus(token), 200);
      assert.equal(await icsStatus(newToken()), 401);
      assert.equal(await icsStatus(row.calTokenHash ?? ""), 401, "the hash is not a credential");

      const rotated = await asUser(setSession, user, () => regenerateCalTokenAction());
      assert.notEqual(rotated, token);
      assert.equal(await icsStatus(token), 401);
      assert.equal(await icsStatus(rotated), 200);
    } finally {
      await cleanupTestUsers(db, [user]);
    }
  },
);

test(
  "calendar token: a legacy plaintext row still resolves and displays; regenerate kills it",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db, setSession } = await load();
    const { ensureCalTokenAction, regenerateCalTokenAction } = await import(
      "../../../src/app/actions/notifications"
    );
    const legacy = newToken();
    const user = await createTestUser(db, { calToken: legacy });
    try {
      assert.equal(await icsStatus(legacy), 200);
      // Settings / ensure show the legacy token rather than minting a new one.
      assert.equal(await asUser(setSession, user, () => ensureCalTokenAction()), legacy);

      await asUser(setSession, user, () => regenerateCalTokenAction());
      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(row.calToken, null);
      assert.equal(await icsStatus(legacy), 401);
    } finally {
      await cleanupTestUsers(db, [user]);
    }
  },
);

test(
  "calendar token: an undecryptable display copy shows as unavailable instead of throwing",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db, setSession, tokens } = await load();
    const { ensureCalTokenAction } = await import("../../../src/app/actions/notifications");
    const token = newToken();
    const user = await createTestUser(db, {
      calTokenHash: tokens.hashToken(token),
      calTokenEncrypted: "kontax-tok-v1:AgJrOQ", // truncated envelope, unknown key id
    });
    try {
      const row = await db.user.findUniqueOrThrow({
        where: { id: user.id },
        select: tokens.calTokenDisplaySelect,
      });
      assert.deepEqual(tokens.calDisplayToken(row), { status: "unavailable" });
      // ensure must not silently rotate a token the user may be subscribed to.
      await assert.rejects(() => asUser(setSession, user, () => ensureCalTokenAction()), /Regenerate/);
      const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(after.calTokenHash, tokens.hashToken(token));
      // The feed itself still works — only display is affected.
      assert.equal(await icsStatus(token), 200);
    } finally {
      await cleanupTestUsers(db, [user]);
    }
  },
);

// ── vCard share links ────────────────────────────────────────────────────────

test(
  "share link: created hash-only, reused by decrypting, resolves by hash, wrong token 404s",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db, setSession, tokens } = await load();
    const { createVcardShareLink, getOrCreateVcardShareLink } = await import(
      "../../../src/app/actions/shares"
    );
    const { resolveShareForDisplay } = await import("../../../src/server/public-share");
    const owner = await createTestUser(db);
    try {
      const contact = await createTestContact(db, owner);
      const form = new FormData();
      form.set("contactId", contact.id);
      form.set("singleUse", "false");
      await asUser(setSession, owner, () => createVcardShareLink(form));

      const rows = await db.contactShare.findMany({ where: { contactId: contact.id } });
      assert.equal(rows.length, 1);
      const [row] = rows;
      assert.ok(row);
      assert.equal(row.token, null, "plaintext column never written");
      assert.ok(row.tokenHash && row.tokenEncrypted);

      const { url } = await asUser(setSession, owner, () => getOrCreateVcardShareLink(contact.id));
      const token = url.split("/share/")[1] ?? "";
      assert.equal(tokens.hashToken(token), row.tokenHash, "reuses the existing link");
      assert.equal(
        await db.contactShare.count({ where: { contactId: contact.id } }),
        1,
        "no second link minted",
      );

      assert.equal((await resolveShareForDisplay(token)).status, "ok");
      assert.equal((await resolveShareForDisplay(newToken())).status, "notfound");
      assert.equal(await vcardStatus(token), 200);
      assert.equal(await vcardStatus(newToken()), 404);
      assert.equal(await vcardStatus(row.tokenHash ?? ""), 404, "the hash is not a credential");
    } finally {
      await cleanupTestUsers(db, [owner]);
    }
  },
);

test(
  "share link: a legacy plaintext link is reused for display and still resolves",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db, setSession } = await load();
    const { getOrCreateVcardShareLink } = await import("../../../src/app/actions/shares");
    const { resolveShareForDisplay } = await import("../../../src/server/public-share");
    const owner = await createTestUser(db);
    try {
      const contact = await createTestContact(db, owner);
      const legacy = newToken();
      await db.contactShare.create({
        data: {
          ownerUserId: owner.id,
          contactId: contact.id,
          shareType: "VCARD_LINK",
          token: legacy,
          status: "ACTIVE",
        },
      });

      const { url } = await asUser(setSession, owner, () => getOrCreateVcardShareLink(contact.id));
      assert.ok(url.endsWith(`/share/${legacy}`));
      assert.equal(await db.contactShare.count({ where: { contactId: contact.id } }), 1);
      assert.equal((await resolveShareForDisplay(legacy)).status, "ok");
      assert.equal(await vcardStatus(legacy), 200);
    } finally {
      await cleanupTestUsers(db, [owner]);
    }
  },
);

test(
  "share link: an undecryptable active link is not silently duplicated; regenerate replaces it",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db, setSession, tokens } = await load();
    const { getOrCreateVcardShareLink, regenerateVcardShareLink } = await import(
      "../../../src/app/actions/shares"
    );
    const owner = await createTestUser(db);
    try {
      const contact = await createTestContact(db, owner);
      const old = newToken();
      const share = await db.contactShare.create({
        data: {
          ownerUserId: owner.id,
          contactId: contact.id,
          shareType: "VCARD_LINK",
          tokenHash: tokens.hashToken(old),
          tokenEncrypted: "kontax-tok-v1:AgJrOQ",
          status: "ACTIVE",
          maxDownloads: 1,
        },
      });

      await assert.rejects(
        () => asUser(setSession, owner, () => getOrCreateVcardShareLink(contact.id)),
        /Regenerate link/,
      );
      assert.equal(
        await db.contactShare.count({ where: { contactId: contact.id, status: "ACTIVE" } }),
        1,
      );

      const form = new FormData();
      form.set("shareId", share.id);
      form.set("contactId", contact.id);
      await asUser(setSession, owner, () => regenerateVcardShareLink(form));

      const active = await db.contactShare.findMany({
        where: { contactId: contact.id, status: "ACTIVE" },
      });
      assert.equal(active.length, 1);
      const [replacement] = active;
      assert.ok(replacement && replacement.id !== share.id);
      assert.equal(replacement.maxDownloads, 1, "keeps the single-use setting");
      assert.equal(replacement.token, null);
      assert.equal(tokens.shareDisplayToken(replacement).status, "ok");
      assert.equal(await vcardStatus(old), 410, "old link revoked");
    } finally {
      await cleanupTestUsers(db, [owner]);
    }
  },
);

// ── Family / team invites ────────────────────────────────────────────────────

test(
  "team invite: hash-only invite and legacy plaintext invite both accept; wrong token is rejected",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db, setSession, tokens } = await load();
    const { acceptTeamInvite } = await import("../../../src/app/actions/teams");
    const owner = await createTestUser(db);
    const hashedInvitee = await createTestUser(db);
    const legacyInvitee = await createTestUser(db);
    try {
      const team = await db.group.create({
        data: { ownerId: owner.id, type: "TEAM", name: "P48-18 team" },
      });
      const hashed = newToken();
      const legacy = newToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await db.groupMember.create({
        data: {
          groupId: team.id,
          invitedEmail: hashedInvitee.email,
          ...tokens.inviteTokenColumns(hashed),
          inviteExpiresAt: expires,
        },
      });
      await db.groupMember.create({
        data: {
          groupId: team.id,
          invitedEmail: legacyInvitee.email,
          inviteToken: legacy,
          inviteExpiresAt: expires,
        },
      });

      const accept = (user: User, token: string) => {
        const form = new FormData();
        form.set("token", token);
        return asUser(setSession, user, () => acceptTeamInvite(form));
      };

      await assert.rejects(() => accept(hashedInvitee, newToken()), /no longer valid/);
      await expectRedirect(() => accept(hashedInvitee, hashed));
      await expectRedirect(() => accept(legacyInvitee, legacy));

      const members = await db.groupMember.findMany({ where: { groupId: team.id } });
      assert.equal(members.length, 2);
      for (const member of members) {
        assert.equal(member.inviteStatus, "ACCEPTED");
        assert.equal(member.inviteToken, null);
        assert.equal(member.inviteTokenHash, null);
      }
    } finally {
      await cleanupTestUsers(db, [owner, hashedInvitee, legacyInvitee]);
    }
  },
);

test(
  "family invite: a legacy plaintext invite still resolves for the join page and accept",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db, setSession, tokens } = await load();
    const { acceptFamilyInvite } = await import("../../../src/app/actions/family");
    const owner = await createTestUser(db);
    const invitee = await createTestUser(db);
    try {
      const family = await db.group.create({
        data: { ownerId: owner.id, type: "FAMILY", name: "P48-18 family" },
      });
      const legacy = newToken();
      const member = await db.groupMember.create({
        data: {
          groupId: family.id,
          invitedEmail: invitee.email,
          inviteToken: legacy,
          inviteExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // What the join page does.
      const found = await tokens.findMemberByInviteToken(legacy, (where) =>
        db.groupMember.findUnique({ where, select: { id: true } }),
      );
      assert.equal(found?.id, member.id);

      const form = new FormData();
      form.set("token", legacy);
      await expectRedirect(() => asUser(setSession, invitee, () => acceptFamilyInvite(form)));
      const after = await db.groupMember.findUniqueOrThrow({ where: { id: member.id } });
      assert.equal(after.inviteStatus, "ACCEPTED");
      assert.equal(after.inviteToken, null);
    } finally {
      await cleanupTestUsers(db, [owner, invitee]);
    }
  },
);

// ── Backfill ─────────────────────────────────────────────────────────────────

test(
  "backfill: dry run writes nothing; --apply converts legacy rows, which still resolve; idempotent",
  { skip: !hasTestDb && skipMessage },
  async () => {
    const { db, tokens } = await load();
    const calLegacy = newToken();
    const shareLegacy = newToken();
    const inviteLegacy = newToken();
    const owner = await createTestUser(db, { calToken: calLegacy });
    const invitee = await createTestUser(db);
    try {
      const contact = await createTestContact(db, owner);
      const share = await db.contactShare.create({
        data: {
          ownerUserId: owner.id,
          contactId: contact.id,
          shareType: "VCARD_LINK",
          token: shareLegacy,
          status: "ACTIVE",
        },
      });
      const team = await db.group.create({
        data: { ownerId: owner.id, type: "TEAM", name: "P48-18 backfill" },
      });
      const member = await db.groupMember.create({
        data: {
          groupId: team.id,
          invitedEmail: invitee.email,
          inviteToken: inviteLegacy,
          inviteExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const dry = runBackfill();
      assert.equal(dry.status, 0, dry.stderr);
      assert.match(dry.stdout, /DRY RUN/);
      assert.match(dry.stdout, /User\."calToken": \d+ plaintext row\(s\) — \d+ would convert/);
      for (const secret of [calLegacy, shareLegacy, inviteLegacy]) {
        assert.ok(!dry.stdout.includes(secret) && !dry.stderr.includes(secret), "no token in output");
      }
      assert.equal(
        (await db.user.findUniqueOrThrow({ where: { id: owner.id } })).calToken,
        calLegacy,
        "dry run leaves rows alone",
      );

      const applied = runBackfill("--apply");
      assert.equal(applied.status, 0, applied.stderr);
      assert.match(applied.stdout, /0 plaintext row\(s\) remaining/);
      for (const secret of [calLegacy, shareLegacy, inviteLegacy]) {
        assert.ok(!applied.stdout.includes(secret) && !applied.stderr.includes(secret));
      }

      const userRow = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
      assert.equal(userRow.calToken, null);
      assert.equal(userRow.calTokenHash, tokens.hashToken(calLegacy));
      assert.deepEqual(tokens.calDisplayToken(userRow), { status: "ok", token: calLegacy });

      const shareRow = await db.contactShare.findUniqueOrThrow({ where: { id: share.id } });
      assert.equal(shareRow.token, null);
      assert.equal(shareRow.tokenHash, tokens.hashToken(shareLegacy));
      assert.deepEqual(tokens.shareDisplayToken(shareRow), { status: "ok", token: shareLegacy });

      const memberRow = await db.groupMember.findUniqueOrThrow({ where: { id: member.id } });
      assert.equal(memberRow.inviteToken, null);
      assert.equal(memberRow.inviteTokenHash, tokens.hashToken(inviteLegacy));

      // Pre-deploy links keep working after the backfill.
      assert.equal(await icsStatus(calLegacy), 200);
      assert.equal(await vcardStatus(shareLegacy), 200);
      const found = await tokens.findMemberByInviteToken(inviteLegacy, (where) =>
        db.groupMember.findUnique({ where, select: { id: true } }),
      );
      assert.equal(found?.id, member.id);

      assert.equal(await db.user.count({ where: { calToken: { not: null } } }), 0);
      assert.equal(await db.contactShare.count({ where: { token: { not: null } } }), 0);
      assert.equal(await db.groupMember.count({ where: { inviteToken: { not: null } } }), 0);

      const again = runBackfill("--apply");
      assert.equal(again.status, 0, again.stderr);
      assert.match(again.stdout, /User\."calToken": 0 plaintext row\(s\)/);
      assert.match(again.stdout, /ContactShare\."token": 0 plaintext row\(s\)/);
      assert.match(again.stdout, /GroupMember\."inviteToken": 0 plaintext row\(s\)/);
    } finally {
      await cleanupTestUsers(db, [owner, invitee]);
    }
  },
);
