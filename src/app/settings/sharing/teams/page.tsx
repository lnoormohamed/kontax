import Link from "next/link";

import { redirectToLogin } from "~/server/auth/require-page-auth";

import { ConfirmAction } from "~/app/_components/confirm-action";
import { SectionLabel, SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import {
  createTeam,
  deleteTeam,
  inviteTeamMember,
  leaveTeam,
  openTeamBillingPortal,
  removeTeamMember,
  resendTeamInvite,
  setBillingManager,
  setTeamMemberRole,
  transferTeamOwnership,
} from "~/app/actions/teams";
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";
import { getTeamBillingSummary } from "~/server/team-access";
import { loadOwnedTeam } from "./_lib";

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
  if (!session?.user?.id) return redirectToLogin("/settings/sharing/teams");
  const userId = session.user.id;

  // P46-18: one shared owned-team loader (also used by the Books /
  // Permissions child pages) — the member / no-team states stay here.
  const ctx = await loadOwnedTeam(userId);

  const memberOf = ctx
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
    // P34F-06: read-only billing summary for every member. P34F-04: a member with
    // canManageBilling (or an admin who's been granted it) can open the portal.
    const memberBilling = await getTeamBillingSummary(memberOf.groupId);
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

          {memberBilling && (
            <SettingsCard className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold text-[#1d2823]">Plan</div>
                <p className="mt-1 text-[13.5px] text-[#5c655e]">
                  {memberBilling.plan} · {memberBilling.seatsUsed}
                  {memberBilling.seatsLimit ? ` of ${memberBilling.seatsLimit}` : ""} seats
                  {memberBilling.cancelAtPeriodEnd && memberBilling.renewsAt
                    ? ` · ends ${fmtDate(memberBilling.renewsAt)}`
                    : memberBilling.renewsAt
                      ? ` · renews ${fmtDate(memberBilling.renewsAt)}`
                      : ""}
                </p>
              </div>
              {memberOf.canManageBilling && (
                <form action={openTeamBillingPortal}>
                  <input name="groupId" type="hidden" value={memberOf.groupId} />
                  <button
                    className="shrink-0 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
                    type="submit"
                  >
                    Manage billing
                  </button>
                </form>
              )}
            </SettingsCard>
          )}

          <SettingsCard className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold text-[#1d2823]">Leave this team</div>
              <p className="mt-1 max-w-[440px] text-[13.5px] text-[#5c655e]">
                Team contacts belong to {memberOf.group.name} — you lose access and they&apos;re not
                copied to your account. Your private contacts stay private. An admin can invite you again later.
              </p>
            </div>
            <ConfirmAction
              action={leaveTeam}
              body="You'll lose access to all team books. Team contacts belong to the team and aren't copied to you; your private contacts are untouched."
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
  if (!ctx) {
    const billing = await getUserBillingContext(userId);
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
  const { ownedTeam, pendingSetup, isLocked, isGrace } = ctx;

  // Option A: a group created at checkout that hasn't been paid yet — it exists,
  // is not active, and is not in grace. Show a "finishing setup" state rather than
  // the full management UI (which getTeamGraceState would otherwise read active).
  if (pendingSetup) {
    return (
      <>
        <SettingsPageHead title="Team management" sub="Finishing your Teams setup." />
        <SettingsCard className="text-center">
          <h2 className="mt-2 text-[18px] font-semibold text-[#1d2823]">
            Completing your Teams subscription…
          </h2>
          <p className="mx-auto mt-2 max-w-[440px] text-[14px] leading-6 text-[#5c655e]">
            We&apos;re waiting for your payment to confirm. This page updates once your
            team is active — refresh in a moment.
          </p>
        </SettingsCard>
      </>
    );
  }

  const accepted = ownedTeam.members.filter((m) => m.role === "OWNER" || m.inviteStatus === "ACCEPTED");
  const pending = ownedTeam.members.filter((m) => m.role !== "OWNER" && m.inviteStatus !== "ACCEPTED");
  const activeCount = ownedTeam.members.filter((m) => m.inviteStatus !== "DECLINED").length;
  const full = activeCount >= ownedTeam.maxMembers;
  const activeBooks = ownedTeam.addressBooks.filter((b) => !b.archivedAt);

  // P34F-06: read-only billing summary (owner is always a billing manager).
  const billingSummary = await getTeamBillingSummary(ownedTeam.id);

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
        {/* grace / locked banner */}
        {isLocked && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#dcae9f] bg-[#fdf4f1] px-5 py-4">
            <div>
              <p className="text-[14px] font-semibold text-[#b5472f]">This team is read-only</p>
              <p className="mt-0.5 text-[13px] text-[#b5472f]">
                Your Teams plan ended and the grace period has expired. Upgrade to re-enable editing.
              </p>
            </div>
            <Link
              className="shrink-0 rounded-xl bg-[#4158f4] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[#3248db]"
              href="/settings/billing"
            >
              Upgrade to Teams
            </Link>
          </div>
        )}
        {isGrace && ownedTeam.teamsGraceEndsAt && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#e6d5a0] bg-[#fffbee] px-5 py-4">
            <div>
              <p className="text-[14px] font-semibold text-[#7c5511]">Teams plan ended — grace period active</p>
              <p className="mt-0.5 text-[13px] text-[#7c5511]">
                Full access until{" "}
                <strong>
                  {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
                    ownedTeam.teamsGraceEndsAt,
                  )}
                </strong>
                . After that this team becomes read-only. Upgrade to keep editing.
              </p>
            </div>
            <Link
              className="shrink-0 rounded-xl bg-[#4158f4] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[#3248db]"
              href="/settings/billing"
            >
              Upgrade to Teams
            </Link>
          </div>
        )}

        {/* seat meter — visible on mobile and desktop */}
        {(() => {
          const pct = Math.min(100, Math.round((activeCount / ownedTeam.maxMembers) * 100));
          const atLimit = full;
          return (
            <div className="rounded-[14px] border border-[#d8ddd6] bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold tabular-nums text-[#1d2823]">
                  {activeCount} of {ownedTeam.maxMembers} seats used
                </span>
                {atLimit && (
                  <span className="rounded-md bg-[#f6edd9] px-2 py-0.5 text-[11px] font-bold text-[#7c5511]">
                    Limit reached
                  </span>
                )}
              </div>
              <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-[#e9ece7]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: atLimit ? "#bf8526" : "#17352e" }}
                />
              </div>
            </div>
          );
        })()}

        {/* P34F-04/06: billing — read-only summary + manager-only portal access */}
        {billingSummary && (
          <SettingsCard className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold text-[#1d2823]">Billing</div>
              <p className="mt-1 text-[13.5px] text-[#5c655e]">
                Run by {billingSummary.ownerName} · {billingSummary.plan} ·{" "}
                {billingSummary.seatsUsed}
                {billingSummary.seatsLimit ? ` of ${billingSummary.seatsLimit}` : ""} seats
                {billingSummary.cancelAtPeriodEnd && billingSummary.renewsAt
                  ? ` · ends ${fmtDate(billingSummary.renewsAt)}`
                  : billingSummary.renewsAt
                    ? ` · renews ${fmtDate(billingSummary.renewsAt)}`
                    : ""}
              </p>
            </div>
            <form action={openTeamBillingPortal}>
              <input name="groupId" type="hidden" value={ownedTeam.id} />
              <button
                className="shrink-0 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
                type="submit"
              >
                Manage billing
              </button>
            </form>
          </SettingsCard>
        )}

        {/* P46-18 / DB07: seats are READ-ONLY here — Plan & billing owns the
            seat count and purchase; this card links there. */}
        {!isLocked && (
          <SettingsCard className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold text-[#1d2823]">Seats</div>
              <p className="mt-1 max-w-[440px] text-[13.5px] text-[#5c655e]">
                {activeCount} of {ownedTeam.maxMembers} seats in use. Seat changes are prorated and
                managed on Plan &amp; billing.
              </p>
            </div>
            <Link
              className="shrink-0 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
              href="/settings/billing"
            >
              Manage seats
            </Link>
          </SettingsCard>
        )}

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
              href="/settings/sharing/teams/audit"
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
                      {!isLocked && m.role === "MEMBER" ? (
                        <form action={setTeamMemberRole}>
                          <input name="memberId" type="hidden" value={m.id} />
                          <input name="role" type="hidden" value="ADMIN" />
                          <button className="text-[13px] font-semibold text-[#4158f4]" type="submit">
                            Make admin
                          </button>
                        </form>
                      ) : null}
                      {!isLocked && m.role === "ADMIN" ? (
                        <form action={setTeamMemberRole}>
                          <input name="memberId" type="hidden" value={m.id} />
                          <input name="role" type="hidden" value="MEMBER" />
                          <button className="text-[13px] font-semibold text-[#4158f4]" type="submit">
                            Make member
                          </button>
                        </form>
                      ) : null}
                      {/* P34F-04: billing-manager access */}
                      {isOwner ? (
                        <Tag green>Billing: Always</Tag>
                      ) : (
                        <form action={setBillingManager}>
                          <input name="memberId" type="hidden" value={m.id} />
                          <input name="enabled" type="hidden" value={m.canManageBilling ? "false" : "true"} />
                          <button className="text-[13px] font-semibold text-[#4158f4]" type="submit">
                            {m.canManageBilling ? "Remove billing" : "Make billing manager"}
                          </button>
                        </form>
                      )}
                      {/* P34F-05: owner transfer (role change, no Stripe op) */}
                      {!isOwner && m.inviteStatus === "ACCEPTED" && m.userId ? (
                        <ConfirmAction
                          action={transferTeamOwnership}
                          body={`${label} will become the owner and you'll become an Admin. Billing stays with the team — no payment changes.`}
                          confirmLabel="Make owner"
                          fields={{ groupId: ownedTeam.id, memberId: m.id }}
                          title={`Make ${label} the owner?`}
                          trigger="Make owner"
                        />
                      ) : null}
                      {!isLocked && !isOwner ? (
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
                        {!isLocked && !declined ? (
                          <form action={resendTeamInvite}>
                            <input name="memberId" type="hidden" value={m.id} />
                            <button className="text-[13px] font-semibold text-[#4158f4]" type="submit">
                              Resend
                            </button>
                          </form>
                        ) : !isLocked ? (
                          <form action={inviteTeamMember}>
                            <input name="email" type="hidden" value={m.invitedEmail ?? m.user?.email ?? ""} />
                            <input name="role" type="hidden" value={m.role} />
                            <button className="text-[13px] font-semibold text-[#4158f4]" disabled={full} type="submit">
                              Invite again
                            </button>
                          </form>
                        ) : null}
                        {!isLocked && (
                          <form action={removeTeamMember}>
                            <input name="memberId" type="hidden" value={m.id} />
                            <button className="text-[13px] font-semibold text-[#b5472f]" type="submit">
                              {declined ? "Dismiss" : "Cancel"}
                            </button>
                          </form>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SettingsCard>
          </div>
        ) : null}

        {/* P46-18: Books & permissions live on child pages now (DB07 T5 —
            even depth with Family; no single page carries books + seats +
            billing + audit at once). */}
        <div>
          <SectionLabel>Books &amp; permissions</SectionLabel>
          <SettingsCard className="!p-0">
            <div className="divide-y divide-[#e9ece7]">
              <Link
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-[#fbfcf9]"
                href="/settings/sharing/teams/books"
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-[#1d2823]">Team books</span>
                  <span className="block text-[12.5px] text-[#8b938c]">
                    {activeBooks.length} active book{activeBooks.length === 1 ? "" : "s"} · create,
                    archive, link sync accounts
                  </span>
                </span>
                <WorkspaceIcon name="chevronRight" size={17} className="shrink-0 text-[#d8ddd6]" />
              </Link>
              {!isLocked ? (
                <Link
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-[#fbfcf9]"
                  href="/settings/sharing/teams/permissions"
                >
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-[#1d2823]">Book permissions</span>
                    <span className="block text-[12.5px] text-[#8b938c]">
                      Per-member, per-book access — edit, view, or none
                    </span>
                  </span>
                  <WorkspaceIcon name="chevronRight" size={17} className="shrink-0 text-[#d8ddd6]" />
                </Link>
              ) : null}
            </div>
          </SettingsCard>
        </div>

        {/* invite — hidden when locked */}
        {!isLocked && (
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
        )}

      </div>
    </>
  );
}
