import { redirect } from "next/navigation";

import { SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { auth } from "~/server/auth";

export default async function SettingsProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  return (
    <>
      <SettingsPageHead
        title="Profile"
        sub="Identity and sign-in basics. These stay off the main contacts page."
        right={
          <span className="rounded-full border border-[#d8ddd6] bg-[#f6f7f4] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5c655e]">
            Consumer account
          </span>
        }
      />
      <SettingsCard>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#d8ddd6] bg-[#f6f7f4] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Display name</p>
            <p className="mt-2 text-[18px] font-semibold text-[#1d2823]">{userLabel}</p>
          </div>
          <div className="rounded-xl border border-[#d8ddd6] bg-[#f6f7f4] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Account email</p>
            <p className="mt-2 break-all text-[18px] font-semibold text-[#1d2823]">{session.user.email}</p>
          </div>
        </div>
      </SettingsCard>
    </>
  );
}
