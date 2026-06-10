import { redirect } from "next/navigation";

import { SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { auth, signOut } from "~/server/auth";

export default async function SettingsSecurityPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const handleSignOut = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  return (
    <>
      <SettingsPageHead
        title="Security & session"
        sub="Sign-out and account-session controls, kept out of the contact workspace."
      />

      <div className="grid gap-[18px]">
        <SettingsCard>
          <p className="text-[15px] font-semibold text-[#1d2823]">This session</p>
          <div className="mt-4 rounded-xl border border-[#d8ddd6] bg-[#f6f7f4] p-4">
            <p className="text-[14px] font-semibold text-[#1d2823]">{session.user.email}</p>
            <p className="mt-1 text-[14px] text-[#5c655e]">Signed in to Kontax on this browser session.</p>
            <form action={handleSignOut} className="mt-4">
              <button
                className="w-full rounded-xl border border-[#d8ddd6] px-4 py-3 text-[14px] font-semibold text-[#3a4540] transition hover:bg-[#f6f7f4]"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </SettingsCard>

        <SettingsCard>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8b938c]">Security posture</p>
          <div className="mt-3 space-y-2.5 text-[14px] leading-6 text-[#525b54]">
            <p>Traffic runs over HTTPS/TLS and your data is encrypted at rest by our infrastructure provider.</p>
            <p>Passwords are stored only as bcrypt hashes — never in plain text.</p>
            <p>Security-sensitive actions are recorded in an append-only audit log.</p>
          </div>
        </SettingsCard>
      </div>
    </>
  );
}
