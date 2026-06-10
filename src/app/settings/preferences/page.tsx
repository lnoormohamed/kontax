import { redirect } from "next/navigation";

import { SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { updatePhoneticSettings } from "~/app/actions/settings";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

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
          <label className="flex items-start gap-3 rounded-xl border border-[#d8ddd6] bg-[#f6f7f4] px-4 py-4 text-[14px] text-[#3a4540]">
            <input
              className="mt-0.5 h-4 w-4 rounded border-[#d8ddd6] text-[#4158f4] focus:ring-[#4158f4]"
              defaultChecked={userSettings?.autoFillPhoneticNames ?? false}
              name="autoFillPhoneticNames"
              type="checkbox"
              value="true"
            />
            <span>
              Auto-fill phonetic first name, phonetic last name, and phonetic company when those fields are
              empty.
            </span>
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
