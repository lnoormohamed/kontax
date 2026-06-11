import Link from "next/link";
import { redirect } from "next/navigation";

import { ConfirmAction } from "~/app/_components/confirm-action";
import { SectionLabel, SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
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
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";

const fmtDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(value)
    : "—";

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

function Avatar({ label }: { label: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7efe9] text-[12px] font-semibold text-[#17352e]">
      {getInitials(label)}
    </span>
  );
}

function Tag({ children, green }: { children: React.ReactNode; green?: boolean }) {
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-md px-2 text-[11.5px] font-semibold ${
        green ? "bg-[#e7efe9] text-[#17352e]" : "bg-[#f2f4f0] text-[#5c655e]"
      }`}
    >
      {children}
    </span>
  );
}

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
        select: { id: true, name: true, description: true, archivedAt: true, _count: { select: { contacts: true } } },
      },
    },
  });

  const memberOf = ownedTeam
    ? null
    : await db.groupMember.findFirst({
        where: { userId, inviteStatus: "ACCEPTED", group: { type: "TEAM" } },
        include: { group: { include: { owner: { select: { name: true, email: true } } } } },
      });

  // ── Member (non-owner/admin) view ──
  if (memberOf) {
    const ownerName = memberOf.group.owner.name?.trim() ?? memberOf.group.owner.email ?? "the owner";
    const roleLabel =
      memberOf.role === "ADMIN" ? "Admin" : memberOf.canEdit ? "Member · can edit" : "Member · view only";
    return (
      <>
        <SettingsPageHead title="Team" sub={`You're a member of ${memberOf.group.name}.`} />
        <div className="grid gap-[18px]">
          <SettingsCard className="flex flex-wrap items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e7efe9] text-[#17352e]">
              <WorkspaceIcon name="team" size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold text-[#1d2823]">{memberOf.group.name}</div>
              <div className="mt-0.5 text-[13.5px] text-[#5c655e]">
                Run by {ownerName}. Your role: <strong className="text-[#3a4540]">{roleLabel}</strong>. Your
                private contacts stay private.
              </div>
            </div>
          </SettingsCard>

          <SettingsCard className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold text-[#1d2823]">Leave this team</div>
              <p className="mt-1 max-w-[440px] text-[13.5px] text-[#5c655e]">
                You&apos;ll lose access to the team&apos;s shared books. An admin can invite you again later.
              </p>
            </div>
            <ConfirmAction
              action={leaveTeam}
              body="You'll immediately lose access to the team's shared books. An admin can re-invite you."
              confirmLabel="Leave team"
              danger
              fields={{ groupId: memberOf.groupId }}
              title={`Leave ${memberOf.group.name}?`}
              trigger="Leave team"
              triggerClassName="rounded-xl border border-[#dcae9f] px-4 py-2.5 text-[14px] font-semibold text-[#b5472f] transition hover:bg-[#f3e1da]"
            />
          </SettingsCard>
        </div>
      </>
    );
  }

  // ── No team yet ──
  if (!ownedTeam) {
    if (!billing.entitlements.teamsEnabled) {
      return (
        <>
          <SettingsPageHead title="Team management" sub="Share multiple address books with up to 25 people." />
          <SettingsCard className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7efe9] text-[#17352e]">
              <WorkspaceIcon name="team" size={28} />
            </span>
            <h2 className="mt-4 text-[20px] font-semibold text-[#1d2823]">Teams is part of the Teams plan</h2>
            <p className="mx-auto mt-2 max-w-[440px] text-[14.5px] leading-6 text-[#5c655e]">
              Share multiple address books with up to 25 people, with roles, per-book permissions, and a full
              audit log. Upgrade to set up your team.
            </p>
            <Link
              className="mt-5 inline-flex rounded-xl bg-[#4158f4] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#3248db]"
              href="/pricing"
            >
              See the Teams plan
            </Link>
          </SettingsCard>
        </>
      );
    }
    return (
      <>
        <SettingsPageHead title="Team management" sub="Shared address books for your organisation." />
        <SettingsCard>
          <p className="text-[15px] font-semibold text-[#1d2823]">Create your team</p>
          <p className="mt-1 text-[14px] text-[#5c655e]">
            Shared address books for your organisation, with roles and a full audit log.
          </p>
          <form action={createTeam} className="mt-4 grid gap-2">
            <input
              className="rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
              name="name"
              placeholder="Team name (e.g. Acme Corp)"
            />
            <input
              className="rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
              name="description"
              placeholder="Description (optional)"
            />
            <button
              className="justify-self-start rounded-xl bg-[#17352e] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
              type="submit"
            >
              Create team
            </button>
          </form>
        </SettingsCard>
      </>
    );
  }

  // ── Owner/admin view ──
  const accepted = ownedTeam.members.filter((m) => m.role === "OWNER" || m.inviteStatus === "ACCEPTED");
  const pending = ownedTeam.members.filter((m) => m.role !== "OWNER" && m.inviteStatus !== "ACCEPTED");
  const activeCount = ownedTeam.members.filter((m) => m.inviteStatus !== "DECLINED").length;
  const full = activeCount >= ownedTeam.maxMembers;
  const activeBooks = ownedTeam.addressBooks.filter((b) => !b.archivedAt);
  const regularMembers = ownedTeam.members.filter((m) => m.role === "MEMBER" && m.inviteStatus === "ACCEPTED");
  const memberPerm = (m: (typeof ownedTeam.members)[number], bookId: string): string => {
    const perms =
      m.addressBookPermissions && typeof m.addressBookPermissions === "object"
        ? (m.addressBookPermissions as Record<string, string>)
        : {};
    return perms[bookId] ?? "EDIT";
  };

  const [mySyncAccounts, teamSyncLinks] = await Promise.all([
    db.syncAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, label: true } }),
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
        title="Team management"
        sub="Invite people, set roles and per-book access, and manage your shared books."
        right={
          <span className="rounded-full border border-[#d8ddd6] bg-[#f6f7f4] px-3 py-1 text-[12px] font-semibold text-[#5c655e]">
            {activeCount} / {ownedTeam.maxMembers} members
          </span>
        }
      />

      <div className="grid gap-[18px]">
        {/* team identity */}
        <SettingsCard className="flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e7efe9] text-[#17352e]">
            <WorkspaceIcon name="team" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold text-[#1d2823]">{ownedTeam.name}</div>
            <div className="mt-0.5 text-[13.5px] text-[#5c655e]">
              {activeBooks.length} address book{activeBooks.length === 1 ? "" : "s"} · unlimited audit log
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8ddd6] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
              href="/settings/teams/audit"
            >
              <WorkspaceIcon name="clock" size={15} />
              Audit log
            </Link>
            <ConfirmAction
              action={deleteTeam}
              body="The team, its address books, and their contacts are removed for everyone. Members keep their private contacts. This can't be undone."
              confirmLabel="Delete team"
              danger
              fields={{ groupId: ownedTeam.id }}
              title={`Delete ${ownedTeam.name}?`}
              trigger="Delete team"
              triggerClassName="rounded-xl border border-[#dcae9f] px-3.5 py-2 text-[13px] font-semibold text-[#b5472f] transition hover:bg-[#f3e1da]"
            />
          </div>
        </SettingsCard>

        {/* members */}
        <div>
          <SectionLabel>Members</SectionLabel>
          <SettingsCard className="!p-0">
            <div className="divide-y divide-[#e9ece7]">
              {accepted.map((m) => {
                const label = m.user?.name?.trim() ?? m.user?.email ?? m.invitedEmail ?? "Member";
                const isOwner = m.role === "OWNER";
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3" key={m.id}>
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar label={label} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-[#1d2823]">
                          {label}
                          {m.userId === userId ? " (you)" : ""}
                        </span>
                        <span className="block truncate text-[12.5px] text-[#5c655e]">
                          {m.user?.email ?? m.invitedEmail}
                          {!isOwner ? ` · joined ${fmtDate(m.joinedAt)}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Tag green={isOwner || m.role === "ADMIN"}>{isOwner ? "Owner" : m.role === "ADMIN" ? "Admin" : "Member"}</Tag>
                      {m.role === "MEMBER" ? (
                        <form action={setTeamMemberRole}>
                          <input name="memberId" type="hidden" value={m.id} />
                          <input name="role" type="hidden" value="ADMIN" />
                          <button className="text-[13px] font-semibold text-[#4158f4]" type="submit">
                            Make admin
                          </button>
                        </form>
                      ) : null}
                      {m.role === "ADMIN" ? (
                        <form action={setTeamMemberRole}>
                          <input name="memberId" type="hidden" value={m.id} />
                          <input name="role" type="hidden" value="MEMBER" />
                          <button className="text-[13px] font-semibold text-[#4158f4]" type="submit">
                            Make member
                          </button>
                        </form>
                      ) : null}
                      {!isOwner ? (
                        <ConfirmAction
                          action={removeTeamMember}
                          body={`${label} will lose access to the team's shared books.`}
                          confirmLabel="Remove member"
                          danger
                          fields={{ memberId: m.id }}
                          title={`Remove ${label}?`}
                          trigger="Remove"
                        />
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </SettingsCard>
        </div>

        {/* pending invites */}
        {pending.length > 0 ? (
          <div>
            <SectionLabel>Pending invites</SectionLabel>
            <SettingsCard className="!p-0">
              <div className="divide-y divide-[#e9ece7]">
                {pending.map((m) => {
                  const label = m.user?.email ?? m.invitedEmail ?? "Invited";
                  const declined = m.inviteStatus === "DECLINED";
                  return (
                    <div className="flex items-center justify-between gap-3 px-5 py-3" key={m.id}>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-[#1d2823]">{label}</span>
                        <span className="block text-[12.5px] text-[#8b938c]">
                          Invited as {m.role === "ADMIN" ? "Admin" : "Member"} · {declined ? "declined" : "pending"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        {!declined ? (
                          <form action={resendTeamInvite}>
                            <input name="memberId" type="hidden" value={m.id} />
                            <button className="text-[13px] font-semibold text-[#4158f4]" type="submit">
                              Resend
                            </button>
                          </form>
                        ) : null}
                        <form action={removeTeamMember}>
                          <input name="memberId" type="hidden" value={m.id} />
                          <button className="text-[13px] font-semibold text-[#b5472f]" type="submit">
                            {declined ? "Remove" : "Cancel"}
                          </button>
                        </form>
                      </span>
                    </div>
                  );
                })}
              </div>
            </SettingsCard>
          </div>
        ) : null}

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
                </div>
              ))}
            </div>
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
          </SettingsCard>
        </div>

        {/* per-book permissions */}
        {regularMembers.length > 0 && activeBooks.length > 0 ? (
          <div>
            <SectionLabel>Book permissions</SectionLabel>
            <SettingsCard>
              <p className="text-[13.5px] text-[#5c655e]">
                Set what each member can do per book. Owners and admins always have full access.
              </p>
              <div className="mt-3 grid gap-4">
                {regularMembers.map((m) => (
                  <div key={m.id}>
                    <p className="text-[13.5px] font-semibold text-[#1d2823]">
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
                                    className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition ${
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
            </SettingsCard>
          </div>
        ) : null}

        {/* invite */}
        <SettingsCard>
          <p className="text-[14.5px] font-semibold text-[#1d2823]">Invite a team member</p>
          <p className="mt-1 text-[13.5px] text-[#5c655e]">
            They get an email with a link to join. New members can edit by default; set view-only per book later.
          </p>
          {full ? (
            <p className="mt-3 rounded-xl bg-[#f6edd9] px-3.5 py-2.5 text-[13.5px] text-[#7c5511]">
              Your team is full ({ownedTeam.maxMembers} members). Remove someone to invite another.
            </p>
          ) : (
            <form action={inviteTeamMember} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="min-w-[200px] flex-1 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
                name="email"
                placeholder="name@email.com"
                required
                type="email"
              />
              <select
                className="rounded-xl border border-[#d8ddd6] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#1d2823] outline-none focus:border-[#4158f4]"
                name="role"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button
                className="rounded-xl bg-[#17352e] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
                type="submit"
              >
                Send invite
              </button>
            </form>
          )}
        </SettingsCard>

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
                    <form action={unlinkTeamSyncAccount}>
                      <input name="teamSyncAccountId" type="hidden" value={l.id} />
                      <button className="shrink-0 text-[13px] font-semibold text-[#b5472f]" type="submit">
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
