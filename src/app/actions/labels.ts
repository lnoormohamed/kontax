"use server";

import { revalidatePath } from "next/cache";

import { LABEL_PALETTE } from "~/app/_components/label-chip";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

// P31B-01: label registry CRUD. Contact.labels[] stays as the membership
// source of truth; the Label table holds canonical name + color + position.
// Rename / merge are write-heavy: they touch every contact carrying the label
// in a single transaction and bump syncVersion so the sync engine re-pushes.

const SYNC_TOUCH = {
  lastMutatedBy: "MANUAL" as const,
  lastMutatedByDetail: null,
  syncVersion: { increment: 1 },
};

const requireUserId = async () => {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You need to be signed in.");
  if (session.impersonatedBy) throw new Error("This is a read-only impersonation session.");
  return session.user.id;
};

const cleanName = (name: string) => {
  const t = name.trim().slice(0, 60);
  if (!t) throw new Error("A label needs a name.");
  return t;
};

/** Pick a palette color not yet in use; once all 8 are taken, pick random from the full palette. */
function pickLabelColor(used: Set<string>): string {
  const pool = LABEL_PALETTE.filter((p) => !used.has(p.col));
  const src = pool.length > 0 ? pool : LABEL_PALETTE;
  return src[Math.floor(Math.random() * src.length)]!.col;
}

const validColor = (col: string) => {
  if (!LABEL_PALETTE.some((p) => p.col === col)) throw new Error("Invalid label color.");
  return col;
};

// ── backfill ─────────────────────────────────────────────────────────────────
// Called lazily: builds the registry from distinct Contact.labels values for
// users who had labels before the registry existed. Safe to call multiple times
// (upsert by userId+name). Exposed so the sidebar + contacts page can call it
// on first load without a separate migration job.

export async function ensureLabelRegistry(): Promise<void> {
  const userId = await requireUserId();

  const existing = await db.label.findMany({
    where: { userId },
    select: { name: true, color: true },
  });
  const registeredNames = new Set(existing.map((l) => l.name.toLowerCase()));

  // Fetch distinct label values from contacts (cap at 2000 contacts for perf).
  const rows = await db.contact.findMany({
    where: { userId, archivedAt: null },
    select: { labels: true },
    take: 2000,
  });

  const seen = new Map<string, string>(); // lowercase → canonical
  for (const row of rows) {
    if (!Array.isArray(row.labels)) continue;
    for (const v of row.labels) {
      if (typeof v !== "string") continue;
      const key = v.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, v.trim());
    }
  }

  // Determine the current highest position for new entries.
  const maxPos = await db.label.aggregate({
    where: { userId },
    _max: { position: true },
  });
  let pos = (maxPos._max.position ?? -1) + 1;
  const usedColors = new Set(existing.map((l) => l.color));

  const toCreate = [...seen.entries()]
    .filter(([key]) => !registeredNames.has(key))
    .map(([, name]) => {
      const color = pickLabelColor(usedColors);
      usedColors.add(color);
      return { userId, name, color, position: pos++ };
    });

  if (toCreate.length > 0) {
    await db.label.createMany({ data: toCreate, skipDuplicates: true });
  }
}

// ── queries ───────────────────────────────────────────────────────────────────

export type LabelWithCount = {
  id: string;
  name: string;
  color: string;
  position: number;
  count: number;
};

export async function getLabels(): Promise<LabelWithCount[]> {
  const userId = await requireUserId();

  // P38-03: one grouped scan over Contact.labels replaces the per-view
  // registry backfill (label fetch + 2000-contact scan + aggregate) AND the
  // one-count-query-per-label loop. Ungrouped scan also removes the old
  // 2000-contact backfill cap.
  const [labels, usageRows] = await Promise.all([
    db.label.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true, position: true },
    }),
    db.$queryRaw<Array<{ name: string; count: bigint }>>`
      SELECT lv.value AS name, count(DISTINCT c.id) AS count
      FROM "Contact" c,
        jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(c.labels) = 'array' THEN c.labels ELSE '[]'::jsonb END
        ) AS lv(value)
      WHERE c."userId" = ${userId} AND c."archivedAt" IS NULL AND trim(lv.value) <> ''
      GROUP BY lv.value
    `,
  ]);

  // Registry backfill (labels attached via import/sync before registration):
  // only pays extra queries when something is actually missing.
  const registeredNames = new Set(labels.map((l) => l.name.toLowerCase()));
  const missing = new Map<string, string>(); // lowercase → canonical
  for (const row of usageRows) {
    const key = row.name.trim().toLowerCase();
    if (key && !registeredNames.has(key) && !missing.has(key)) missing.set(key, row.name.trim());
  }
  if (missing.size > 0) {
    const usedColors = new Set(labels.map((l) => l.color));
    let pos = labels.reduce((max, l) => Math.max(max, l.position), -1) + 1;
    await db.label.createMany({
      data: [...missing.values()].map((name) => {
        const color = pickLabelColor(usedColors);
        usedColors.add(color);
        return { userId, name, color, position: pos++ };
      }),
      skipDuplicates: true,
    });
    return getLabels();
  }

  if (labels.length === 0) return [];

  // Case-sensitive name match — registry names are canonical after backfill,
  // matching the previous array_contains counting exactly.
  const usage = new Map(usageRows.map((r) => [r.name, Number(r.count)]));
  return labels.map((l) => ({ ...l, count: usage.get(l.name) ?? 0 }));
}

