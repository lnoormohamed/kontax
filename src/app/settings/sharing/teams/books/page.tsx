import Link from "next/link";
import { redirect } from "next/navigation";

import { redirectToLogin } from "~/server/auth/require-page-auth";
import { ConfirmAction } from "~/app/_components/confirm-action";
import { SectionLabel, SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import {
  archiveTeamBook,
  createTeamBook,
  deleteTeamBook,
  linkTeamSyncAccount,
  unlinkTeamSyncAccount,
} from "~/app/actions/teams";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { SYNC_ACCOUNT_HISTORICAL_STATUSES } from "~/lib/sync-account-status";
import { loadOwnedTeam } from "../_lib";

export const metadata = { title: "Team books" };

// P46-18 / DB07 T5 remainder — Books child page, split out of the Teams
// monolith. Owner-only; members and team-less owners land on the parent,
// which owns those states.
export default async function TeamBooksPage() {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings/sharing/teams/books");
  const userId = session.user.id;

  const ctx = await loadOwnedTeam(userId);
  if (!ctx || ctx.pendingSetup) redirect("/settings/sharing/teams");
  const { ownedTeam, isLocked } = ctx;

  const activeBooks = ownedTeam.addressBooks.filter((b) => !b.archivedAt);

  const [mySyncAccounts, teamSyncLinks] = await Promise.all([
    db.syncAccount.findMany({
      where: { userId, status: { notIn: [...SYNC_ACCOUNT_HISTORICAL_STATUSES] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, label: true },
    }),
    db.teamSyncAccount.findMany({
      where: { groupId: ownedTeam.id },
      include: {
        syncAccount: { select: { label: true, status: true } },
        addressBook: { select: { name: true } },
      },
    }),
  ]);
  const linkedAccountIds = new Set(teamSyncLinks.map((l) => l.syncAccountId));
  const linkableAccounts = mySyncAccounts.filter((a) => !linkedAccountIds.has(a.id));

  return (
    <>
      <SettingsPageHead
        title="Team books"
        sub={`Shared address books for ${ownedTeam.name}, and the sync accounts they're linked to.`}
        right={
          <Link
            className="rounded-xl border border-[#d8ddd6] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            href="/settings/sharing/teams"
          >
            ← Team management
          </Link>
        }
      />

      <div className="grid gap-[18px]">
        {/* address books */}
        <div>
          <SectionLabel>Address books</SectionLabel>
          <SettingsCard>
            <p className="text-[13.5px] text-[#5c655e]">
              Organise team contacts into named books (e.g. Clients, Partners). Archived books are read-only.
            </p>
            <div className="mt-3 divide-y divide-[#e9ece7]">
              {ownedTeam.addressBooks.map((b) => (
                <div className="flex items-center justify-between gap-3 py-2.5" key={b.id}>
                  <span className="min-w-0">
                    <span className="text-[14px] font-semibold text-[#1d2823]">{b.name}</span>
                    {b.archivedAt ? <span className="ml-2 text-[12px] font-semibold text-[#8b938c]">Archived</span> : null}
                    <span className="block text-[12.5px] text-[#8b938c]">
                      {b.description ? `${b.description} · ` : ""}{b._count.contacts.toLocaleString()} contacts
                    </span>
                  </span>
                  {!isLocked && (
                    <span className="flex shrink-0 items-center gap-3">
                      <form action={archiveTeamBook}>
                        <input name="bookId" type="hidden" value={b.id} />
                        <button className="text-[13px] font-semibold text-[#4158f4]" type="submit">
                          {b.archivedAt ? "Restore" : "Archive"}
                        </button>
                      </form>
                      <ConfirmAction
                        action={deleteTeamBook}
                        body={`"${b.name}" and its contacts are permanently removed for everyone. This can't be undone.`}
                        confirmLabel="Delete book"
                        danger
                        fields={{ bookId: b.id }}
                        title={`Delete ${b.name}?`}
                        trigger="Delete"
                      />
                    </span>
                  )}
                </div>
              ))}
            </div>
            {!isLocked && (
              <form action={createTeamBook} className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  className="min-w-[160px] flex-1 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
                  name="name"
                  placeholder="New book name"
                  required
                />
                <input
                  className="min-w-[160px] flex-1 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
                  name="description"
                  placeholder="Description (optional)"
                />
                <button
                  className="rounded-xl bg-[#17352e] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
                  type="submit"
                >
                  Add book
                </button>
              </form>
            )}
          </SettingsCard>
        </div>

        {/* sync accounts */}
        <div>
          <SectionLabel>Sync accounts</SectionLabel>
          <SettingsCard>
            <p className="text-[13.5px] text-[#5c655e]">
              Sync a team book to an external CardDAV provider (Google Workspace, Nextcloud…). Connect an
              account under{" "}
              <Link className="font-semibold text-[#4158f4]" href="/sync">
                Sync
              </Link>
              , then link it to a book here.
            </p>

            {teamSyncLinks.length > 0 ? (
              <div className="mt-3 divide-y divide-[#e9ece7]">
                {teamSyncLinks.map((l) => (
                  <div className="flex items-center justify-between gap-3 py-2.5 text-[13px]" key={l.id}>
                    <span className="min-w-0">
                      <span className="text-[#1d2823]">{l.syncAccount.label}</span>
                      <span className="text-[#8b938c]"> → {l.addressBook.name}</span>
                    </span>
                    {!isLocked && (
                      <form action={unlinkTeamSyncAccount}>
                        <input name="teamSyncAccountId" type="hidden" value={l.id} />
                        <button className="shrink-0 text-[13px] font-semibold text-[#b5472f]" type="submit">
                          Unlink
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {!isLocked && linkableAccounts.length > 0 && activeBooks.length > 0 ? (
              <form action={linkTeamSyncAccount} className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className="rounded-xl border border-[#d8ddd6] bg-white px-3 py-2.5 text-[13px]"
                  name="syncAccountId"
                  required
                >
                  {linkableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <span className="text-[13px] text-[#8b938c]">→</span>
                <select
                  className="rounded-xl border border-[#d8ddd6] bg-white px-3 py-2.5 text-[13px]"
                  name="bookId"
                  required
                >
                  {activeBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-xl bg-[#4158f4] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#3248db]"
                  type="submit"
                >
                  Link
                </button>
              </form>
            ) : (
              <p className="mt-3 text-[12.5px] text-[#8b938c]">
                {activeBooks.length === 0
                  ? "Create an address book first."
                  : "Connect a CardDAV account under Sync to link it here."}
              </p>
            )}
          </SettingsCard>
        </div>
      </div>
    </>
  );
}
