import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminHeader } from "./_components/admin-header";
import { AD, AdIcon } from "./_components/admin-icons";
import { loadAdminOverview } from "~/server/admin/dashboard";
import { assertAdmin } from "~/server/admin/guard";

export const dynamic = "force-dynamic";

const toneMeta = {
  healthy: { pill: "#f0fdf4", fg: "#15803d", dot: "#22c55e", label: "Healthy" },
  watch: { pill: "#fffbeb", fg: "#b45309", dot: "#f59e0b", label: "Watch" },
  warning: { pill: "#fff7ed", fg: "#c2410c", dot: "#f97316", label: "Needs attention" },
  critical: { pill: "#fef2f2", fg: "#b91c1c", dot: "#ef4444", label: "Critical" },
} as const;

export default async function AdminOverviewPage() {
  let admin;
  try {
    admin = await assertAdmin();
  } catch {
    redirect("/contacts");
  }

  const overview = await loadAdminOverview();

  return (
    <>
      <AdminHeader title="Overview" adminName={admin.name} />
      <div className="adm-content">
        <div className="ad-page">
          <section className="ad-home-hero">
            <div className="ad-home-hero__main">
              <div className="ad-home-hero__eyebrow">Command center</div>
              <h2 className="ad-home-hero__title">Platform operations at a glance</h2>
              <p className="ad-home-hero__sub">
                See what needs attention, jump into support work, and review the
                most recent privileged changes without hopping between pages.
              </p>
              <div className="ad-home-hero__chips">
                <span className="ad-home-chip" data-tone={overview.summary.criticalCount > 0 ? "critical" : "healthy"}>
                  <span className="ad-home-chip__dot" />
                  {overview.summary.criticalCount > 0
                    ? `${overview.summary.criticalCount.toLocaleString()} critical`
                    : "No critical issues"}
                </span>
                <span className="ad-home-chip" data-tone={overview.summary.needsAttentionCount > 0 ? "warning" : "healthy"}>
                  <span className="ad-home-chip__dot" />
                  {overview.summary.needsAttentionCount > 0
                    ? `${overview.summary.needsAttentionCount.toLocaleString()} need attention`
                    : "Queues look clear"}
                </span>
              </div>
            </div>
            <div className="ad-home-hero__aside">
              <div className="ad-home-mini">
                <div className="ad-home-mini__label">Today</div>
                <div className="ad-home-mini__value tnum">
                  {overview.overviewStats[2]?.value ?? "0"}
                </div>
                <div className="ad-home-mini__sub">Admin actions in the last 24 hours</div>
              </div>
              <div className="ad-home-mini">
                <div className="ad-home-mini__label">Sync review</div>
                <div className="ad-home-mini__value tnum">
                  {(overview.summary.syncNeedsReauth + overview.summary.syncErrors + overview.summary.syncPaused).toLocaleString()}
                </div>
                <div className="ad-home-mini__sub">Connections currently asking for human attention</div>
              </div>
            </div>
          </section>

          <div className="ad-section-label">Overview</div>
          <section className="ad-home-stat-grid">
            {overview.overviewStats.map((card) => (
              <Link key={card.id} href={card.href} className="ad-home-stat ad-home-linkcard">
                <div className="ad-home-stat__value tnum">{card.value}</div>
                <div className="ad-home-stat__label">{card.label}</div>
                <div className="ad-home-stat__sub">{card.sub}</div>
              </Link>
            ))}
          </section>

          <div className="ad-home-two-col">
            <div>
              <div className="ad-section-label">Needs attention</div>
              <section className="ad-card ad-home-list">
                {overview.attention.map((item, index) => {
                  const tone = toneMeta[item.tone as keyof typeof toneMeta];
                  return (
                    <Link key={item.id} href={item.href} className="ad-home-list__row">
                      <div className="ad-home-list__head">
                        <div>
                          <div className="ad-home-list__title">{item.label}</div>
                          <div className="ad-home-list__body">{item.body}</div>
                        </div>
                        <div className="ad-home-list__meta">
                          <span
                            className="ad-home-status"
                            style={{ background: tone.pill, color: tone.fg }}
                          >
                            <span
                              className="ad-home-status__dot"
                              style={{ background: tone.dot }}
                            />
                            {tone.label}
                          </span>
                          <div className="ad-home-list__count tnum">{item.count.toLocaleString()}</div>
                        </div>
                      </div>
                      {index < overview.attention.length - 1 ? (
                        <div className="ad-home-list__rule" />
                      ) : null}
                    </Link>
                  );
                })}
              </section>
            </div>

            <div>
              <div className="ad-section-label">Quick actions</div>
              <section className="ad-home-action-grid">
                {overview.quickActions.map((action) => (
                  <Link key={action.id} href={action.href} className="ad-card ad-home-action ad-home-linkcard">
                    <span className="ad-home-action__icon">
                      <AdIcon name={action.icon} size={18} c={AD.blue} />
                    </span>
                    <div className="ad-home-action__title">{action.label}</div>
                    <div className="ad-home-action__body">{action.body}</div>
                  </Link>
                ))}
              </section>
            </div>
          </div>

          <div className="ad-section-label">Recent admin activity</div>
          <section className="ad-card ad-home-recent">
            {overview.recentActions.length === 0 ? (
              <div className="ad-table-state" style={{ padding: "34px 24px" }}>
                <span className="ad-state-icon">
                  <AdIcon name="audit" size={22} c={AD.mute} />
                </span>
                <div className="ad-state-title">No recent admin actions</div>
                <div className="ad-state-sub">Privileged actions will appear here as they happen.</div>
              </div>
            ) : (
              <>
                <div className="ad-home-recent__head">
                  <span>Action</span>
                  <span>Admin</span>
                  <span>Target</span>
                  <span>When</span>
                </div>
                {overview.recentActions.map((row) => (
                  <Link key={row.id} href="/admin/audit" className="ad-home-recent__row">
                    <span className="ad-home-recent__action">{row.actionLabel}</span>
                    <span className="ad-home-recent__actor">{row.actor}</span>
                    <span className="ad-home-recent__target">{row.target}</span>
                    <span className="ad-home-recent__when tnum">{row.when}</span>
                  </Link>
                ))}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
