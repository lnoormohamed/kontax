import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import bcrypt from "bcryptjs";

import { createFakePrisma } from "./_fake-prisma";

/**
 * P49A-13 (Fable review, item 2): Google / Outlook connect and
 * `completeSyncSetup` used to need only the session — a hijacked cookie could
 * connect the attacker's Google account as a two-way sync and receive the
 * whole address book. They now require the 15-minute sync elevation
 * (`src/server/sync-elevation.ts`), which only `confirmSyncSettingsPassword`
 * issues, and that goes through the shared step-up helper (item 6).
 *
 * The real routes, actions, elevation module and step-up helper run; the
 * session, DB and provider SDKs are mocked.
 */

const USER = "user_1";
const JTI = "jti_1";
const PASSWORD = "correct horse battery staple";

let currentDb: unknown;
mock.module("~/server/db", {
  namedExports: {
    db: new Proxy({}, { get: (_t, prop) => (currentDb as Record<string, unknown>)[prop as string] }),
  },
});
mock.module("~/server/auth", {
  namedExports: { auth: async () => ({ user: { id: USER }, jti: JTI }) },
});
mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => USER,
    requireSession: async () => ({ user: { id: USER } }),
    isSessionError: () => false,
    sessionErrorMessage: () => "",
    SessionError: class SessionError extends Error {},
  },
});
mock.module("~/server/billing", {
  namedExports: {
    assertCanCreateContactsTx: async () => undefined,
    assertCanCreateSyncAccount: async () => undefined,
    assertCanCreateSyncAccountTx: async () => undefined,
    assertCanUseCardDavSync: async () => undefined,
    lockUserForPlanCheck: async () => undefined,
  },
});
mock.module("~/server/carddav", {
  namedExports: {
    CardDavPreflightError: class CardDavPreflightError extends Error {},
    discoverCardDavAccount: async () => ({}),
    pushCardDavContact: async () => ({ href: "/x.vcf", etag: null }),
  },
});
mock.module("~/server/sync-credentials", {
  namedExports: {
    decryptSyncCredentialPayload: () => ({ username: "u", password: "p" }),
    encryptSyncCredentialPayload: () => ({ credentialReference: "enc", encryptionKeyRef: "k1" }),
    getSyncCredentialEncryptionStatus: () => ({ available: true }),
  },
});
mock.module("next/cache", {
  namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined },
});

const GOOGLE_CONSENT = "https://accounts.google.com/o/oauth2/v2/auth?fake=1";
const MICROSOFT_CONSENT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?fake=1";
mock.module("~/server/google-sync", {
  namedExports: {
    GOOGLE_CONTACTS_SCOPES: [],
    isGoogleSyncConfigured: () => true,
    createGoogleOAuthClient: () => ({ generateAuthUrl: () => GOOGLE_CONSENT }),
    encodeOAuthState: () => "state",
  },
});
mock.module("~/server/microsoft-sync", {
  namedExports: {
    MICROSOFT_SCOPES: [],
    isMicrosoftSyncConfigured: () => true,
    createMsalClient: () => ({ getAuthCodeUrl: async () => MICROSOFT_CONSENT }),
    microsoftRedirectUri: () => "http://localhost:3000/api/sync/microsoft/callback",
  },
});
mock.module("~/server/sync-oauth-state", { namedExports: { encodeOAuthState: () => "state" } });

const googleConnect = await import("../../src/app/api/sync/google/connect/route");
const microsoftConnect = await import("../../src/app/api/sync/microsoft/connect/route");
const { completeSyncSetup, confirmSyncSettingsPassword } = await import("~/app/actions/sync");

let fake: ReturnType<typeof createFakePrisma>;
beforeEach(() => {
  fake = createFakePrisma();
  currentDb = fake.client;
  fake.seed("user", { id: USER, email: "u@example.invalid", password: bcrypt.hashSync(PASSWORD, 4) });
});

const connect = (route: { GET: (req: never) => Promise<Response> }) =>
  route.GET(new Request("http://localhost:3000/api/sync/x/connect") as never);

for (const [label, route, consent, provider] of [
  ["Google", googleConnect, GOOGLE_CONSENT, "google"],
  ["Outlook", microsoftConnect, MICROSOFT_CONSENT, "microsoft"],
] as const) {
  test(`${label} connect without the sync re-auth bounces back to /sync instead of starting OAuth`, async () => {
    const res = await connect(route);
    assert.equal(res.status, 307);
    const location = new URL(res.headers.get("location")!);
    assert.equal(location.pathname, "/sync");
    assert.equal(location.searchParams.get("reauth"), provider);
    assert.equal(location.searchParams.get("add"), "1");
  });

  test(`${label} connect with a valid elevation starts OAuth; an expired one doesn't`, async () => {
    fake.seed("syncSettingsElevation", { userId: USER, jti: JTI, expiresAt: new Date(Date.now() - 1000) });
    assert.notEqual((await connect(route)).headers.get("location"), consent, "expired elevation refused");

    fake.seed("syncSettingsElevation", { userId: USER, jti: JTI, expiresAt: new Date(Date.now() + 60_000) });
    assert.equal((await connect(route)).headers.get("location"), consent);
  });

  test(`${label} connect: another session's elevation doesn't count`, async () => {
    fake.seed("syncSettingsElevation", { userId: USER, jti: "other_session", expiresAt: new Date(Date.now() + 60_000) });
    assert.notEqual((await connect(route)).headers.get("location"), consent);
  });
}

test("the password confirm issues the elevation (wrong password: none), and connect then proceeds", async () => {
  assert.deepEqual(await confirmSyncSettingsPassword("wrong"), { elevated: false });
  assert.equal(fake.rows("syncSettingsElevation").length, 0);

  assert.deepEqual(await confirmSyncSettingsPassword(PASSWORD), { elevated: true });
  assert.equal((await connect(googleConnect)).headers.get("location"), GOOGLE_CONSENT);
});

test("completeSyncSetup refuses without the elevation and changes nothing", async () => {
  fake.seed("syncAccount", { id: "acct_1", userId: USER, status: "ACTIVE", setupCompletedAt: null });
  const result = await completeSyncSetup({ syncAccountId: "acct_1" });
  assert.deepEqual(result, { ok: false, error: "SYNC_SETTINGS_ELEVATION_REQUIRED" });
  assert.equal(fake.rows("syncAccount")[0]!.setupCompletedAt, null);
});
