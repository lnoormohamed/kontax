import test from "node:test";
import assert from "node:assert/strict";

import {
  addMembership,
  LastBookMembershipError,
  movePrimaryMembership,
  removeMembership,
  setPrimaryMembership,
} from "../../src/server/contact-book-membership";

/**
 * In-memory fake of the `contactBookMembership` Prisma delegate — just the calls
 * the helper makes. Lets us verify the ≥1-membership and single-primary
 * invariants (P40-06) without a database.
 */
function makeFakeClient() {
  let seq = 0;
  const rows: Array<{
    id: string;
    contactId: string;
    addressBookId: string;
    isPrimary: boolean;
    createdAt: number;
  }> = [];

  const cbm = {
    async findFirst({ where }: any) {
      return (
        rows.find(
          (r) =>
            (where.contactId === undefined || r.contactId === where.contactId) &&
            (where.isPrimary === undefined || r.isPrimary === where.isPrimary),
        ) ?? null
      );
    },
    async findMany({ where }: any) {
      return rows
        .filter((r) => r.contactId === where.contactId)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((r) => ({ ...r }));
    },
    async upsert({ where, update, create }: any) {
      const key = where.contactId_addressBookId;
      const existing = rows.find(
        (r) => r.contactId === key.contactId && r.addressBookId === key.addressBookId,
      );
      if (existing) {
        if ("isPrimary" in update) existing.isPrimary = update.isPrimary;
        return { ...existing };
      }
      const row = { id: `m${seq++}`, createdAt: seq, ...create };
      rows.push(row);
      return { ...row };
    },
    async update({ where, data }: any) {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return { ...row };
    },
    async updateMany({ where, data }: any) {
      let count = 0;
      for (const r of rows) {
        if (r.contactId !== where.contactId) continue;
        if (where.addressBookId?.not !== undefined && r.addressBookId === where.addressBookId.not)
          continue;
        if (where.isPrimary !== undefined && r.isPrimary !== where.isPrimary) continue;
        Object.assign(r, data);
        count++;
      }
      return { count };
    },
    async delete({ where }: any) {
      const i = rows.findIndex((r) => r.id === where.id);
      const [row] = rows.splice(i, 1);
      return row;
    },
  };
  return { client: { contactBookMembership: cbm } as any, rows };
}

const primaries = (rows: any[]) => rows.filter((r) => r.isPrimary);

test("setPrimaryMembership creates a single primary membership", async () => {
  const { client, rows } = makeFakeClient();
  await setPrimaryMembership(client, "c1", "bookA");
  assert.equal(rows.length, 1);
  assert.equal(primaries(rows).length, 1);
  assert.equal(rows[0]?.addressBookId, "bookA");
});

test("addMembership adds a non-primary book; primary stays unique", async () => {
  const { client, rows } = makeFakeClient();
  await setPrimaryMembership(client, "c1", "bookA");
  await addMembership(client, "c1", "bookB");
  assert.equal(rows.length, 2);
  assert.equal(primaries(rows).length, 1);
  assert.equal(primaries(rows)[0]?.addressBookId, "bookA");
});

test("movePrimaryMembership drops the old home and sets the new one", async () => {
  const { client, rows } = makeFakeClient();
  await setPrimaryMembership(client, "c1", "bookA");
  await addMembership(client, "c1", "bookB"); // extra, non-primary
  await movePrimaryMembership(client, "c1", "bookC");
  const books = rows.map((r) => r.addressBookId).sort();
  assert.deepEqual(books, ["bookB", "bookC"], "old primary bookA removed, bookB kept");
  assert.equal(primaries(rows).length, 1);
  assert.equal(primaries(rows)[0]?.addressBookId, "bookC");
});

test("removeMembership blocks removing the last book", async () => {
  const { client, rows } = makeFakeClient();
  await setPrimaryMembership(client, "c1", "bookA");
  await assert.rejects(
    () => removeMembership(client, "c1", "bookA"),
    (e) => e instanceof LastBookMembershipError,
  );
  assert.equal(rows.length, 1, "membership not removed");
});

test("removing the primary promotes the oldest survivor and reports it", async () => {
  const { client, rows } = makeFakeClient();
  await setPrimaryMembership(client, "c1", "bookA"); // primary, oldest
  await addMembership(client, "c1", "bookB");
  await addMembership(client, "c1", "bookC");
  const { newPrimaryBookId } = await removeMembership(client, "c1", "bookA");
  assert.equal(newPrimaryBookId, "bookB", "oldest survivor promoted");
  assert.equal(primaries(rows).length, 1);
  assert.equal(primaries(rows)[0]?.addressBookId, "bookB");
  assert.equal(rows.length, 2);
});

test("removing a non-primary book leaves the primary untouched", async () => {
  const { client, rows } = makeFakeClient();
  await setPrimaryMembership(client, "c1", "bookA");
  await addMembership(client, "c1", "bookB");
  const { newPrimaryBookId } = await removeMembership(client, "c1", "bookB");
  assert.equal(newPrimaryBookId, null);
  assert.equal(primaries(rows)[0]?.addressBookId, "bookA");
  assert.equal(rows.length, 1);
});
