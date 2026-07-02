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
  // P38-06: the contact search trigger + function live outside Prisma's model
  // (owned by scripts/setup-contact-search-index.mjs). Verify them so a fresh
  // or restored database fails fast instead of silently serving empty search.
  const triggerCheck = spawnSync(
    "npx",
    ["prisma", "db", "execute", "--url", DATABASE_URL, "--stdin"],
    {
      input: `DO $$
BEGIN
  IF (SELECT count(*) FROM pg_trigger WHERE tgname = 'contact_search_vector_trigger') < 1 THEN
    RAISE EXCEPTION 'missing trigger contact_search_vector_trigger — run scripts/setup-contact-search-index.mjs';
  END IF;
END $$;`,
      env: process.env,
      encoding: "utf8",
    },
  );
  if (triggerCheck.status !== 0) {
    console.error(triggerCheck.stderr || triggerCheck.stdout);
    console.error(
      "[schema-check] Contact search trigger missing — run scripts/setup-contact-search-index.mjs (P38-06).",
    );
    process.exit(2);
  }
  console.log("[schema-check] Contact search trigger present.");
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
