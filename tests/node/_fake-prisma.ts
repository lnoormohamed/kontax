// P49A-05: a tiny in-memory stand-in for the Prisma client, for unit tests that
// drive real server code (e.g. the Stripe webhook processor) without Postgres.
//
// Supports the subset those code paths use: findUnique/findUniqueOrThrow/
// findFirst/findMany/count/create/update/updateMany/upsert/delete/deleteMany,
// scalar `where` filters (equals, in, notIn, not, startsWith, lt/lte/gt/gte,
// AND/OR/NOT), `orderBy` with Postgres null ordering, top-level scalar
// `select`, and `$transaction(fn)` with rollback on throw. Relation filters
// and nested selects are NOT supported — a relation filter throws so a test
// can't silently pass on an unmatched query.

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const OPERATORS = new Set([
  "equals",
  "in",
  "notIn",
  "not",
  "startsWith",
  "lt",
  "lte",
  "gt",
  "gte",
]);

const norm = (v: unknown) => (v === undefined ? null : v);
const cmp = (v: unknown) => (v instanceof Date ? v.getTime() : v);
const eq = (a: unknown, b: unknown) => cmp(norm(a)) === cmp(norm(b));

function isOperatorObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !(v instanceof Date) &&
    !Array.isArray(v) &&
    Object.keys(v).length > 0 &&
    Object.keys(v).every((k) => OPERATORS.has(k))
  );
}

function matchField(value: unknown, filter: unknown): boolean {
  if (!isOperatorObject(filter)) {
    if (typeof filter === "object" && filter !== null && !(filter instanceof Date)) {
      throw new Error(`fake-prisma: relation/unsupported filter ${JSON.stringify(filter)}`);
    }
    return eq(value, filter);
  }
  for (const [op, arg] of Object.entries(filter)) {
    const v = cmp(norm(value));
    switch (op) {
      case "equals":
        if (!eq(value, arg)) return false;
        break;
      case "in":
        if (!(arg as unknown[]).some((a) => eq(value, a))) return false;
        break;
      case "notIn":
        if ((arg as unknown[]).some((a) => eq(value, a))) return false;
        break;
      case "not":
        if (matchField(value, arg)) return false;
        break;
      case "startsWith":
        if (typeof value !== "string" || !value.startsWith(arg as string)) return false;
        break;
      case "lt":
        if (v === null || !((v as number) < (cmp(arg) as number))) return false;
        break;
      case "lte":
        if (v === null || !((v as number) <= (cmp(arg) as number))) return false;
        break;
      case "gt":
        if (v === null || !((v as number) > (cmp(arg) as number))) return false;
        break;
      case "gte":
        if (v === null || !((v as number) >= (cmp(arg) as number))) return false;
        break;
    }
  }
  return true;
}

export function matchWhere(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  for (const [key, filter] of Object.entries(where)) {
    if (filter === undefined) continue;
    if (key === "AND") {
      const list = Array.isArray(filter) ? filter : [filter];
      if (!list.every((w) => matchWhere(row, w as Where))) return false;
    } else if (key === "OR") {
      if (!(filter as Where[]).some((w) => matchWhere(row, w))) return false;
    } else if (key === "NOT") {
      const list = Array.isArray(filter) ? filter : [filter];
      if (list.some((w) => matchWhere(row, w as Where))) return false;
    } else if (!matchField(row[key], filter)) {
      return false;
    }
  }
  return true;
}

type OrderBy = Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[];

function sortRows(rows: Row[], orderBy: OrderBy | undefined): Row[] {
  if (!orderBy) return rows;
  const keys = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
  return [...rows].sort((a, b) => {
    for (const [field, dir] of keys) {
      const av = cmp(norm(a[field]));
      const bv = cmp(norm(b[field]));
      if (av === bv) continue;
      // Postgres default: NULLS LAST for ASC, NULLS FIRST for DESC.
      if (av === null) return dir === "asc" ? 1 : -1;
      if (bv === null) return dir === "asc" ? -1 : 1;
      const lt = (av as number) < (bv as number);
      return (lt ? -1 : 1) * (dir === "asc" ? 1 : -1);
    }
    return 0;
  });
}

function project(row: Row | undefined, select: Record<string, unknown> | undefined) {
  if (!row) return null;
  const copy = structuredClone(row);
  if (!select) return copy;
  const out: Row = {};
  for (const [k, v] of Object.entries(select)) if (v === true) out[k] = copy[k];
  return out;
}

export class UniqueConstraintError extends Error {
  code = "P2002";
  constructor(model: string, field: string) {
    super(`Unique constraint failed on ${model}.${field}`);
  }
}

