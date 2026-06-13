import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

const schema = z.object({
  columnHeader: z.string().trim().min(1).max(200),
  suggestedField: z.string().trim().min(1).max(100),
  chosenField: z.string().trim().min(1).max(100),
  sampleValue: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ ok: false }, { status: 401 });

  const raw: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  await db.importMappingSuggestionFeedback.create({
    data: { userId, ...parsed.data },
  });

  return Response.json({ ok: true });
}
