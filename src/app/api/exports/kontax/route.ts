import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { createKontaxArchiveJob } from "~/server/export-format/jobs";

// Route files may only export HTTP handlers — keep the shared shape local.
const JOB_SELECT = {
  id: true,
  status: true,
  progressCount: true,
  totalCount: true,
  photoCount: true,
  exportedCount: true,
  downloadUrl: true,
  fileSizeBytes: true,
  expiresAt: true,
  createdAt: true,
} as const;

const postSchema = z.object({
  includePhotos: z.boolean(),
  includeVcardFallback: z.boolean(),
  ids: z.array(z.string()).optional(),
  bookId: z.string().optional(),
  includeArchived: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const raw: unknown = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return new Response("Invalid request", { status: 400 });

  const { includePhotos, includeVcardFallback, ids, bookId, includeArchived } = parsed.data;
  const job = await createKontaxArchiveJob(userId, {
    includePhotos,
    includeVcardFallback,
    includeArchived,
    contactIds: ids,
    bookId,
  });

  return Response.json({ jobId: job.id });
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const job = await db.kontaxExportJob.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: JOB_SELECT,
  });

  return Response.json({ job: job ?? null });
}
