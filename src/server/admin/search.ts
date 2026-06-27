import "server-only";

import { buildAdminAuditHref, loadAuditSearchTargets } from "~/server/admin/audit";
import {
  adminSupportCaseSeverityLabel,
  adminSupportCaseStatusLabel,
} from "~/server/admin/support-cases";
import { db } from "~/server/db";

type SearchResultItem = {
  id: string;
  title: string;
  sub: string;
  href: string;
};

type RankedSearchResult = SearchResultItem & {
  score: number;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function scoreValue(query: string, value: string | null | undefined, boost = 0) {
  if (!value) return 0;
  const hay = normalize(value);
  if (!hay) return 0;
  if (hay === query) return 120 + boost;
  if (hay.startsWith(query)) return 80 + boost;
  if (hay.includes(query)) return 45 + boost;
  return 0;
}

function rankResult(
  query: string,
  item: SearchResultItem,
  fields: Array<{ value: string | null | undefined; boost?: number }>,
) {
  const score = fields.reduce(
    (best, field) => Math.max(best, scoreValue(query, field.value, field.boost ?? 0)),
    0,
  );
  return score > 0 ? { ...item, score } : null;
}

function sortRanked(items: Array<RankedSearchResult | null>, limit = 8) {
  return items
    .filter((item): item is RankedSearchResult => !!item)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);
}

