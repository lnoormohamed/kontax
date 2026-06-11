"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export interface SessionSummary {
  id: string;
  deviceHint: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

export async function listActiveSessions(): Promise<SessionSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const currentJti = (session as { jti?: string }).jti;

  const rows = await db.userSession.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { lastActiveAt: "desc" },
    select: { id: true, deviceHint: true, ipAddress: true, lastActiveAt: true, createdAt: true, jti: true },
  });

  return rows.map((r) => ({
    id: r.id,
    deviceHint: r.deviceHint,
    ipAddress: r.ipAddress,
    lastActiveAt: r.lastActiveAt,
    createdAt: r.createdAt,
    isCurrent: r.jti === currentJti,
  }));
}

export async function revokeSession(
  sessionId: string,
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };

  const currentJti = (session as { jti?: string }).jti;

  const row = await db.userSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
    select: { jti: true },
  });

  if (!row) return { error: "SESSION_NOT_FOUND" };
  if (row.jti === currentJti) return { error: "CANNOT_REVOKE_CURRENT_SESSION" };

  await db.userSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  await db.activityEvent.create({
    data: {
      userId: session.user.id,
      eventType: "ACCOUNT_UPDATED",
      actor: "USER",
      payload: { field: "sessionRevoked", sessionId },
    },
  });

  return { success: true };
}

export async function revokeAllOtherSessions(): Promise<{ revokedCount: number }> {
  const session = await auth();
  if (!session?.user?.id) return { revokedCount: 0 };

  const currentJti = (session as { jti?: string }).jti;

  const result = await db.userSession.updateMany({
    where: {
      userId: session.user.id,
      revokedAt: null,
      ...(currentJti ? { NOT: { jti: currentJti } } : {}),
    },
    data: { revokedAt: new Date() },
  });

  if (result.count > 0) {
    await db.activityEvent.create({
      data: {
        userId: session.user.id,
        eventType: "ACCOUNT_UPDATED",
        actor: "USER",
        payload: { field: "allOtherSessionsRevoked", count: result.count },
      },
    });
  }

  return { revokedCount: result.count };
}
