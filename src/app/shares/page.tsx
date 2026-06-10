import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { acceptStaticShare, declineStaticShare } from "~/app/actions/shares";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";

type ShareSnapshot = { fullName?: string; ownerName?: string; email?: string | null } | null;

export default async function SharesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const [plan, people, favorites, archived, duplicates, pending] = await Promise.all([
    getUserPlanSummary(userId),
    db.contact.count({ where: { userId, archivedAt: null } }),
    db.contact.count({ where: { userId, archivedAt: null, isFavorite: true } }),
    db.contact.count({ where: { userId, NOT: { archivedAt: null } } }),
    db.mergeSuggestion.count({ where: { userId, status: "OPEN" } }),
    db.contactShare.findMany({
      where: {
        recipientUserId: userId,
        shareType: "STATIC_COPY",
        status: "ACTIVE",
        recipientContactId: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, snapshot: true, createdAt: true },
    }),
  ]);

  const name = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  return (
    <AppShell
      account={{ name, email: session.user.email ?? "", plan: plan.planLabel }}
      counts={{ people, favorites, archived, duplicates }}
    >
      <div className="mx-auto w-full max-w-2xl px-4 py-8 lg:px-0">
        <h1 className="text-2xl font-semibold text-[#1d2823]">Shared with me</h1>
        <p className="mt-1 text-sm text-[#5c655e]">
          Contacts other Kontax users have shared with you. Accept to add a copy to your account.
        </p>

        {pending.length === 0 ? (
          <div className="mt-6 rounded-[1.4rem] border border-dashed border-[#d8ddd6] bg-white px-6 py-12 text-center">
            <p className="text-sm font-semibold text-[#1d2823]">No pending shares</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5c655e]">
              When someone shares a contact with you, it&apos;ll show up here to accept or decline.
            </p>
            <Link className="mt-4 inline-block text-[13px] font-semibold text-[#4158f4]" href="/">
              ← Back to contacts
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3">
            {pending.map((share) => {
              const snap = share.snapshot as ShareSnapshot;
              const contactName = snap?.fullName ?? "Shared contact";
              const ownerName = snap?.ownerName ?? "A Kontax user";
              return (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-[#d8ddd6] bg-white p-4"
                  key={share.id}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1d2823]">{contactName}</p>
                    <p className="mt-0.5 text-[13px] text-[#5c655e]">
                      Shared by {ownerName}
                      {snap?.email ? ` · ${snap.email}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={declineStaticShare}>
                      <input name="shareId" type="hidden" value={share.id} />
                      <button
                        className="rounded-[0.8rem] border border-[#d8ddd6] bg-white px-3.5 py-2 text-sm font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0]"
                        type="submit"
                      >
                        Decline
                      </button>
                    </form>
                    <form action={acceptStaticShare}>
                      <input name="shareId" type="hidden" value={share.id} />
                      <button
                        className="rounded-[0.8rem] bg-[#17352e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#20443b]"
                        type="submit"
                      >
                        Accept
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
