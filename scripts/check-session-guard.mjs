#!/usr/bin/env node
// P48-06: static guard against reintroducing hand-rolled session checks.
//
// Every server action (src/app/actions/*.ts) and API route handler
// (src/app/api/**/route.ts) must resolve the caller through the central
// helper in src/server/auth/require-session.ts (`requireSession` /
// `requireUserId`), not a raw `await auth()` + manual `impersonatedBy` /
// `pendingDeletion` check — that was the whole defect P48-06 fixes (17 of 30
// action files reimplemented the check inline; 11 skipped it entirely, and
// every /api/* route that called auth() skipped the write guard completely).
//
// This script scans for `await auth()` outside a small, documented
// allowlist and exits non-zero on any unlisted hit, so a future PR can't
// silently regress back to the old pattern. It does not (and cannot) verify
// *correct* usage of requireSession — that's what code review and the
// acceptance tests are for — only that the discouraged raw call doesn't
// reappear in a file that isn't already an accepted exception.
//
// Run: node scripts/check-session-guard.mjs   (wired as `npm run check:session-guard`)

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Directories under src/app/api this ticket (P48-06) does not own and that
// use a different auth mechanism entirely (cron secret, NextAuth's own
// handler, Stripe/SES webhook signatures, v1 bearer tokens, or are
// deliberately unauthenticated) — out of scope for the session-guard sweep.
const EXCLUDED_API_DIR_PREFIXES = [
  "cron/",
  "auth/",
  "stripe/",
  "ses/",
  "v1/",
  "calendar/",
  "card/",
  "health/",
  "register/",
  "sync/run/",
];

// Exact files (relative to src/app/) where a raw `await auth()` call is a
// documented, deliberate exception — not a regression. Keep this list small
// and justify every entry; anything else that calls `await auth()` should be
// routed through `requireSession` / `requireUserId` instead.
const ALLOWLIST = new Map([
  [
    "actions/account.ts",
    "scheduleAccountDeletion / cancelAccountDeletion: cancelAccountDeletion " +
      "is the one write a pending-deletion session must still be able to make, " +
      "so it deliberately reads auth() directly rather than requireSession({write:true}), " +
      "which would throw PENDING_DELETION; scheduleAccountDeletion mirrors the same " +
      "session object to distinguish an already-pending request (ALREADY_PENDING_DELETION) " +
      "from a fresh one, ahead of its own step-up check. See the comment on cancelAccountDeletion.",
  ],
  [
    "api/billing/plan/route.ts",
    "public prefix: /api/billing/plan is called by the statically-rendered /pricing " +
      "page and must return { plan: null } for anonymous visitors, so it reads auth() " +
      "directly and stays read-only by construction (no write path exists).",
  ],
  [
    "api/impersonation/route.ts",
    "public prefix: reports impersonation-banner state for the client after hydration " +
      "and must work for any session shape (including none); reads auth() directly and " +
      "is read-only by construction (no write path exists).",
  ],
]);

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function isExcludedApiFile(relFromApi) {
  return EXCLUDED_API_DIR_PREFIXES.some((prefix) => relFromApi.startsWith(prefix));
}

function main() {
  const targets = [
    { dir: path.join(ROOT, "src/app/actions"), label: "actions/" },
    { dir: path.join(ROOT, "src/app/api"), label: "api/" },
  ];

  /** @type {{file: string, line: number, text: string}[]} */
  const violations = [];
  let scanned = 0;

  for (const { dir, label } of targets) {
    let files;
    try {
      files = walk(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      const relFromAppRoot = label + path.relative(dir, file).split(path.sep).join("/");

      if (label === "api/") {
        const relFromApi = path.relative(dir, file).split(path.sep).join("/");
        if (isExcludedApiFile(relFromApi)) continue;
        // Only route handlers matter for this guard.
        if (!relFromApi.endsWith("route.ts")) continue;
      }

      if (ALLOWLIST.has(relFromAppRoot)) continue;

      scanned += 1;
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((lineText, idx) => {
        // Matches `await auth()` but not `await authIncludingPendingTotp()`,
        // `await authConfig` etc — word boundary after `auth` via the `(`.
        if (/\bawait\s+auth\(\)/.test(lineText)) {
          violations.push({ file: relFromAppRoot, line: idx + 1, text: lineText.trim() });
        }
      });
    }
  }

  if (violations.length > 0) {
    console.error(
      `check-session-guard: found ${violations.length} raw "await auth()" call(s) ` +
        `outside the documented allowlist:\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}: ${v.text}`);
    }
    console.error(
      `\nUse requireSession() / requireUserId() from ~/server/auth/require-session instead ` +
        `(see src/server/auth/require-session.ts), or add a justified entry to the ALLOWLIST ` +
        `in scripts/check-session-guard.mjs if this really is a deliberate exception.`,
    );
    process.exit(1);
  }

  console.log(
    `check-session-guard: OK — scanned ${scanned} file(s) under src/app/actions and ` +
      `src/app/api/**/route.ts, no unlisted "await auth()" calls found ` +
      `(${ALLOWLIST.size} allowlisted exception(s)).`,
  );
}

main();
