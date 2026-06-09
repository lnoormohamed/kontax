import type { Actor, EventType, Prisma, PrismaClient } from "../../../generated/prisma";

import { EVENT_PAYLOAD_SCHEMAS, type EventPayloadMap } from "./payload-schemas";

export { EVENT_PAYLOAD_SCHEMAS } from "./payload-schemas";
export type { FieldDiff, EventPayloadMap } from "./payload-schemas";

const ACTOR_DETAIL_MAX = 255;

/**
 * Anything with `.activityEvent.create` — a `PrismaClient` or an interactive
 * transaction client. Callers should pass their active transaction so the event
 * is written atomically with the mutation it records (P10-02).
 */
type ActivityWriter = Pick<PrismaClient, "activityEvent"> | Prisma.TransactionClient;

type EmitEventArgs<T extends EventType> = {
  userId: string;
  eventType: T;
  actor: Actor;
  contactId?: string | null;
  actorDetail?: string | null;
  payload?: EventPayloadMap[T];
};

/**
 * The single append-only write path for ActivityEvent (P10-01).
 *
 * Validates the payload against the schema for the event type, caps actorDetail,
 * and inserts one row. There is intentionally no update/delete counterpart —
 * the only place events are removed is the Phase 11 retention/pruning job.
 */
export async function emitEvent<T extends EventType>(
  client: ActivityWriter,
  { userId, eventType, actor, contactId, actorDetail, payload }: EmitEventArgs<T>,
) {
  const schema = EVENT_PAYLOAD_SCHEMAS[eventType];
  const validated = schema.parse(payload ?? {}) as Prisma.InputJsonValue;

  return client.activityEvent.create({
    data: {
      userId,
      eventType,
      actor,
      contactId: contactId ?? null,
      actorDetail: actorDetail ? actorDetail.slice(0, ACTOR_DETAIL_MAX) : null,
      payload: validated,
    },
  });
}
