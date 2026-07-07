import Link from "next/link";
import { redirect } from "next/navigation";

import { redirectToLogin } from "~/server/auth/require-page-auth";
import { SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { setMemberBookPermission } from "~/app/actions/teams";
import { auth } from "~/server/auth";
import { loadOwnedTeam } from "../_lib";

export const metadata = { title: "Book permissions" };

// P46-18 / DB07 T5 remainder — per-book permissions child page, split out of
// the Teams monolith. Owner-only; hidden entirely when locked (there is no
// active plan to adjust), matching the old inline section's gate.
export default async function TeamPermissionsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings/sharing/teams/permissions");

  const ctx = await loadOwnedTeam(session.user.id);
  if (!ctx || ctx.pendingSetup || ctx.isLocked) redirect("/settings/sharing/teams");
  const { ownedTeam } = ctx;

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

  return (
    <>
      <SettingsPageHead
        title="Book permissions"
        sub="Set what each member can do per book. Owners and admins always have full access."
        right={
          <Link
            className="rounded-xl border border-[#d8ddd6] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            href="/settings/sharing/teams"
          >
            ← Team management
          </Link>
        }
      />

      {regularMembers.length === 0 || activeBooks.length === 0 ? (
        <SettingsCard>
          <p className="text-[13.5px] text-[#5c655e]">
            {activeBooks.length === 0
              ? "Create a team book first — permissions are set per book."
              : "No regular members yet. Owners and admins always have full access; per-book permissions apply to members."}
          </p>
          <Link
            className="mt-3 inline-flex rounded-xl border border-[#d8ddd6] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            href={activeBooks.length === 0 ? "/settings/sharing/teams/books" : "/settings/sharing/teams"}
          >
            {activeBooks.length === 0 ? "Manage team books" : "Invite members"}
          </Link>
        </SettingsCard>
      ) : (
        <SettingsCard>
          <div className="grid gap-4">
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
      )}
    </>
  );
}
