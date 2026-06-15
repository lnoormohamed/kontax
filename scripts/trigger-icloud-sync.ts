import { db } from "../src/server/db";
import { decryptSyncCredentialPayload } from "../src/server/sync-credentials";
import { pushCardDavContact } from "../src/server/carddav";
import { runQueuedSyncJobs } from "../src/server/sync-runner";

const SYNC_ACCOUNT_ID = "cmqf9hbx00001j5g89tae1h4w";

// All contacts with non-ASCII characters that need re-pushing with VERSION:3.0
const NON_ASCII_CONTACT_IDS = [
  "cmqf9pz81001vj5g8gd4nzwom", // Ämÿ Žhœû
  "cmqf9pz2w0007j5g80i811p2b", // 孟老师
  "cmqf9pzqo0087j5g8y71hsa21", // 宋
  "cmqf9pzkl0061j5g8h3cbkr61", // 张晨希
  "cmqf9pzo20077j5g8pxchuh12", // 施敏颖
  "cmqf9pzed004dj5g8nxbf32ei", // 朱雯雯 (already pushed, but re-push is idempotent)
  "cmqf9pzbp0037j5g8fnqo2rx5", // 樊瑛筱
  "cmqf9pzlk006dj5g89fjxuyva", // 王秀倩
  "cmqf9pzcg003jj5g8hf1tf3am", // 石敏超
  "cmqf9pz5m0011j5g8tb0wfa8u", // 程新杰校长
];

async function pushNonAsciiContacts() {
  const syncAccount = await db.syncAccount.findUniqueOrThrow({
    where: { id: SYNC_ACCOUNT_ID },
    select: { credentialReference: true, addressBookUrl: true },
  });

  const creds = decryptSyncCredentialPayload(syncAccount.credentialReference!);
  console.log("Credentials decrypted for:", creds.username);

  for (const contactId of NON_ASCII_CONTACT_IDS) {
    const link = await db.syncContactLink.findFirst({
      where: { contactId, syncAccountId: SYNC_ACCOUNT_ID },
      include: { contact: true },
    });

    if (!link) {
      console.warn("  SKIP: no link found for", contactId);
      continue;
    }

    console.log(`\nPushing: ${link.contact.fullName} → ${link.remoteHref}`);
    console.log(`  remoteUid: ${link.remoteUid}`);

    if (!syncAccount.addressBookUrl) throw new Error("Sync account has no addressBookUrl.");
    try {
      const result = await pushCardDavContact({
        addressBookUrl: syncAccount.addressBookUrl,
        credentials: { username: creds.username, password: creds.password },
        remoteUid: link.remoteUid!,
        contact: {
          fullName: link.contact.fullName,
          firstName: link.contact.firstName,
          lastName: link.contact.lastName,
          nickname: link.contact.nickname,
          email: link.contact.email,
          emailAddresses: Array.isArray(link.contact.emailAddresses)
            ? (link.contact.emailAddresses as string[])
            : [],
          phone: link.contact.phone,
          phoneNumbers: Array.isArray(link.contact.phoneNumbers)
            ? (link.contact.phoneNumbers as string[])
            : [],
          company: link.contact.company,
          jobTitle: link.contact.jobTitle,
          website: link.contact.website,
          birthday: link.contact.birthday,
          address: link.contact.address,
          postalAddresses: Array.isArray(link.contact.postalAddresses)
            ? (link.contact.postalAddresses as any)
            : null,
          notes: link.contact.notes,
        },
        hrefOverride: link.remoteHref ?? undefined,
      });

      console.log(`  ✓ pushed, new ETag: ${result.etag}`);

      await db.syncContactLink.update({
        where: { id: link.id },
        data: {
          remoteETag: result.etag,
          remoteHref: result.href,
          lastSyncedAt: link.contact.updatedAt,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
    } catch (err) {
      console.error(`  ✗ push failed:`, err instanceof Error ? err.message : err);
    }
  }
}

async function resolveConflictsAndRunSync() {
  // Bulk-resolve all false-positive conflicts as auto-dismissed
  const resolved = await db.syncConflict.updateMany({
    where: {
      syncAccountId: SYNC_ACCOUNT_ID,
      resolvedAt: null,
    },
    data: {
      resolvedAt: new Date(),
      resolutionStrategy: "KEEP_LOCAL",
      resolutionNotes: "Bulk-dismissed false-positive DELETE_CONFLICT caused by incorrect UID in pushed vCard body",
    },
  });
  console.log(`\nResolved ${resolved.count} false-positive conflicts`);

  // Ensure account is active
  await db.syncAccount.update({
    where: { id: SYNC_ACCOUNT_ID },
    data: { status: "ACTIVE", lastErrorCode: null, lastErrorMessage: null },
  });
  console.log("Sync account reactivated");

  // Run the full sync to stabilize ETags for all ASCII contacts
  const { createId } = await import("@paralleldrive/cuid2");
  const job = await db.syncJob.create({
    data: {
      id: createId(),
      syncAccountId: SYNC_ACCOUNT_ID,
      status: "QUEUED",
      trigger: "MANUAL",
      syncDirection: "TWO_WAY",
    },
  });
  console.log("\nCreated sync job:", job.id);
  const result = await runQueuedSyncJobs({ limit: 1 });
  console.log("Sync result:", JSON.stringify(result, null, 2));
}

async function main() {
  console.log("=== Step 1: Re-push all non-ASCII contacts with VERSION:3.0 ===");
  await pushNonAsciiContacts();

  console.log("\n\n=== Step 2: Resolve false-positive conflicts and run full sync ===");
  await resolveConflictsAndRunSync();

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
