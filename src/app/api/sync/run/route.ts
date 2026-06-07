import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { runQueuedSyncJobs } from "~/server/sync-runner";

const isAuthorizedRunnerRequest = async (request: Request) => {
  const session = await auth();
  if (session?.user?.id) {
    return true;
  }

  const header = request.headers.get("authorization");
  const expectedSecret = process.env.AUTH_SECRET;

  if (!header?.startsWith("Bearer ") || !expectedSecret) {
    return false;
  }

  return header.slice("Bearer ".length) === expectedSecret;
};

export async function POST(request: Request) {
  const allowed = await isAuthorizedRunnerRequest(request);

  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const redirectTo = formData?.get("redirectTo");
  const limitValue = formData?.get("limit");
  const limit =
    typeof limitValue === "string" && Number.isFinite(Number(limitValue))
      ? Number(limitValue)
      : 5;

  const result = await runQueuedSyncJobs({ limit });

  revalidatePath("/");
  revalidatePath("/sync");

  if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        Location: redirectTo,
      },
    });
  }

  return NextResponse.json(result);
}
