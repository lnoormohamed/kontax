#!/usr/bin/env node
/**
 * P46-02 — one-off avatar URL host rewrite.
 *
 * When an environment's media host changes (e.g. staging moves from the private
 * `http://10.0.0.144:9000` MinIO origin to a public `https://media-staging.
 * getkontax.com` subdomain), avatar URLs already baked into the DB still point
 * at the old host and won't load in a browser. This rewrites the base prefix of
 * every `Contact.avatarUrl` / `User.avatarUrl` that starts with `--from` to
 * `--to`, preserving the rest of the path (the object keys don't move — the new
 * host must front the SAME MinIO with the SAME `/kontax-uploads/avatars/…`
 * paths). External pasted URLs and `data:` URIs are left untouched.
 *
 * ── SAFETY (repo standing note) ──────────────────────────────────────────────
 * STAGING FIRST. DRY-RUN BEFORE COMMIT. Default mode mutates nothing and only
 * prints what would change. `--commit` applies. Idempotent: re-running after a
 * completed run is a no-op (nothing still starts with `--from`).
 *
 * Usage:
 *   Dry-run (default, safe):
 *     node --env-file-if-exists=.env --env-file-if-exists=.env.local \
 *       scripts/rewrite-avatar-host.mjs \
 *       --from http://10.0.0.144:9000/kontax-uploads \
 *       --to   https://media-staging.getkontax.com/kontax-uploads
 *   Commit (staging, after reviewing the dry-run):
 *     …same… --commit
 *
 * The `--from` / `--to` bases must match how `MINIO_PUBLIC_URL` is (was) set —
 * whatever prefix uploads build their URLs from. Swap ONLY the base; keep the
 * `/kontax-uploads/avatars/…` tail intact.
 */

import { PrismaClient } from "../generated/prisma/index.js";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const FROM = arg("--from");
const TO = arg("--to");
const COMMIT = process.argv.includes("--commit");

if (!FROM || !TO) {
  console.error("Missing --from <oldBase> and/or --to <newBase>. See the header for usage.");
  process.exit(1);
}
// Guard against a trailing-slash mismatch silently missing everything.
const from = FROM.replace(/\/+$/, "");
const to = TO.replace(/\/+$/, "");

const db = new PrismaClient();

const swap = (url) => (url && url.startsWith(from + "/") ? to + url.slice(from.length) : null);

async function rewriteModel(label, findMany, update) {
  const rows = await findMany();
  let changed = 0;
  const samples = [];
  for (const row of rows) {
    const next = swap(row.avatarUrl);
    if (!next) continue;
    changed += 1;
    if (samples.length < 3) samples.push(`${row.avatarUrl}\n      → ${next}`);
    if (COMMIT) await update(row.id, next);
  }
  console.log(`${label}: ${changed} to rewrite${COMMIT ? " (applied)" : ""}`);
  for (const s of samples) console.log(`  • ${s}`);
  return changed;
}

console.log(`Rewriting avatar host\n  from ${from}\n  to   ${to}\n  mode ${COMMIT ? "COMMIT" : "DRY RUN"}\n`);

const contacts = await rewriteModel(
  "Contact.avatarUrl",
  () => db.contact.findMany({ where: { avatarUrl: { startsWith: from } }, select: { id: true, avatarUrl: true } }),
  (id, avatarUrl) => db.contact.update({ where: { id }, data: { avatarUrl } }),
);
const users = await rewriteModel(
  "User.avatarUrl",
  () => db.user.findMany({ where: { avatarUrl: { startsWith: from } }, select: { id: true, avatarUrl: true } }),
  (id, avatarUrl) => db.user.update({ where: { id }, data: { avatarUrl } }),
);

console.log(`\nTotal: ${contacts + users} rows`);
if (!COMMIT) console.log("DRY RUN — nothing written. Re-run with --commit (staging first) to apply.");

await db.$disconnect();
