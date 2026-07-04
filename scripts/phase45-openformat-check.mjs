// P45-06 — guard for the published open-format bundle (open-format/).
// 1. The JSON Schemas vendored into the public bundle MUST match the app's
//    canonical docs/schemas/ copies byte-for-byte (no silent drift).
// 2. The zero-dependency reference validator MUST accept both committed
//    examples (bare document + archive) and reject a corrupted archive.
// Run: npm run qa:phase45:openformat   (exits non-zero on the first failure)

import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = join(ROOT, "open-format");
const VALIDATOR = join(BUNDLE, "bin", "validate.mjs");

let failures = 0;
const ok = (label) => console.log(`✓ ${label}`);
const fail = (label, detail) => {
  failures += 1;
  console.error(`✗ ${label}${detail ? `\n    ${detail}` : ""}`);
};

// 1. schema parity
for (const name of ["kontax-contact.v1.schema.json", "kontax-archive.v1.schema.json"]) {
  const canonical = readFileSync(join(ROOT, "docs", "schemas", name), "utf8");
  const vendored = readFileSync(join(BUNDLE, "schemas", name), "utf8");
  if (canonical === vendored) ok(`schema in sync: ${name}`);
  else fail(`schema drift: open-format/schemas/${name} ≠ docs/schemas/${name}`, "re-copy the canonical schema into the bundle");
}

// 2. validator accepts the good examples (exit 0)
const runValidator = (file) => {
  try {
    execFileSync("node", [VALIDATOR, join(BUNDLE, "examples", file)], { stdio: "pipe" });
    return 0;
  } catch (err) {
    return typeof err.status === "number" ? err.status : 1;
  }
};
for (const file of ["daniel-cho.json", "example-archive.zip"]) {
  if (runValidator(file) === 0) ok(`validator accepts ${file}`);
  else fail(`validator rejected a valid example: ${file}`);
}

// 3. validator rejects a corrupted archive (non-zero exit)
{
  const good = readFileSync(join(BUNDLE, "examples", "example-archive.zip"));
  const bad = Buffer.from(good);
  const mid = Math.floor(bad.length / 2);
  bad.writeUInt8(bad.readUInt8(mid) ^ 0xff, mid);
  const badPath = join(tmpdir(), `kontax-openformat-corrupt-${process.pid}.zip`);
  writeFileSync(badPath, bad);
  let status = 0;
  try {
    execFileSync("node", [VALIDATOR, badPath], { stdio: "pipe" });
  } catch (err) {
    status = typeof err.status === "number" ? err.status : 1;
  } finally {
    rmSync(badPath, { force: true });
  }
  if (status === 1) ok("validator rejects a corrupted archive");
  else fail("validator did NOT reject a corrupted archive", `exit ${status}`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll P45-06 open-format checks passed.");