export type FakePrismaOptions = {
  /** Unique scalar columns per model, e.g. { stripeWebhookEvent: ["stripeEventId"] }. */
  unique?: Record<string, string[]>;
  /** Default column values per model, applied on create. */
  defaults?: Record<string, Row>;
};

let idSeq = 0;

export function createFakePrisma(opts: FakePrismaOptions = {}) {
  let tables: Record<string, Row[]> = {};
  const calls: { model: string; op: string; args: unknown }[] = [];
  const hooks: { beforeTransaction?: () => void | Promise<void> } = {};

  const table = (model: string) => (tables[model] ??= []);

  const checkUnique = (model: string, row: Row, ignore?: Row) => {
    for (const field of opts.unique?.[model] ?? []) {
      if (row[field] == null) continue;
      if (table(model).some((r) => r !== ignore && eq(r[field], row[field]))) {
        throw new UniqueConstraintError(model, field);
      }
    }
  };

  const insert = (model: string, data: Row): Row => {
    const now = new Date();
    const row: Row = {
      id: `${model}_${++idSeq}`,
      createdAt: now,
      updatedAt: now,
      ...(opts.defaults?.[model] ?? {}),
      ...structuredClone(data),
    };
    checkUnique(model, row);
    table(model).push(row);
    return row;
  };

  const applyData = (model: string, row: Row, data: Row) => {
    const next = { ...row, ...structuredClone(data), updatedAt: new Date() };
    checkUnique(model, next, row);
    Object.assign(row, next);
  };

  const delegate = (model: string) => {
    const log = (op: string, args: unknown) => calls.push({ model, op, args });
    type Args = {
      where?: Where;
      data?: Row;
      select?: Record<string, unknown>;
      orderBy?: OrderBy;
      create?: Row;
      update?: Row;
    };
    const find = (a: Args) => sortRows(table(model).filter((r) => matchWhere(r, a.where)), a.orderBy);
    return {
      findUnique: async (a: Args) => (log("findUnique", a), project(find(a)[0], a.select)),
      findUniqueOrThrow: async (a: Args) => {
        log("findUniqueOrThrow", a);
        const row = find(a)[0];
        if (!row) throw new Error(`fake-prisma: ${model} not found`);
        return project(row, a.select);
      },
      findFirst: async (a: Args = {}) => (log("findFirst", a), project(find(a)[0], a.select)),
      findMany: async (a: Args = {}) => (log("findMany", a), find(a).map((r) => project(r, a.select))),
      count: async (a: Args = {}) => (log("count", a), find(a).length),
      create: async (a: Args) => (log("create", a), project(insert(model, a.data ?? {}), a.select)),
      update: async (a: Args) => {
        log("update", a);
        const row = find(a)[0];
        if (!row) throw new Error(`fake-prisma: ${model} to update not found`);
        applyData(model, row, a.data ?? {});
        return project(row, a.select);
      },
      updateMany: async (a: Args) => {
        log("updateMany", a);
        const rows = find(a);
        for (const row of rows) applyData(model, row, a.data ?? {});
        return { count: rows.length };
      },
      upsert: async (a: Args) => {
        log("upsert", a);
        const row = find(a)[0];
        if (row) {
          applyData(model, row, a.update ?? {});
          return project(row, a.select);
        }
        return project(insert(model, a.create ?? {}), a.select);
      },
      delete: async (a: Args) => {
        log("delete", a);
        const row = find(a)[0];
        if (!row) throw new Error(`fake-prisma: ${model} to delete not found`);
        tables[model] = table(model).filter((r) => r !== row);
        return project(row, a.select);
      },
      deleteMany: async (a: Args = {}) => {
        log("deleteMany", a);
        const rows = find(a);
        tables[model] = table(model).filter((r) => !rows.includes(r));
        return { count: rows.length };
      },
    };
  };

  const delegates = new Map<string, ReturnType<typeof delegate>>();

  const client: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return undefined; // not a thenable
        if (prop === "$transaction") {
          return async (fn: (tx: unknown) => Promise<unknown>) => {
            await hooks.beforeTransaction?.();
            const snapshot = structuredClone(tables);
            try {
              return await fn(client);
            } catch (err) {
              tables = snapshot;
              throw err;
            }
          };
        }
        if (prop === "$queryRaw") return async () => [];
        let d = delegates.get(prop);
        if (!d) {
          d = delegate(prop);
          delegates.set(prop, d);
        }
        return d;
      },
    },
  );

  return {
    /** Pass where a PrismaClient / TransactionClient is expected (cast). */
    client,
    /** Live rows per model (mutable). */
    rows: (model: string) => table(model),
    seed: (model: string, data: Row) => insert(model, data),
    calls,
    hooks,
  };
}
