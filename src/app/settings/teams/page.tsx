import Link from "next/link";
import { redirect } from "next/navigation";

import {
  archiveTeamBook,
  createTeam,
  createTeamBook,
  deleteTeam,
  deleteTeamBook,
  inviteTeamMember,
  leaveTeam,
  linkTeamSyncAccount,
  removeTeamMember,
  resendTeamInvite,
  setMemberBookPermission,
  setTeamMemberRole,
  unlinkTeamSyncAccount,
} from "~/app/actions/teams";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";

const fmtDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
        value,
      )
    : "—";

export default async function TeamSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const billing = await getUserBillingContext(userId);

  const ownedTeam = await db.group.findFirst({
    where: { ownerId: userId, type: "TEAM" },
    include: {
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: { user: { select: { name: true, email: true } } },
      },
      addressBooks: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, description: true, archivedAt: true },
      },
    },
  });

  const memberOf = ownedTeam
    ? null
    : await db.groupMember.findFirst({
        where: { userId, inviteStatus: "ACCEPTED", group: { type: "TEAM" } },
        include: { group: { include: { owner: { select: { name: true, email: true } } } } },
      });

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="mx-auto max-w-2xl px-5 py-8 text-[#1d2823]">
      <Link
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5c655e] transition hover:text-[#1d2823]"
        href="/settings"
      >
        <WorkspaceIcon name="back" size={16} />
        Settings
      </Link>
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Team</h1>
      <div className="mt-5">{children}</div>
    </div>
  );

  // Member (non-owner/admin) view
  if (memberOf) {
    const ownerName = memberOf.group.owner.name?.trim() ?? memberOf.group.owner.email ?? "the owner";
    const roleLabel =
      memberOf.role === "ADMIN" ? "Admin" : memberOf.canEdit ? "Member · can edit" : "Member · view only";
    return (
      <Shell>
        <div className="rounded-[14px] border border-[#d8ddd6] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">Your team</p>
          <h2 className="mt-1 text-[17px] font-semibold">{memberOf.group.name}</h2>
          <p className="mt-1 text-[13px] text-[#5c655e]">
            Run by {ownerName}. Your role: <strong>{roleLabel}</strong>. Your private contacts stay
            private.
          </p>
          <form action={leaveTeam} className="mt-4">
            <input name="groupId" type="hidden" value={memberOf.groupId} />
            <button
              className="rounded-[9px] border border-[#d8ddd6] bg-white px-3.5 py-2 text-sm font-semibold text-[#b5472f] transition hover:bg-[#fbeae6]"
              type="submit"
            >
              Leave team
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  // No team yet
  if (!ownedTeam) {
    if (!billing.entitlements.teamsEnabled) {
      return (
        <Shell>
          <div className="rounded-[14px] border border-[#d8ddd6] bg-white p-6 text-center">
            <p className="text-sm font-semibold text-[#1d2823]">Teams is a Teams plan feature</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#8b938c]">
              Upgrade to the Teams plan to share multiple address books with up to 25 people, with
              roles and an audit log.
            </p>
            <Link
              className="mt-4 inline-flex rounded-[9px] bg-[#4158f4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3248db]"
              href="/pricing"
            >
              View plans
            </Link>
          </div>
        </Shell>
      );
    }
    return (
      <Shell>
        <form action={createTeam} className="rounded-[14px] border border-[#d8ddd6] bg-white p-6">
          <p className="text-sm font-semibold text-[#1d2823]">Create your team</p>
          <p className="mt-1 text-[13px] text-[#8b938c]">
            Shared address books for your organisation, with roles and a full audit log.
          </p>
          <div className="mt-4 grid gap-2">
            <input
              className="rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-2 text-sm outline-none focus:border-[#4158f4]"
              name="name"
              placeholder="Team name (e.g. Acme Corp)"
            />
            <input
              className="rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-2 text-sm outline-none focus:border-[#4158f4]"
              name="description"
              placeholder="Description (optional)"
            />
            <button
              className="justify-self-start rounded-[9px] bg-[#4158f4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3248db]"
              type="submit"
            >
              Create team
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  // Owner view — manage members + roles + invites
  const activeCount = ownedTeam.members.filter((m) => m.inviteStatus !== "DECLINED").length;
  const full = activeCount >= ownedTeam.maxMembers;
  const activeBooks = ownedTeam.addressBooks.filter((b) => !b.archivedAt);
  const regularMembers = ownedTeam.members.filter(
    (m) => m.role === "MEMBER" && m.inviteStatus === "ACCEPTED",
  );
  const memberPerm = (m: (typeof ownedTeam.members)[number], bookId: string): string => {
    const perms =
      m.addressBookPermissions && typeof m.addressBookPermissions === "object"
        ? (m.addressBookPermissions as Record<string, string>)
        : {};
    return perms[bookId] ?? "EDIT";
  };

  // P14-06: the admin's connected CardDAV accounts + the team's sync links.
  const [mySyncAccounts, teamSyncLinks] = await Promise.all([
    db.syncAccount.findMany({
      where: { userId },
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
    <Shell>
      <div className="grid gap-4">
        <section className="rounded-[14px] border border-[#d8ddd6] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">Team</p>
          <h2 className="mt-1 text-[17px] font-semibold">{ownedTeam.name}</h2>
          <p className="mt-1 text-[13px] text-[#5c655e]">
            {activeCount} of {ownedTeam.maxMembers} members · {activeBooks.length} address
            book{activeBooks.length === 1 ? "" : "s"}
          </p>
          <Link
            className="mt-3 inline-flex items-center gap-1.5 rounded-[9px] border border-[#d8ddd6] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
            href="/settings/teams/audit"
          >
            <WorkspaceIcon name="clock" size={15} />
            View audit log
          </Link>

          <div className="mt-4 grid gap-2">
            {ownedTeam.members.map((m) => {
              const label = m.user?.name?.trim() ?? m.user?.email ?? m.invitedEmail ?? "Invited";
              const statusLabel =
                m.role === "OWNER"
                  ? "Owner"
                  : m.inviteStatus === "ACCEPTED"
                    ? m.role === "ADMIN"
                      ? "Admin"
                      : "Member"
                    : m.inviteStatus === "DECLINED"
                      ? "Declined"
                      : "Pending";
              return (
                <div
                  className="flex items-center justify-between gap-3 border-b border-[#e9ece7] pb-2 text-[13px] last:border-b-0"
                  key={m.id}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[#1d2823]">{label}</span>
                    {m.inviteStatus === "ACCEPTED" && m.role !== "OWNER" ? (
                      <span className="text-[12px] text-[#8b938c]">Joined {fmtDate(m.joinedAt)}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[#8b938c]">{statusLabel}</span>
                    {m.role === "MEMBER" && m.inviteStatus === "ACCEPTED" ? (
                      <form action={setTeamMemberRole}>
                        <input name="memberId" type="hidden" value={m.id} />
                        <input name="role" type="hidden" value="ADMIN" />
                        <button className="font-semibold text-[#4158f4]" type="submit">
                          Make admin
                        </button>
                      </form>
                    ) : null}
                    {m.role === "ADMIN" ? (
                      <form action={setTeamMemberRole}>
                        <input name="memberId" type="hidden" value={m.id} />
                        <input name="role" type="hidden" value="MEMBER" />
                        <button className="font-semibold text-[#4158f4]" type="submit">
                          Make member
                        </button>
                      </form>
                    ) : null}
                    {m.role !== "OWNER" && m.inviteStatus === "PENDING" ? (
                      <form action={resendTeamInvite}>
                        <input name="memberId" type="hidden" value={m.id} />
                        <button className="font-semibold text-[#4158f4]" type="submit">
                          Resend
                        </button>
                      </form>
                    ) : null}
                    {m.role !== "OWNER" ? (
                      <form action={removeTeamMember}>
                        <input name="memberId" type="hidden" value={m.id} />
                        <button className="font-semibold text-[#b5472f]" type="submit">
                          {m.inviteStatus === "PENDING" ? "Revoke" : "Remove"}
                        </button>
                      </form>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Address books */}
        <section className="rounded-[14px] border border-[#d8ddd6] bg-white p-5">
          <p className="text-sm font-semibold text-[#1d2823]">Address books</p>
          <p className="mt-1 text-[13px] text-[#8b938c]">
            Organise team contacts into named books (e.g. Clients, Partners). Archived books are
            read-only.
          </p>
          <div className="mt-3 grid gap-2">
            {ownedTeam.addressBooks.map((b) => (
              <div
                className="flex items-center justify-between gap-3 border-b border-[#e9ece7] pb-2 text-[13px] last:border-b-0"
                key={b.id}
              >
                <span className="min-w-0">
                  <span className="text-[#1d2823]">{b.name}</span>
                  {b.archivedAt ? <span className="text-[#8b938c]"> · archived</span> : null}
                  {b.description ? (
                    <span className="block text-[12px] text-[#8b938c]">{b.description}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <form action={archiveTeamBook}>
                    <input name="bookId" type="hidden" value={b.id} />
                    <button className="font-semibold text-[#4158f4]" type="submit">
                      {b.archivedAt ? "Restore" : "Archive"}
                    </button>
                  </form>
                  <form action={deleteTeamBook}>
                    <input name="bookId" type="hidden" value={b.id} />
                    <button className="font-semibold text-[#b5472f]" type="submit">
                      Delete
                    </button>
                  </form>
                </span>
              </div>
            ))}
          </div>
          <form action={createTeamBook} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="min-w-[160px] flex-1 rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-2 text-sm outline-none focus:border-[#4158f4]"
              name="name"
              placeholder="New book name"
              required
            />
            <input
              className="min-w-[160px] flex-1 rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-2 text-sm outline-none focus:border-[#4158f4]"
              name="description"
              placeholder="Description (optional)"
            />
            <button
              className="rounded-[9px] bg-[#4158f4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3248db]"
              type="submit"
            >
              Add book
            </button>
          </form>
        </section>

        {/* Per-book permissions (members only; owner/admin always full) */}
        {regularMembers.length > 0 && activeBooks.length > 0 ? (
          <section className="rounded-[14px] border border-[#d8ddd6] bg-white p-5">
            <p className="text-sm font-semibold text-[#1d2823]">Book permissions</p>
            <p className="mt-1 text-[13px] text-[#8b938c]">
              Set what each member can do per book. Owners and admins always have full access.
            </p>
            <div className="mt-3 grid gap-4">
              {regularMembers.map((m) => (
                <div key={m.id}>
                  <p className="text-[13px] font-semibold text-[#1d2823]">
                    {m.user?.name?.trim() ?? m.user?.email ?? "Member"}
                  </p>
                  <div className="mt-1.5 grid gap-1.5">
                    {activeBooks.map((b) => {
                      const cur = memberPerm(m, b.id);
                      return (
                        <div className="flex items-center justify-between gap-3 text-[13px]" key={b.id}>
                          <span className="min-w-0 truncate text-[#5c655e]">{b.name}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            {(["EDIT", "VIEW", "NONE"] as const).map((perm) => (
                              <form action={setMemberBookPermission} key={perm}>
                                <input name="memberId" type="hidden" value={m.id} />
                                <input name="bookId" type="hidden" value={b.id} />
                                <input name="permission" type="hidden" value={perm} />
                                <button
                                  className={`rounded-[6px] px-2 py-1 text-[12px] font-semibold transition ${
                                    cur === perm
                                      ? "bg-[#17352e] text-white"
                                      : "bg-[#f2f4f0] text-[#5c655e] hover:bg-[#e6e9e3]"
                                  }`}
                                  type="submit"
                                >
                                  {perm === "EDIT" ? "Edit" : perm === "VIEW" ? "View" : "None"}
                                </button>
                              </form>
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[14px] border border-[#d8ddd6] bg-white p-5">
          <p className="text-sm font-semibold text-[#1d2823]">Invite a team member</p>
          <p className="mt-1 text-[13px] text-[#8b938c]">
            They get an email with a link to join. New members can edit by default; set view-only per
            book later.
          </p>
          {full ? (
            <p className="mt-3 rounded-[9px] bg-[#f6edd9] px-3.5 py-2.5 text-[13px] text-[#7a5a1a]">
              Your team is full ({ownedTeam.maxMembers} members).
            </p>
          ) : (
            <form action={inviteTeamMember} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="min-w-[220px] flex-1 rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-2 text-sm outline-none focus:border-[#4158f4]"
                name="email"
                placeholder="name@email.com"
                required
                type="email"
              />
              <button
                className="rounded-[9px] bg-[#4158f4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3248db]"
                type="submit"
              >
                Send invite
              </button>
            </form>
          )}
        </section>

        {/* Team CardDAV sync accounts */}
        <section className="rounded-[14px] border border-[#d8ddd6] bg-white p-5">
          <p className="text-sm font-semibold text-[#1d2823]">Sync accounts</p>
          <p className="mt-1 text-[13px] text-[#8b938c]">
            Sync a team book to an external CardDAV provider (Google Workspace, Nextcloud…). Connect
            an account under{" "}
            <Link className="font-semibold text-[#4158f4]" href="/sync">
              Sync
            </Link>
            , then link it to a book here.
          </p>

          {teamSyncLinks.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {teamSyncLinks.map((l) => (
                <div
                  className="flex items-center justify-between gap-3 border-b border-[#e9ece7] pb-2 text-[13px] last:border-b-0"
                  key={l.id}
                >
                  <span className="min-w-0">
                    <span className="text-[#1d2823]">{l.syncAccount.label}</span>
                    <span className="text-[#8b938c]"> → {l.addressBook.name}</span>
                  </span>
                  <form action={unlinkTeamSyncAccount}>
                    <input name="teamSyncAccountId" type="hidden" value={l.id} />
                    <button className="shrink-0 font-semibold text-[#b5472f]" type="submit">
                      Unlink
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : null}

          {linkableAccounts.length > 0 && activeBooks.length > 0 ? (
            <form action={linkTeamSyncAccount} className="mt-3 flex flex-wrap items-center gap-2">
              <select
                className="rounded-[9px] border border-[#d8ddd6] bg-white px-2.5 py-2 text-[13px]"
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
                className="rounded-[9px] border border-[#d8ddd6] bg-white px-2.5 py-2 text-[13px]"
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
                className="rounded-[9px] bg-[#4158f4] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#3248db]"
                type="submit"
              >
                Link
              </button>
            </form>
          ) : (
            <p className="mt-3 text-[12px] text-[#8b938c]">
              {activeBooks.length === 0
                ? "Create an address book first."
                : "Connect a CardDAV account under Sync to link it here."}
            </p>
          )}
        </section>

        <section className="rounded-[14px] border border-[#f0d8ce] bg-white p-5">
          <p className="text-sm font-semibold text-[#b5472f]">Delete team</p>
          <p className="mt-1 text-[13px] text-[#8b938c]">
            Permanently deletes the team, its address books and their contacts for everyone. Members
            keep their private contacts. This can&rsquo;t be undone.
          </p>
          <details className="mt-3">
            <summary className="inline-flex cursor-pointer list-none rounded-[9px] border border-[#f0d8ce] px-3.5 py-2 text-sm font-semibold text-[#b5472f] transition hover:bg-[#fbeae6]">
              Delete team…
            </summary>
            <form action={deleteTeam} className="mt-3">
              <input name="groupId" type="hidden" value={ownedTeam.id} />
              <button
                className="rounded-[9px] bg-[#b5472f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9c3c28]"
                type="submit"
              >
                Yes, permanently delete &ldquo;{ownedTeam.name}&rdquo;
              </button>
            </form>
          </details>
        </section>
      </div>
    </Shell>
  );
}
