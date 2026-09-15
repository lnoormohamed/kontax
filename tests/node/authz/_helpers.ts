// P48-13: fixture + session-override helpers shared by tests/node/authz/*.
// Import `./_env` FIRST in every test file (see its header comment) — this
// module and everything it dynamically imports assumes DATABASE_URL has
// already been pointed at the test database.
import type { Contact, Prisma, PrismaClient, SyncAccount, User } from "../../../generated/prisma";
import { DEFAULT_PREFERENCES } from "../../../src/lib/preferences-shared";

let seq = 0;
/** A short unique suffix so parallel test files never collide on unique columns. */
export const uniqueSuffix = (): string => `${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Create a throwaway user directly in the test DB. Returns the row. */
export async function createTestUser(
  db: PrismaClient,
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
): Promise<User> {
  const suffix = uniqueSuffix();
  return db.user.create({
    data: {
      email: `authz-test-${suffix}@example.invalid`,
      password: "not-a-real-hash",
      emailVerified: new Date(),
      ...overrides,
    },
  });
}

/** Create a throwaway contact owned by `user`. */
export async function createTestContact(
  db: PrismaClient,
  user: User,
  overrides: Partial<Prisma.ContactUncheckedCreateInput> = {},
): Promise<Contact> {
  return db.contact.create({
    data: {
      userId: user.id,
      fullName: `Authz Test Contact ${uniqueSuffix()}`,
      ...overrides,
    },
  });
}

/** Create a throwaway (disconnectable) sync account owned by `user`. */
export async function createTestSyncAccount(
  db: PrismaClient,
  user: User,
  overrides: Partial<Prisma.SyncAccountUncheckedCreateInput> = {},
): Promise<SyncAccount> {
  const suffix = uniqueSuffix();
  return db.syncAccount.create({
    data: {
      userId: user.id,
      label: `Authz Test Sync ${suffix}`,
      baseUrl: `https://dav.example.invalid/${suffix}`,
      status: "ACTIVE",
      ...overrides,
    },
  });
}

/**
 * The subset of `AppSession` (src/server/auth/index.ts) that
 * `requireSession`/`requireUserId` actually read: `user.id` plus the two
 * write-refusal flags. Everything else `Session["user"]` requires
 * (`emailVerified`, `avatarUrl`, `preferences`) is UI-only, but still typed
 * here rather than cast away, so a real shape drift in `require-session.ts`
 * still fails this file's typecheck.
 */
export type FakeSessionOptions = {
  impersonatedBy?: string;
  pendingDeletion?: boolean;
};

/** Build a minimal but real-shaped session for `__setSessionOverrideForTests`. */
export function fakeSession(user: User, opts: FakeSessionOptions = {}) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      role: user.role,
      preferences: DEFAULT_PREFERENCES,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
    impersonatedBy: opts.impersonatedBy,
    pendingDeletion: opts.pendingDeletion,
  };
}

/**
 * Delete every row created by the given users (cascades handle the rest —
 * see `onDelete: Cascade` on Contact/SyncAccount/etc → User in the schema).
 */
export async function cleanupTestUsers(db: PrismaClient, users: User[]): Promise<void> {
  const ids = users.map((u) => u.id).filter(Boolean);
  if (ids.length === 0) return;
  await db.user.deleteMany({ where: { id: { in: ids } } });
}
