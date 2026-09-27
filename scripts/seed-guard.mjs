// Safety rails for every script that writes demo / QA data.
//
// Incident 2026-09-27: the Phase 37 seed scripts defaulted to the owner's own
// account (and others to the oldest user). On staging that account was
// connected to the owner's real Google / iCloud / Fastmail, so ~380 demo
// contacts were pushed into real address books, and duplicate merges folded
// real contacts into demo ones (demo company, title, phone on real people).
//
// So a seed now needs an explicit target, never runs against production, and
// refuses an account with any live sync connection unless told otherwise.

const LIVE_CONNECTION_EXCLUDED = ["RETIRED", "DISCONNECTED"];

const deployEnv = () =>
  process.env.KONTAX_DEPLOY_ENV ??
  // Unset under NODE_ENV=production: assume the worst.
  (process.env.NODE_ENV === "production" ? "production" : "development");

/**
 * Resolve and vet the user a seed script is about to write into.
 * @param {import("../generated/prisma/index.js").PrismaClient} db
 * @param {string | undefined | null} email explicit --user / SEED_USER_EMAIL
 * @returns {Promise<{ id: string, email: string }>}
 */
export const assertSeedTarget = async (db, email) => {
  if (!email) {
    throw new Error(
      "Seed scripts need an explicit --user=<email> (or SEED_USER_EMAIL). There is no default target.",
    );
  }
  if (deployEnv() === "production") {
    throw new Error("Refusing to seed demo data: this looks like production (KONTAX_DEPLOY_ENV / NODE_ENV).");
  }
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${email}`);

  const liveConnections = await db.syncAccount.count({
    where: { userId: user.id, status: { notIn: LIVE_CONNECTION_EXCLUDED } },
  });
  if (liveConnections > 0 && !process.argv.includes("--allow-synced-account")) {
    throw new Error(
      `${user.email} has ${liveConnections} sync connection(s) (Google / iCloud / CardDAV / Outlook). ` +
        "Seeding demo contacts into it can push them into those real address books and merge them " +
        "into real contacts. Use a dedicated demo account, or pass --allow-synced-account if every " +
        "connection points at a test address book.",
    );
  }
  return user;
};
