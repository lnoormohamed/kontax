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

const SCALAR_OPERATORS = new Set(["not", "in", "notIn", "lt", "lte", "gt", "gte"]);

const comparable = (value: unknown) => (value instanceof Date ? value.getTime() : value);

const scalarOperator = (op: string, value: unknown, arg: unknown): boolean => {
  switch (op) {
    case "not":
      return arg === null ? value != null : comparable(value) !== comparable(arg);
    case "in":
      return (arg as unknown[]).includes(value);
    case "notIn":
      return !(arg as unknown[]).includes(value);
    default: {
      if (value == null) return false;
      const left = comparable(value) as number;
      const right = comparable(arg) as number;
      if (op === "lt") return left < right;
      if (op === "lte") return left <= right;
      if (op === "gt") return left > right;
      return left >= right;
    }
  }
};

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

  // P49A-12: tables the merge / undo / delete paths touch.
  const memberships: Row[] = [];
  const groupContacts: Row[] = [];
  const mergeSuggestions: Row[] = [];
  const mergeDecisions: Row[] = [];
  // Sync account statuses (a link's `syncAccount` relation); unknown = ACTIVE.
  const accountStatus = new Map<string, string>();

  const relationFor = (row: Row, key: string): unknown => {
    if (key === "contact" && typeof row.contactId === "string") {
      return contacts.get(row.contactId) ?? null;
    }
    if (key === "syncLinks") {
      return [...links.values()].filter((link) => link.contactId === row.id);
    }
    if (key === "bookMemberships") return memberships.filter((m) => m.contactId === row.id);
    if (key === "groupContacts") return groupContacts.filter((g) => g.contactId === row.id);
    if (key === "syncAccount" && typeof row.syncAccountId === "string") {
      return { id: row.syncAccountId, status: accountStatus.get(row.syncAccountId) ?? "ACTIVE" };
    }
    return undefined;
  };

  // A contact row plus any to-many relation its `select` asks for (with the
  // relation's own `where`). Scalar selects are not narrowed — extra keys are
  // harmless to the code under test.
  const CONTACT_RELATIONS = new Set(["syncLinks", "bookMemberships", "groupContacts"]);
  const projectContact = (row: Row, select?: Record<string, unknown>) => {
    const out: Row = { ...row };
    for (const [key, spec] of Object.entries(select ?? {})) {
      if (!CONTACT_RELATIONS.has(key)) continue;
      const related = relationFor(row, key) as Row[];
      const where = isPlainObject(spec) ? (spec.where as Where | undefined) : undefined;
      out[key] = related.filter((r) => matches(r, where)).map((r) => ({ ...r }));
    }
    return out;
  };

  // Generic in-memory table (create / find / update / delete by `where`).
  const table = (rows: Row[], prefix: string, uniqueKey?: (row: Row) => string) => {
    const flatten = (where: Where | undefined): Where | undefined => {
      if (!where) return where;
      const out: Where = {};
      for (const [key, value] of Object.entries(where)) {
        // compound-unique selector, e.g. { userId_pairKey: { userId, pairKey } }
        if (key.includes("_") && isPlainObject(value)) Object.assign(out, value);
        else out[key] = value;
      }
      return out;
    };
    const find = (where?: Where) => rows.filter((row) => matches(row, flatten(where)));
    return {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { id: nextId(prefix), createdAt: new Date(), ...data };
        rows.push(row);
        return { ...row };
      },
      createMany: async ({ data, skipDuplicates }: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const item of data) {
          const row: Row = { id: nextId(prefix), createdAt: new Date(), ...item };
          if (uniqueKey && rows.some((existing) => uniqueKey(existing) === uniqueKey(row))) {
            if (skipDuplicates) continue;
            throw new Error(`fake db: unique violation in ${prefix}`);
          }
          rows.push(row);
          count += 1;
        }
        return { count };
      },
      findFirst: async ({ where }: { where?: Where } = {}) => {
        const row = find(where)[0];
        return row ? { ...row } : null;
      },
      findUnique: async ({ where }: { where?: Where } = {}) => {
        const row = find(where)[0];
        return row ? { ...row } : null;
      },
      findMany: async ({ where }: { where?: Where } = {}) => find(where).map((row) => ({ ...row })),
      update: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const row = find(where)[0];
        if (!row) throw new Error(`fake db: ${prefix} not found`);
        applyData(row, data);
        return { ...row };
      },
      updateMany: async ({ where, data }: { where?: Where; data: Record<string, unknown> }) => {
        const found = find(where);
        for (const row of found) applyData(row, data);
        return { count: found.length };
      },
      deleteMany: async ({ where }: { where?: Where } = {}) => {
        const found = new Set(find(where));
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i -= 1) if (found.has(rows[i]!)) rows.splice(i, 1);
        return { count: before - rows.length };
      },
      count: async ({ where }: { where?: Where } = {}) => find(where).length,
    };
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
        if ("none" in condition) {
          return !(value as Row[]).some((related) => matches(related, condition.none as Where));
        }
        // P49A-12: scalar operators, combinable ({ not: null, lte: date }).
        const operators = Object.keys(condition);
        if (operators.every((op) => SCALAR_OPERATORS.has(op))) {
          return operators.every((op) => scalarOperator(op, value, condition[op]));
        }
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
      update: async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
        select?: Record<string, unknown>;
      }) => {
        const row = contacts.get(where.id);
        if (!row) throw new Error(`fake db: contact ${where.id} not found`);
        applyData(row, data);
        await stampContact(row);
        return projectContact(row, select);
      },
      findMany: async ({
        where,
        select,
        take,
      }: {
        where?: Where;
        select?: Record<string, unknown>;
        take?: number;
      }) =>
        [...contacts.values()]
          .filter((row) => matches(row, where))
          .slice(0, take ?? Infinity)
          .map((row) => projectContact(row, select)),
      findFirst: async ({ where, select }: { where?: Where; select?: Record<string, unknown> } = {}) => {
        const row = [...contacts.values()].find((candidate) => matches(candidate, where));
        return row ? projectContact(row, select) : null;
      },
      count: async ({ where }: { where?: Where } = {}) =>
        [...contacts.values()].filter((row) => matches(row, where)).length,
      // P49A-12: permanent delete / purge.
      updateMany: async ({ where, data }: { where?: Where; data: Record<string, unknown> }) => {
        const rows = [...contacts.values()].filter((row) => matches(row, where));
        for (const row of rows) {
          applyData(row, data);
          await stampContact(row);
        }
        return { count: rows.length };
      },
      deleteMany: async ({ where }: { where?: Where }) => {
        const rows = [...contacts.values()].filter((row) => matches(row, where));
        for (const row of rows) {
          contacts.delete(row.id);
          // FK cascades
          for (const link of [...links.values()]) if (link.contactId === row.id) links.delete(link.id);
        }
        return { count: rows.length };
      },
    },
    contactBookMembership: table(memberships, "membership", (r) =>
      [r.contactId, r.addressBookId].map(String).join(":"),
    ),
    groupContact: table(groupContacts, "groupContact", (r) =>
      [r.groupAddressBookId, r.contactId].map(String).join(":"),
    ),
    mergeSuggestion: table(mergeSuggestions, "suggestion"),
    mergeDecision: table(mergeDecisions, "decision"),
    // No shares in these tests (the merge moves / propagates them).
    contactShare: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [],
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
      // P49A-12: the dirty marker is set / settled with updateMany.
      updateMany: async ({ where, data }: { where?: Where; data: Record<string, unknown> }) => {
        const rows = [...links.values()].filter((row) => matches(row, where));
        for (const row of rows) {
          applyData(row, data);
          row.updatedAt = new Date();
        }
        return { count: rows.length };
      },
      deleteMany: async ({ where }: { where?: Where }) => {
        const rows = [...links.values()].filter((row) => matches(row, where));
        for (const row of rows) links.delete(row.id);
        return { count: rows.length };
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
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        for (const item of data) events.push({ id: nextId("event"), ...item });
        return { count: data.length };
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
    memberships,
    groupContacts,
    mergeSuggestions,
    mergeDecisions,
    accountStatus,
    reset() {
      contacts.clear();
      links.clear();
      conflicts.length = 0;
      events.length = 0;
      accountUpdates.length = 0;
      memberships.length = 0;
      groupContacts.length = 0;
      mergeSuggestions.length = 0;
      mergeDecisions.length = 0;
      accountStatus.clear();
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
