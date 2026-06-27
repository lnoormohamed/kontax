import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminAccessPanel } from "../_components/admin-access-panel";
import { assertAdmin } from "~/server/admin/guard";
import { buildAdminAuditHref, loadAdminAudit } from "~/server/admin/audit";
import {
  ADMIN_AUDIT_VIEWS,
  adminAuditViewDefaults,
  normalizeAdminAuditViewId,
} from "~/server/admin/saved-views";
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
  const view = normalizeAdminAuditViewId(typeof sp.view === "string" ? sp.view : undefined);
  const defaults = adminAuditViewDefaults(view);
  const action = typeof sp.action === "string" ? sp.action : defaults.action;
  const actor = typeof sp.actor === "string" ? sp.actor : defaults.actor;
  const target = typeof sp.target === "string" ? sp.target : defaults.target;
  const entity = typeof sp.entity === "string" ? sp.entity : defaults.entity;
  const severity = typeof sp.severity === "string" ? sp.severity : defaults.severity;
  const q = typeof sp.q === "string" ? sp.q : defaults.q;
  const range = typeof sp.range === "string" ? sp.range : defaults.range;
  const page = typeof sp.page === "string" ? Math.max(0, parseInt(sp.page, 10) || 0) : 0;

  const data = admin.capabilities["audit.view"]
    ? await loadAdminAudit({ action, actor, target, entity, severity: severity as "all" | "high" | "standard", q, range, page })
    : null;

  const buildHref = (p: number) => {
    const href = buildAdminAuditHref({ action, actor, target, entity, severity, q, range });
    if (p <= 0) return href;
    return `${href}${href.includes("?") ? "&" : "?"}page=${p}`;
  };

  const start = data ? data.page * data.pageSize : 0;

  return (
    <>
      <AdminHeader
        title="Audit log"
        adminName={admin.name}
        adminRoleLabel={admin.tierLabel}
        crumbs={[{ label: "Governance" }]}
      />
      <div className="adm-content">
        <div className="ad-page">
          {!admin.capabilities["audit.view"] || !data ? (
            <AdminAccessPanel
              title="Audit log access is unavailable"
              body="The audit log is limited to governance admins because it exposes privileged history across support, billing, sync, and platform controls."
              requiredTierLabel="Governance"
              currentTierLabel={admin.tierLabel}
              policySource={admin.policySource}
            />
          ) : (
            <>
          <div className="ad-section-label">Saved views</div>
          <div className="ad-support-tabs">
            {ADMIN_AUDIT_VIEWS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="ad-support-tab"
                data-active={view === item.id ? "1" : "0"}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <AuditFilters
            actionTypes={data.actionTypes}
            actors={data.actors}
            current={{ action, actor, target, entity, severity, q, range }}
          />

          <div className="ad-result-meta" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>
              {data.total} audit event{data.total === 1 ? "" : "s"} matched
            </span>
            <Link
              href={`/admin/audit/export${buildAdminAuditHref({ action, actor, target, entity, severity, q, range }).replace("/admin/audit", "")}`}
              className="ad-btn ad-btn--secondary ad-btn--sm"
            >
              Export CSV
            </Link>
          </div>

          <div className="ad-table-wrap ad-table-wrap--dense">
            <div className="ad-tr ad-thead ad-tr--audit">
              <span>Timestamp</span>
              <span>Admin</span>
              <span>Action</span>
              <span>Target user</span>
              <span>Severity</span>
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
                    severity: r.severity,
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
