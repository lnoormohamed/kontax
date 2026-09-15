import { spawnSync } from "node:child_process";

// P48-14: DATABASE_URL is read from the environment and passed to Prisma
// through the environment only. It used to be interpolated into argv
// (`--from-url <url>`, `--url <url>`), which put the database password in the
// process table for anyone who could run `ps` on the host.
//   · `migrate diff --from-schema-datasource` resolves the datasource through
//     the schema's own env("DATABASE_URL").
//   · `db execute --schema` does the same for the trigger probe.
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[schema-check] DATABASE_URL is required.");
  process.exit(1);
}

// `--trigger-only` skips the structural diff and checks just the out-of-model
// database objects. start-production.mjs uses it after `prisma migrate deploy`,
// which has already established that the structure is correct.
const triggerOnly = process.argv.includes("--trigger-only");

// P38-06: the contact search trigger + function live outside Prisma's model
// (owned by scripts/runtime/setup-contact-search-index.mjs). Verify them so a
// fresh or restored database fails fast instead of silently serving empty
// search results.
const checkContactSearchTrigger = () => {
  const triggerCheck = spawnSync(
    "npx",
    ["prisma", "db", "execute", "--schema", "prisma/schema.prisma", "--stdin"],
    {
      input: `DO $$
BEGIN
  IF (SELECT count(*) FROM pg_trigger WHERE tgname = 'contact_search_vector_trigger') < 1 THEN
    RAISE EXCEPTION 'missing trigger contact_search_vector_trigger — run scripts/runtime/setup-contact-search-index.mjs';
  END IF;
END $$;`,
      env: process.env,
      encoding: "utf8",
    },
  );
  if (triggerCheck.status !== 0) {
    console.error(triggerCheck.stderr || triggerCheck.stdout);
    console.error(
      "[schema-check] Contact search trigger missing — run scripts/runtime/setup-contact-search-index.mjs (P38-06).",
    );
    process.exit(2);
  }
  console.log("[schema-check] Contact search trigger present.");
};

if (triggerOnly) {
  checkContactSearchTrigger();
  process.exit(0);
}

const result = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-schema-datasource",
    "prisma/schema.prisma",
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
  checkContactSearchTrigger();
  process.exit(0);
}

if (result.status === 2) {
  console.error(
    "[schema-check] Drift detected between the live database and prisma/schema.prisma.",
  );
  console.error(
    "[schema-check] Apply the schema intentionally before booting: `npm run db:migrate` (prisma migrate deploy) on an environment with migration history, or reconcile the drift by hand.",
  );
  process.exit(2);
}

process.exit(result.status ?? 1);
