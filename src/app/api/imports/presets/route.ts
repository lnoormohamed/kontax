import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const presets = await db.importMappingPreset.findMany({
    where: { userId },
    select: { id: true, name: true, usageCount: true, lastUsedAt: true, createdAt: true },
    orderBy: { lastUsedAt: "desc" },
  });

  return Response.json({ presets });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  headerHash: z.string().trim().length(64),
  columnMappings: z.array(z.object({
    index: z.number().int().nonnegative(),
    targetField: z.string(),
    customFieldKey: z.string().trim().max(50).optional(),
  })),
  sourceProfile: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const raw: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ message: parsed.error.issues[0]?.message ?? "Invalid." }, { status: 400 });
  }

  const preset = await db.importMappingPreset.upsert({
    where: { userId_headerHash: { userId, headerHash: parsed.data.headerHash } },
    create: {
      userId,
      name: parsed.data.name,
      headerHash: parsed.data.headerHash,
      columnMappings: parsed.data.columnMappings,
      sourceProfile: parsed.data.sourceProfile,
    },
    update: {
      name: parsed.data.name,
      columnMappings: parsed.data.columnMappings,
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
    select: { id: true, name: true },
  });

  return Response.json({ preset });
}
