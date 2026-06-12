import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import { searchUsers } from "~/server/admin/users";
import { AdminHeader } from "../_components/admin-header";
import { AdIcon } from "../_components/admin-icons";
import { Avatar } from "../_components/avatar";
import { PlanPill, StatusPill } from "../_components/pills";
import { UserSearch } from "./user-search";

export const dynamic = "force-dynamic";

function TableSkeleton() {
  return (
    <>
      <div className="ad-result-meta">Searching…</div>
      <div className="ad-table-wrap">
        <div className="ad-tr ad-thead ad-tr--users">
          <span>Email</span>
          <span>Name</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Joined</span>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="ad-tr ad-tr--users">
            <span className="ad-cell-email">
              <span className="ad-skel ad-skel-av" />
              <span className="ad-skel" style={{ width: "70%" }} />
            </span>
            <span><span className="ad-skel" style={{ width: "60%" }} /></span>
            <span><span className="ad-skel ad-skel-pill" /></span>
            <span><span className="ad-skel ad-skel-pill" /></span>
            <span><span className="ad-skel" style={{ width: 64 }} /></span>
          </div>
        ))}
      </div>
    </>
  );
}

async function Results({ q }: { q: string }) {
  let rows;
  try {
    rows = await searchUsers(q);
  } catch {
    return (
      <div className="ad-table-wrap">
        <div className="ad-table-state">
          <span className="ad-state-icon ad-state-icon--err">
            <AdIcon name="warn" size={22} c="#dc2626" />
          </span>
          <div className="ad-state-title">Couldn&rsquo;t load users</div>
          <div className="ad-state-sub">The search service returned an error. Please try again.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="ad-result-meta">
        {rows.length} user{rows.length === 1 ? "" : "s"}
        {q ? ` matching “${q}”` : ""}
      </div>
      <div className="ad-table-wrap">
        <div className="ad-tr ad-thead ad-tr--users">
          <span>Email</span>
          <span>Name</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Joined</span>
        </div>

        {rows.length === 0 ? (
          <div className="ad-table-state">
            <span className="ad-state-icon">
              <AdIcon name="search" size={22} c="#8b938c" />
            </span>
            <div className="ad-state-title">No users found for “{q || "this query"}”</div>
            <div className="ad-state-sub">Try a different email or name.</div>
          </div>
        ) : (
          rows.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`} className="ad-tr ad-tr--users ad-row">
              <span className="ad-cell-email" data-th="Email">
                <Avatar name={u.name} size={28} />
                <span className="ad-link">{u.email}</span>
              </span>
              <span className="ad-cell" data-th="Name">{u.name}</span>
              <span data-th="Plan"><PlanPill plan={u.plan} /></span>
              <span data-th="Status"><StatusPill status={u.status} /></span>
              <span className="ad-cell-muted tnum" data-th="Joined">{u.joined}</span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let admin;
  try {
    admin = await assertAdmin();
  } catch {
    redirect("/contacts");
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";

  return (
    <>
      <AdminHeader title="Users" adminName={admin.name} />
      <div className="adm-content">
        <div className="ad-page">
          <UserSearch initial={q} />
          <Suspense key={q} fallback={<TableSkeleton />}>
            <Results q={q} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
