import { spawnSync } from "node:child_process";

const deployEnv = (process.env.KONTAX_DEPLOY_ENV ?? "").trim().toLowerCase();
const requestedMode = (process.env.KONTAX_SCHEMA_MODE ?? "").trim().toLowerCase();
const schemaMode =
  requestedMode || (deployEnv === "production" ? "validate" : "push");

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
  `[startup] Deploy environment: ${deployEnv || "unspecified"} · schema mode: ${schemaMode}`,
);

if (schemaMode === "push") {
  console.log("[startup] Applying prisma db push before boot.");
  run("npx", ["prisma", "db", "push", "--skip-generate"]);
} else if (schemaMode === "validate") {
  console.log("[startup] Validating live schema before boot.");
  run("node", ["scripts/check-schema-drift.mjs"]);
} else {
  console.log("[startup] Skipping schema step before boot.");
}

console.log("[startup] Starting Kontax.");
run("npm", ["start"]);
