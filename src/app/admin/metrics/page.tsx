import { redirect } from "next/navigation";

import { assertAdmin, requireAdminCapability } from "~/server/admin/guard";
import {
  adminAttentionForErrorRate,
  adminAttentionMeta,
} from "~/server/admin/attention";
import { loadPlatformMetrics } from "~/server/admin/metrics";
import { loadPageViewSummary } from "~/server/page-view-metrics";
import { AdminHeader } from "../_components/admin-header";
import { AD, AdIcon } from "../_components/admin-icons";

export const dynamic = "force-dynamic";

function sev(rate: number) {
  const state = adminAttentionForErrorRate(rate);
  const meta = adminAttentionMeta(state);
  return { tone: meta.dot, bg: meta.pill, fg: meta.fg, label: meta.label };
}

function healthBanner(worst: number) {
  const state = adminAttentionForErrorRate(worst);
  const meta = adminAttentionMeta(state);
  if (state === "critical") {
    return {
      bg: meta.pill,
      bd: "#fecaca",
      fg: meta.fg,
      dot: meta.dot,
      icon: "warn",
      title: "Service degraded",
      sub: `A service is failing at ${worst}% — above the 15% critical threshold.`,
    };
  }
  if (state === "warning") {
    return {
      bg: meta.pill,
      bd: "#fde68a",
      fg: meta.fg,
      dot: meta.dot,
      icon: "warn",
      title: "Elevated error rate",
      sub: `A service is failing at ${worst}% — above the 5% warning threshold.`,
    };
  }
  return {
    bg: meta.pill,
    bd: "#bbf7d0",
    fg: meta.fg,
    dot: meta.dot,
    icon: "check",
    title: "All systems operational",
    sub: "Error rates are within normal range across all services.",
  };
}

export default async function AdminMetricsPage() {
  let admin;
  try {
    admin = await assertAdmin();
    // P49A-07 (admin hardening): metrics had no capability gate at all — any
    // admin tier (including SUPPORT_OPS) could load it. Sync ops and
    // governance are the tiers that actually own this surface.
    requireAdminCapability(admin, "sync.view");
  } catch {
    redirect("/contacts");
  }

  const m = await loadPlatformMetrics();
  const total = m.plans.reduce((s, p) => s + p.count, 0) || 1;
  const h = healthBanner(m.worst);
  // P50A-08: cookieless page-view counts (guides/compare/help/for/features)
  // and the /register conversion proxy, over the last 7 days.
  const pv = await loadPageViewSummary(7);

  return (
    <>
      <AdminHeader
        title="Sync ops"
        adminName={admin.name}
        crumbs={[{ label: "Operations" }]}
      />
      <div className="adm-content">
        <div className="ad-page">
          <div className="ad-health" style={{ background: h.bg, borderColor: h.bd, color: h.fg }}>
            <span className="ad-health-dot" style={{ background: h.dot }} />
            <AdIcon name={h.icon} size={18} c={h.fg} w={2} />
            <div style={{ minWidth: 0 }}>
              <div className="ad-health-title">{h.title}</div>
              <div className="ad-health-sub">{h.sub}</div>
            </div>
          </div>

          <div className="ad-section-label">Overview</div>
          <div className="ad-stat-grid">
            {m.stats.map((s) => (
              <div key={s.label} className="ad-stat">
                <div className="ad-stat-value tnum">{s.value}</div>
                <div className="ad-stat-label">{s.label}</div>
                <div className="ad-stat-delta" data-up={s.up ? "1" : "0"}>
                  <AdIcon name={s.up ? "chevu" : "chevd"} size={13} c={s.up ? "#15803d" : AD.amber} w={2.4} />
                  {s.delta}
                </div>
              </div>
            ))}
          </div>

          <div className="ad-section-label">Plan breakdown</div>
          <section className="ad-card">
            <div className="ad-planbar">
              {m.plans.map((p) => (
                <span
                  key={p.plan}
                  className="ad-planbar-seg"
                  style={{ width: `${(p.count / total) * 100}%`, background: p.color }}
                  title={`${p.plan}: ${p.count}`}
                />
              ))}
            </div>
            <div className="ad-plan-legend">
              {m.plans.map((p) => (
                <div key={p.plan} className="ad-plan-leg">
                  <span className="ad-leg-swatch" style={{ background: p.color }} />
                  <span className="ad-leg-plan">{p.plan}</span>
                  <span className="ad-leg-count tnum">{p.count.toLocaleString()}</span>
                  <span className="ad-leg-pct tnum">{((p.count / total) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </section>

          <div className="ad-section-label">Error rates (last 24h)</div>
          <div className="ad-err-grid">
            {m.errors.map((e) => {
              const s = sev(e.rate);
              return (
                <div key={e.label} className="ad-err-card" style={{ borderColor: e.rate >= 5 ? s.bg : AD.line }}>
                  <div className="ad-err-top">
                    <span className="ad-err-label">{e.label}</span>
                    <span className="ad-err-badge" style={{ background: s.bg, color: s.fg }}>
                      {s.label}
                    </span>
                  </div>
                  <div className="ad-err-rate tnum" style={{ color: e.rate >= 5 ? s.fg : AD.ink }}>
                    {e.rate}%
                  </div>
                  <span className="ad-err-track">
                    <span className="ad-err-fill" style={{ width: `${Math.min(100, e.rate * 4)}%`, background: s.tone }} />
                  </span>
                </div>
              );
            })}
          </div>

          <div className="ad-section-label">Page views — last {pv.days} days (P50A-08)</div>
          <div className="ad-stat-grid">
            <div className="ad-stat">
              <div className="ad-stat-value tnum">{pv.totalViews.toLocaleString()}</div>
              <div className="ad-stat-label">Content page views</div>
            </div>
            <div className="ad-stat">
              <div className="ad-stat-value tnum">{pv.registerConversions.toLocaleString()}</div>
              <div className="ad-stat-label">Register views (conversion proxy)</div>
            </div>
            <div className="ad-stat">
              <div className="ad-stat-value tnum">
                {Object.keys(pv.categoryTotals).length
                  ? Object.entries(pv.categoryTotals)
                      .map(([category, count]) => `${category} ${count}`)
                      .join(" · ")
                  : "—"}
              </div>
              <div className="ad-stat-label">By section</div>
            </div>
          </div>
          <section className="ad-card">
            <div className="ad-card-head">
              <h3 className="ad-card-title">Top content pages</h3>
            </div>
            {!pv.redisConfigured ? (
              <p className="ad-pv-empty">Redis is not configured — page-view counts aren&apos;t available.</p>
            ) : pv.topPaths.length === 0 ? (
              <p className="ad-pv-empty">No page views recorded yet.</p>
            ) : (
              pv.topPaths.map((p) => (
                <div key={p.path} className="ad-pv-row">
                  <span className="ad-pv-path">{p.path}</span>
                  <span className="ad-pv-count tnum">{p.count.toLocaleString()}</span>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </>
  );
}
