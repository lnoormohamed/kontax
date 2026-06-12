import { SecurityAlertBanner } from "~/app/_components/security-alert-banner";
import { getActiveSecurityAlerts } from "~/server/notifications";

/**
 * Server slot: resolves the current user's active (unresolved) security alerts
 * and renders the banner pinned below the billing banner. Renders nothing when
 * there are no active alerts (P22-DB05 surface 4).
 */
export async function SecurityAlertBannerSlot({ userId }: { userId: string }) {
  const alerts = await getActiveSecurityAlerts(userId);
  if (alerts.length === 0) return null;
  return (
    <SecurityAlertBanner
      alerts={alerts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
    />
  );
}
