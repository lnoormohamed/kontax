import Link from "next/link";
import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import { loadAdminAudit } from "~/server/admin/audit";
import { AdminHeader } from "../_components/admin-header";
import { AdIcon } from "../_components/admin-icons";
import { AuditFilters, AuditRow } from "./audit-client";

export const dynamic = "force-dynamic";

const fmtTs = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
    .format(d)
    .replace(",", ",")
    .replace(/(\d{4}), /, "$1 · ");

export default async function AdminAuditPage({
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
  const action = typeof sp.action === "string" ? sp.action : "all";
  const target = typeof sp.target === "string" ? sp.target : "";
  const range = typeof sp.range === "string" ? sp.range : "all";
  const page = typeof sp.page === "string" ? Math.max(0, parseInt(sp.page, 10) || 0) : 0;

  const data = await loadAdminAudit({ action, target, range, page });

  const buildHref = (p: number) => {
    const q = new URLSearchParams();
    if (action !== "all") q.set("action", action);
    if (target) q.set("target", target);
    if (range !== "all") q.set("range", range);
    if (p > 0) q.set("page", String(p));
    const s = q.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };

  const start = data.page * data.pageSize;

  return (
    <>
      <AdminHeader title="Audit log" adminName={admin.name} />
      <div className="adm-content">
        <div className="ad-page">
          <AuditFilters
            actionTypes={data.actionTypes}
            current={{ action, target, range }}
          />

          <div className="ad-table-wrap ad-table-wrap--dense">
            <div className="ad-tr ad-thead ad-tr--audit">
              <span>Timestamp</span>
              <span>Admin</span>
              <span>Action</span>
              <span>Target user</span>
              <span>Details</span>
            </div>

            {data.rows.length === 0 ? (
              <div className="ad-table-state">
                <span className="ad-state-icon">
                  <AdIcon name="audit" size={22} c="#8b938c" />
                </span>
                <div className="ad-state-title">No matching audit events</div>
                <div className="ad-state-sub">
                  Adjust the action type, date range, or target filter.
                </div>
              </div>
            ) : (
              data.rows.map((r) => (
                <AuditRow
                  key={r.id}
                  row={{
                    id: r.id,
                    ts: fmtTs(r.createdAt),
                    adminName: r.adminName,
                    action: r.action,
                    targetEmail: r.targetEmail,
                    details: r.details,
                  }}
                />
              ))
            )}
          </div>

          {data.total > 0 && (
            <div className="ad-pagination">
              <span className="ad-page-info">
                Showing{" "}
                <strong>
                  {start + 1}–{Math.min(start + data.pageSize, data.total)}
                </strong>{" "}
                of <strong>{data.total}</strong>
              </span>
              <div className="ad-page-nav">
                {data.page > 0 ? (
                  <Link className="ad-btn ad-btn--ghost ad-btn--sm" href={buildHref(data.page - 1)}>
                    ← Prev
                  </Link>
                ) : (
                  <button className="ad-btn ad-btn--ghost ad-btn--sm" disabled>
                    ← Prev
                  </button>
                )}
                <span className="ad-page-num">
                  Page {data.page + 1} of {data.pageCount}
                </span>
                {data.page < data.pageCount - 1 ? (
                  <Link className="ad-btn ad-btn--ghost ad-btn--sm" href={buildHref(data.page + 1)}>
                    Next →
                  </Link>
                ) : (
                  <button className="ad-btn ad-btn--ghost ad-btn--sm" disabled>
                    Next →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
