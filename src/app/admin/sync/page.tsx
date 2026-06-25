import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminHeader } from "../_components/admin-header";
import { AD, AdIcon } from "../_components/admin-icons";
import { adminAttentionMeta } from "~/server/admin/attention";
import { assertAdmin } from "~/server/admin/guard";
import { loadAdminSyncOverview } from "~/server/admin/sync";

export const dynamic = "force-dynamic";

function worstTone(actionRequired: number, warningConnections: number) {
  if (actionRequired > 0) return "action" as const;
  if (warningConnections > 0) return "warning" as const;
  return "healthy" as const;
}

export default async function AdminSyncPage({
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
  const data = await loadAdminSyncOverview({
    provider: typeof sp.provider === "string" ? sp.provider : undefined,
    status: typeof sp.status === "string" ? sp.status : undefined,
    profile: typeof sp.profile === "string" ? sp.profile : undefined,
    q: typeof sp.q === "string" ? sp.q : undefined,
  });

  const bannerTone = adminAttentionMeta(
    worstTone(data.summary.actionRequired, data.summary.warningConnections),
  );

  return (
    <>
      <AdminHeader title="Sync ops" adminName={admin.name} crumbs={[{ label: "Operations" }]} />
      <div className="adm-content">
        <div className="ad-page">
          <div
            className="ad-health"
            style={{ background: bannerTone.pill, borderColor: bannerTone.dot, color: bannerTone.fg }}
          >
            <span className="ad-health-dot" style={{ background: bannerTone.dot }} />
            <AdIcon
              name={data.summary.actionRequired > 0 || data.summary.warningConnections > 0 ? "warn" : "check"}
              size={18}
              c={bannerTone.fg}
            />
            <div style={{ minWidth: 0 }}>
              <div className="ad-health-title">
                {data.summary.actionRequired > 0
                  ? "Connections need operator action"
                  : data.summary.warningConnections > 0
                    ? "Sync health needs a pass"
                    : "Sync fleet looks healthy"}
              </div>
              <div className="ad-health-sub">
                {data.summary.actionRequired > 0
                  ? `${data.summary.actionRequired} connection${data.summary.actionRequired === 1 ? "" : "s"} currently require re-auth or manual intervention.`
                  : data.summary.warningConnections > 0
                    ? `${data.summary.warningConnections} connection${data.summary.warningConnections === 1 ? "" : "s"} are paused, degraded, or otherwise worth checking.`
                    : "No action-required sync issues are currently queued."}
              </div>
            </div>
          </div>

          <form className="ad-filterbar" method="get">
            <div className="ad-select-wrap">
              <select className="ad-select" name="provider" defaultValue={data.filters.provider}>
                <option value="all">All providers</option>
                <option value="CARDDAV">CardDAV</option>
                <option value="GOOGLE">Google</option>
                <option value="MICROSOFT">Microsoft</option>
              </select>
              <AdIcon name="chevd" size={14} c={AD.mute} />
            </div>
            <div className="ad-select-wrap">
              <select className="ad-select" name="status" defaultValue={data.filters.status}>
                <option value="all">All statuses</option>
                {data.statusBuckets.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.label}
                  </option>
                ))}
              </select>
              <AdIcon name="chevd" size={14} c={AD.mute} />
            </div>
            <div className="ad-select-wrap">
              <select className="ad-select" name="profile" defaultValue={data.filters.profile}>
                <option value="all">All capability profiles</option>
                {data.profileBuckets.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.label}
                  </option>
                ))}
              </select>
              <AdIcon name="chevd" size={14} c={AD.mute} />
            </div>
            <div className="ad-filter-search">
              <AdIcon name="search" size={15} c={AD.mute} />
              <input
                name="q"
                type="search"
                placeholder="Search label, user, remote account, or connection id"
                defaultValue={data.filters.q}
              />
            </div>
            <button className="ad-btn ad-btn--secondary ad-btn--sm" type="submit">
              Apply
            </button>
          </form>

          <div className="ad-section-label">Overview</div>
          <div className="ad-sync-mini-grid">
            <div className="ad-sync-mini">
              <div className="ad-sync-mini__label">Connections</div>
              <div className="ad-sync-mini__value tnum">{data.summary.totalConnections}</div>
            </div>
            <div className="ad-sync-mini">
              <div className="ad-sync-mini__label">Action required</div>
              <div className="ad-sync-mini__value tnum">{data.summary.actionRequired}</div>
            </div>
            <div className="ad-sync-mini">
              <div className="ad-sync-mini__label">Warnings</div>
              <div className="ad-sync-mini__value tnum">{data.summary.warningConnections}</div>
            </div>
            <div className="ad-sync-mini">
              <div className="ad-sync-mini__label">Open conflicts</div>
              <div className="ad-sync-mini__value tnum">{data.summary.openConflicts}</div>
            </div>
            <div className="ad-sync-mini">
              <div className="ad-sync-mini__label">Generic-safe</div>
              <div className="ad-sync-mini__value tnum">{data.summary.genericSafeConnections}</div>
            </div>
          </div>

          <div className="ad-section-label">Provider health</div>
          <div className="ad-sync-provider-grid">
            {data.providerCards.map((card) => {
              const tone = adminAttentionMeta(card.tone === "action" ? "action" : card.tone === "warning" ? "warning" : card.tone === "watch" ? "watch" : "healthy");
              return (
                <div key={card.id} className="ad-card ad-sync-provider-card">
                  <div className="ad-sync-provider-card__head">
                    <div>
                      <div className="ad-sync-provider-card__title">{card.label}</div>
                      <div className="ad-sync-provider-card__sub">{card.count} connected account{card.count === 1 ? "" : "s"}</div>
                    </div>
                    <span className="ad-home-status" style={{ background: tone.pill, color: tone.fg }}>
                      <span className="ad-home-status__dot" style={{ background: tone.dot }} />
                      {tone.label}
                    </span>
                  </div>
                  <div className="ad-sync-provider-card__stats">
                    <span>Action {card.actionRequired}</span>
                    <span>Warnings {card.warningCount}</span>
                    <span>Generic-safe {card.genericSafeCount}</span>
                    <span>Recent failures {card.recentFailures}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ad-home-two-col">
            <div>
              <div className="ad-section-label">Needs attention</div>
              <section className="ad-card ad-support-list">
                {data.needsAction.length === 0 ? (
                  <div className="ad-support-note">No connections currently need manual follow-up.</div>
                ) : (
                  data.needsAction.map((item) => {
                    const tone = adminAttentionMeta(
                      item.tone === "critical" ? "warning" : item.tone,
                    );
                    return (
                      <Link key={item.id} href={item.href} className="ad-support-list__row">
                        <div className="ad-support-list__main">
                          <div className="ad-support-list__title">{item.label}</div>
                          <div className="ad-support-list__sub">
                            {item.provider} · {item.userEmail} · {item.profileLabel}
                          </div>
                          <div className="ad-support-list__body">{item.body}</div>
                        </div>
                        <div className="ad-support-list__meta">
                          <span className="ad-home-status" style={{ background: tone.pill, color: tone.fg }}>
                            <span className="ad-home-status__dot" style={{ background: tone.dot }} />
                            {item.status}
                          </span>
                          <div className="ad-support-list__tail">{item.lastEventLabel}</div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </section>
            </div>

            <div>
              <div className="ad-section-label">Recent outcomes</div>
              <section className="ad-card ad-support-stack">
                <div>
                  <div className="ad-support-stack__title">Failures</div>
                  {data.recentFailures.length === 0 ? (
                    <div className="ad-support-note">No failures in the last 24 hours.</div>
                  ) : (
                    <div className="ad-support-list">
                      {data.recentFailures.map((job) => (
                        <Link key={job.id} href={job.href} className="ad-support-list__row">
                          <div className="ad-support-list__main">
                            <div className="ad-support-list__title">{job.label}</div>
                            <div className="ad-support-list__sub">
                              {job.provider} · {job.userEmail}
                            </div>
                            <div className="ad-support-list__body">{job.errorSummary}</div>
                          </div>
                          <div className="ad-support-list__meta">
                            <div className="ad-support-list__tail">{job.when}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="ad-support-stack__title">Recoveries</div>
                  {data.recentRecoveries.length === 0 ? (
                    <div className="ad-support-note">No recoveries in the last 24 hours.</div>
                  ) : (
                    <div className="ad-support-list">
                      {data.recentRecoveries.map((job) => (
                        <Link key={job.id} href={job.href} className="ad-support-list__row">
                          <div className="ad-support-list__main">
                            <div className="ad-support-list__title">{job.label}</div>
                            <div className="ad-support-list__sub">
                              {job.provider} · {job.userEmail}
                            </div>
                            <div className="ad-support-list__body">
                              {job.status} with {job.changes} recorded change{job.changes === 1 ? "" : "s"}.
                            </div>
                          </div>
                          <div className="ad-support-list__meta">
                            <div className="ad-support-list__tail">{job.when}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="ad-section-label">Connections</div>
          <section className="ad-card ad-support-list">
            {data.connectionRows.length === 0 ? (
              <div className="ad-support-note">No sync connections match the current filters.</div>
            ) : (
              data.connectionRows.map((row) => {
                const tone = adminAttentionMeta(
                  row.healthToneValue === "critical" ? "warning" : row.healthToneValue,
                );
                return (
                  <Link key={row.id} href={row.href} className="ad-support-list__row">
                    <div className="ad-support-list__main">
                      <div className="ad-support-list__title">{row.label}</div>
                      <div className="ad-support-list__sub">
                        {row.provider} · {row.userEmail} · {row.profileLabel}
                        {row.connectionId ? ` · ${row.connectionId}` : ""}
                      </div>
                      <div className="ad-support-list__body">
                        {row.openConflicts} open conflict{row.openConflicts === 1 ? "" : "s"} · {row.syncLinks} synced link{row.syncLinks === 1 ? "" : "s"} · last success {row.lastSuccess}
                        {row.lastError ? ` · last error ${row.lastError}` : ""}
                      </div>
                    </div>
                    <div className="ad-support-list__meta">
                      <span className="ad-home-status" style={{ background: tone.pill, color: tone.fg }}>
                        <span className="ad-home-status__dot" style={{ background: tone.dot }} />
                        {row.status}
                      </span>
                      <div className="ad-support-list__tail">{row.supportBucket}</div>
                    </div>
                  </Link>
                );
              })
            )}
          </section>
        </div>
      </div>
    </>
  );
}