// ── mutations ─────────────────────────────────────────────────────────────────

export async function createLabel(input: { name: string }): Promise<{ id: string }> {
  const userId = await requireUserId();
  const name = cleanName(input.name);

  // Idempotent: return existing if the name already exists (case-insensitive).
  const existing = await db.label.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing;

  const [maxPos, existingColors] = await Promise.all([
    db.label.aggregate({ where: { userId }, _max: { position: true } }),
    db.label.findMany({ where: { userId }, select: { color: true } }),
  ]);
  const usedColors = new Set(existingColors.map((l) => l.color));

  const created = await db.label.create({
    data: {
      userId,
      name,
      color: pickLabelColor(usedColors),
      position: (maxPos._max.position ?? -1) + 1,
    },
    select: { id: true },
  });

  revalidatePath("/contacts");
  return created;
}

export async function renameLabel(input: { id: string; name: string }): Promise<void> {
  const userId = await requireUserId();
  const label = await db.label.findFirst({ where: { id: input.id, userId } });
  if (!label) throw new Error("Label not found.");

  const newName = cleanName(input.name);
  if (newName.toLowerCase() === label.name.toLowerCase()) return; // no-op

  // Check for collision.
  const collision = await db.label.findFirst({
    where: { userId, name: { equals: newName, mode: "insensitive" }, id: { not: input.id } },
  });
  if (collision) throw new Error(`A label named "${newName}" already exists.`);

  const oldName = label.name;

  // Read-modify-write all contacts carrying the old name in one transaction.
  const contacts = await db.contact.findMany({
    where: { userId, labels: { array_contains: oldName } },
    select: { id: true, labels: true },
  });

  await db.$transaction([
    db.label.update({ where: { id: input.id }, data: { name: newName } }),
    ...contacts.map((c) => {
      const arr = (Array.isArray(c.labels) ? (c.labels as unknown[]) : [])
        .filter((v): v is string => typeof v === "string")
        .map((v) => (v === oldName ? newName : v));
      return db.contact.update({
        where: { id: c.id },
        data: { labels: arr, ...SYNC_TOUCH },
      });
    }),
  ]);

  revalidatePath("/contacts");
}

export async function recolorLabel(input: { id: string; color: string }): Promise<void> {
  const userId = await requireUserId();
  await db.label.updateMany({
    where: { id: input.id, userId },
    data: { color: validColor(input.color) },
  });
  revalidatePath("/contacts");
}

export async function mergeLabels(input: {
  sourceId: string; // label being folded away
  targetId: string; // label that survives
}): Promise<void> {
  const userId = await requireUserId();
  if (input.sourceId === input.targetId) throw new Error("Cannot merge a label into itself.");

  const [source, target] = await Promise.all([
    db.label.findFirst({ where: { id: input.sourceId, userId } }),
    db.label.findFirst({ where: { id: input.targetId, userId } }),
  ]);
  if (!source || !target) throw new Error("Label not found.");

  // Find all contacts carrying the source label.
  const contacts = await db.contact.findMany({
    where: { userId, labels: { array_contains: source.name } },
    select: { id: true, labels: true },
  });

  await db.$transaction([
    // Replace source name with target name on every contact (de-dupe).
    ...contacts.map((c) => {
      const arr = (Array.isArray(c.labels) ? (c.labels as unknown[]) : [])
        .filter((v): v is string => typeof v === "string");
      const hasTarget = arr.some((v) => v === target.name);
      const next = arr
        .filter((v) => v !== source.name)
        .concat(hasTarget ? [] : [target.name]);
      return db.contact.update({
        where: { id: c.id },
        data: { labels: next, ...SYNC_TOUCH },
      });
    }),
    // Delete the source label from the registry.
    db.label.delete({ where: { id: input.sourceId } }),
  ]);

  revalidatePath("/contacts");
}

export async function deleteLabel(input: { id: string }): Promise<void> {
  const userId = await requireUserId();
  const label = await db.label.findFirst({ where: { id: input.id, userId } });
  if (!label) throw new Error("Label not found.");

  const contacts = await db.contact.findMany({
    where: { userId, labels: { array_contains: label.name } },
    select: { id: true, labels: true },
  });

  await db.$transaction([
    ...contacts.map((c) => {
      const arr = (Array.isArray(c.labels) ? (c.labels as unknown[]) : [])
        .filter((v): v is string => typeof v === "string" && v !== label.name);
      return db.contact.update({
        where: { id: c.id },
        data: { labels: arr, ...SYNC_TOUCH },
      });
    }),
    db.label.delete({ where: { id: input.id } }),
  ]);

  revalidatePath("/contacts");
}

export async function reorderLabels(orderedIds: string[]): Promise<void> {
  const userId = await requireUserId();
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.label.updateMany({ where: { id, userId }, data: { position: index } }),
    ),
  );
  revalidatePath("/contacts");
}
