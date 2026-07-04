// P44-03/04 — the contact photo pass.
//
// Runs after the normal field sync, once per account, over every active link.
// A photo can change while no portable field did, so this is a dedicated pass
// (not a hook in the field-push loop). Provider specifics (how to read remote
// state, fetch bytes, push, delete) are injected as closures per link — the
// loop and persistence here are provider-agnostic. See docs/adr/0001.

import { Prisma, type PrismaClient } from "../../generated/prisma";
import { emitEvent } from "~/lib/activity";
import {
  reconcileContactPhoto,
  type PhotoShadow,
  type PhotoSignalKind,
  type PushSeed,
  type RemotePhotoState,
  type SyncCapability,
} from "~/server/contact-photo-sync";

export type PhotoPassLink = {
  linkId: string;
  contactId: string;
  avatarUrl: string | null;
  shadow: PhotoShadow | null;
  signalKind: PhotoSignalKind;
  remote: RemotePhotoState;
  loadRemoteBytes: () => Promise<Buffer | null>;
  pushCanonical: (jpegBase64: string) => Promise<PushSeed>;
  deleteRemote: () => Promise<void>;
};

export type PhotoPassTally = {
  pulled: number;
  pushed: number;
  deletedLocal: number;
  deletedRemote: number;
  conflicts: number;
};

const emptyTally = (): PhotoPassTally => ({
  pulled: 0,
  pushed: 0,
  deletedLocal: 0,
  deletedRemote: 0,
  conflicts: 0,
});

/**
 * Reconcile photos for a set of links. `cap` is account-level (syncDirection +
 * photo-exclusion already folded in); when both false the pass is a no-op.
 * Never throws — a single link's failure degrades to a skip.
 */
export async function runPhotoPass(
  db: PrismaClient,
  ctx: { userId: string; syncAccountId: string; syncAccountLabel: string },
  cap: SyncCapability,
  links: PhotoPassLink[],
): Promise<PhotoPassTally> {
  const tally = emptyTally();
  if (!cap.canPull && !cap.canPush) return tally;

  for (const link of links) {
    let result;
    try {
      result = await reconcileContactPhoto({
        contactId: link.contactId,
        avatarUrl: link.avatarUrl,
        shadow: link.shadow,
        signalKind: link.signalKind,
        remote: link.remote,
        cap,
        loadRemoteBytes: link.loadRemoteBytes,
        pushCanonical: link.pushCanonical,
        deleteRemote: link.deleteRemote,
      });
    } catch (error) {
      console.warn(`[Kontax] photo reconcile threw for contact ${link.contactId} — skipping`, error);
      continue;
    }

    if (result.conflict) {
      tally.conflicts += 1;
      continue; // P44-05 owns the conflict surface; nothing written here
    }
    if (result.action === "noop") continue;

    try {
      await db.$transaction(async (tx) => {
        if (result.avatarUrl !== undefined) {
          await tx.contact.update({
            where: { id: link.contactId },
            data: { avatarUrl: result.avatarUrl },
          });
        }
        const linkData: Prisma.SyncContactLinkUpdateInput = {};
        if (result.shadow !== undefined) {
          linkData.photoShadow =
            result.shadow === null ? Prisma.DbNull : (result.shadow as unknown as Prisma.InputJsonValue);
        }
        if (result.remoteETag !== undefined && result.remoteETag !== null) {
          linkData.remoteETag = result.remoteETag;
        }
        if (Object.keys(linkData).length > 0) {
          await tx.syncContactLink.update({ where: { id: link.linkId }, data: linkData });
        }
        if (result.activity) {
          const inbound = result.activity === "pulled" || result.activity === "deleted-local";
          await emitEvent(tx, {
            userId: ctx.userId,
            eventType: inbound ? "SYNC_PULLED" : "SYNC_PUSHED",
            actor: "SYNC",
            contactId: link.contactId,
            payload: { syncAccountId: ctx.syncAccountId, syncAccountLabel: ctx.syncAccountLabel },
          });
        }
      });
    } catch (error) {
      console.warn(`[Kontax] photo persist failed for contact ${link.contactId} — skipping`, error);
      continue;
    }

    switch (result.activity) {
      case "pulled":
        tally.pulled += 1;
        break;
      case "pushed":
        tally.pushed += 1;
        break;
      case "deleted-local":
        tally.deletedLocal += 1;
        break;
      case "deleted-remote":
        tally.deletedRemote += 1;
        break;
      default:
        break;
    }
  }

  return tally;
}
