import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { cancelKontaxExportJob } from "~/server/export-format/jobs";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const job = await db.kontaxExportJob.findFirst({
    where: { id, userId },
    select: JOB_SELECT,
  });
  if (!job) return new Response("Not found", { status: 404 });

  return Response.json({ job });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const cancelled = await cancelKontaxExportJob(userId, id);
  if (!cancelled) return new Response("Not found", { status: 404 });

  return Response.json({ cancelled: true });
}
