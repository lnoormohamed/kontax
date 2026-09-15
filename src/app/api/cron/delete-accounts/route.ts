import { type NextRequest, NextResponse } from "next/server";

import { invalidateDavCredentialCacheForUser } from "~/server/app-passwords";
import { cancelBillingForDeletedUser } from "~/server/billing-lifecycle";
import { assertCronSecret } from "~/server/cron-guard";
import { db } from "~/server/db";
import { sendAccountDeletionConfirmationEmail } from "~/server/deletion-notifications";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  // P48-02: key the sweep on `scheduledDeleteAt` alone. A user-initiated
  // deletion now leaves the account ACTIVE (so the user can sign back in and
  // cancel), while an admin suspension stays LOCKED — both set
  // `scheduledDeleteAt`, and both must be collected once the date passes.
  // Filtering on lifecycleState would silently skip every self-service
  // deletion.
  const due = await db.user.findMany({
    where: {
      scheduledDeleteAt: { lte: new Date() },
    },
    select: { id: true, email: true },
  });

  let deleted = 0;
  const errors: string[] = [];

  for (const user of due) {
    // Capture email before the row is gone
    const email = user.email;
    const deletedAt = new Date();

    try {
      // P48-14: cancel Stripe *before* the delete. SubscriptionCustomer.user
      // and Subscription.user both cascade, so once the row is gone we no
      // longer know which Stripe customer to stop — and Stripe would keep
      // charging a card for an account that no longer exists. Best-effort and
      // non-throwing by design (see billing-lifecycle.ts): a Stripe outage
      // logs for manual reconciliation rather than stalling the sweep.
      await cancelBillingForDeletedUser(user.id);
      // P48-09: a cached DAV credential must not outlive the row it points at.
      await invalidateDavCredentialCacheForUser(user.id);

      await db.user.delete({ where: { id: user.id } });
      // Cascade deletes all child records via Prisma onDelete: Cascade
      deleted++;
      console.log(`[Kontax] Hard-deleted account ${user.id} (${email})`);

      // Fire-and-forget — a failed send does not re-trigger deletion
      void sendAccountDeletionConfirmationEmail({ email, deletedAt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${user.id}: ${msg}`);
      console.error(`[Kontax] Failed to delete account ${user.id}:`, err);
    }
  }

  return NextResponse.json({ deleted, errors, scanned: due.length });
}
