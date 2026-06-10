import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptFamilyInvite, declineFamilyInvite } from "~/app/actions/family";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

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
  const valid =
    member?.inviteStatus === "PENDING" &&
    (member.inviteExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY) >= Date.now();

  // Not signed in → send to login/register, returning here afterwards.
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/family/join/${token}`)}`);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 text-[#1d2823]">
      <div className="rounded-[14px] border border-[#d8ddd6] bg-white p-6 text-center">
        {!valid || !member ? (
          <>
            <p className="text-sm font-semibold">This invite is no longer valid</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#8b938c]">
              It may have expired or already been used. Ask the family owner to send a new one.
            </p>
            <Link
              className="mt-4 inline-flex rounded-[9px] border border-[#d8ddd6] bg-white px-4 py-2 text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
              href="/"
            >
              Go to Kontax
            </Link>
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
              Family invitation
            </p>
            <h1 className="mt-1 text-[19px] font-semibold">
              Join the {member.group.name} book
            </h1>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-[#5c655e]">
              {member.group.owner.name?.trim() ?? member.group.owner.email} invited you to share this
              family contact book. Your private contacts stay private.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <form action={acceptFamilyInvite}>
                <input name="token" type="hidden" value={token} />
                <button
                  className="rounded-[9px] bg-[#4158f4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3248db]"
                  type="submit"
                >
                  Accept &amp; join
                </button>
              </form>
              <form action={declineFamilyInvite}>
                <input name="token" type="hidden" value={token} />
                <button
                  className="rounded-[9px] px-4 py-2 text-sm font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0]"
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
