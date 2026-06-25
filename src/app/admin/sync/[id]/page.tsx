import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminHeader } from "../../_components/admin-header";
import { AD } from "../../_components/admin-icons";
import { adminAttentionMeta } from "~/server/admin/attention";
import { assertAdmin } from "~/server/admin/guard";
import { loadAdminSyncConnectionDetail } from "~/server/admin/sync";
import { SyncConnectionActions } from "./detail-client";

export const dynamic = "force-dynamic";

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

export default async function AdminSyncConnectionDetailPage({
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
  const d = await loadAdminSyncConnectionDetail(id);
  if (!d) notFound();

  const tone = adminAttentionMeta(
    d.healthToneValue === "critical" ? "warning" : d.healthToneValue,
  );

  return (
    <>
      <AdminHeader
        title={d.label}
        adminName={admin.name}
        crumbs={[{ label: "Operations" }, { label: "Sync ops", href: "/admin/sync" }]}
      />
      <div className="adm-content">
        <div className="ad-page">
          {(d.capabilityNotice || d.lastErrorMessage || d.invariants.length > 0) && (
            <div
              className={"ad-flag-banner " + (d.healthToneValue === "action" || d.invariants.length > 0 ? "ad-flag-banner--red" : "ad-flag-banner--amber")}
            >
              <span>
                {d.capabilityNotice?.title ??
                  d.lastErrorMessage ??
                  d.invariants[0]?.message ??
                  "This connection has support context to review."}
              </span>
            </div>
          )}

          <div className="ad-detail-grid">
            <div className="ad-detail-main">
              <section className="ad-card">
                <div className="ad-overview">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="ad-overview-email">{d.label}</div>
                    <div className="ad-overview-name">{d.providerLabel} · {d.user.email}</div>
                    <div className="ad-overview-tags">
                      <span className="ad-home-status" style={{ background: tone.pill, color: tone.fg }}>
                        <span className="ad-home-status__dot" style={{ background: tone.dot }} />
                        {d.statusLabel}
                      </span>
                      <span className="ad-flag-chip">{d.capabilityProfileLabel}</span>
                      {d.capabilityGenericSafe ? <span className="ad-flag-chip">Generic-safe</span> : null}
                    </div>
                  </div>
                </div>
                <div className="ad-overview-rows">
                  <KV k="Connection ID" v={d.connectionId ?? "Missing"} vColor={!d.connectionId ? AD.red : undefined} />
                  <KV k="User" v={d.user.name} />
                  <KV k="Last synced" v={d.lastSyncedAt} />
                  <KV k="Last succeeded" v={d.lastSucceededAt} />
                  <KV k="Open conflicts" v={String(d.counts.syncConflicts)} />
                  <KV k="Synced links" v={String(d.counts.syncLinks)} />
                </div>
              </section>

              <section className="ad-card">
                <div className="ad-card-head">
                  <h3 className="ad-card-title">Capability profile</h3>
                </div>
                <div className="ad-kv-grid">
                  <KV k="Resolved profile" v={d.capabilityProfileLabel} />
                  <KV k="Override" v={d.capabilityProfileOverride ?? "Auto-detect"} />
                  <KV k="Provider display" v={d.capabilityProfileDisplayName} />
                  <KV k="Support bucket" v={d.supportBucket} />
                </div>
                {d.capabilityNotice ? (
                  <div className="ad-support-callout">
                    <div className="ad-support-callout__title">{d.capabilityNotice.title}</div>
                    <div className="ad-support-callout__body">{d.capabilityNotice.body}</div>
                  </div>
                ) : null}
              </section>

              <section className="ad-card">
                <div className="ad-card-head">
                  <h3 className="ad-card-title">Connection diagnostics</h3>
                </div>
                <div className="ad-kv-grid">
                  <KV k="Credential status" v={d.credentialStatus} />
                  <KV k="Connection validated" v={d.connectionValidatedAt} />
                  <KV k="Book discovery" v={d.discoveredBooksAt} />
                  <KV k="Setup completed" v={d.setupCompletedAt} />
                  <KV k="Sync direction" v={d.syncDirection} />
                  <KV k="Conflict policy" v={d.conflictPolicy} />
                  <KV k="Failure streak" v={String(d.failureStreak)} />
                  <KV k="Remote account" v={d.remoteAccountId ?? "—"} />
                </div>
                <div className="ad-support-list" style={{ marginTop: 14 }}>
                  <div className="ad-support-list__row">
                    <div className="ad-support-list__main">
                      <div className="ad-support-list__title">Base URL</div>
                      <div className="ad-support-list__body ad-mono-sm">{d.baseUrl}</div>
                    </div>
                  </div>
                  {d.principalUrl ? (
                    <div className="ad-support-list__row">
                      <div className="ad-support-list__main">
                        <div className="ad-support-list__title">Principal URL</div>
                        <div className="ad-support-list__body ad-mono-sm">{d.principalUrl}</div>
                      </div>
                    </div>
                  ) : null}
                  {d.addressBookUrl ? (
                    <div className="ad-support-list__row">
                      <div className="ad-support-list__main">
                        <div className="ad-support-list__title">Address book URL</div>
                        <div className="ad-support-list__body ad-mono-sm">{d.addressBookUrl}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="ad-card">
                <div className="ad-card-head">
                  <h3 className="ad-card-title">Lineage & lifecycle</h3>
                </div>
                <div className="ad-kv-grid">
                  <KV k="Retired at" v={d.retiredAt ?? "—"} />
                  <KV k="Disconnected at" v={d.disconnectedAt ?? "—"} />
                  <KV k="Retired reason" v={d.retiredReason ?? "—"} />
                  <KV k="Remote CTag" v={d.remoteCTag ?? "—"} />
                </div>
                {(d.lineage.replaces || d.lineage.replacedBy) && (
                  <div className="ad-support-list" style={{ marginTop: 14 }}>
                    {d.lineage.replaces ? (
                      <Link href={`/admin/sync/${d.lineage.replaces.id}`} className="ad-support-list__row">
                        <div className="ad-support-list__main">
                          <div className="ad-support-list__title">Replaces {d.lineage.replaces.label}</div>
                          <div className="ad-support-list__sub">
                            {d.lineage.replaces.status} · {d.lineage.replaces.connectionId}
                          </div>
                        </div>
                        <div className="ad-support-list__meta">
                          <div className="ad-support-list__tail">{d.lineage.replaces.retiredAt ?? "Retirement pending"}</div>
                        </div>
                      </Link>
                    ) : null}
                    {d.lineage.replacedBy ? (
                      <Link href={`/admin/sync/${d.lineage.replacedBy.id}`} className="ad-support-list__row">
                        <div className="ad-support-list__main">
                          <div className="ad-support-list__title">Replaced by {d.lineage.replacedBy.label}</div>
                          <div className="ad-support-list__sub">
                            {d.lineage.replacedBy.status} · {d.lineage.replacedBy.connectionId}
                          </div>
                        </div>
                        <div className="ad-support-list__meta">
                          <div className="ad-support-list__tail">{d.lineage.replacedBy.createdAt}</div>
                        </div>
                      </Link>
                    ) : null}
                  </div>
                )}
                {d.invariants.length > 0 ? (
                  <div className="ad-support-callout">
                    <div className="ad-support-callout__title">Lineage invariant issues</div>
                    <div className="ad-support-callout__body">
                      {d.invariants.map((issue) => issue.message).join(" ")}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="ad-card">
                <div className="ad-card-head">
                  <h3 className="ad-card-title">Recent jobs</h3>
                </div>
                <div className="ad-support-list">
                  {d.recentJobs.length === 0 ? (
                    <div className="ad-support-note">No sync jobs recorded yet.</div>
                  ) : (
                    d.recentJobs.map((job) => (
                      <div key={job.id} className="ad-support-list__row">
                        <div className="ad-support-list__main">
                          <div className="ad-support-list__title">{job.status} · {job.trigger}</div>
                          <div className="ad-support-list__sub">
                            {job.when}
                            {job.errorCode ? ` · ${job.errorCode}` : ""}
                          </div>
                          <div className="ad-support-list__body">
                            Inbound c/u/d {job.changes.created}/{job.changes.updated}/{job.changes.deleted}
                            {" · "}
                            Outbound c/u/d {job.changes.pushedCreated}/{job.changes.pushedUpdated}/{job.changes.pushedDeleted}
                            {" · "}
                            Conflicts {job.changes.conflicts}
                          </div>
                          {job.errorSummary ? (
                            <div className="ad-support-list__body">{job.errorSummary}</div>
                          ) : null}
                        </div>
                        <div className="ad-support-list__meta">
                          <div className="ad-support-list__tail">{job.supportBucket}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="ad-card">
                <div className="ad-card-head">
                  <h3 className="ad-card-title">Recent conflicts</h3>
                </div>
                <div className="ad-support-list">
                  {d.recentConflicts.length === 0 ? (
                    <div className="ad-support-note">No recent conflicts for this connection.</div>
                  ) : (
                    d.recentConflicts.map((conflict) => (
                      <div key={conflict.id} className="ad-support-list__row">
                        <div className="ad-support-list__main">
                          <div className="ad-support-list__title">{conflict.contactName}</div>
                          <div className="ad-support-list__sub">
                            {conflict.type} · {conflict.status} · {conflict.detectedAt}
                          </div>
                          <div className="ad-support-list__body">
                            Resolution {conflict.resolutionStrategy ?? "pending"}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <SyncConnectionActions
              syncAccountId={d.id}
              userId={d.user.id}
              userEmail={d.user.email}
              label={d.label}
              providerLabel={d.providerLabel}
              currentOverride={d.capabilityProfileOverride}
              canOverride={d.provider === "CARDDAV"}
            />
          </div>
        </div>
      </div>
    </>
  );
}
