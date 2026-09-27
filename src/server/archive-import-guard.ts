import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

/**
 * P49A-13 (SEC P2: 64 MB archive upload without a per-user limiter).
 *
 * The Kontax-format preview and commit routes each buffer an upload of up to
 * 64 MB and parse it on the web process. Nothing stopped one account from
 * sending them back to back, or several at once. Before touching the body:
 *
 *   - a declared Content-Length over the cap is refused outright (the old code
 *     only looked at `file.size` after `request.formData()` had already read
 *     the whole thing into memory);
 *   - 20 uploads per user per hour (preview + commit share the bucket);
 *   - one upload in flight per user per process.
 */

// Multipart framing around the file: boundaries, part headers, other fields.
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

const inFlight = new Set<string>();

export type ArchiveImportGate =
  | { ok: true; release: () => void }
  | { ok: false; status: 413 | 429; message: string };

export async function beginArchiveImport(
  userId: string,
  request: Request,
  maxBytes: number,
): Promise<ArchiveImportGate> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes + MULTIPART_OVERHEAD_BYTES) {
    return {
      ok: false,
      status: 413,
      message: `That file is too large to import (${Math.round(maxBytes / (1024 * 1024))} MB max).`,
    };
  }

  if (inFlight.has(userId)) {
    return { ok: false, status: 429, message: "An import is already in progress. Wait for it to finish." };
  }

  const rl = await checkRateLimit(rateLimiters.archiveImport, `user:${userId}`);
  if (!rl.allowed) {
    return { ok: false, status: 429, message: "Too many imports in the last hour. Try again later." };
  }

  // Re-check after the await: another request for this user may have started.
  if (inFlight.has(userId)) {
    return { ok: false, status: 429, message: "An import is already in progress. Wait for it to finish." };
  }
  inFlight.add(userId);
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      inFlight.delete(userId);
    },
  };
}
