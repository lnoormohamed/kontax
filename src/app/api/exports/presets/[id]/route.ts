import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const raw: unknown = await request.json().catch(() => null);
  const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(raw);
  if (!parsed.success) return Response.json({ message: "Invalid name." }, { status: 400 });

  const existing = await db.exportPreset.findFirst({ where: { id, userId } });
  if (!existing) return Response.json({ message: "Not found." }, { status: 404 });

  await db.exportPreset.update({ where: { id }, data: { name: parsed.data.name } });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.exportPreset.findFirst({ where: { id, userId } });
  if (!existing) return Response.json({ message: "Not found." }, { status: 404 });

  await db.exportPreset.delete({ where: { id } });
  return Response.json({ ok: true });
}
