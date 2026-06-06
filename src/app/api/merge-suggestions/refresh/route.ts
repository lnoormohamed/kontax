import { auth } from "~/server/auth";
import { refreshMergeSuggestionsForUser } from "~/server/contact-merge";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const suggestionCount = await refreshMergeSuggestionsForUser(userId);

  return Response.json({ suggestionCount });
}
