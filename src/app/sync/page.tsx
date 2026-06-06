import Link from "next/link";
import { redirect } from "next/navigation";

import {
  activateSyncAccount,
  attachSyncCredentials,
  createSyncAccount,
  pauseSyncAccount,
  prepareSyncRelink,
  queueSyncJob,
  revokeSyncCredentials,
  resolveSyncConflict,
  retrySyncJob,
} from "~/app/actions/sync";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";
import { getSyncCredentialEncryptionStatus } from "~/server/sync-credentials";

type SyncPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const formatTimestamp = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(value)
    : "Not yet";

const getSearchValue = (
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) => {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
};

export default async function SyncPage({ searchParams }: SyncPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const created = getSearchValue(resolvedSearchParams, "created") === "1";
  const activated = getSearchValue(resolvedSearchParams, "activated") === "1";
  const paused = getSearchValue(resolvedSearchParams, "paused") === "1";
  const queued = getSearchValue(resolvedSearchParams, "queued") === "1";
  const retryQueued = getSearchValue(resolvedSearchParams, "retryQueued") === "1";
  const preflightFailed = getSearchValue(resolvedSearchParams, "preflightFailed") === "1";
  const conflictResolved = getSearchValue(resolvedSearchParams, "conflictResolved") === "1";
  const credentialsSaved = getSearchValue(resolvedSearchParams, "credentialsSaved") === "1";
  const credentialsRevoked = getSearchValue(resolvedSearchParams, "credentialsRevoked") === "1";
  const relinkPrepared = getSearchValue(resolvedSearchParams, "relinkPrepared") === "1";
  const encryptionStatus = getSyncCredentialEncryptionStatus();

  const [planSummary, syncAccounts, recentJobs, recentConflicts, queuedJobsCount, openConflictsCount] =
    await Promise.all([
    getUserPlanSummary(session.user.id),
    db.syncAccount.findMany({
      where: { userId: session.user.id },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        _count: {
          select: {
            syncJobs: true,
            syncConflicts: true,
            syncLinks: true,
          },
        },
        syncJobs: {
          orderBy: [{ createdAt: "desc" }],
          take: 1,
        },
      },
    }),
    db.syncJob.findMany({
      where: {
        syncAccount: {
          userId: session.user.id,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
      include: {
        syncAccount: {
          select: {
            id: true,
            label: true,
          },
        },
      },
    }),
    db.syncConflict.findMany({
      where: {
        syncAccount: {
          userId: session.user.id,
        },
      },
      orderBy: [{ detectedAt: "desc" }],
      take: 5,
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
          },
        },
        syncAccount: {
          select: {
            id: true,
            label: true,
          },
        },
      },
    }),
    db.syncJob.count({
      where: {
        status: "QUEUED",
        syncAccount: {
          userId: session.user.id,
        },
      },
    }),
    db.syncConflict.count({
      where: {
        status: "OPEN",
        syncAccount: {
          userId: session.user.id,
        },
      },
    }),
  ]);

  const syncAccountsRemaining = Math.max(
    planSummary.entitlements.syncAccountsLimit - syncAccounts.length,
    0,
  );
  const canUseCardDavSync = planSummary.entitlements.cardDavSyncEnabled;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-cyan-200 hover:text-cyan-100" href="/">
              ← Back to dashboard
            </Link>
            <p className="mt-4 text-sm uppercase tracking-[0.35em] text-cyan-200">Sync</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Prepare CardDAV sync without losing control of the core contact model.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              Ticket `P5-01` starts the sync account surface. Ticket `P5-03` keeps credential
              storage deliberately separate so encrypted secret handling can land cleanly before we
              move real device credentials through the app.
            </p>
          </div>

          <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-[#08101c] p-5 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Plan:</span> {planSummary.planLabel}
            </p>
            <p>
              <span className="text-slate-500">Sync accounts:</span> {syncAccounts.length} /{" "}
              {planSummary.entitlements.syncAccountsLimit}
            </p>
            <p>
              <span className="text-slate-500">CardDAV access:</span>{" "}
              {canUseCardDavSync ? "Enabled" : "Upgrade required"}
            </p>
          </div>
        </div>

        {created ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Sync account saved successfully.
          </div>
        ) : null}
        {activated ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Sync account marked active.
          </div>
        ) : null}
        {paused ? (
          <div className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(251,191,36,0.12)]">
            Sync account paused successfully.
          </div>
        ) : null}
        {queued ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Sync job queued successfully.
          </div>
        ) : null}
        {retryQueued ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Recovery retry queued successfully.
          </div>
        ) : null}
        {preflightFailed ? (
          <div className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(251,191,36,0.12)]">
            Sync preflight was blocked because encrypted credentials are not attached yet. The
            failed preflight is now recorded in job history with a retry window.
          </div>
        ) : null}
        {conflictResolved ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Sync conflict resolution saved successfully.
          </div>
        ) : null}
        {credentialsSaved ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Encrypted sync credentials saved successfully.
          </div>
        ) : null}
        {credentialsRevoked ? (
          <div className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(251,191,36,0.12)]">
            Stored sync credentials were revoked. This account now needs fresh encrypted credentials
            before the next run.
          </div>
        ) : null}
        {relinkPrepared ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Sync relink preparation completed. Local sync links were reset and open conflicts were
            closed out so you can review the account and then start a fresh recovery run.
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Sync accounts</p>
                <h2 className="text-2xl font-semibold text-white">Connect your contact home</h2>
                <p className="text-sm text-slate-400">
                  Start by storing the remote CardDAV topology and lifecycle state. Encrypted
                  credential capture, rotation, and revoke now live here too, while job queueing,
                  retries, and conflict logging stay visible in the same operational surface.
                </p>
              </div>

              {canUseCardDavSync ? (
                <form action={createSyncAccount} className="mt-6 grid gap-4">
                  <input name="redirectTo" type="hidden" value="/sync?created=1" />

                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Connection label</span>
                    <input
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                      name="label"
                      placeholder="Personal iCloud"
                      required
                      type="text"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>CardDAV base URL</span>
                    <input
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                      name="baseUrl"
                      placeholder="https://contacts.example.com/dav"
                      required
                      type="url"
                    />
                  </label>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2 text-sm text-slate-200">
                      <span>Principal URL</span>
                      <input
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                        name="principalUrl"
                        placeholder="https://contacts.example.com/principals/me"
                        type="url"
                      />
                    </label>

                    <label className="grid gap-2 text-sm text-slate-200">
                      <span>Address book URL</span>
                      <input
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                        name="addressBookUrl"
                        placeholder="https://contacts.example.com/addressbooks/me/default"
                        type="url"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Sync direction</span>
                    <select
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                      defaultValue="TWO_WAY"
                      name="syncDirection"
                    >
                      <option className="bg-slate-950 text-white" value="TWO_WAY">
                        Two-way sync
                      </option>
                      <option className="bg-slate-950 text-white" value="IMPORT_ONLY">
                        Import only
                      </option>
                      <option className="bg-slate-950 text-white" value="EXPORT_ONLY">
                        Export only
                      </option>
                    </select>
                  </label>

                  <div className="rounded-2xl border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300">
                    <p>
                      Encryption backend:{" "}
                      {encryptionStatus.available
                        ? encryptionStatus.mode === "dedicated"
                          ? "Dedicated sync key"
                          : "AUTH_SECRET fallback"
                        : "Not configured"}
                    </p>
                    <p className="mt-1 text-slate-500">
                      Key reference: {encryptionStatus.keyRef ?? "Missing"}
                    </p>
                  </div>

                  <button
                    className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                    type="submit"
                  >
                    Save sync account
                  </button>
                </form>
              ) : (
                <div className="mt-6 rounded-[1.75rem] border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
                  CardDAV sync is currently gated to the Pro plan. You can still use import,
                  export, merge, and the core contact experience on your current plan while we keep
                  building out the sync layer.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Configured accounts</p>
              <div className="mt-4 grid gap-4">
                {syncAccounts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-400">
                    No sync accounts yet. Once one is saved, this is where we will track lifecycle,
                    job health, and conflict counts.
                  </div>
                ) : (
                  syncAccounts.map((account) => (
                    <article
                      className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5"
                      key={account.id}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-semibold text-white">{account.label}</h3>
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                              {account.status.toLowerCase()}
                            </span>
                            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                              {account.syncDirection.replaceAll("_", " ").toLowerCase()}
                            </span>
                          </div>
                          <p className="mt-2 break-all text-sm text-slate-400">{account.baseUrl}</p>
                          <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                            <p>Principal: {account.principalUrl ?? "Not stored yet"}</p>
                            <p>Address book: {account.addressBookUrl ?? "Not stored yet"}</p>
                            <p>
                              Credentials:{" "}
                              {account.credentialReference && !account.credentialRevokedAt
                                ? "Attached"
                                : "Missing"}
                            </p>
                            <p>
                              Credential state:{" "}
                              {account.credentialRevokedAt ? "Revoked" : "Ready for rotation"}
                            </p>
                            <p>
                              Credential version: {account.credentialVersion}
                            </p>
                            <p>
                              Key reference: {account.encryptionKeyRef ?? "Not attached"}
                            </p>
                            <p>
                              Updated: {formatTimestamp(account.credentialUpdatedAt)}
                            </p>
                            <p>
                              Revoked: {formatTimestamp(account.credentialRevokedAt)}
                            </p>
                            <p>Last success: {formatTimestamp(account.lastSucceededAt)}</p>
                            <p>Last sync: {formatTimestamp(account.lastSyncedAt)}</p>
                          </div>
                          {account.lastErrorMessage ? (
                            <p className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">
                              {account.lastErrorCode ? `${account.lastErrorCode}: ` : ""}
                              {account.lastErrorMessage}
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-3 text-sm text-slate-300 sm:min-w-44">
                          <div className="rounded-2xl border border-white/10 bg-[#08101c] p-4">
                            <p>Jobs tracked: {account._count.syncJobs}</p>
                            <p className="mt-1">Open conflicts: {account._count.syncConflicts}</p>
                            <p className="mt-1">Linked contacts: {account._count.syncLinks}</p>
                          </div>
                          {account.status === "ACTIVE" ? (
                            <form action={pauseSyncAccount}>
                              <input name="redirectTo" type="hidden" value="/sync?paused=1" />
                              <input name="syncAccountId" type="hidden" value={account.id} />
                              <button
                                className="w-full rounded-full border border-amber-300/30 px-4 py-3 font-semibold text-amber-200 transition hover:border-amber-200 hover:text-white"
                                type="submit"
                              >
                                Pause sync
                              </button>
                            </form>
                          ) : (
                            <form action={activateSyncAccount}>
                              <input name="redirectTo" type="hidden" value="/sync?activated=1" />
                              <input name="syncAccountId" type="hidden" value={account.id} />
                              <button
                                className="w-full rounded-full bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                                type="submit"
                              >
                                Mark active
                              </button>
                            </form>
                          )}
                          <form action={queueSyncJob}>
                            <input
                              name="redirectTo"
                              type="hidden"
                              value={
                                account.credentialReference && !account.credentialRevokedAt
                                  ? "/sync?queued=1"
                                  : "/sync?preflightFailed=1"
                              }
                            />
                            <input name="syncAccountId" type="hidden" value={account.id} />
                            <button
                              className="w-full rounded-full border border-white/10 px-4 py-3 font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                              type="submit"
                            >
                              {account.credentialReference && !account.credentialRevokedAt
                                ? "Queue sync run"
                                : "Run sync preflight"}
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#08101c]/80 p-4">
                        <p className="text-sm font-semibold text-white">Encrypted credentials</p>
                        <p className="mt-2 text-sm text-slate-400">
                          Ticket `P5-03`: credentials are stored as an encrypted server-side
                          envelope, tracked with key references and rotation metadata instead of
                          being written as plain text fields.
                        </p>
                        {encryptionStatus.available ? (
                          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                            <form action={attachSyncCredentials} className="grid gap-3">
                              <input
                                name="redirectTo"
                                type="hidden"
                                value="/sync?credentialsSaved=1"
                              />
                              <input name="syncAccountId" type="hidden" value={account.id} />
                              <input
                                autoComplete="username"
                                className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                                name="username"
                                placeholder="CardDAV username or email"
                                type="text"
                              />
                              <input
                                autoComplete="current-password"
                                className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                                name="password"
                                placeholder="App password or account password"
                                type="password"
                              />
                              <input
                                className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                                name="note"
                                placeholder="Optional note for this credential set"
                                type="text"
                              />
                              <button
                                className="rounded-full border border-cyan-300/30 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
                                type="submit"
                              >
                                {account.credentialReference && !account.credentialRevokedAt
                                  ? "Rotate encrypted credentials"
                                  : "Attach encrypted credentials"}
                              </button>
                            </form>
                            <div className="grid gap-3 self-start">
                              <div className="rounded-2xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-400">
                                <p>
                                  Backend mode:{" "}
                                  {encryptionStatus.mode === "dedicated"
                                    ? "Dedicated sync key"
                                    : "AUTH_SECRET fallback"}
                                </p>
                                <p className="mt-1">
                                  Active key ref: {encryptionStatus.keyRef ?? "Missing"}
                                </p>
                              </div>
                              {account.credentialReference ? (
                                <form action={revokeSyncCredentials}>
                                  <input
                                    name="redirectTo"
                                    type="hidden"
                                    value="/sync?credentialsRevoked=1"
                                  />
                                  <input
                                    name="syncAccountId"
                                    type="hidden"
                                    value={account.id}
                                  />
                                  <button
                                    className="w-full rounded-full border border-amber-300/30 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-200 hover:text-white"
                                    type="submit"
                                  >
                                    Revoke stored credentials
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
                            Set `SYNC_CREDENTIAL_ENCRYPTION_KEY` for a dedicated sync-secret key,
                            or keep `AUTH_SECRET` available as the fallback. Credential capture is
                            blocked until one of those server secrets exists.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#08101c]/80 p-4">
                        <p className="text-sm font-semibold text-white">Recovery toolkit</p>
                        <p className="mt-2 text-sm text-slate-400">
                          Ticket `P5-06`: when sync health gets messy, the safest path is pause,
                          export, inspect, then relink. Recovery actions here avoid touching your
                          underlying Kontax contacts.
                        </p>
                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <a
                            className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                            href={`/api/exports/sync-recovery?syncAccountId=${account.id}`}
                          >
                            Export recovery package
                          </a>
                          <form action={prepareSyncRelink}>
                            <input
                              name="redirectTo"
                              type="hidden"
                              value="/sync?relinkPrepared=1"
                            />
                            <input name="syncAccountId" type="hidden" value={account.id} />
                            <button
                              className="w-full rounded-full border border-cyan-300/30 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
                              type="submit"
                            >
                              Prepare relink reset
                            </button>
                          </form>
                        </div>
                        <div className="mt-4 rounded-2xl border border-white/10 bg-[#020617] p-4 text-sm text-slate-400">
                          <p>Recommended recovery order</p>
                          <p className="mt-2">1. Pause sync if the account is still active.</p>
                          <p className="mt-1">2. Export a recovery package before any reset.</p>
                          <p className="mt-1">
                            3. Prepare relink to clear local sync links and stale open conflicts.
                          </p>
                          <p className="mt-1">
                            4. Run a fresh preflight or queue a new recovery sync run.
                          </p>
                        </div>
                      </div>

                      {account.syncJobs[0] ? (
                        <p className="mt-4 text-sm text-slate-500">
                          Latest job: {account.syncJobs[0].status.toLowerCase()} via{" "}
                          {account.syncJobs[0].trigger.toLowerCase()} on{" "}
                          {formatTimestamp(account.syncJobs[0].createdAt)}
                        </p>
                      ) : (
                        <p className="mt-4 text-sm text-slate-500">
                          No sync jobs yet. Ticket `P5-04` will attach scheduling, retries, and
                          conflict-aware execution.
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>

          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Plan fit</p>
              <p className="mt-4 text-sm text-slate-300">
                Ticket `P5-02`: sync remains product-aware from the start so we can gate premium
                capability without forcing a redesign of ownership or auth later.
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300">
                <p>Accounts remaining: {syncAccountsRemaining}</p>
                <p className="mt-1">
                  Live CardDAV entitlement: {canUseCardDavSync ? "Yes" : "No"}
                </p>
                <p className="mt-1">Queued jobs: {queuedJobsCount}</p>
                <p className="mt-1">Open conflicts: {openConflictsCount}</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Recent jobs</p>
              <div className="mt-4 grid gap-3">
                {recentJobs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-slate-400">
                    No sync jobs have been recorded yet.
                  </div>
                ) : (
                  recentJobs.map((job) => (
                    <div className="rounded-2xl border border-white/10 bg-[#08101c]/70 p-4" key={job.id}>
                      <p className="font-semibold text-white">{job.syncAccount.label}</p>
                      <p className="mt-1 text-slate-400">
                        {job.status} · {job.trigger} · {job.syncDirection}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Attempt {job.attemptCount} of {job.maxAttempts} · created{" "}
                        {formatTimestamp(job.createdAt)}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Next retry {formatTimestamp(job.nextRetryAt)} · conflicts {job.conflictCount}
                      </p>
                      {job.errorSummary ? (
                        <p className="mt-2 text-sm text-amber-100">
                          {job.errorCode ? `${job.errorCode}: ` : ""}
                          {job.errorSummary}
                        </p>
                      ) : null}
                      {(job.status === "FAILED" || job.status === "PARTIAL") &&
                      job.attemptCount < job.maxAttempts ? (
                        <form action={retrySyncJob} className="mt-3">
                          <input name="redirectTo" type="hidden" value="/sync?retryQueued=1" />
                          <input name="syncJobId" type="hidden" value={job.id} />
                          <button
                            className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
                            type="submit"
                          >
                            Queue recovery retry
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Open conflicts</p>
              <div className="mt-4 grid gap-3">
                {recentConflicts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-slate-400">
                    No sync conflicts yet.
                  </div>
                ) : (
                  recentConflicts.map((conflict) => (
                    <div
                      className="rounded-2xl border border-white/10 bg-[#08101c]/70 p-4"
                      key={conflict.id}
                    >
                      <p className="font-semibold text-white">{conflict.syncAccount.label}</p>
                      <p className="mt-1 text-slate-400">
                        {conflict.conflictType} · {conflict.status}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Contact: {conflict.contact?.fullName ?? "Detached record"} · detected{" "}
                        {formatTimestamp(conflict.detectedAt)}
                      </p>
                      <p className="mt-1 text-slate-500">
                        Remote ETag: {conflict.remoteETag ?? "Unknown"} · snapshots{" "}
                        {conflict.localSnapshot ? "local" : "no local"} /{" "}
                        {conflict.remoteSnapshot ? "remote" : "no remote"}
                      </p>
                      {conflict.resolutionNotes ? (
                        <p className="mt-2 text-slate-400">{conflict.resolutionNotes}</p>
                      ) : null}
                      {conflict.status === "OPEN" ? (
                        <form action={resolveSyncConflict} className="mt-3 grid gap-3">
                          <input
                            name="redirectTo"
                            type="hidden"
                            value="/sync?conflictResolved=1"
                          />
                          <input name="syncConflictId" type="hidden" value={conflict.id} />
                          <select
                            className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                            defaultValue="KEEP_LOCAL"
                            name="resolutionStrategy"
                          >
                            <option className="bg-slate-950 text-white" value="KEEP_LOCAL">
                              Keep local
                            </option>
                            <option className="bg-slate-950 text-white" value="KEEP_REMOTE">
                              Keep remote
                            </option>
                            <option className="bg-slate-950 text-white" value="DUPLICATE_LOCAL">
                              Duplicate local
                            </option>
                            <option className="bg-slate-950 text-white" value="ARCHIVE_LOCAL">
                              Archive local
                            </option>
                            <option className="bg-slate-950 text-white" value="MANUAL_MERGE">
                              Manual merge
                            </option>
                          </select>
                          <input
                            className="rounded-full border border-white/10 bg-[#020617] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                            name="resolutionNotes"
                            placeholder="Optional support note for this resolution"
                            type="text"
                          />
                          <button
                            className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200 hover:text-white"
                            type="submit"
                          >
                            Save resolution
                          </button>
                        </form>
                      ) : (
                        <p className="mt-2 text-emerald-100">
                          Resolution: {conflict.resolutionStrategy ?? "Saved"}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
