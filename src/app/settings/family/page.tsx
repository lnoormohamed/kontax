import Link from "next/link";
import { redirect } from "next/navigation";

import { ConfirmAction } from "~/app/_components/confirm-action";
import { SectionLabel, SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import {
  createFamilyGroup,
  deleteFamilyGroup,
  inviteFamilyMember,
  leaveFamilyGroup,
  removeFamilyMember,
  resendFamilyInvite,
  setMemberCanEdit,
} from "~/app/actions/family";
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

type TagKind = "Owner" | "Can edit" | "View only" | "Pending" | "Declined" | "Member";

const TAG_STYLES: Record<TagKind, string> = {
  Owner:      "bg-[#e7efe9] text-[#17352e]",
  "Can edit": "bg-[#edf0fe] text-[#3142c4]",
  "View only":"bg-[#f2f4f0] text-[#5c655e]",
  Pending:    "bg-[#f6edd9] text-[#7c5511]",
  Declined:   "bg-[#f3e1da] text-[#9a3a23]",
  Member:     "bg-[#f2f4f0] text-[#5c655e]",
};

function Tag({ children, kind }: { children: React.ReactNode; kind?: TagKind; green?: boolean }) {
  const cls = kind ? TAG_STYLES[kind] : TAG_STYLES.Member;
  return (
    <span className={`inline-flex h-[22px] items-center rounded-md px-2 text-[11.5px] font-semibold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}

export default async function FamilySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const billing = await getUserBillingContext(userId);

  const ownedGroup = await db.group.findFirst({
    where: { ownerId: userId, type: "FAMILY" },
    include: {
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  const memberOf = ownedGroup
    ? null
    : await db.groupMember.findFirst({
        where: { userId, inviteStatus: "ACCEPTED", group: { type: "FAMILY" } },
        include: {
          group: {
            include: {
              owner: { select: { name: true, email: true } },
              members: {
                where: { inviteStatus: "ACCEPTED" },
                orderBy: [{ role: "asc" }, { createdAt: "asc" }],
                include: { user: { select: { name: true, email: true } } },
              },
            },
          },
        },
      });

  // ── Member (non-owner) view ──
  if (memberOf) {
    const ownerName = memberOf.group.owner.name?.trim() ?? memberOf.group.owner.email ?? "the owner";
    return (
      <>
        <SettingsPageHead
          title="Family"
          sub={`You're a member of ${memberOf.group.name}.`}
          right={
            <span className="rounded-full border border-[#d8ddd6] bg-[#f6f7f4] px-3 py-1 text-[12px] font-semibold text-[#5c655e]">
              {memberOf.group.members.length} members
            </span>
          }
        />
        <div className="grid gap-[18px]">
          <SettingsCard className="flex flex-wrap items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e7efe9] text-[#17352e]">
              <WorkspaceIcon name="users" size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold text-[#1d2823]">{memberOf.group.name}</div>
              <div className="mt-0.5 text-[13.5px] text-[#5c655e]">
                Shared by {ownerName}. You can {memberOf.canEdit ? "view and edit" : "view"} the family book.
                Your private contacts stay private.
              </div>
            </div>
          </SettingsCard>

          <div>
            <SectionLabel>Family members</SectionLabel>
            <SettingsCard className="!p-0">
              <div className="divide-y divide-[#e9ece7]">
                {memberOf.group.members.map((m) => {
                  const label = m.user?.name?.trim() ?? m.user?.email ?? m.invitedEmail ?? "Member";
                  const you = m.userId === userId;
                  return (
                    <div className="flex items-center justify-between gap-3 px-5 py-3" key={m.id}>
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar label={label} />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-[#1d2823]">
                            {label}
                            {you ? " (you)" : ""}
                          </span>
                          <span className="block truncate text-[12.5px] text-[#5c655e]">
                            {m.user?.email ?? m.invitedEmail}
                          </span>
                        </span>
                      </span>
                      <Tag kind={m.role === "OWNER" ? "Owner" : m.canEdit ? "Can edit" : "View only"}>
                        {m.role === "OWNER" ? "Owner" : m.canEdit ? "Can edit" : "View only"}
                      </Tag>
                    </div>
                  );
                })}
              </div>
            </SettingsCard>
          </div>

          <SettingsCard className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold text-[#1d2823]">Leave this family</div>
              <p className="mt-1 max-w-[440px] text-[13.5px] text-[#5c655e]">
                You&apos;ll lose access to the shared family book. The owner can invite you again later.
              </p>
            </div>
            <ConfirmAction
              action={leaveFamilyGroup}
              body="You'll immediately lose access to the shared family book. The owner can re-invite you."
              confirmLabel="Leave family"
              danger
              fields={{ groupId: memberOf.groupId }}
              title={`Leave ${memberOf.group.name}?`}
              trigger="Leave family"
              triggerClassName="rounded-xl border border-[#dcae9f] px-4 py-2.5 text-[14px] font-semibold text-[#b5472f] transition hover:bg-[#f3e1da]"
            />
          </SettingsCard>
        </div>
      </>
    );
  }

  // ── No group yet ──
  if (!ownedGroup) {
    if (!billing.entitlements.familyGroupEnabled) {
      return (
        <>
          <SettingsPageHead title="Family management" sub="Share one family address book with up to 6 people." />
          <SettingsCard className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7efe9] text-[#17352e]">
              <WorkspaceIcon name="users" size={28} />
            </span>
            <h2 className="mt-4 text-[20px] font-semibold text-[#1d2823]">
              Family books are part of the Family plan
            </h2>
            <p className="mx-auto mt-2 max-w-[440px] text-[14.5px] leading-6 text-[#5c655e]">
              Invite up to 6 family members, share a single family address book, and control who can edit.
              Upgrade to set up your family group.
            </p>
            <Link
              className="mt-5 inline-flex rounded-xl bg-[#4158f4] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#3248db]"
              href="/pricing"
            >
              See the Family plan
            </Link>
          </SettingsCard>
        </>
      );
    }
    return (
      <>
        <SettingsPageHead title="Family management" sub="One shared address book for up to 6 people." />
        <SettingsCard>
          <p className="text-[15px] font-semibold text-[#1d2823]">Create your family book</p>
          <p className="mt-1 text-[14px] text-[#5c655e]">
            One shared contact book everyone in your family can view and edit. You can invite up to 5 people.
          </p>
          <form action={createFamilyGroup} className="mt-4 flex flex-wrap items-center gap-2">
            <input
              className="min-w-[220px] flex-1 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
              name="name"
              placeholder="Family name (e.g. Okafor Family)"
            />
            <button
              className="rounded-xl bg-[#17352e] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
              type="submit"
            >
              Create family book
            </button>
          </form>
        </SettingsCard>
      </>
    );
  }

  // ── Owner view ──
  const accepted = ownedGroup.members.filter((m) => m.role === "OWNER" || m.inviteStatus === "ACCEPTED");
  const pending = ownedGroup.members.filter((m) => m.role !== "OWNER" && m.inviteStatus !== "ACCEPTED");
  const activeCount = ownedGroup.members.filter((m) => m.inviteStatus !== "DECLINED").length;
  const full = activeCount >= ownedGroup.maxMembers;

  return (
    <>
      <SettingsPageHead
        title="Family management"
        sub="Invite family, control who can edit, and manage your shared book."
        right={
          <span className="rounded-full border border-[#d8ddd6] bg-[#f6f7f4] px-3 py-1 text-[12px] font-semibold text-[#5c655e]">
            {activeCount} / {ownedGroup.maxMembers} members
          </span>
        }
      />

      <div className="grid gap-[18px]">
        {/* seat meter */}
        {(() => {
          const pct = Math.min(100, Math.round((activeCount / ownedGroup.maxMembers) * 100));
          const atLimit = full;
          return (
            <div className="rounded-[14px] border border-[#d8ddd6] bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold tabular-nums text-[#1d2823]">
                  {activeCount} of {ownedGroup.maxMembers} members
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
        <SettingsCard className="flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e7efe9] text-[#17352e]">
            <WorkspaceIcon name="users" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold text-[#1d2823]">{ownedGroup.name}</div>
            <div className="mt-0.5 text-[13.5px] text-[#5c655e]">One shared family book · 90-day history</div>
          </div>
          <ConfirmAction
            action={deleteFamilyGroup}
            confirmLabel="Delete group"
            danger
            fields={{ groupId: ownedGroup.id }}
            title={`Delete ${ownedGroup.name}?`}
            body="The shared family book and all member access are removed. Personal contacts owned by each member are not affected. This can't be undone."
            trigger="Delete group"
            triggerClassName="rounded-xl border border-[#dcae9f] px-4 py-2.5 text-[14px] font-semibold text-[#b5472f] transition hover:bg-[#f3e1da]"
          />
        </SettingsCard>

        {/* members */}
        <div>
          <SectionLabel>Members</SectionLabel>
          <SettingsCard className="!p-0">
            <div className="hidden grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-[#e9ece7] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c] sm:grid">
              <span>Member</span>
              <span>Role</span>
              <span className="text-center">Can edit</span>
              <span />
            </div>
            <div className="divide-y divide-[#e9ece7]">
              {accepted.map((m) => {
                const label = m.user?.name?.trim() ?? m.user?.email ?? m.invitedEmail ?? "Member";
                const isOwner = m.role === "OWNER";
                return (
                  <div
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[1fr_auto_auto_auto]"
                    key={m.id}
                  >
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
                    <span className="sm:justify-self-start">
                      <Tag kind={isOwner ? "Owner" : m.canEdit ? "Can edit" : "View only"}>
                        {isOwner ? "Owner" : m.canEdit ? "Can edit" : "View only"}
                      </Tag>
                    </span>
                    <span className="justify-self-center">
                      {isOwner ? (
                        <span className="text-[12.5px] text-[#8b938c]">Always</span>
                      ) : (
                        <form action={setMemberCanEdit}>
                          <input name="memberId" type="hidden" value={m.id} />
                          <input name="canEdit" type="hidden" value={m.canEdit ? "false" : "true"} />
                          <button
                            aria-label={m.canEdit ? "Disable editing" : "Allow editing"}
                            aria-pressed={m.canEdit}
                            className={`relative inline-flex h-[22px] w-[38px] items-center rounded-full transition ${
                              m.canEdit ? "bg-[#17352e]" : "bg-[#d8ddd6]"
                            }`}
                            type="submit"
                          >
                            <span
                              className={`inline-block h-[16px] w-[16px] rounded-full bg-white transition-transform ${
                                m.canEdit ? "translate-x-[19px]" : "translate-x-[3px]"
                              }`}
                            />
                          </button>
                        </form>
                      )}
                    </span>
                    <span className="justify-self-end">
                      {isOwner ? null : (
                        <ConfirmAction
                          action={removeFamilyMember}
                          body={`${label} will lose access to the shared family book. You can invite them again later.`}
                          confirmLabel="Remove member"
                          danger
                          fields={{ memberId: m.id }}
                          title={`Remove ${label}?`}
                          trigger="Remove"
                        />
                      )}
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
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3" key={m.id}>
                      <span className="flex min-w-0 items-center gap-3">
                        {/* ghost avatar for uninvited */}
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f2f4f0]">
                          <WorkspaceIcon name={declined ? "x" : "people"} size={16} className="text-[#8b938c]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium text-[#1d2823]">{label}</span>
                          <span className="block text-[12.5px] text-[#8b938c]">
                            {declined ? "Declined the invite" : "Invite pending"}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <Tag kind={declined ? "Declined" : "Pending"}>
                          {declined ? "Declined" : "Pending"}
                        </Tag>
                        {declined ? (
                          <form action={inviteFamilyMember}>
                            <input name="email" type="hidden" value={m.invitedEmail ?? m.user?.email ?? ""} />
                            <button className="text-[13px] font-semibold text-[#4158f4] hover:underline" disabled={full} type="submit">
                              Invite again
                            </button>
                          </form>
                        ) : (
                          <form action={resendFamilyInvite}>
                            <input name="memberId" type="hidden" value={m.id} />
                            <button className="text-[13px] font-semibold text-[#4158f4] hover:underline" type="submit">
                              Resend
                            </button>
                          </form>
                        )}
                        <form action={removeFamilyMember}>
                          <input name="memberId" type="hidden" value={m.id} />
                          <button className="text-[13px] font-semibold text-[#b5472f] hover:underline" type="submit">
                            {declined ? "Dismiss" : "Revoke"}
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

        {/* invite */}
        <SettingsCard>
          <p className="text-[14.5px] font-semibold text-[#1d2823]">Invite a family member</p>
          <p className="mt-1 text-[13.5px] text-[#5c655e]">
            They get an email with a link to join {ownedGroup.name}. They keep their own private contacts.
          </p>
          {full ? (
            <p className="mt-3 rounded-xl bg-[#f6edd9] px-3.5 py-2.5 text-[13.5px] text-[#7c5511]">
              Your family is full ({ownedGroup.maxMembers} members). Remove someone to invite another.
            </p>
          ) : (
            <form action={inviteFamilyMember} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="min-w-[220px] flex-1 rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[14px] outline-none transition focus:border-[#4158f4] focus:shadow-[0_0_0_3px_#edf0fe]"
                name="email"
                placeholder="name@email.com"
                required
                type="email"
              />
              <button
                className="rounded-xl bg-[#17352e] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
                type="submit"
              >
                Send invite
              </button>
            </form>
          )}
        </SettingsCard>
      </div>
    </>
  );
}
