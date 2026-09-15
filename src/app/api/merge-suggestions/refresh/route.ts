import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { refreshMergeSuggestionsForUser } from "~/server/contact-merge";

export async function POST() {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return Response.json({ message: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const suggestionCount = await refreshMergeSuggestionsForUser(userId);

  return Response.json({ suggestionCount });
}
