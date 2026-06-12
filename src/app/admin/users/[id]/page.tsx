import { notFound, redirect } from "next/navigation";

import { assertAdmin } from "~/server/admin/guard";
import { ADMIN_ACTIONS, emitAdminEvent } from "~/server/admin/audit";
import { loadUserDetail } from "~/server/admin/users";
import { AdminHeader } from "../../_components/admin-header";
import { AD, AdIcon } from "../../_components/admin-icons";
import { Avatar } from "../../_components/avatar";
import { PlanPill, StatusPill } from "../../_components/pills";
import { Collapsible, UserActions } from "./detail-client";

export const dynamic = "force-dynamic";

const ACT_ICON: Record<string, string> = {
  edit: "edit",
  import: "upload",
  share: "share",
  sync: "sync",
  merge: "merge",
  account: "account",
  fam: "fam",
};

function KV({ k, v, vColor }: { k: string; v: string; vColor?: string }) {
  return (
    <div className="ad-kv">
      <span className="ad-kv-k">{k}</span>
      <span className="ad-kv-v" style={vColor ? { color: vColor } : undefined}>
        {v}
      </span>
    </div>
  );
}

function Progress({ pct, tone }: { pct: number | null; tone: string }) {
  if (pct == null) return <span className="ad-prog-na">—</span>;
  return (
    <span className="ad-prog">
      <span className="ad-prog-fill" style={{ width: `${Math.round(pct * 100)}%`, background: tone }} />
    </span>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let admin;
  try {
    admin = await assertAdmin();
  } catch {
    redirect("/contacts");
  }

  const { id } = await params;
  const d = await loadUserDetail(id);
  if (!d) notFound();

  // USER_VIEWED audit trail (P21-03 AC). Fire-and-forget — don't block render.
  void emitAdminEvent({
    adminId: admin.adminId,
    action: ADMIN_ACTIONS.USER_VIEWED,
    targetUserId: d.id,
    targetEmail: d.email,
    details: {},
  });

  const overriddenLabel = d.overriddenAt
    ? `Overridden ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d.overriddenAt)}`
    : null;

  return (
    <>
      <AdminHeader title={d.email} crumb={{ label: "Users", href: "/admin/users" }} adminName={admin.name} />
      <div className="adm-content">
        <div className="ad-page">
          {(d.suspended || d.deletionScheduled) && (
            <div className={"ad-flag-banner " + (d.suspended ? "ad-flag-banner--red" : "ad-flag-banner--amber")}>
              <AdIcon name="warn" size={17} c={d.suspended ? AD.red : AD.amber} />
              <span>
                {d.suspended
                  ? "Account suspended — the user is signed out and blocked from logging in."
                  : "Deletion scheduled — this account will be permanently deleted in 30 days."}
              </span>
            </div>
          )}

          <div className="ad-detail-grid">
            {/* left column */}
            <div className="ad-detail-main">
              <section className="ad-card">
                <div className="ad-overview">
                  <Avatar name={d.name} size={48} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="ad-overview-email">{d.email}</div>
                    <div className="ad-overview-name">{d.name}</div>
                    <div className="ad-overview-tags">
                      <PlanPill plan={d.plan} />
                      <StatusPill status={d.status} />
                      {d.overridden && (
                        <span className="ad-flag-chip">
                          <AdIcon name="flag" size={12} c={AD.blue} />
                          Overridden
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ad-overview-rows">
                  <KV k="User ID" v={d.overview.userId} />
                  <KV k="Created" v={d.overview.created} />
                  <KV k="Last active" v={d.overview.lastActive} />
                  <KV
                    k="Email status"
                    v={d.overview.emailStatus}
                    vColor={d.overview.emailStatus === "OK" ? AD.green : AD.amber}
                  />
                </div>
              </section>

              <section className="ad-card">
                <div className="ad-card-head">
                  <h3 className="ad-card-title">Subscription</h3>
                </div>
                <div className="ad-kv-grid">
                  <KV k="Plan" v={d.subscription.plan} />
                  <KV k="Status" v={d.subscription.status} />
                  <KV k="Period ends" v={d.subscription.periodEnds} />
                  <KV
                    k="Cancel at period end"
                    v={d.subscription.cancelAtPeriodEnd ? "Yes" : "No"}
                    vColor={d.subscription.cancelAtPeriodEnd ? AD.amber : undefined}
                  />
                  {d.overridden && <KV k="Override" v="Admin override active" vColor={AD.blue} />}
                </div>
              </section>

              <section className="ad-card">
                <div className="ad-card-head">
                  <h3 className="ad-card-title">Usage</h3>
                </div>
                <div className="ad-usage">
                  {d.usage.map((u) => (
                    <div key={u.label} className="ad-usage-row">
                      <span className="ad-usage-label">{u.label}</span>
                      <span className="ad-usage-val tnum">
                        {u.value}
                        {u.limit ? <span className="ad-usage-limit"> / {u.limit}</span> : ""}
                      </span>
                      <Progress pct={u.pct} tone={u.pct != null && u.pct >= 0.8 ? AD.amber : AD.blue} />
                    </div>
                  ))}
                </div>
              </section>

              {d.group && (
                <section className="ad-card">
                  <div className="ad-card-head">
                    <h3 className="ad-card-title">Group membership</h3>
                  </div>
                  <div className="ad-kv-grid">
                    <KV k={d.group.isTeam ? "Team" : "Family group"} v={d.group.name} />
                    <KV k="Role" v={d.group.role} />
                    <KV k="Members" v={d.group.members} />
                  </div>
                </section>
              )}

              <Collapsible title="Recent activity" count={`${d.activity.length} events`} defaultOpen>
                <div className="ad-activity">
                  {d.activity.length === 0 ? (
                    <div className="ad-activity-row">
                      <span className="ad-activity-text" style={{ color: AD.mute }}>
                        No recent activity.
                      </span>
                    </div>
                  ) : (
                    d.activity.map((a, i) => (
                      <div key={i} className="ad-activity-row">
                        <span className="ad-activity-icon">
                          <AdIcon name={ACT_ICON[a.type] ?? "edit"} size={14} c={AD.ink2} />
                        </span>
                        <span className="ad-activity-text">{a.text}</span>
                        <span className="ad-activity-when tnum">{a.when}</span>
                      </div>
                    ))
                  )}
                </div>
              </Collapsible>

              <Collapsible title="Active sessions" count={`${d.sessions.length} sessions`}>
                <div className="ad-sessions">
                  {d.sessions.length === 0 ? (
                    <div className="ad-session-row" style={{ gridTemplateColumns: "1fr" }}>
                      <span className="ad-session-ip" style={{ color: AD.mute }}>
                        No active sessions.
                      </span>
                    </div>
                  ) : (
                    d.sessions.map((s, i) => (
                      <div key={i} className="ad-session-row">
                        <span className="ad-session-dot" data-cur={s.current ? "1" : "0"} />
                        <span className="ad-session-ua">{s.ua}</span>
                        <span className="ad-session-ip tnum">{s.ip}</span>
                        <span className="ad-session-when">{s.when}</span>
                      </div>
                    ))
                  )}
                </div>
              </Collapsible>
            </div>

            {/* right column: actions */}
            <UserActions
              userId={d.id}
              user={{ name: d.name, email: d.email, plan: d.plan }}
              planLabel={d.plan}
              overridden={d.overridden}
              overriddenLabel={overriddenLabel}
              suspended={d.suspended}
              deletionScheduled={d.deletionScheduled}
            />
          </div>
        </div>
      </div>
    </>
  );
}
