import { z } from "zod";

import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { estimateArchiveExport } from "~/server/export-format/jobs";

const postSchema = z.object({
  ids: z.array(z.string()).optional(),
  bookId: z.string().optional(),
  includeArchived: z.boolean().optional(),
});

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if (isSessionError(err)) return new Response("Unauthorized", { status: 401 });
    throw err;
  }

  const raw: unknown = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw ?? {});
  if (!parsed.success) return new Response("Invalid request", { status: 400 });

  const { ids, bookId, includeArchived } = parsed.data;
  const estimate = await estimateArchiveExport(userId, { ids, bookId, includeArchived });

  return Response.json(estimate);
}
