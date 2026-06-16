#!/usr/bin/env node
/**
 * P34F-03 rollback: reverse a teams-billing migration using its log file.
 *
 * Re-points the SubscriptionCustomer + Subscription from groupId back to the
 * previousUserId recorded in the log, restores Stripe metadata to kontaxUserId,
 * and clears Group.subscriptionId / teamsEnabled.
 *
 * Usage:
 *   node scripts/rollback-teams-billing-to-org.mjs scripts/out/teams-billing-migration-<ts>.json            # dry-run
 *   node scripts/rollback-teams-billing-to-org.mjs scripts/out/teams-billing-migration-<ts>.json --apply
 */
import { readFileSync } from "node:fs";

import Stripe from "stripe";

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const logPath = process.argv.find((a) => a.endsWith(".json"));

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set — required for --apply");
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

async function main() {
  if (!logPath) throw new Error("Pass the migration log path, e.g. scripts/out/teams-billing-migration-<ts>.json");
  const entries = JSON.parse(readFileSync(logPath, "utf8"));
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"}: rolling back ${entries.length} team(s) from ${logPath}\n`);

  const stripe = APPLY ? stripeClient() : null;

  for (const e of entries) {
    console.log(
      `${APPLY ? "REVERT" : "PLAN  "} group=${e.groupId} → user=${e.previousUserId} cust=${e.customerId} sub=${e.subscriptionId}`,
    );
    if (!APPLY) continue;

    await stripe.customers.update(e.customerId, {
      metadata: { kontaxUserId: e.previousUserId, kontaxGroupId: "" },
    });
    await db.$transaction([
      db.subscriptionCustomer.update({
        where: { groupId: e.groupId },
        data: { userId: e.previousUserId, groupId: null },
      }),
      db.subscription.update({
        where: { id: e.subscriptionId },
        data: { userId: e.previousUserId, groupId: null },
      }),
      db.group.update({
        where: { id: e.groupId },
        data: { subscriptionId: null, teamsEnabled: false },
      }),
    ]);
  }

  console.log(`\n${APPLY ? "Rolled back" : "Dry-run complete"}: ${entries.length} team(s).`);
  if (!APPLY) console.log("Re-run with --apply to execute.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
