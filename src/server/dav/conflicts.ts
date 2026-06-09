import type { Prisma } from "../../../generated/prisma/index.js";
import { db } from "~/server/db";

type SyncConflictKind = "VERSION_MISMATCH" | "DELETE_CONFLICT";

/**
 * Record an inbound device-write conflict against the Kontax CardDAV server.
 *
 * Raised when a device sends a PUT/DELETE with a stale `If-Match` ETag — i.e. it
 * is trying to mutate a version of the contact that no longer exists on the
 * server. The default resolution is last-write-wins (the server version is
 * authoritative); the conflict row is kept `OPEN` so the Phase 10 activity log /
 * review UI can surface it. Mirrors the inline implementation in `server.mjs`
 * (the live CardDAV adapter); kept here for Next-native callers and tests.
 *
 * Returns the new `SyncConflict.id`, or `null` if logging failed (logging must
 * never turn a 412 into a 500).
 */
export async function logDeviceWriteConflict({
  contactId,
  appPasswordId,
  clientEtag,
  serverSyncVersion,
  incomingVCardData,
  conflictType = "VERSION_MISMATCH",
}: {
  contactId: string;
  appPasswordId: string | null;
  clientEtag: string;
  serverSyncVersion: number | null;
  incomingVCardData: string | null;
  conflictType?: SyncConflictKind;
}): Promise<string | null> {
  try {
    const contact = await db.contact.findUnique({ where: { id: contactId } });

    if (!contact) {
      return null;
    }

    const conflict = await db.syncConflict.create({
      data: {
        conflictType,
        conflictSource: "INBOUND_DEVICE",
        status: "OPEN",
        resolutionStrategy: "KEEP_LOCAL",
        contactId,
        appPasswordId: appPasswordId ?? undefined,
        localSyncVersion: serverSyncVersion ?? undefined,
        remoteETag: clientEtag,
        localSnapshot: JSON.parse(JSON.stringify(contact)) as Prisma.InputJsonValue,
        remoteSnapshot: incomingVCardData ? { rawVCard: incomingVCardData } : undefined,
        detectedAt: new Date(),
      },
      select: { id: true },
    });

    return conflict.id;
  } catch (error) {
    console.error("Failed to log device-write conflict", error);
    return null;
  }
}
