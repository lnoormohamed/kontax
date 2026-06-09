import { actorIconName, formatActorLabel, formatEventSummary } from "~/lib/activity/formatters";
import { auth } from "~/server/auth";
import { getUserBillingContext, isActivityLogEnabled } from "~/server/billing";
import { db } from "~/server/db";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
// Free plan: per-contact history shows only the most recent N events (P11-01),
// enforced at query time — older events are kept in the DB, just not surfaced.
const FREE_HISTORY_CAP = 10;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id: contactId } = await params;

  // Ownership: the contact must belong to the requester. (Events for a
  // hard-deleted contact have contactId=null and are not reachable here.)
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });

  if (!contact) {
    return Response.json({ message: "Not found" }, { status: 403 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  // Free plan caps per-contact history to the last N events with no pagination.
  const billing = await getUserBillingContext(userId);
  const capped = !isActivityLogEnabled(billing.entitlements);
  const effectiveLimit = capped ? Math.min(limit, FREE_HISTORY_CAP) : limit;
  const cursorDate = capped || !cursor ? null : new Date(cursor);

  const rows = await db.activityEvent.findMany({
    where: {
      contactId,
      userId,
      ...(cursorDate && !Number.isNaN(cursorDate.getTime())
        ? { createdAt: { lt: cursorDate } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: effectiveLimit + 1,
  });

  const hasMore = !capped && rows.length > effectiveLimit;
  const page = rows.slice(0, effectiveLimit);

  const events = page.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    actor: event.actor,
    actorDetail: event.actorDetail,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
    summary: formatEventSummary(event.eventType, event.payload, event.actorDetail),
    actorLabel: formatActorLabel(event.actor, event.actorDetail),
    actorIcon: actorIconName(event.actor),
  }));

  return Response.json({
    events,
    nextCursor: hasMore ? page[page.length - 1]?.createdAt.toISOString() ?? null : null,
    hasMore,
  });
}
