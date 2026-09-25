// P49A-01: in-memory stand-in for the Prisma client, covering only the query
// shapes the OAuth sync connectors (google-sync, microsoft-sync) and the shared
// import engine issue. `src/server/db.ts` reuses `globalThis.prisma` when set,
// so a test installs this BEFORE dynamically importing any sync module:
//
//   const fake = installFakeSyncDb();
//   const { runGoogleSync } = await import("~/server/google-sync");
//
// Node's test runner runs each test file in its own process, so the global
// never leaks between files. Contact writes wait a couple of milliseconds and
// then stamp `updatedAt` with the wall clock, like Prisma's @updatedAt, so
// "the write happened after the batch started" is strictly observable.

type Row = Record<string, unknown> & { id: string };

type Where = Record<string, unknown>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

export type FakeSyncDb = ReturnType<typeof createFakeSyncDb>;

export const createFakeSyncDb = () => {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  const contacts = new Map<string, Row>();
  const links = new Map<string, Row>();
  const conflicts: Row[] = [];
  const events: Row[] = [];
  const accountUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const userPlan: {
    subscriptions: Array<{ plan: string; memberSlotsLimit: number | null }>;
    groupMemberships: unknown[];
  } = { subscriptions: [], groupMemberships: [] };

  const relationFor = (row: Row, key: string): unknown => {
    if (key === "contact" && typeof row.contactId === "string") {
      return contacts.get(row.contactId) ?? null;
    }
    if (key === "syncLinks") {
      return [...links.values()].filter((link) => link.contactId === row.id);
    }
    return undefined;
  };

  const matches = (row: Row, where: Where | undefined): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([key, condition]) => {
      if (condition === undefined) return true;
      if (key === "OR") return (condition as Where[]).some((w) => matches(row, w));
      if (key === "AND") return (condition as Where[]).every((w) => matches(row, w));
      const value = key in row ? row[key] : relationFor(row, key);
      if (condition === null) return value == null;
      if (isPlainObject(condition)) {
        if ("not" in condition) {
          return condition.not === null ? value != null : value !== condition.not;
        }
        if ("none" in condition) {
          return !(value as Row[]).some((related) => matches(related, condition.none as Where));
        }
        if ("in" in condition) return (condition.in as unknown[]).includes(value);
        // Nested relation filter (e.g. link.contact: { archivedAt: null }).
        return value != null && matches(value as Row, condition);
      }
      return value === condition;
    });
  };

  const applyData = (row: Row, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (isPlainObject(value) && typeof value.increment === "number") {
        row[key] = ((row[key] as number | undefined) ?? 0) + value.increment;
      } else {
        row[key] = value;
      }
    }
  };

  const withContact = (link: Row) => ({ ...link, contact: contacts.get(link.contactId as string) ?? null });

  const stampContact = async (row: Row) => {
    await sleep(2);
    row.updatedAt = new Date();
  };

  const client = {
    contact: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = {
          id: nextId("contact"),
          syncUid: nextId("uid"),
          syncVersion: 1,
          archivedAt: null,
          syncTombstoneAt: null,
          createdAt: new Date(),
        };
        applyData(row, data);
        await stampContact(row);
        contacts.set(row.id, row);
        return { ...row };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = contacts.get(where.id);
        if (!row) throw new Error(`fake db: contact ${where.id} not found`);
        applyData(row, data);
        await stampContact(row);
        return { ...row };
      },
      findMany: async ({ where }: { where?: Where }) =>
        [...contacts.values()].filter((row) => matches(row, where)).map((row) => ({ ...row })),
      count: async ({ where }: { where?: Where } = {}) =>
        [...contacts.values()].filter((row) => matches(row, where)).length,
    },
    // P49A-06: the plan loader (plan-entitlements.mjs loadEffectivePlan) reads
    // the user's active subscriptions + team memberships in one nested query.
    // Every user resolves to `userPlan` (default: no subscriptions → FREE).
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        lifecycleState: "ACTIVE",
        subscriptions: userPlan.subscriptions,
        groupMemberships: userPlan.groupMemberships,
      }),
    },
    $queryRaw: async () => [],
    syncContactLink: {
      findUnique: async ({ where }: { where: Where }) => {
        const key = where.syncAccountId_remoteUid as { syncAccountId: string; remoteUid: string } | undefined;
        const found = [...links.values()].find((link) =>
          key
            ? link.syncAccountId === key.syncAccountId && link.remoteUid === key.remoteUid
            : link.id === where.id,
        );
        return found ? withContact(found) : null;
      },
      findMany: async ({ where }: { where?: Where }) =>
        [...links.values()].filter((row) => matches(row, where)).map(withContact),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = {
          id: nextId("link"),
          tombstonedAt: null,
          remoteDeletedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        applyData(row, data);
        links.set(row.id, row);
        return { ...row };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = links.get(where.id);
        if (!row) throw new Error(`fake db: link ${where.id} not found`);
        applyData(row, data);
        row.updatedAt = new Date();
        return { ...row };
      },
    },
    syncConflict: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId("conflict"), ...data };
        conflicts.push(row);
        return { ...row };
      },
      count: async ({ where }: { where?: Where }) =>
        conflicts.filter((row) => matches(row, where)).length,
      findFirst: async ({ where }: { where?: Where }) => {
        const row = conflicts.filter((candidate) => matches(candidate, where)).at(-1);
        return row ? { ...row } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = conflicts.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error(`fake db: conflict ${where.id} not found`);
        applyData(row, data);
        return { ...row };
      },
    },
    activityEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId("event"), ...data };
        events.push(row);
        return row;
      },
    },
    syncAccount: {
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        accountUpdates.push({ id: where.id, data });
        return { id: where.id, ...data };
      },
    },
    label: {
      findMany: async () => [],
    },
    $transaction: async (arg: unknown): Promise<unknown> => {
      if (typeof arg === "function") return (arg as (tx: unknown) => Promise<unknown>)(client);
      return Promise.all(arg as Array<Promise<unknown>>);
    },
  };

  return {
    client,
    contacts,
    links,
    conflicts,
    events,
    accountUpdates,
    userPlan,
    reset() {
      contacts.clear();
      links.clear();
      conflicts.length = 0;
      events.length = 0;
      accountUpdates.length = 0;
      userPlan.subscriptions = [];
      userPlan.groupMemberships = [];
    },
    linkByRemoteUid(remoteUid: string) {
      return [...links.values()].find((link) => link.remoteUid === remoteUid);
    },
    contactByRemoteUid(remoteUid: string) {
      const link = [...links.values()].find((l) => l.remoteUid === remoteUid);
      return link ? contacts.get(link.contactId as string) : undefined;
    },
    // A user edit in the Kontax UI: bumps updatedAt and marks it MANUAL.
    async editContact(id: string, patch: Record<string, unknown>) {
      const row = contacts.get(id);
      if (!row) throw new Error(`fake db: contact ${id} not found`);
      applyData(row, { ...patch, lastMutatedBy: "MANUAL" });
      await stampContact(row);
    },
    lastCursorFor(accountId: string): string | null | undefined {
      const updates = accountUpdates.filter((u) => u.id === accountId && "lastSyncCursor" in u.data);
      return updates.at(-1)?.data.lastSyncCursor as string | null | undefined;
    },
  };
};

export const installFakeSyncDb = () => {
  const fake = createFakeSyncDb();
  (globalThis as unknown as { prisma: unknown }).prisma = fake.client;
  return fake;
};
