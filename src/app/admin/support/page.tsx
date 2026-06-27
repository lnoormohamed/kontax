import Link from "next/link";
import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import { loadAdminSupportCaseWorkbench } from "~/server/admin/support-cases";
import { AdminHeader } from "../_components/admin-header";
import { AD, AdIcon } from "../_components/admin-icons";
import { SupportWorkbench } from "./support-workbench";

export const dynamic = "force-dynamic";

function supportHref(params: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `/admin/support?${qs}` : "/admin/support";
}

export default async function AdminSupportPage({
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
  const data = await loadAdminSupportCaseWorkbench({
    adminId: admin.adminId,
    queue: typeof sp.queue === "string" ? sp.queue : undefined,
    status: typeof sp.status === "string" ? sp.status : undefined,
    severity: typeof sp.severity === "string" ? sp.severity : undefined,
    owner: typeof sp.owner === "string" ? sp.owner : undefined,
    subjectType: typeof sp.subjectType === "string" ? sp.subjectType : undefined,
    q: typeof sp.q === "string" ? sp.q : undefined,
  });

  return (
    <>
      <AdminHeader
        title="Support inbox"
        adminName={admin.name}
        crumbs={[{ label: "Operations" }]}
        showSearch={false}
      />
      <div className="adm-content">
        <div className="ad-page">
          <div className="ad-support-summary">
            <div className="ad-support-summary__card">
              <div className="ad-support-summary__label">Open</div>
              <div className="ad-support-summary__value tnum">{data.summary.open}</div>
              <div className="ad-support-summary__sub">Actionable cases across all operators</div>
            </div>
            <div className="ad-support-summary__card">
              <div className="ad-support-summary__label">Unassigned</div>
              <div className="ad-support-summary__value tnum">{data.summary.unassigned}</div>
              <div className="ad-support-summary__sub">Triage work not owned yet</div>
            </div>
            <div className="ad-support-summary__card">
              <div className="ad-support-summary__label">Overdue</div>
              <div className="ad-support-summary__value tnum">{data.summary.overdue}</div>
              <div className="ad-support-summary__sub">Past-due follow-ups in UTC</div>
            </div>
            <div className="ad-support-summary__card">
              <div className="ad-support-summary__label">Due today</div>
              <div className="ad-support-summary__value tnum">{data.summary.dueToday}</div>
              <div className="ad-support-summary__sub">Follow-ups due before tomorrow UTC</div>
            </div>
          </div>

          <div className="ad-section-label">Saved queues</div>
          <div className="ad-support-tabs">
            {data.queueTabs.map((tab) => (
              <Link
                key={tab.id}
                href={supportHref({ queue: tab.id })}
                className="ad-support-tab"
                data-active={data.filters.queue === tab.id ? "1" : "0"}
              >
                <span>{tab.label}</span>
                <span className="ad-support-tab__count tnum">{tab.count}</span>
              </Link>
            ))}
          </div>

          <form className="ad-filterbar" method="get">
            <input type="hidden" name="queue" value={data.filters.queue} />
            <div className="ad-select-wrap">
              <select className="ad-select" name="status" defaultValue={data.filters.status}>
                <option value="all">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="WAITING_ON_CUSTOMER">Waiting on customer</option>
                <option value="WAITING_ON_PROVIDER">Waiting on provider</option>
                <option value="RESOLVED">Resolved</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <AdIcon name="chevd" size={14} c={AD.mute} />
            </div>
            <div className="ad-select-wrap">
              <select className="ad-select" name="severity" defaultValue={data.filters.severity}>
                <option value="all">All severities</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
              <AdIcon name="chevd" size={14} c={AD.mute} />
            </div>
            <div className="ad-select-wrap">
              <select className="ad-select" name="owner" defaultValue={data.filters.owner}>
                <option value="all">All owners</option>
                <option value="me">Assigned to me</option>
                <option value="assigned">Assigned to anyone</option>
                <option value="unassigned">Unassigned</option>
              </select>
              <AdIcon name="chevd" size={14} c={AD.mute} />
            </div>
            <div className="ad-select-wrap">
              <select className="ad-select" name="subjectType" defaultValue={data.filters.subjectType}>
                <option value="all">All subject types</option>
                <option value="USER">User</option>
                <option value="SYNC_ACCOUNT">Sync account</option>
              </select>
              <AdIcon name="chevd" size={14} c={AD.mute} />
            </div>
            <div className="ad-filter-search">
              <AdIcon name="search" size={15} c={AD.mute} />
              <input
                name="q"
                type="search"
                placeholder="Search title, summary, user, owner, or record id"
                defaultValue={data.filters.q}
              />
            </div>
            <button className="ad-btn ad-btn--secondary ad-btn--sm" type="submit">
              Apply
            </button>
          </form>

          <div className="ad-support-toolbar-note">
            <AdIcon name="calendar" size={15} c={AD.mute} />
            <span>Follow-up times are shown and edited in UTC so queue urgency stays consistent across operators.</span>
          </div>

          <div className="ad-result-meta">
            {data.rows.length} case{data.rows.length === 1 ? "" : "s"} in the{" "}
            {data.queueTabs.find((tab) => tab.id === data.filters.queue)?.label.toLowerCase() ?? "open"} queue
          </div>

          <SupportWorkbench rows={data.rows} />
        </div>
      </div>
    </>
  );
}
