import { type NextRequest, NextResponse } from "next/server";

import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { db } from "~/server/db";
import { getAvatarThumbUrl } from "~/lib/avatar-thumb";
import { isKontaxHosted } from "~/lib/avatar-src";
import {
  deleteContactPhoto,
  normalizeContactPhoto,
  storeContactPhoto,
} from "~/server/contact-photo-sync";

// P46-03: uploads no longer store the raw original. Every uploaded photo is
// normalized (rotate → cap 1024px → JPEG q82 → EXIF stripped) via the shared
// sync module and stored as exactly two objects — canonical + 96px webp thumb.
// The raw bytes are discarded. This is the same path the sync pull already runs.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) {
      const status = err.code === "UNAUTHENTICATED" ? 401 : 403;
      return NextResponse.json({ error: err.code }, { status });
    }
    throw err;
  }

  if (!process.env.MINIO_ENDPOINT) {
    console.warn("[Kontax] MINIO_ENDPOINT not configured — avatar upload unavailable");
    return NextResponse.json({ error: "UPLOAD_NOT_CONFIGURED" }, { status: 503 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("avatar");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  // Normalize — a correctly-typed but undecodable payload returns null.
  const normalized = await normalizeContactPhoto(Buffer.from(bytes));
  if (!normalized) {
    return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
  }

  // Key under the uploading user (profile and contact uploads alike). Cleanup
  // keys off the stored URL, not this id, so this is sufficient and avoids an
  // IDOR on a caller-supplied contact id.
  const url = await storeContactPhoto(userId, normalized);
  if (!url) {
    return NextResponse.json({ error: "UPLOAD_NOT_CONFIGURED" }, { status: 503 });
  }

  // Replace — drop the superseded object best-effort (Kontax-hosted only; never
  // a pasted external URL). Never blocks the response.
  //
  // P48-05: `prevUrl` is caller-supplied and avatar URLs are public, so only
  // delete an object that is currently the caller's own profile photo or the
  // photo of a contact the caller owns. Anything else is silently ignored.
  const prevUrl = formData?.get("prevUrl");
  if (typeof prevUrl === "string" && prevUrl && prevUrl !== url && isKontaxHosted(prevUrl)) {
    const [me, ownedContact] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } }),
      db.contact.findFirst({ where: { userId, avatarUrl: prevUrl }, select: { id: true } }),
    ]);
    if (me?.avatarUrl === prevUrl || ownedContact) {
      void deleteContactPhoto(prevUrl);
    }
  }

  return NextResponse.json({ url, thumbUrl: getAvatarThumbUrl(url) });
}
