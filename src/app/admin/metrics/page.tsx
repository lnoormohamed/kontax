import { redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import {
  adminAttentionForErrorRate,
  adminAttentionMeta,
} from "~/server/admin/attention";
import { loadPlatformMetrics } from "~/server/admin/metrics";
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
  } catch {
    redirect("/contacts");
  }

  const m = await loadPlatformMetrics();
  const total = m.plans.reduce((s, p) => s + p.count, 0) || 1;
  const h = healthBanner(m.worst);

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
        </div>
      </div>
    </>
  );
}
