import { redirect } from "next/navigation";

import { SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { updatePhoneticSettings } from "~/app/actions/settings";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

function Switch({ defaultChecked, name }: { defaultChecked: boolean; name: string }) {
  return (
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
      <input
        className="peer sr-only"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
        value="true"
      />
      <span className="h-6 w-11 rounded-full bg-[#d8ddd6] transition-colors peer-checked:bg-[#17352e]" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] transition-transform peer-checked:translate-x-5" />
    </span>
  );
}

export default async function SettingsPreferencesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userSettings = await db.user.findUnique({
    where: { id: session.user.id },
    select: { autoFillPhoneticNames: true },
  });

  return (
    <>
      <SettingsPageHead
        title="Preferences"
        sub="Personal behavior settings. They only affect your account, without changing the structure of your contacts."
      />
      <SettingsCard>
        <p className="text-[15px] font-semibold text-[#1d2823]">Phonetic names</p>
        <p className="mt-2 text-[14px] leading-6 text-[#5c655e]">
          Kontax can suggest phonetic readings for first name, last name, and company when those phonetic
          fields are still blank. Any value you enter manually always wins.
        </p>

        <form action={updatePhoneticSettings} className="mt-5">
          <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#d8ddd6] bg-[#f6f7f4] px-4 py-4 text-[14px] text-[#3a4540]">
            <span className="min-w-0">
              <span className="block font-semibold text-[#1d2823]">Auto-fill phonetic fields</span>
              <span className="mt-1 block leading-5 text-[#5c655e]">
                Fill phonetic first name, last name, and company when those fields are empty.
              </span>
            </span>
            <Switch
              defaultChecked={userSettings?.autoFillPhoneticNames ?? false}
              name="autoFillPhoneticNames"
            />
          </label>
          <p className="mt-3 text-[14px] leading-6 text-[#5c655e]">
            Chinese names use dedicated phonetic generation. Other non-Latin scripts use a best-effort
            transliterated reading so contacts can still sort and search more naturally.
          </p>
          <button
            className="mt-4 rounded-xl bg-[#17352e] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
            type="submit"
          >
            Save preferences
          </button>
        </form>
      </SettingsCard>
    </>
  );
}
