import { z } from "zod";

import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { db } from "~/server/db";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if (isSessionError(err)) return Response.json({ message: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const presets = await db.exportPreset.findMany({
    where: { userId },
    select: { id: true, name: true, fieldSelection: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json({ presets });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  fieldSelection: z.array(
    z.object({
      key: z.string(),
      included: z.boolean(),
      headerOverride: z.string().trim().max(80).optional(),
    }),
  ),
});

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return Response.json({ message: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const raw: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ message: parsed.error.issues[0]?.message ?? "Invalid." }, { status: 400 });
  }

  const preset = await db.exportPreset.create({
    data: { userId, name: parsed.data.name, fieldSelection: parsed.data.fieldSelection },
    select: { id: true, name: true },
  });

  return Response.json({ preset });
}