export async function searchAdminEntities(query: string) {
  const q = query.trim();
  const needle = normalize(q);
  if (!needle) {
    return {
      query: "",
      total: 0,
      users: [],
      supportCases: [],
      syncConnections: [],
      broadcasts: [],
      groups: [],
      featureFlags: [],
      auditTargets: [],
    };
  }

  const [users, supportCases, syncConnections, broadcasts, groups, featureFlags, auditTargets] =
    await Promise.all([
      db.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { id: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, email: true, name: true, role: true },
      }),
      db.adminSupportCase.findMany({
        where: {
          archivedAt: null,
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { subjectId: { contains: q, mode: "insensitive" } },
            { targetUser: { email: { contains: q, mode: "insensitive" } } },
            { targetUser: { name: { contains: q, mode: "insensitive" } } },
            { assignee: { email: { contains: q, mode: "insensitive" } } },
            { assignee: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 20,
        select: {
          id: true,
          title: true,
          summary: true,
          status: true,
          severity: true,
          targetUser: { select: { email: true, name: true } },
          assignee: { select: { email: true, name: true } },
        },
      }),
      db.syncAccount.findMany({
        where: {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { label: { contains: q, mode: "insensitive" } },
            { connectionId: { contains: q, mode: "insensitive" } },
            { remoteAccountId: { contains: q, mode: "insensitive" } },
            { baseUrl: { contains: q, mode: "insensitive" } },
            { addressBookUrl: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          label: true,
          connectionId: true,
          remoteAccountId: true,
          provider: true,
          status: true,
          baseUrl: true,
          addressBookUrl: true,
          user: { select: { email: true, name: true } },
        },
      }),
      db.adminBroadcast.findMany({
        where: {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: [{ createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          previewRecipientCount: true,
          deliveredRecipientCount: true,
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
        take: 16,
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
            { id: { contains: q, mode: "insensitive" } },
            { key: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { owner: { contains: q, mode: "insensitive" } },
            { purpose: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          key: true,
          name: true,
          mode: true,
          owner: true,
          purpose: true,
        },
      }),
      loadAuditSearchTargets(q, 12),
    ]);

  const userResults = sortRanked(
    users.map((user) =>
      rankResult(
        needle,
        {
          id: user.id,
          title: user.email,
          sub: `${user.name?.trim() ?? "No name"} · ${user.role}`,
          href: `/admin/users/${user.id}`,
        },
        [
          { value: user.email, boost: 25 },
          { value: user.id, boost: 30 },
          { value: user.name, boost: 10 },
        ],
      ),
    ),
  );

  const supportCaseResults = sortRanked(
    supportCases.map((supportCase) =>
      rankResult(
        needle,
        {
          id: supportCase.id,
          title: supportCase.title,
          sub: `${adminSupportCaseStatusLabel(supportCase.status)} · ${adminSupportCaseSeverityLabel(supportCase.severity)} · ${supportCase.targetUser?.email ?? supportCase.assignee?.email ?? "No target email"}`,
          href: `/admin/support?q=${encodeURIComponent(supportCase.id)}`,
        },
        [
          { value: supportCase.id, boost: 35 },
          { value: supportCase.title, boost: 20 },
          { value: supportCase.summary, boost: 8 },
          { value: supportCase.targetUser?.email, boost: 20 },
          { value: supportCase.targetUser?.name, boost: 12 },
          { value: supportCase.assignee?.email, boost: 10 },
          { value: supportCase.assignee?.name, boost: 6 },
        ],
      ),
    ),
  );

  const syncResults = sortRanked(
    syncConnections.map((sync) =>
      rankResult(
        needle,
        {
          id: sync.id,
          title: sync.label,
          sub: `${sync.provider} · ${sync.user.email}${sync.connectionId ? ` · ${sync.connectionId}` : ""}${sync.remoteAccountId ? ` · ${sync.remoteAccountId}` : ""}`,
          href: `/admin/sync/${sync.id}`,
        },
        [
          { value: sync.id, boost: 30 },
          { value: sync.connectionId, boost: 35 },
          { value: sync.remoteAccountId, boost: 24 },
          { value: sync.user.email, boost: 20 },
          { value: sync.user.name, boost: 12 },
          { value: sync.label, boost: 16 },
          { value: sync.baseUrl, boost: 14 },
          { value: sync.addressBookUrl, boost: 14 },
          { value: sync.provider, boost: 10 },
        ],
      ),
    ),
  );

  const broadcastResults = sortRanked(
    broadcasts.map((broadcast) =>
      rankResult(
        needle,
        {
          id: broadcast.id,
          title: broadcast.title,
          sub: `${broadcast.status} · preview ${broadcast.previewRecipientCount.toLocaleString()} · delivered ${broadcast.deliveredRecipientCount.toLocaleString()}`,
          href: `/admin/broadcast?q=${encodeURIComponent(broadcast.id)}`,
        },
        [
          { value: broadcast.id, boost: 35 },
          { value: broadcast.title, boost: 24 },
          { value: broadcast.status, boost: 6 },
        ],
      ),
    ),
  );

  const groupResults = sortRanked(
    groups.map((group) =>
      rankResult(
        needle,
        {
          id: group.id,
          title: group.name,
          sub: `${group.type} · owner ${group.owner.email}`,
          href: `/admin/users?q=${encodeURIComponent(group.owner.email)}`,
        },
        [
          { value: group.id, boost: 24 },
          { value: group.name, boost: 20 },
          { value: group.owner.email, boost: 10 },
        ],
      ),
    ),
  );

  const featureFlagResults = sortRanked(
    featureFlags.map((flag) =>
      rankResult(
        needle,
        {
          id: flag.id,
          title: flag.name,
          sub: `${flag.key} · ${flag.mode}${flag.owner ? ` · ${flag.owner}` : ""}`,
          href: `/admin/feature-flags?q=${encodeURIComponent(flag.key)}`,
        },
        [
          { value: flag.id, boost: 25 },
          { value: flag.key, boost: 35 },
          { value: flag.name, boost: 18 },
          { value: flag.owner, boost: 10 },
          { value: flag.purpose, boost: 8 },
        ],
      ),
    ),
  );

  const auditResults = sortRanked(
    auditTargets.map((target) =>
      rankResult(
        needle,
        {
          id: target.id,
          title: target.label,
          sub: target.action,
          href: target.href || buildAdminAuditHref({ q }),
        },
        [
          { value: target.label, boost: 18 },
          { value: target.action, boost: 8 },
        ],
      ),
    ),
    10,
  );

  const total = [
    userResults,
    supportCaseResults,
    syncResults,
    broadcastResults,
    groupResults,
    featureFlagResults,
    auditResults,
  ].reduce((sum, items) => sum + items.length, 0);

  return {
    query: q,
    total,
    users: userResults,
    supportCases: supportCaseResults,
    syncConnections: syncResults,
    broadcasts: broadcastResults,
    groups: groupResults,
    featureFlags: featureFlagResults,
    auditTargets: auditResults,
  };
}
