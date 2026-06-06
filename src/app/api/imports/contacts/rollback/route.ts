import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

const rollbackRequestSchema = z.object({
  jobId: z.string().min(1, "Missing import job id."),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsedBody = rollbackRequestSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return Response.json(
      { message: parsedBody.error.issues[0]?.message ?? "Invalid rollback request." },
      { status: 400 },
    );
  }

  const job = await db.importJob.findFirst({
    where: {
      id: parsedBody.data.jobId,
      userId,
    },
    select: {
      id: true,
      status: true,
      importedCount: true,
      rolledBackAt: true,
    },
  });

  if (!job) {
    return Response.json({ message: "Import job not found." }, { status: 404 });
  }

  if (job.rolledBackAt) {
    return Response.json({ message: "This import has already been rolled back." }, { status: 400 });
  }

  if (job.status !== "COMPLETED" || job.importedCount === 0) {
    return Response.json(
      { message: "Only completed imports with imported contacts can be rolled back." },
      { status: 400 },
    );
  }

  const rolledBackAt = new Date();
  const archivedContacts = await db.contact.updateMany({
    where: {
      userId,
      importJobId: job.id,
      archivedAt: null,
    },
    data: {
      archivedAt: rolledBackAt,
    },
  });

  await db.importJob.update({
    where: { id: job.id },
    data: {
      rolledBackAt,
      rolledBackCount: archivedContacts.count,
    },
  });

  return Response.json({
    rolledBackCount: archivedContacts.count,
  });
}
