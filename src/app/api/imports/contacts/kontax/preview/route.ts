// P45-DB01 Surface 5: recognition endpoint for Kontax-format files.
// Recognition is content-based (server sniffs the bytes) — the client only
// uses the extension to decide to call this endpoint at all, so a renamed
// file still recognizes correctly.

import { auth } from "~/server/auth";
import { recognizeKontaxFile } from "~/server/export-format/parse";

const MAX_BYTES = 512 * 1024 * 1024; // 512 MB

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ message: "Choose a file to import." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ message: "That file is too large to import (512 MB max)." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const recognition = recognizeKontaxFile(buffer);

  return Response.json({
    ...recognition,
    fileName: file.name,
    size: file.size,
  });
}
