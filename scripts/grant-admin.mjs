/**
 * P21-01 — Promote a user to the platform ADMIN role.
 *
 * Usage:  node scripts/grant-admin.mjs <email>
 *         node scripts/grant-admin.mjs <email> --revoke
 *
 * Sets User.role = ADMIN (or USER with --revoke). The change takes effect on the
 * user's next request once their JWT is re-issued (sign out / in to force it).
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const revoke = process.argv.includes("--revoke");
  if (!email) {
    console.error("Usage: node scripts/grant-admin.mjs <email> [--revoke]");
    process.exit(1);
  }

  const role = revoke ? "USER" : "ADMIN";
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    console.error(`No user found with email "${email}".`);
    process.exit(1);
  }

  await prisma.user.update({ where: { email }, data: { role } });
  console.log(`✓ ${email} is now ${role}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
