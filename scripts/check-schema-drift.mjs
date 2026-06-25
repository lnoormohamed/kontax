import { spawnSync } from "node:child_process";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[schema-check] DATABASE_URL is required.");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-url",
    DATABASE_URL,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--exit-code",
  ],
  {
    stdio: "inherit",
    env: process.env,
  },
);

if (result.status === 0) {
  console.log("[schema-check] Database schema matches prisma/schema.prisma.");
  process.exit(0);
}

if (result.status === 2) {
  console.error(
    "[schema-check] Drift detected between the live database and prisma/schema.prisma.",
  );
  console.error(
    "[schema-check] Apply the schema intentionally before booting in validate mode.",
  );
  process.exit(2);
}

process.exit(result.status ?? 1);
