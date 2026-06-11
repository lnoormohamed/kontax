import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptFamilyInvite, declineFamilyInvite } from "~/app/actions/family";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

function JoinCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-5 py-10 text-[#1d2823]"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #eef3ee 0%, #f6f7f4 55%)" }}
    >
      <div className="w-full max-w-md rounded-[24px] border border-[#e3e7e0] bg-white p-8 text-center shadow-[0_18px_50px_rgba(20,30,25,0.10)]">
        {children}
      </div>
    </div>
  );
}

function FamCrest() {
  return (
    <span className="mx-auto mb-5 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-[#e7efe9] text-[#17352e]">
      <WorkspaceIcon name="users" size={30} strokeWidth={1.8} />
    </span>
  );
}

export default async function FamilyJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const member = await db.groupMember.findUnique({
    where: { inviteToken: token },
    include: {
      group: { include: { owner: { select: { name: true, email: true } } } },
    },
  });

  const session = await auth();

  // Not signed in → send to login/register, returning here afterwards.
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/family/join/${token}`)}`);
  }

  const userId = session.user.id;

  // Already a member of this group?
  const alreadyMember =
    member &&
    (await db.groupMember.findFirst({
      where: { groupId: member.groupId, userId, inviteStatus: "ACCEPTED" },
    }));

  if (alreadyMember) {
    return (
      <JoinCard>
        <FamCrest />
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
          Family book
        </p>
        <h1 className="mt-1 text-[20px] font-semibold">
          You&apos;re already in this family
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-[1.6] text-[#5c655e]">
          You&apos;re already a member of{" "}
          <strong className="font-semibold text-[#1d2823]">{member.group.name}</strong>.
          The shared book is in your contacts under the Family scope.
        </p>
        <Link
          className="mt-6 flex items-center justify-center rounded-[10px] bg-[#4158f4] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#3248db]"
          href="/"
        >
          Open my contacts
        </Link>
      </JoinCard>
    );
  }

  const valid =
    member?.inviteStatus === "PENDING" &&
    (member.inviteExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY) >= Date.now();

  if (!valid || !member) {
    return (
      <JoinCard>
        {/* Amber warning crest */}
        <span className="mx-auto mb-5 grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-[#f6edd9] text-[#bf8526]">
          <WorkspaceIcon name="warning" size={28} strokeWidth={1.8} />
        </span>
        <h1 className="text-[20px] font-semibold">This invite is no longer valid</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-[1.6] text-[#5c655e]">
          Family invitations expire after 48 hours, and this one has passed its window or
          already been used. Ask the family owner to send a fresh invite.
        </p>
        <Link
          className="mt-6 flex items-center justify-center rounded-[10px] border border-[#d8ddd6] bg-white px-4 py-3 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
          href="/"
        >
          Go to Kontax
        </Link>
      </JoinCard>
    );
  }

  const ownerName = member.group.owner.name?.trim() ?? member.group.owner.email ?? "the owner";
  const firstName = ownerName.split(" ")[0];

  // Hours remaining on the invite
  const hoursLeft = member.inviteExpiresAt
    ? Math.max(0, Math.round((member.inviteExpiresAt.getTime() - Date.now()) / 3_600_000))
    : null;

  return (
    <JoinCard>
      <FamCrest />
      <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#4452c9]">
        Family invitation
      </p>
      <h1 className="mt-1 text-[20px] font-semibold">
        Join {member.group.name}
      </h1>

      {/* Owner identity */}
      <div className="mx-auto mt-4 flex w-fit items-center gap-3 rounded-[10px] border border-[#e9ece7] bg-[#f6f7f4] px-3.5 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7efe9] text-[11px] font-semibold text-[#17352e]">
          {ownerName
            .split(/\s+/)
            .map((p: string) => p[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <div className="text-left">
          <div className="text-[14px] font-semibold text-[#1d2823]">{ownerName}</div>
          <div className="text-[12.5px] text-[#8b938c]">
            {member.group.owner.email}
          </div>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-sm text-[13.5px] leading-[1.6] text-[#5c655e]">
        {firstName} invited you to share this family contact book. You&apos;ll be able to view and
        edit shared contacts.{" "}
        <strong className="font-semibold text-[#1d2823]">
          Your private contacts stay private.
        </strong>
      </p>

      {/* Expiry warning */}
      {hoursLeft !== null && hoursLeft <= 48 ? (
        <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-[8px] bg-[#f6edd9] px-3 py-1.5 text-[12.5px] font-medium text-[#7c5511]">
          <WorkspaceIcon name="bell" size={13} strokeWidth={1.7} className="shrink-0" />
          This invitation expires in {hoursLeft} hour{hoursLeft !== 1 ? "s" : ""}.
        </div>
      ) : null}

      {/* Stacked CTAs */}
      <div className="mt-6 flex flex-col gap-2.5">
        <form action={acceptFamilyInvite}>
          <input name="token" type="hidden" value={token} />
          <button
            className="w-full rounded-[10px] bg-[#4158f4] py-3 text-[14px] font-semibold text-white transition hover:bg-[#3248db]"
            type="submit"
          >
            Accept &amp; join
          </button>
        </form>
        <form action={declineFamilyInvite}>
          <input name="token" type="hidden" value={token} />
          <button
            className="w-full rounded-[10px] border border-[#d8ddd6] bg-white py-3 text-[14px] font-semibold text-[#5c655e] transition hover:bg-[#f6f7f4]"
            type="submit"
          >
            Decline
          </button>
        </form>
      </div>
    </JoinCard>
  );
}
