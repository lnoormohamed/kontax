import { spawnSync } from "node:child_process";

const deployEnv = (process.env.KONTAX_DEPLOY_ENV ?? "").trim().toLowerCase();
const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
const requestedMode = (process.env.KONTAX_SCHEMA_MODE ?? "").trim().toLowerCase();
const inferredProduction = !deployEnv && nodeEnv === "production";
// P48-14: production now boots through `prisma migrate deploy` (mode "migrate").
// `validate` remains available as a read-only pre-flight (migrate status + the
// additive-drift assessment) for operators who apply migrations out of band,
// and `push` stays the non-prod default.
const defaultSchemaMode = deployEnv
  ? deployEnv === "production"
    ? "migrate"
    : "push"
  : inferredProduction
    ? "migrate"
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

if (!["migrate", "push", "validate", "skip"].includes(schemaMode)) {
  console.error(
    `[startup] Unsupported KONTAX_SCHEMA_MODE "${schemaMode}". Use migrate, push, validate, or skip.`,
  );
  process.exit(1);
}

console.log(
  `[startup] Deploy environment: ${deployEnv || "unspecified"} · node env: ${nodeEnv || "unspecified"} · schema mode: ${schemaMode}`,
);

if (!requestedMode && inferredProduction) {
  console.warn(
    "[startup] KONTAX_DEPLOY_ENV is unset while NODE_ENV=production; defaulting schema mode to migrate for safety.",
  );
}

// P48-14: the DB password must never reach argv — `ps` on the host would show
// it. `prisma migrate` reads the connection string from DATABASE_URL in the
// environment, and `migrate diff --from-schema-datasource` resolves it through
// the schema's `env("DATABASE_URL")` rather than a --from-url flag.
const requireDatabaseUrl = () => {
  if (!process.env.DATABASE_URL) {
    console.error("[startup] DATABASE_URL is required for this schema mode.");
    process.exit(1);
  }
};

/**
 * The additive-drift assessment, kept from the `db push` era as a POST-CHECK.
 *
 * `prisma migrate diff` here transforms the live DB INTO the committed schema:
 * CREATE/ADD steps mean the DB is MISSING something the app needs (fatal —
 * the app would break at runtime), while DROP steps mean the DB merely has
 * extra objects the schema does not define (harmless to run against; leaving
 * them is strictly safer than dropping another session's data).
 *
 * Returns "clean" | "additive" | "destructive-only" | "unknown".
 */
const assessDrift = () => {
  const diff = spawnSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      // P48-14: reads the URL from the schema's env("DATABASE_URL") — no
      // credential on the command line.
      "--from-schema-datasource",
      "prisma/schema.prisma",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    { encoding: "utf8", env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" } },
  );
  if (diff.status !== 0 || typeof diff.stdout !== "string") {
    if (diff.stderr) console.error(diff.stderr);
    return { verdict: "unknown", script: "" };
  }
  const script = diff.stdout.trim();
  if (!script || /^--\s*This is an empty migration/i.test(script)) {
    return { verdict: "clean", script };
  }
  const needsAdditive =
    /CREATE\s+(TABLE|TYPE|SEQUENCE|(UNIQUE\s+)?INDEX)|ADD\s+(COLUMN|CONSTRAINT)|ADD\s+VALUE/i.test(
      script,
    );
  return { verdict: needsAdditive ? "additive" : "destructive-only", script };
};

if (schemaMode === "migrate") {
  requireDatabaseUrl();

  // Report the migration state before touching anything, so a failed deploy
  // leaves a readable trail in the container log. `migrate status` exits
  // non-zero when migrations are pending — expected here, so it is advisory
  // only and its exit code is deliberately not fatal.
  console.log("[startup] Migration status before deploy:");
  spawnSync("npx", ["prisma", "migrate", "status"], {
    stdio: "inherit",
    env: process.env,
  });

  console.log("[startup] Applying pending migrations (prisma migrate deploy).");
  // Fail-closed: `migrate deploy` is transactional per migration and never
  // destructive on its own; if it cannot apply cleanly the deploy must stop
  // rather than boot against a half-migrated database.
  run("npx", ["prisma", "migrate", "deploy"]);

  // Post-check: `migrate deploy` only guarantees the recorded migrations ran.
  // It does NOT detect a database that has drifted underneath them, so keep
  // the additive assessment as a fail-closed backstop.
  const { verdict, script } = assessDrift();
  if (verdict === "unknown") {
    console.error(
      "[startup] Could not assess schema drift after migrate deploy (prisma migrate diff failed); refusing to boot.",
    );
    process.exit(1);
  }
  if (verdict === "additive") {
    console.error(
      "[startup] The live DB is MISSING objects the committed schema requires even after migrate deploy — booting would break the app. A migration is probably missing from prisma/migrations. Pending changes:",
    );
    console.error(script);
    process.exit(1);
  }
  if (verdict === "destructive-only") {
    console.warn(
      "[startup] Live DB satisfies the committed schema; it also holds extra objects the schema does not define. Booting as-is and leaving them untouched. Pending drops:",
    );
    console.warn(script);
  } else {
    console.log("[startup] Live schema matches prisma/schema.prisma.");
  }

  // P38-06: the contact-search trigger lives outside Prisma's model; verify it
  // the same way validate mode does so a restored DB fails fast.
  run("node", ["scripts/runtime/check-schema-drift.mjs", "--trigger-only"]);
} else if (schemaMode === "push") {
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
    // IFF the live DB already satisfies the committed schema.
    console.warn(
      "[startup] prisma db push was refused (destructive drift on the live DB). Assessing whether the DB already satisfies the committed schema…",
    );
    requireDatabaseUrl();
    const { verdict, script } = assessDrift();
    if (verdict === "unknown") {
      console.error(
        "[startup] Could not assess schema drift (prisma migrate diff failed); refusing to boot.",
      );
      process.exit(push.status ?? 1);
    }
    if (verdict === "additive") {
      console.error(
        "[startup] The live DB is MISSING objects the committed schema requires — booting would break the app. Reconcile schema/DB before deploying. Pending changes:",
      );
      console.error(script);
      process.exit(push.status ?? 1);
    }
    console.warn(
      "[startup] Live DB already satisfies the committed schema; the refused changes are destructive-only (extra objects the schema doesn't define). Booting as-is and leaving them untouched. Pending drops:",
    );
    console.warn(script || "(none reported)");
  }
} else if (schemaMode === "validate") {
  // P48-14: read-only pre-flight. Reports migration state and refuses to boot
  // on drift, but applies nothing — for operators who run `migrate deploy`
  // out of band (e.g. a separate release job).
  requireDatabaseUrl();
  console.log("[startup] Validating live schema before boot (no changes applied).");
  console.log("[startup] Migration status:");
  const status = spawnSync("npx", ["prisma", "migrate", "status"], {
    stdio: "inherit",
    env: process.env,
  });
  if (status.status !== 0) {
    console.error(
      "[startup] prisma migrate status reports pending or failed migrations; refusing to boot in validate mode. Apply them (KONTAX_SCHEMA_MODE=migrate or `npm run db:migrate`) first.",
    );
    process.exit(status.status ?? 1);
  }
  run("node", ["scripts/runtime/check-schema-drift.mjs"]);
} else {
  console.log("[startup] Skipping schema step before boot.");
}

console.log("[startup] Starting Kontax.");
run("npm", ["start"]);
