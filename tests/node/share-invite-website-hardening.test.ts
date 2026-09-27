import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-13 step 5, through the real actions and routes:
 *
 *   - a single-use vCard share link serves exactly one download, even when
 *     two requests race (the check and the count used to be separate steps);
 *   - declining a family/team invite, and accepting a family invite, only
 *     work for the invitee — a forwarded token is no longer enough;
 *   - a contact's website can't be saved as `javascript:alert(1)` (or any
 *     script/embed scheme) through the contact form or the inline editor.
 */

let currentDb: unknown;
mock.module("~/server/db", {
  namedExports: {
    db: new Proxy({}, { get: (_t, prop) => (currentDb as Record<string, unknown>)[prop as string] }),
  },
});

let sessionUserId = "invitee";
mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => sessionUserId,
    requireSession: async () => ({ user: { id: sessionUserId } }),
    isSessionError: () => false,
    sessionErrorMessage: () => "",
    SessionError: class SessionError extends Error {},
  },
});
mock.module("~/server/billing", {
  namedExports: {
    assertCanCreateContactsTx: async () => undefined,
    lockUserForPlanCheck: async () => undefined,
    getUserBillingContext: async () => ({ plan: "PRO", entitlements: {} }),
  },
});
mock.module("~/server/session-validation-cache", {
  namedExports: { invalidateSessionValidation: async () => undefined },
});
mock.module("~/server/render-email", {
  namedExports: { renderEmail: async () => ({ html: "", text: "" }) },
});
mock.module("~/emails/verify-email", { defaultExport: () => null });
mock.module("~/server/email", {
  namedExports: { appUrl: () => "https://app.example.com", sendEmail: async () => ({ success: true }) },
});
mock.module("~/server/shared-access", {
  namedExports: { resolveContactEditAccess: async () => ({ shared: false, allowed: true }) },
});
mock.module("~/server/contact-shares", { namedExports: { propagateLiveShares: async () => undefined } });
mock.module("~/lib/activity", { namedExports: { emitEvent: async () => undefined } });
mock.module("next/cache", {
  namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined },
});
mock.module("next/navigation", {
  namedExports: {
    redirect: () => undefined,
    notFound: () => {
      throw new Error("notFound");
    },
  },
});

const { hashToken } = await import("../../src/server/capability-tokens");
const shareRoute = await import("../../src/app/share/[token]/vcard/route");
const { declineFamilyInvite, acceptFamilyInvite } = await import("../../src/app/actions/family");
const { acceptTeamInvite, declineTeamInvite } = await import("../../src/app/actions/teams");
const { verifyEmailToken } = await import("../../src/server/email-verification");
const { createContact, updateContactEntries } = await import("../../src/app/actions/contacts");

let fake: ReturnType<typeof createFakePrisma>;
beforeEach(() => {
  fake = createFakePrisma();
  currentDb = fake.client;
  sessionUserId = "invitee";
});

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";

// ── single-use share link ────────────────────────────────────────────────────

const seedShare = (maxDownloads: number | null) => {
  // The route selects the nested `contact` relation, which the fake's
  // projection doesn't support: answer the lookup with a copy of the row.
  const delegate = (fake.client as Record<string, Record<string, unknown>>).contactShare!;
  delegate.findUnique = async (args: { where: Record<string, unknown> }) => {
    const row = fake.rows("contactShare").find((r) => r.tokenHash === args.where.tokenHash);
    return row ? structuredClone(row) : null;
  };
  return seedShareRow(maxDownloads);
};

const seedShareRow = (maxDownloads: number | null) =>
  fake.seed("contactShare", {
    shareType: "VCARD_LINK",
    status: "ACTIVE",
    tokenHash: hashToken(TOKEN),
    expiresAt: null,
    downloadCount: 0,
    maxDownloads,
    // The route selects the contact relation; the fake returns the row as-is.
    contact: { fullName: "Ada Lovelace", firstName: "Ada", lastName: "Lovelace", emailEntries: [], phoneEntries: [] },
  });

const download = () =>
  shareRoute.GET(new Request(`https://app.example.com/share/${TOKEN}/vcard`), {
    params: Promise.resolve({ token: TOKEN }),
  });

test("a single-use share link serves one download, even to two racing requests", async () => {
  seedShare(1);
  const responses = await Promise.all([download(), download()]);
  const statuses = responses.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 410], "exactly one request gets the card");

  const share = fake.rows("contactShare")[0]!;
  assert.equal(share.downloadCount, 1);
  assert.equal(share.status, "EXPIRED");
  assert.equal((await download()).status, 410, "and it stays used");

  // Both requests passed the initial check before either claimed — the race
  // was real, and the conditional claim is what settled it.
  const claims = fake.calls.filter(
    (c) =>
      c.model === "contactShare" &&
      c.op === "updateMany" &&
      (c.args as { data?: Record<string, unknown> }).data?.downloadCount !== undefined,
  );
  assert.equal(claims.length, 2, "both requests reached the claim");
});

test("an unlimited share link keeps serving and counting", async () => {
  seedShare(null);
  for (let i = 0; i < 3; i++) assert.equal((await download()).status, 200);
  const share = fake.rows("contactShare")[0]!;
  assert.equal(share.downloadCount, 3);
  assert.equal(share.status, "ACTIVE");
});

// ── invites bound to the invitee ─────────────────────────────────────────────

