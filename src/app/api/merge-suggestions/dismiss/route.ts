import { z } from "zod";

import { auth } from "~/server/auth";
import { dismissMergeSuggestionForUser } from "~/server/contact-merge";

const dismissRequestSchema = z.object({
  suggestionId: z.string().min(1, "Missing merge suggestion id."),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsedBody = dismissRequestSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return Response.json(
      { message: parsedBody.error.issues[0]?.message ?? "Invalid dismiss request." },
      { status: 400 },
    );
  }

  try {
    await dismissMergeSuggestionForUser(userId, parsedBody.data.suggestionId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Dismiss failed." },
      { status: 400 },
    );
  }
}
