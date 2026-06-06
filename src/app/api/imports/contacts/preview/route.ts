import { z } from "zod";

import { auth } from "~/server/auth";
import { parseCsvContacts } from "~/server/contact-portability";

const previewRequestSchema = z.object({
  csvText: z.string().min(1, "Paste CSV data or choose a CSV file."),
  profile: z.enum(["GENERIC", "GOOGLE", "APPLE", "OUTLOOK"]),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsedBody = previewRequestSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return Response.json(
      { message: parsedBody.error.issues[0]?.message ?? "Invalid preview request." },
      { status: 400 },
    );
  }

  try {
    const preview = parseCsvContacts(parsedBody.data.csvText, parsedBody.data.profile);
    return Response.json(preview);
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Preview failed." },
      { status: 400 },
    );
  }
}