const seedInvite = (type: "FAMILY" | "TEAM", inviteeVerified = true) => {
  fake.seed("user", {
    id: "invitee",
    email: "invitee@example.invalid",
    emailVerified: inviteeVerified ? new Date() : null,
  });
  fake.seed("user", { id: "bystander", email: "bystander@example.invalid", emailVerified: new Date() });
  return fake.seed("groupMember", {
    groupId: "group_1",
    userId: null,
    invitedEmail: "Invitee@Example.invalid",
    inviteStatus: "PENDING",
    inviteTokenHash: hashToken(TOKEN),
    inviteExpiresAt: new Date(Date.now() + 60_000),
    role: "MEMBER",
    group: { familyDissolveAt: null, type },
  });
};

const tokenForm = () => {
  const fd = new FormData();
  fd.set("token", TOKEN);
  return fd;
};

for (const [label, decline, type] of [
  ["family", declineFamilyInvite, "FAMILY"],
  ["team", declineTeamInvite, "TEAM"],
] as const) {
  test(`declining a ${label} invite: someone else holding the token is refused`, async () => {
    const member = seedInvite(type);
    sessionUserId = "bystander";
    await assert.rejects(() => decline(tokenForm()), /different email address/);
    assert.equal(member.inviteStatus, "PENDING");
    assert.equal(member.inviteTokenHash, hashToken(TOKEN), "the invite still works for its recipient");
  });

  test(`declining a ${label} invite: the invitee can (email match is case-insensitive)`, async () => {
    const member = seedInvite(type);
    sessionUserId = "invitee";
    await decline(tokenForm());
    assert.equal(member.inviteStatus, "DECLINED");
  });
}

test("accepting a family invite is bound to the invitee too", async () => {
  const member = seedInvite("FAMILY");
  sessionUserId = "bystander";
  await assert.rejects(() => acceptFamilyInvite(tokenForm()), /different email address/);
  assert.equal(member.inviteStatus, "PENDING");
  assert.equal(member.userId, null);

  sessionUserId = "invitee";
  await acceptFamilyInvite(tokenForm());
  assert.equal(member.inviteStatus, "ACCEPTED");
  assert.equal(member.userId, "invitee");
});

for (const [label, accept, type] of [
  ["family", acceptFamilyInvite, "FAMILY"],
  ["team", acceptTeamInvite, "TEAM"],
] as const) {
  test(`accepting a ${label} invite needs a verified email — squatting the address isn't enough`, async () => {
    const member = seedInvite(type, false);
    sessionUserId = "invitee";
    await assert.rejects(() => accept(tokenForm()), /Verify your email address first/);
    assert.equal(member.inviteStatus, "PENDING");
  });

  test(`${label}: a new invitee who registers and verifies can then accept`, async () => {
    const member = seedInvite(type, false);
    member.invitedEmail = "invitee@example.invalid"; // invites are stored lower-cased
    // The real verification flow: consuming the SIGNUP token verifies the
    // address and binds pending invites for it to the account.
    const plaintext = "verify-token-plaintext";
    const { createHash } = await import("node:crypto");
    fake.seed("emailVerificationToken", {
      userId: "invitee",
      type: "SIGNUP",
      tokenHash: createHash("sha256").update(plaintext).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    assert.deepEqual(await verifyEmailToken(plaintext), { success: true, type: "SIGNUP" });
    assert.equal(member.userId, "invitee", "verification bound the invite to the account");

    sessionUserId = "invitee";
    await accept(tokenForm());
    assert.equal(member.inviteStatus, "ACCEPTED");
  });
}

test("a team invite with no address and no account is nobody's (old inline check let it through)", async () => {
  const member = seedInvite("TEAM");
  member.invitedEmail = null;
  sessionUserId = "bystander";
  await assert.rejects(() => acceptTeamInvite(tokenForm()), /different email address/);
  assert.equal(member.inviteStatus, "PENDING");
});

// ── website fields ───────────────────────────────────────────────────────────

const contactForm = (fields: Record<string, string>) => {
  const fd = new FormData();
  fd.set("firstName", "Ada");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

test("the contact form rejects a javascript: website (primary, secondary, additional)", async () => {
  fake.seed("user", { id: "invitee", email: "invitee@example.invalid" });
  await assert.rejects(() => createContact(contactForm({ website: "javascript:alert(1)" })), /http:\/\/ or https:\/\//);
  await assert.rejects(
    () => createContact(contactForm({ secondaryWebsite: "data:text/html,<script>alert(1)</script>" })),
    /http:\/\/ or https:\/\//,
  );
  await assert.rejects(
    () => createContact(contactForm({ additionalWebsites: "https://ok.example\nJavaScript:alert(1)" })),
    /valid additional website URL/,
  );
  assert.equal(fake.rows("contact").length, 0, "nothing saved");
});

test("the inline editor rejects a javascript: website but keeps free-text hosts", async () => {
  await assert.rejects(
    () => updateContactEntries("contact_1", "websites", [{ label: "home", value: "javascript:alert(1)" }]),
    /web addresses/,
  );
  await assert.rejects(
    () => updateContactEntries("contact_1", "websites", [{ label: "home", value: " java\tscript:alert(1)" }]),
    /web addresses/,
  );
  // A scheme-less host is not refused by the website check (it then fails on
  // the missing contact, which is the next step).
  await assert.rejects(
    () => updateContactEntries("contact_1", "websites", [{ label: "home", value: "example.com" }]),
    /Contact not found/,
  );
});
