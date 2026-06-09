import type { Actor, EventType, Prisma } from "../../../../generated/prisma";
import { actorIconName, formatActorLabel, formatEventSummary } from "~/lib/activity/formatters";
import { auth } from "~/server/auth";
import { getUserBillingContext, isActivityLogEnabled } from "~/server/billing";
import { db } from "~/server/db";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Event-type categories used by the filter bar.
const CATEGORY_EVENT_TYPES: Record<string, EventType[]> = {
  edits: [
    "CONTACT_CREATED",
    "CONTACT_UPDATED",
    "CONTACT_ARCHIVED",
    "CONTACT_RESTORED",
    "CONTACT_DELETED",
  ],
  sync: ["SYNC_PULLED", "SYNC_PUSHED", "SYNC_CONFLICT_DETECTED", "SYNC_CONFLICT_RESOLVED"],
  imports: ["CONTACT_IMPORTED"],
  merges: ["CONTACT_MERGED", "CONTACT_MERGE_UNDONE"],
  shares: ["CONTACT_SHARED", "CONTACT_SHARE_RECEIVED"],
};

// Actor groups used by the filter bar.
const ACTOR_GROUPS: Record<string, Actor[]> = {
  you: ["USER"],
  sync: ["SYNC"],
  import: ["IMPORT"],
  shared: ["SHARE", "FAMILY_MEMBER", "TEAM_MEMBER"],
};

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Plan gate: the global activity feed is available to Pro/Family/Teams (any
  // plan with non-zero activity retention). Free is blocked server-side (the
  // client also renders a locked state).
  const billing = await getUserBillingContext(userId);
  if (!isActivityLogEnabled(billing.entitlements)) {
    return Response.json({ message: "Upgrade required", gated: true }, { status: 403 });
  }
  // Retention window by tier: Pro 90d, Family 365d, Teams unlimited (null).
  const retentionDays = billing.entitlements.activityLogRetentionDays;

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const category = url.searchParams.get("category");
  const actor = url.searchParams.get("actor");
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const cursorDate = cursor ? new Date(cursor) : null;
  const hasCursor = cursorDate != null && !Number.isNaN(cursorDate.getTime());

  // Retention lower bound — omitted entirely for unlimited (Teams, null).
  const createdAtFilter: Prisma.DateTimeFilter = {};
  if (retentionDays !== null && retentionDays > 0) {
    const retentionStart = new Date();
    retentionStart.setDate(retentionStart.getDate() - retentionDays);
    createdAtFilter.gte = retentionStart;
  }
  if (hasCursor) {
    createdAtFilter.lt = cursorDate!;
  }

  const eventTypeFilter =
    category && category !== "all" && CATEGORY_EVENT_TYPES[category]
      ? { eventType: { in: CATEGORY_EVENT_TYPES[category] } }
      : {};
  const actorFilter =
    actor && actor !== "all" && ACTOR_GROUPS[actor]
      ? { actor: { in: ACTOR_GROUPS[actor] } }
      : {};

  const rows = await db.activityEvent.findMany({
    where: {
      userId,
      createdAt: createdAtFilter,
      ...eventTypeFilter,
      ...actorFilter,
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      contact: { select: { id: true, fullName: true } },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const events = page.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    actor: event.actor,
    actorDetail: event.actorDetail,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
    contactId: event.contact?.id ?? null,
    contactName: event.contact?.fullName ?? null,
    summary: formatEventSummary(event.eventType, event.payload, event.actorDetail),
    actorLabel: formatActorLabel(event.actor, event.actorDetail),
    actorIcon: actorIconName(event.actor),
  }));

  return Response.json({
    events,
    nextCursor: hasMore ? (page[page.length - 1]?.createdAt.toISOString() ?? null) : null,
    hasMore,
    retentionDays,
  });
}
