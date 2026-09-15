import { z } from "zod";

import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { dismissMergeSuggestionForUser } from "~/server/contact-merge";

const dismissRequestSchema = z.object({
  suggestionId: z.string().min(1, "Missing merge suggestion id."),
});

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return Response.json({ message: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsedBody = dismissRequestSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return Response.json(
      { message: parsedBody.error.issues[0]?.message ?? "Invalid dismiss request." },
      { status: 400 },
    );
  }

  // P48-11 item 6: dismissMergeSuggestionForUser only ever throws two curated,
  // user-safe messages ("Merge suggestion not found.", "Only open merge
  // suggestions can be dismissed.") — anything else (a DB failure mid-update)
  // is unexpected and shouldn't be echoed to the caller.
  const KNOWN_MESSAGES = new Set([
    "Merge suggestion not found.",
    "Only open merge suggestions can be dismissed.",
  ]);

  try {
    await dismissMergeSuggestionForUser(userId, parsedBody.data.suggestionId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (KNOWN_MESSAGES.has(message)) {
      return Response.json({ message }, { status: 400 });
    }
    console.error("[merge-suggestions/dismiss] unexpected failure", error);
    return Response.json({ message: "Could not dismiss that merge suggestion." }, { status: 500 });
  }
}
