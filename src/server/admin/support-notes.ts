import "server-only";

import { db } from "~/server/db";

const fmtRelative = (date: Date) => {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

export async function listAdminSupportNotes(input: {
  subjectType: string;
  subjectId: string;
  limit?: number;
}) {
  const rows = await db.adminSupportNote.findMany({
    where: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 20,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    when: fmtRelative(row.createdAt),
    author: row.author.name?.trim() ?? row.author.email,
  }));
}

export async function listUserSupportTimeline(targetUserId: string, limit = 24) {
  const rows = await db.adminSupportNote.findMany({
    where: { targetUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      subjectType: true,
      subjectId: true,
      body: true,
      createdAt: true,
      author: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    body: row.body,
    createdAt: row.createdAt,
    when: fmtRelative(row.createdAt),
    author: row.author.name?.trim() ?? row.author.email,
  }));
}
