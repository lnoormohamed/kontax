/**
 * P21-08 — Seed a starter set of feature flags for the admin Feature Flags page.
 * Idempotent: upserts by key. Usage: node scripts/seed-feature-flags.mjs
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const FLAGS = [
  { key: "advanced-merge-v2", name: "Advanced merge v2", description: "New duplicate-detection scoring engine", mode: "ROLLOUT", rolloutPct: 25 },
  { key: "teams-audit-export", name: "Teams audit export", description: "CSV export of the team audit log", mode: "SPECIFIC_USERS", rolloutPct: 0 },
  { key: "carddav-push", name: "CardDAV push sync", description: "Real-time push instead of polling", mode: "ALL", rolloutPct: 100 },
  { key: "ai-contact-enrich", name: "AI contact enrichment", description: "Suggest company / title from email domain", mode: "OFF", rolloutPct: 0 },
  { key: "new-onboarding", name: "New onboarding flow", description: "Three-step guided first-run experience", mode: "ROLLOUT", rolloutPct: 60 },
  { key: "family-live-share", name: "Family live share", description: "Live-syncing shared contacts for Family", mode: "ALL", rolloutPct: 100 },
];

async function main() {
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: { name: f.name, description: f.description },
      create: f,
    });
  }
  console.log(`✓ Seeded ${FLAGS.length} feature flags.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
