import { db } from "../src/server/db";
import { decryptSyncCredentialPayload } from "../src/server/sync-credentials";
import { pushCardDavContact } from "../src/server/carddav";

const SYNC_ACCOUNT_ID = "cmqf9hbx00001j5g89tae1h4w";
const USER_ID = "cmqf4htvr000cp72msyztzxjs";

async function main() {
  const { createId } = await import("@paralleldrive/cuid2");

  const syncAccount = await db.syncAccount.findUniqueOrThrow({
    where: { id: SYNC_ACCOUNT_ID },
    select: { credentialReference: true, addressBookUrl: true },
  });
  const creds = decryptSyncCredentialPayload(syncAccount.credentialReference!);

  // ── Contact 1: minimal — phone + email, varied non-English name ──────────────
  // Covers: Danish ø, German ü, Spanish ñ, French é, Turkish ç
  const c1 = await db.contact.create({
    data: {
      id: createId(),
      userId: USER_ID,
      fullName: "Søren Müñoz-Éçe",
      firstName: "Søren",
      lastName: "Müñoz-Éçe",
      phone: "+44 7911 123456",
      email: "soren.munoz@example.com",
      sourceType: "MANUAL",
      lastMutatedBy: "MANUAL",
    },
    select: { id: true, fullName: true, updatedAt: true },
  });
  console.log("Created contact 1:", c1.fullName, c1.id);

  // ── Contact 2: full details — Icelandic þ, Swedish Å, Czech č, ß ────────────
  const c2 = await db.contact.create({
    data: {
      id: createId(),
      userId: USER_ID,
      fullName: "Þórunn Özbağ-Čapek",
      firstName: "Þórunn",
      lastName: "Özbağ-Čapek",
      nickname: "Þóra",
      phone: "+49 89 12345678",
      email: "thorunn@großfirma.de",
      emailAddresses: ["thorunn@großfirma.de", "thorunn.ozbag@gmail.com"],
      phoneNumbers: ["+49 89 12345678", "+354 555 0198"],
      company: "Großunternehmen GmbH",
      jobTitle: "Führungskraft",
      website: "https://großfirma.de",
      birthday: "1985-06-15",
      address: "Schloßstraße 42, 80333 München",
      notes: "Spricht Türkçe und Deutsch. Besöker Sverige regelbundet. Mødes også på dansk.",
      sourceType: "MANUAL",
      lastMutatedBy: "MANUAL",
    },
    select: { id: true, fullName: true, updatedAt: true },
  });
  console.log("Created contact 2:", c2.fullName, c2.id);

  // ── Push both to iCloud ───────────────────────────────────────────────────────
  for (const [contact, updatedAt] of [[c1, c1.updatedAt], [c2, c2.updatedAt]] as const) {
    const remoteUid = createId().toUpperCase().replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5").slice(0, 36);

    console.log(`\nPushing ${contact.fullName} → uid ${remoteUid}`);

    const full = await db.contact.findUniqueOrThrow({
      where: { id: contact.id },
    });

    const result = await pushCardDavContact({
      addressBookUrl: syncAccount.addressBookUrl,
      credentials: { username: creds.username, password: creds.password },
      remoteUid,
      contact: {
        fullName: full.fullName,
        firstName: full.firstName,
        lastName: full.lastName,
        nickname: full.nickname,
        email: full.email,
        emailAddresses: Array.isArray(full.emailAddresses) ? full.emailAddresses as string[] : [],
        phone: full.phone,
        phoneNumbers: Array.isArray(full.phoneNumbers) ? full.phoneNumbers as string[] : [],
        company: full.company,
        jobTitle: full.jobTitle,
        website: full.website,
        birthday: full.birthday,
        address: full.address,
        postalAddresses: Array.isArray(full.postalAddresses) ? full.postalAddresses as any : null,
        notes: full.notes,
      },
    });

    console.log("  ✓ pushed, href:", result.href, "etag:", result.etag);

    await db.syncContactLink.create({
      data: {
        id: createId(),
        syncAccountId: SYNC_ACCOUNT_ID,
        contactId: contact.id,
        remoteHref: result.href,
        remoteUid,
        remoteETag: result.etag,
        lastSyncedAt: updatedAt,
      },
    });

    console.log("  ✓ link created");
  }

  console.log("\nDone. Both contacts are live in iCloud.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
