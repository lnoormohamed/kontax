import { BillingBanner } from "~/app/_components/billing-banner";
import { getBillingBanner } from "~/server/billing-surface";

/**
 * Server slot that resolves the billing banner for the current user and renders
 * it pinned below the top nav. Renders nothing when there's no billing issue.
 */
export async function BillingBannerSlot({ userId }: { userId: string }) {
  const banner = await getBillingBanner(userId);
  if (!banner) return null;
  return <BillingBanner daysRemaining={banner.daysRemaining} variant={banner.variant} />;
}
