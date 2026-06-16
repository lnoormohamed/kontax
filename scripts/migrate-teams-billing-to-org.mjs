#!/usr/bin/env node
/**
 * P34F-03: Re-anchor existing Teams billing from the owner (User) to the org (Group).
 *
 * After P34F-01 (schema) + P34F-02 (webhook routing), existing teams still have
 * their SubscriptionCustomer / Subscription anchored to the owner's userId. This
 * one-time, idempotent, dry-runnable, reversible migration moves them onto the
 * Group and stamps the Stripe customer with kontaxGroupId.
 *
 * Usage:
 *   node scripts/migrate-teams-billing-to-org.mjs            # dry-run (default) — writes nothing
 *   node scripts/migrate-teams-billing-to-org.mjs --apply    # executes (needs STRIPE_SECRET_KEY)
 *   node scripts/migrate-teams-billing-to-org.mjs --verify   # post-conditions only
 *
 * Ordering (per P34F-DB01 §08): Stripe metadata write FIRST, then the DB flip. A
 * failed DB transaction leaves the row user-anchored (DB groupId unchanged →
 * resolveBillingOwner returns kind:"user" → billing still works). The DB is the
 * source of truth; the metadata is belt-and-braces.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import Stripe from "stripe";

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const ACTIVE = ["ACTIVE", "TRIALING", "PAST_DUE"];

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set — required for --apply");
  // Match src/server/stripe.ts.
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

// Pick the team's authoritative TEAMS subscription: prefer an active one, then the
// latest period end (covers a re-subscribe history on one customer).
function pickTeamSub(subs) {
  return subs
    .filter((s) => s.plan === "TEAMS")
    .sort((a, b) => {
      const aActive = ACTIVE.includes(a.status) ? 0 : 1;
      const bActive = ACTIVE.includes(b.status) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (b.currentPeriodEnd?.getTime() ?? 0) - (a.currentPeriodEnd?.getTime() ?? 0);
    })[0];
}

async function verify() {
  const teams = await db.group.findMany({
    where: { type: "TEAM" },
    select: {
      id: true,
      name: true,
      teamsEnabled: true,
      billingCustomer: { select: { userId: true, groupId: true } },
      subscriptions: { select: { id: true, plan: true, status: true, userId: true, groupId: true } },
    },
  });
  let ok = 0;
  let unmigrated = 0;
  let failed = 0;
  for (const t of teams) {
    if (!t.billingCustomer) {
      unmigrated++;
      continue;
    }
    const problems = [];
    if (t.billingCustomer.groupId !== t.id) problems.push("customer.groupId != team");
    if (t.billingCustomer.userId !== null) problems.push("customer.userId not null");
    const teamSub = t.subscriptions.find((s) => s.groupId === t.id);
    if (!teamSub) problems.push("no subscription anchored to group");
    else if (teamSub.userId !== null) problems.push("subscription.userId not null");
    if (problems.length) {
      failed++;
      console.log(`FAIL ${t.id} "${t.name}": ${problems.join("; ")}`);
    } else {
      ok++;
    }
  }
  console.log(`\nVerify: ok=${ok} unmigrated=${unmigrated} failed=${failed} (of ${teams.length} teams)`);
  if (failed) process.exitCode = 1;
}

async function main() {
  if (VERIFY) return verify();

  const teams = await db.group.findMany({
    where: { type: "TEAM" },
    select: {
      id: true,
      name: true,
      ownerId: true,
      billingCustomer: { select: { id: true } },
    },
  });
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"}: ${teams.length} team(s) to consider.\n`);

  const stripe = APPLY ? stripeClient() : null;
  const log = [];
  let migrated = 0;
  let skipped = 0;
  let warned = 0;

  for (const team of teams) {
    if (team.billingCustomer) {
      skipped++;
      console.log(`SKIP   ${team.id} "${team.name}" — already org-anchored`);
      continue;
    }

    const cust = await db.subscriptionCustomer.findUnique({
      where: { userId: team.ownerId },
      select: {
        id: true,
        providerCustomerId: true,
        subscriptions: {
          select: {
            id: true,
            plan: true,
            status: true,
            providerSubscriptionId: true,
            currentPeriodEnd: true,
          },
        },
      },
    });
    if (!cust) {
      skipped++;
      console.log(`SKIP   ${team.id} "${team.name}" — owner has no Stripe customer`);
      continue;
    }

    const teamSub = pickTeamSub(cust.subscriptions);
    if (!teamSub) {
      warned++;
      console.log(`WARN   ${team.id} "${team.name}" — owner customer has no TEAMS subscription`);
      continue;
    }

    // Stripe cannot move a subscription between customers. If the owner's single
    // Stripe customer also carries an ACTIVE non-Teams plan, re-anchoring the
    // customer to the group would drag the personal plan along. Flag for manual
    // handling (split = cancel + recreate) rather than corrupt billing.
    const sharedActive = cust.subscriptions.find(
      (s) => s.plan !== "TEAMS" && ACTIVE.includes(s.status),
    );
    if (sharedActive) {
      warned++;
      console.log(
        `WARN   ${team.id} "${team.name}" — owner customer ${cust.providerCustomerId} also has active ${sharedActive.plan}; ` +
          `manual split required (Stripe can't move a sub between customers). SKIPPED.`,
      );
      continue;
    }

    const teamsActive = ACTIVE.includes(teamSub.status);
    console.log(
      `${APPLY ? "MIGRATE" : "PLAN   "} ${team.id} "${team.name}" — cust=${cust.providerCustomerId} ` +
        `sub=${teamSub.providerSubscriptionId} (${teamSub.status}) teamsEnabled→${teamsActive}`,
    );

    if (APPLY) {
      // 1. Stripe first (informational; DB is source of truth). Clearing
      //    kontaxUserId (set to "") removes the key so the customer reads as org.
      await stripe.customers.update(cust.providerCustomerId, {
        metadata: { kontaxGroupId: team.id, kontaxUserId: "" },
      });
      // 2. DB flip — atomic. Each row update keeps exactly-one-owner (CHECK).
      await db.$transaction([
        db.subscriptionCustomer.update({
          where: { id: cust.id },
          data: { groupId: team.id, userId: null },
        }),
        db.subscription.update({
          where: { id: teamSub.id },
          data: { groupId: team.id, userId: null },
        }),
        db.group.update({
          where: { id: team.id },
          data: { subscriptionId: teamSub.id, teamsEnabled: teamsActive },
        }),
      ]);
    }

    log.push({
      groupId: team.id,
      customerId: cust.providerCustomerId,
      subscriptionId: teamSub.id,
      previousUserId: team.ownerId,
      teamsActive,
    });
    migrated++;
  }

  if (APPLY && log.length) {
    mkdirSync("scripts/out", { recursive: true });
    const file = `scripts/out/teams-billing-migration-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    writeFileSync(file, JSON.stringify(log, null, 2));
    console.log(`\nMigration log (for rollback): ${file}`);
  }

  console.log(
    `\n${APPLY ? "Applied" : "Dry-run"}: migrated=${migrated} skipped=${skipped} warned=${warned} (of ${teams.length} teams)`,
  );
  if (!APPLY) console.log("Re-run with --apply to execute (requires STRIPE_SECRET_KEY).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
