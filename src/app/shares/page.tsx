import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { acceptLiveShare, acceptStaticShare, declineStaticShare } from "~/app/actions/shares";
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

  const [plan, people, favorites, archived, duplicates, pending, history] = await Promise.all([
    getUserPlanSummary(userId),
    db.contact.count({ where: { userId, archivedAt: null } }),
    db.contact.count({ where: { userId, archivedAt: null, isFavorite: true } }),
    db.contact.count({ where: { userId, NOT: { archivedAt: null } } }),
    db.mergeSuggestion.count({ where: { userId, status: "OPEN" } }),
    // Pending: active shares the recipient hasn't yet accepted (no recipientContactId yet).
    db.contactShare.findMany({
      where: {
        recipientUserId: userId,
        shareType: { in: ["STATIC_COPY", "LIVE_SYNC"] },
        status: "ACTIVE",
        recipientContactId: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, snapshot: true, createdAt: true, shareType: true },
    }),
    // History: already-processed shares (accepted = ACTIVE + has recipientContactId, or DECLINED).
    db.contactShare.findMany({
      where: {
        recipientUserId: userId,
        shareType: { in: ["STATIC_COPY", "LIVE_SYNC"] },
        OR: [
          { status: "ACTIVE",   recipientContactId: { not: null } },
          { status: "DECLINED" },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        snapshot: true,
        updatedAt: true,
        status: true,
        recipientContactId: true,
      },
    }),
  ]);

  const name = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  const relativeTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 14) return "Last week";
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
  };

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

        {/* ── Pending ── */}
        {pending.length === 0 ? (
          <div className="mt-6 rounded-[1.4rem] border border-dashed border-[#d8ddd6] bg-white px-6 py-12 text-center">
            <span className="mx-auto mb-3 grid size-[46px] place-items-center rounded-full border border-[#e9ece7] bg-[#f6f7f4]">
              <svg fill="none" height="20" stroke="#aeb4ac" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="20">
                <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-[#1d2823]">No pending shares</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5c655e]">
              When someone shares a contact with you, it&apos;ll show up here to accept or decline.
            </p>
            <Link className="mt-4 inline-block text-[13px] font-semibold text-[#4158f4]" href="/contacts">
              ← Back to contacts
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3">
            {pending.map((share) => {
              const snap = share.snapshot as ShareSnapshot;
              const contactName = snap?.fullName ?? "Shared contact";
              const ownerName = snap?.ownerName ?? "A Kontax user";
              const isLive = share.shareType === "LIVE_SYNC";
              return (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-[#d8ddd6] bg-white p-4"
                  key={share.id}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1d2823]">{contactName}</p>
                    <p className="mt-0.5 text-[13px] text-[#5c655e]">
                      Shared by {ownerName}
                      {isLive ? (
                        <span className="font-semibold text-[#17352e]">
                          {" · "}
                          <span className="inline-flex items-center gap-1 align-middle">
                            <svg fill="none" height="13" stroke="#17352e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="13">
                              <circle cx="12" cy="12" fill="none" r="1.5" />
                              <path d="M8.2 7.8a5 5 0 000 8.4M15.8 7.8a5 5 0 010 8.4M5.6 5.2a8.5 8.5 0 000 13.6M18.4 5.2a8.5 8.5 0 010 13.6" />
                            </svg>
                            live (stays in sync)
                          </span>
                        </span>
                      ) : null}
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
                    <form action={isLive ? acceptLiveShare : acceptStaticShare}>
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

        {/* ── Earlier (history) ── */}
        {history.length > 0 ? (
          <div className="mt-8">
            <div className="mb-1.5 flex items-baseline gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
                Earlier
              </h2>
              <span className="text-[12px] text-[#aeb4ac]">· accepted &amp; declined</span>
            </div>
            <ul>
              {history.map((row) => {
                const snap = row.snapshot as ShareSnapshot;
                const contactName = snap?.fullName ?? "Shared contact";
                const ownerName = snap?.ownerName ?? "A Kontax user";
                const accepted = row.status === "ACTIVE" && row.recipientContactId;
                return (
                  <li
                    className="flex items-center gap-3 border-b border-[#edf0ea] py-3 last:border-b-0"
                    key={row.id}
                  >
                    {/* Initials avatar */}
                    <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-[#f2f4f0] text-[12px] font-semibold text-[#5c655e]">
                      {contactName
                        .split(/\s+/)
                        .map((p: string) => p[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] text-[#5c655e]">
                        <span className="font-semibold text-[#1d2823]">{contactName}</span>
                        {" · "}shared by {ownerName}
                      </p>
                      <p className="mt-px text-[12px] text-[#8b938c]">
                        {accepted ? "Accepted" : "Declined"} · {relativeTime(row.updatedAt)}
                      </p>
                    </div>
                    {accepted && row.recipientContactId ? (
                      <Link
                        className="shrink-0 text-[13px] font-semibold text-[#4158f4] hover:underline"
                        href={`/contacts/${row.recipientContactId}`}
                      >
                        View contact →
                      </Link>
                    ) : (
                      <span className="shrink-0 text-[12.5px] text-[#8b938c]">Declined</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
