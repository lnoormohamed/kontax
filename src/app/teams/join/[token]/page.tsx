import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptTeamInvite, declineTeamInvite } from "~/app/actions/teams";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .map((p) => p.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default async function TeamJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const member = await db.groupMember.findUnique({
    where: { inviteToken: token },
    include: { group: { include: { owner: { select: { name: true, email: true } } } } },
  });

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/teams/join/${token}`)}`);
  }

  const valid =
    member?.inviteStatus === "PENDING" &&
    member.group.type === "TEAM" &&
    (member.inviteExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY) >= Date.now();

  // Already a member?
  const alreadyMember =
    member &&
    (await db.groupMember.findFirst({
      where: { groupId: member.groupId, userId: session.user.id, inviteStatus: "ACCEPTED" },
    }));

  const ownerName = member?.group.owner.name?.trim() ?? member?.group.owner.email ?? "A team admin";
  const ownerEmail = member?.group.owner.email ?? "";
  const roleLabel = member?.role === "ADMIN" ? "Admin" : "Member · can edit";

  const hoursLeft = member?.inviteExpiresAt
    ? Math.max(0, Math.round((member.inviteExpiresAt.getTime() - Date.now()) / 3_600_000))
    : null;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-5 py-10 text-[#1d2823]"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #e9f1ea 0%, #f6f7f4 55%)" }}
    >
      <div className="w-full max-w-[432px] rounded-[22px] border border-[#e3e7e0] bg-white p-8 text-center shadow-[0_18px_50px_rgba(20,30,25,0.10)]">
        {/* Brand */}
        <Link className="mb-5 inline-flex items-center gap-2" href="/">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-[#17352e] text-[17px] font-bold text-[#dff0e7]">
            K
          </span>
          <span className="text-[19px] font-bold tracking-[-0.01em] text-[#1d2823]">Kontax</span>
        </Link>

        {/* Already a member */}
        {alreadyMember ? (
          <>
            <span className="mx-auto mb-1 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-[#e7efe9] text-[#17352e]">
              <WorkspaceIcon name="team" size={28} strokeWidth={1.8} />
            </span>
            <h1 className="mt-3 text-[22px] font-semibold leading-[1.2] tracking-[-0.01em]">
              You&apos;re already in this team
            </h1>
            <p className="mx-auto mt-3 max-w-[340px] text-[14px] leading-[1.6] text-[#5c655e]">
              You&apos;re already a member of{" "}
              <strong className="font-semibold text-[#3a4540]">{member?.group.name}</strong>. The
              shared books are in your contacts under the Shared scope.
            </p>
            <Link
              className="mt-6 flex w-full items-center justify-center rounded-[10px] bg-[#4158f4] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#3248db]"
              href="/contacts"
            >
              Open my contacts
            </Link>
          </>
        ) : !valid || !member ? (
          /* Expired / invalid */
          <>
            <span className="mx-auto mb-1 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-[#f6edd9] text-[#bf8526]">
              <WorkspaceIcon name="warning" size={28} strokeWidth={1.8} />
            </span>
            <h1 className="mt-3 text-[22px] font-semibold leading-[1.2] tracking-[-0.01em]">
              This invite is no longer valid
            </h1>
            <p className="mx-auto mt-3 max-w-[340px] text-[14px] leading-[1.6] text-[#5c655e]">
              Team invitations expire after 48 hours, and this one has passed its window or already
              been used. Ask a team admin to send you a fresh invite.
            </p>
            <Link
              className="mt-6 flex w-full items-center justify-center rounded-[10px] border border-[#d8ddd6] bg-white px-4 py-3 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
              href="/contacts"
            >
              Go to Kontax
            </Link>
          </>
        ) : (
          /* Valid invite */
          <>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#17352e]">
              Team invitation
            </p>
            <h1 className="mt-3 text-[22px] font-semibold leading-[1.2] tracking-[-0.01em]">
              Join {member.group.name}
            </h1>

            {/* Owner identity */}
            <div className="mx-auto mt-4 flex w-fit items-center gap-3 rounded-[14px] border border-[#eceee8] bg-[#f6f7f4] px-3 py-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7efe9] text-[12px] font-semibold text-[#17352e]">
                {getInitials(ownerName)}
              </span>
              <div className="text-left">
                <div className="text-[14px] font-semibold text-[#1d2823]">{ownerName}</div>
                <div className="text-[12.5px] text-[#8b938c]">{ownerEmail}</div>
              </div>
            </div>

            <p className="mx-auto mt-3 max-w-[340px] text-[14px] leading-[1.6] text-[#5c655e]">
              {ownerName.split(" ")[0]} invited you to this team on Kontax.{" "}
              <strong className="font-semibold text-[#3a4540]">
                Your private contacts stay private.
              </strong>
            </p>

            {/* Role pill */}
            <div className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-[#e9ece7] bg-[#f2f4f0] px-3.5 py-1.5 text-[12.5px] text-[#5c655e]">
              <WorkspaceIcon name="team" size={14} strokeWidth={1.8} className="shrink-0 text-[#17352e]" />
              Joining as <strong className="font-bold text-[#17352e]">{roleLabel}</strong>
            </div>

            {/* Expiry warning */}
            {hoursLeft !== null && hoursLeft <= 48 ? (
              <div className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-[#ecdcb0] bg-[#f6edd9] px-3 py-1.5 text-[12.5px] text-[#7c5511]">
                <WorkspaceIcon name="bell" size={13} strokeWidth={1.7} className="shrink-0" />
                This invitation expires in {hoursLeft} hour{hoursLeft !== 1 ? "s" : ""}.
              </div>
            ) : null}

            {/* Stacked CTAs */}
            <div className="mt-6 flex flex-col gap-2.5">
              <form action={acceptTeamInvite}>
                <input name="token" type="hidden" value={token} />
                <button
                  className="w-full rounded-[10px] bg-[#4158f4] py-3 text-[14px] font-semibold text-white transition hover:bg-[#3248db]"
                  type="submit"
                >
                  Accept &amp; join
                </button>
              </form>
              <form action={declineTeamInvite}>
                <input name="token" type="hidden" value={token} />
                <button
                  className="w-full rounded-[10px] border border-[#d8ddd6] bg-white py-3 text-[14px] font-semibold text-[#5c655e] transition hover:bg-[#f6f7f4]"
                  type="submit"
                >
                  Decline
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
