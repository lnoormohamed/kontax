import type { Prisma, PrismaClient } from "../../generated/prisma";
import { SharedBookPermissionKind } from "../../generated/prisma";
import { db } from "~/server/db";

type AuditWriter = Prisma.TransactionClient | Pick<PrismaClient, "sharedBookPermissionAuditEvent">;

type RecordPermissionAuditInput = {
  groupId: string;
  groupType: "FAMILY" | "TEAM";
  groupName: string;
  groupAddressBookId?: string | null;
  groupAddressBookName?: string | null;
  actorUserId: string;
  actorName: string;
  targetMemberId: string;
  targetUserId?: string | null;
  targetName: string;
  permissionKind: SharedBookPermissionKind;
  beforeValue?: string | null;
  afterValue: string;
};

export async function recordSharedBookPermissionAudit(
  client: AuditWriter,
  input: RecordPermissionAuditInput,
) {
  return client.sharedBookPermissionAuditEvent.create({
    data: {
      groupId: input.groupId,
      groupType: input.groupType,
      groupName: input.groupName,
      groupAddressBookId: input.groupAddressBookId ?? null,
      groupAddressBookName: input.groupAddressBookName ?? null,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      targetMemberId: input.targetMemberId,
      targetUserId: input.targetUserId ?? null,
      targetName: input.targetName,
      permissionKind: input.permissionKind,
      beforeValue: input.beforeValue ?? null,
      afterValue: input.afterValue,
    },
  });
}

export async function loadSharedBookPermissionAudit(
  groupIds: string[],
  limit = 12,
) {
  if (groupIds.length === 0) return [];
  return db.sharedBookPermissionAuditEvent.findMany({
    where: { groupId: { in: groupIds } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function describePermissionValue(value: string | null | undefined) {
  if (!value) return "No access";
  if (value === "EDIT") return "Can edit";
  if (value === "VIEW") return "View only";
  if (value === "NONE") return "No access";
  return value;
}
