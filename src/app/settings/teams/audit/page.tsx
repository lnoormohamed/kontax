import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { AUDIT_EVENT_TYPES, loadTeamAudit } from "~/server/team-audit";
import { AuditTable } from "./audit-table";

const eventLabel = (t: string) =>
  ({
    CONTACT_CREATED: "Created",
    CONTACT_UPDATED: "Updated",
    CONTACT_ARCHIVED: "Archived",
    CONTACT_RESTORED: "Restored",
    CONTACT_MERGED: "Merged",
    CONTACT_IMPORTED: "Imported",
    SYNC_PUSHED: "Synced (push)",
    SYNC_PULLED: "Synced (pull)",
  })[t] ?? t;

const single = (v: string | string[] | undefined) => {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : undefined;
};

export default async function TeamAuditPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const sp = searchParams ? await searchParams : undefined;
  const filters = {
    memberId: single(sp?.member),
    bookId: single(sp?.book),
    eventType: single(sp?.type),
    from: single(sp?.from),
    to: single(sp?.to),
    cursor: single(sp?.cursor),
  };

  const data = await loadTeamAudit(session.user.id, filters);

  if (!data) {
    return (
      <div className="text-[#1d2823]">
        <Link className="text-sm font-semibold text-[#5c655e]" href="/settings/teams">
          ← Team
        </Link>
        <p className="mt-6 rounded-2xl border border-[#d8ddd6] bg-white p-6 text-center text-sm text-[#8b938c]">
          Only the team owner or an admin can view the audit log.
        </p>
      </div>
    );
  }

  const exportQuery = new URLSearchParams();
  if (filters.memberId) exportQuery.set("member", filters.memberId);
  if (filters.bookId) exportQuery.set("book", filters.bookId);
  if (filters.eventType) exportQuery.set("type", filters.eventType);
  if (filters.from) exportQuery.set("from", filters.from);
  if (filters.to) exportQuery.set("to", filters.to);

  return (
    <div className="text-[#1d2823]">
      <Link
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5c655e] transition hover:text-[#1d2823]"
        href="/settings/teams"
      >
        <WorkspaceIcon name="back" size={16} />
        Team
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Audit log</h1>
          <p className="mt-1 text-[13px] text-[#8b938c]">
            Every change to {data.team.name}&rsquo;s address books · full retention
          </p>
        </div>
        <a
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#d8ddd6] bg-white px-3.5 py-2 text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          download
          href={`/settings/teams/audit/export?${exportQuery.toString()}`}
        >
          <WorkspaceIcon name="download" size={16} />
          Export CSV
        </a>
      </div>

      {/* filter bar (GET form drives URL params) */}
      <form
        action="/settings/teams/audit"
        className="mt-5 flex flex-wrap items-end gap-2 rounded-[12px] border border-[#d8ddd6] bg-white p-3"
        method="get"
      >
        <select
          className="rounded-[9px] border border-[#d8ddd6] bg-white px-2.5 py-2 text-[13px]"
          defaultValue={filters.memberId ?? ""}
          name="member"
        >
          <option value="">All members</option>
          {data.members.map((m) => (
            <option key={m.userId} value={m.userId ?? ""}>
              {m.user?.name?.trim() ?? m.user?.email ?? "Member"}
            </option>
          ))}
        </select>
        <select
          className="rounded-[9px] border border-[#d8ddd6] bg-white px-2.5 py-2 text-[13px]"
          defaultValue={filters.bookId ?? ""}
          name="book"
        >
          <option value="">All books</option>
          {data.books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-[9px] border border-[#d8ddd6] bg-white px-2.5 py-2 text-[13px]"
          defaultValue={filters.eventType ?? ""}
          name="type"
        >
          <option value="">All events</option>
          {AUDIT_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {eventLabel(t)}
            </option>
          ))}
        </select>
        <input
          className="rounded-[9px] border border-[#d8ddd6] bg-white px-2.5 py-2 text-[13px]"
          defaultValue={filters.from ?? ""}
          name="from"
          type="date"
        />
        <input
          className="rounded-[9px] border border-[#d8ddd6] bg-white px-2.5 py-2 text-[13px]"
          defaultValue={filters.to ?? ""}
          name="to"
          type="date"
        />
        <button
          className="rounded-[9px] bg-[#4158f4] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#3248db]"
          type="submit"
        >
          Apply
        </button>
        <Link className="px-2 py-2 text-[13px] font-semibold text-[#5c655e]" href="/settings/teams/audit">
          Clear
        </Link>
      </form>

      <div className="mt-4">
        <AuditTable rows={data.rows} />
      </div>

      {data.nextCursor ? (
        <div className="mt-3 text-center">
          <Link
            className="inline-flex rounded-[9px] border border-[#d8ddd6] bg-white px-4 py-2 text-[13px] font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0]"
            href={`/settings/teams/audit?${new URLSearchParams({ ...Object.fromEntries(exportQuery), cursor: data.nextCursor }).toString()}`}
          >
            Load older
          </Link>
        </div>
      ) : null}
    </div>
  );
}
