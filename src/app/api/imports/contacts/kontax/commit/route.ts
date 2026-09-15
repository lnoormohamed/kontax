// P45-DB01 Surface 5: commit endpoint for Kontax-format imports. Re-recognizes
// the uploaded bytes (never trusts the client's recognition), parses, and
// lands contacts via commitKontaxImport.

import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { commitKontaxImport, KontaxImportError } from "~/server/export-format/import";
import {
  parseKontaxArchive,
  parseKontaxDocument,
  recognizeKontaxFile,
  verifyKontaxArchiveIntegrity,
  ZipBoundsError,
  type ImportedCardContact,
} from "~/server/export-format/parse";

// P48-11 item 2: lowered from 512 MB — archives are bounded per-entry/total
// at parse time (see ZipBoundsError below), so there's no reason to buffer a
// half-gigabyte upload before we even get to sniff it.
const MAX_BYTES = 64 * 1024 * 1024; // 64 MB

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return Response.json({ message: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "Choose a file to import." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That file is too large to import (64 MB max)." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const recognition = recognizeKontaxFile(buffer);

  if (recognition.kind === "unsupported-version") {
    return Response.json(
      { error: `This file uses format v${recognition.major}, which needs a newer Kontax.` },
      { status: 400 },
    );
  }
  if (recognition.kind === "unrecognized") {
    return Response.json(
      { error: "We couldn't read this file. It may be damaged, too large, or not a Kontax export." },
      { status: 400 },
    );
  }

  let contacts: ImportedCardContact[];
  let parseSkippedCount = 0;
  let sourceDetail: string;
  try {
    if (recognition.kind === "archive") {
      // Reject a truncated or tampered archive before landing anything — the
      // manifest's integrity table (spec §7.3) makes a partial download
      // detectable. Never a silent partial import.
      const integrity = verifyKontaxArchiveIntegrity(buffer);
      if (integrity.verified && !integrity.ok) {
        return Response.json(
          {
            error: `This archive is corrupted or incomplete — ${integrity.problems.length} file(s) failed the integrity check. Re-export and try again.`,
          },
          { status: 400 },
        );
      }
      const parsed = parseKontaxArchive(buffer);
      contacts = parsed.contacts;
      parseSkippedCount = parsed.skippedCount;
      sourceDetail = "kontax-archive";
    } else {
      const contact = parseKontaxDocument(buffer);
      contacts = contact ? [contact] : [];
      sourceDetail = "kontax-document";
    }
  } catch (error) {
    if (error instanceof ZipBoundsError) {
      return Response.json({ error: error.message }, { status: 413 });
    }
    console.error("[imports/kontax/commit] archive parse failed", error);
    return Response.json(
      { error: "This file could not be processed. It may be damaged or too large." },
      { status: 400 },
    );
  }

  if (contacts.length === 0) {
    return Response.json(
      { error: "No importable contacts were found in that file." },
      { status: 400 },
    );
  }

  try {
    const result = await commitKontaxImport(userId, contacts, sourceDetail, {
      sourceFileName: file.name,
      sourceFileSizeBytes: file.size,
      skippedCount: parseSkippedCount,
    });
    return Response.json(result);
  } catch (error) {
    const known = error instanceof KontaxImportError;
    if (!known) {
      console.error("[imports/kontax/commit] commit failed", error);
    }
    return Response.json(
      { error: known ? error.message : "Import failed. Please try again." },
      { status: known ? 400 : 500 },
    );
  }
}
