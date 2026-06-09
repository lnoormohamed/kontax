/**
 * P10-03 one-time backfill: set sourceType = IMPORT_CSV (+ sourceDetail) for
 * contacts that came from an import job. Everything else stays MANUAL (the
 * column default). Idempotent — re-running only re-applies the same values.
 *
 * Run: node scripts/backfill-source-type.mjs
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

try {
  const contactsWithImport = await prisma.contact.findMany({
    where: { importJobId: { not: null } },
    select: { id: true, importJobId: true },
  });

  console.log(`Found ${contactsWithImport.length} import-originated contacts.`);

  let updated = 0;
  for (const batch of chunk(contactsWithImport, 500)) {
    const jobIds = [...new Set(batch.map((c) => c.importJobId))];
    const jobs = await prisma.importJob.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, sourceFileName: true, sourceProfile: true },
    });
    const jobMap = new Map(jobs.map((j) => [j.id, j]));

    await Promise.all(
      batch.map((contact) => {
        const job = jobMap.get(contact.importJobId);
        const detail = job?.sourceFileName ?? job?.sourceProfile ?? null;
        return prisma.contact.update({
          where: { id: contact.id },
          data: {
            sourceType: "IMPORT_CSV",
            sourceDetail: detail,
            // leave lastMutatedBy alone — it reflects the most recent actor,
            // which for historical rows we cannot reconstruct; default MANUAL is fine
          },
        });
      }),
    );
    updated += batch.length;
  }

  console.log(`Backfill complete: ${updated} contacts set to IMPORT_CSV. All others remain MANUAL.`);
} finally {
  await prisma.$disconnect();
}
