import { NotificationBell } from "~/app/_components/notification-bell";
import { getNotificationFeed } from "~/server/notifications";

/**
 * Server slot: resolves the current user's notification feed and renders the
 * header bell. Replaces the legacy pending-shares bell in the app + settings
 * shells (P22-DB05 Resolution 1).
 */
export async function NotificationBellSlot({ userId }: { userId: string }) {
  const feed = await getNotificationFeed(userId);
  const items = feed.map((n) => ({
    id: n.id,
    category: n.category,
    title: n.title,
    body: n.body,
    read: n.read,
    actionUrl: n.actionUrl,
    securityAlertId: n.securityAlertId,
    createdAt: n.createdAt.toISOString(),
  }));
  return <NotificationBell initialItems={items} />;
}
