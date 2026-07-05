import { spawnSync } from "node:child_process";

const deployEnv = (process.env.KONTAX_DEPLOY_ENV ?? "").trim().toLowerCase();
const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
const requestedMode = (process.env.KONTAX_SCHEMA_MODE ?? "").trim().toLowerCase();
const inferredProduction = !deployEnv && nodeEnv === "production";
const defaultSchemaMode = deployEnv
  ? deployEnv === "production"
    ? "validate"
    : "push"
  : inferredProduction
    ? "validate"
    : "push";
const schemaMode = requestedMode || defaultSchemaMode;

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (!["push", "validate", "skip"].includes(schemaMode)) {
  console.error(
    `[startup] Unsupported KONTAX_SCHEMA_MODE "${schemaMode}". Use push, validate, or skip.`,
  );
  process.exit(1);
}

console.log(
  `[startup] Deploy environment: ${deployEnv || "unspecified"} · node env: ${nodeEnv || "unspecified"} · schema mode: ${schemaMode}`,
);

if (!requestedMode && inferredProduction) {
  console.warn(
    "[startup] KONTAX_DEPLOY_ENV is unset while NODE_ENV=production; defaulting schema mode to validate for safety.",
  );
}

if (schemaMode === "push") {
  console.log("[startup] Applying prisma db push before boot.");
  const push = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    stdio: "inherit",
    env: process.env,
  });
  if (push.status !== 0) {
    // `prisma db push` (without --accept-data-loss) refuses ALL changes the
    // moment ANY would be destructive. On a SHARED staging DB the usual trigger
    // is another deploy/session having added objects the committed schema does
    // not define yet (e.g. a seeded lookup table): harmless to run against, but
    // db push wants to DROP them, aborts, and — because a non-zero exit kills
    // the container — crash-loops the whole site into an outage.
    //
    // Dropping is NOT a safe recovery (--accept-data-loss could wipe another
    // session's data). Instead decide whether it is safe to boot as-is: it is
    // IFF the live DB already satisfies the committed schema, i.e. the only
    // pending changes are destructive (removing extra objects the app never
    // references). If the schema needs objects the DB LACKS, the app would
    // break at runtime — fail hard so the deploy is fixed, not silently broken.
    console.warn(
      "[startup] prisma db push was refused (destructive drift on the live DB). Assessing whether the DB already satisfies the committed schema…",
    );
    const diff = spawnSync(
      "npx",
      [
        "prisma",
        "migrate",
        "diff",
        "--from-url",
        process.env.DATABASE_URL ?? "",
        "--to-schema-datamodel",
        "prisma/schema.prisma",
        "--script",
      ],
      { encoding: "utf8", env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" } },
    );
    if (diff.status !== 0 || typeof diff.stdout !== "string") {
      console.error(
        "[startup] Could not assess schema drift (prisma migrate diff failed); refusing to boot.",
      );
      if (diff.stderr) console.error(diff.stderr);
      process.exit(push.status ?? 1);
    }
    // The diff transforms the live DB INTO the committed schema: DROP steps =
    // objects the DB has but the schema doesn't (safe to leave); CREATE/ADD
    // steps = objects the schema needs but the DB lacks (app-breaking).
    const needsAdditive =
      /CREATE\s+(TABLE|TYPE|SEQUENCE|(UNIQUE\s+)?INDEX)|ADD\s+(COLUMN|CONSTRAINT)|ADD\s+VALUE/i.test(
        diff.stdout,
      );
    if (needsAdditive) {
      console.error(
        "[startup] The live DB is MISSING objects the committed schema requires — booting would break the app. Reconcile schema/DB before deploying. Pending changes:",
      );
      console.error(diff.stdout);
      process.exit(push.status ?? 1);
    }
    console.warn(
      "[startup] Live DB already satisfies the committed schema; the refused changes are destructive-only (extra objects the schema doesn't define). Booting as-is and leaving them untouched. Pending drops:",
    );
    console.warn(diff.stdout.trim() || "(none reported)");
  }
} else if (schemaMode === "validate") {
  console.log("[startup] Validating live schema before boot.");
  run("node", ["scripts/check-schema-drift.mjs"]);
} else {
  console.log("[startup] Skipping schema step before boot.");
}

console.log("[startup] Starting Kontax.");
run("npm", ["start"]);
