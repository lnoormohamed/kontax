import "server-only";

import { buildAdminAuditHref, loadAuditSearchTargets } from "~/server/admin/audit";
import { db } from "~/server/db";

export async function searchAdminEntities(query: string) {
  const q = query.trim();
  if (!q) {
    return {
      query: "",
      users: [],
      syncConnections: [],
      groups: [],
      featureFlags: [],
      auditTargets: [],
    };
  }

  const [users, syncConnections, groups, featureFlags, auditTargets] = await Promise.all([
    db.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, email: true, name: true, role: true },
    }),
    db.syncAccount.findMany({
      where: {
        OR: [
          { label: { contains: q, mode: "insensitive" } },
          { connectionId: { contains: q, mode: "insensitive" } },
          { remoteAccountId: { contains: q, mode: "insensitive" } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        label: true,
        connectionId: true,
        provider: true,
        status: true,
        user: { select: { email: true } },
      },
    }),
    db.group.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        type: true,
        owner: { select: { email: true } },
      },
    }),
    db.featureFlag.findMany({
      where: {
        OR: [
          { key: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { owner: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        key: true,
        name: true,
        mode: true,
        owner: true,
      },
    }),
    loadAuditSearchTargets(q, 8),
  ]);

  return {
    query: q,
    users: users.map((user) => ({
      id: user.id,
      title: user.email,
      sub: `${user.name?.trim() ?? "No name"} · ${user.role}`,
      href: `/admin/users/${user.id}`,
    })),
    syncConnections: syncConnections.map((sync) => ({
      id: sync.id,
      title: sync.label,
      sub: `${sync.provider} · ${sync.user.email}${sync.connectionId ? ` · ${sync.connectionId}` : ""}`,
      href: `/admin/sync/${sync.id}`,
    })),
    groups: groups.map((group) => ({
      id: group.id,
      title: group.name,
      sub: `${group.type} · owner ${group.owner.email}`,
      href: `/admin/users?q=${encodeURIComponent(group.owner.email)}`,
    })),
    featureFlags: featureFlags.map((flag) => ({
      id: flag.id,
      title: flag.name,
      sub: `${flag.key} · ${flag.mode}${flag.owner ? ` · ${flag.owner}` : ""}`,
      href: `/admin/feature-flags`,
    })),
    auditTargets: auditTargets.map((target) => ({
      id: target.id,
      title: target.label,
      sub: target.action,
      href: target.href || buildAdminAuditHref({ q }),
    })),
  };
}
