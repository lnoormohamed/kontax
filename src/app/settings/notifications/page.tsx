import { redirect } from "next/navigation";

import { updateNotificationPreferences } from "~/app/actions/notifications";
import { SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { auth } from "~/server/auth";
import { getNotificationSettings } from "~/server/notifications";

// 36×20 toggle. Locked rows (Security/Billing) render a disabled, checked switch
// at 0.45 opacity with a tooltip — disabled inputs aren't submitted, which is
// correct since those categories are always-on and have no columns.
function Toggle({
  name,
  label,
  on,
  locked,
}: {
  name: string;
  label: string;
  on: boolean;
  locked?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 ${locked ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
      title={locked ? "Security and billing alerts cannot be disabled." : undefined}
    >
      <span className="text-[13px] text-[#5c655e]">{label}</span>
      <span className="relative inline-flex h-5 w-9 items-center">
        <input
          className="peer sr-only"
          defaultChecked={on}
          disabled={locked}
          name={locked ? undefined : name}
          type="checkbox"
        />
        <span className="h-5 w-9 rounded-full bg-[#d8ddd6] transition-colors peer-checked:bg-[#17352e]" />
        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function CategoryRow({
  name,
  note,
  inAppName,
  emailName,
  inApp,
  email,
  locked,
}: {
  name: string;
  note?: string;
  inAppName: string;
  emailName: string;
  inApp: boolean;
  email: boolean;
  locked?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-[#1d2823]">{name}</div>
        {note ? <div className="mt-0.5 text-[12px] text-[#8b938c]">{note}</div> : null}
      </div>
      <div className="flex flex-none gap-7">
        <Toggle label="In-app" locked={locked} name={inAppName} on={inApp} />
        <Toggle label="Email" locked={locked} name={emailName} on={email} />
      </div>
    </div>
  );
}

const DIGEST_OPTIONS = [
  { id: "NONE", name: "No digest", note: "Notifications are sent as they happen." },
  { id: "DAILY", name: "Daily digest", note: "Sent at 8:00 AM UTC." },
  { id: "WEEKLY", name: "Weekly digest", note: "Sent Monday at 8:00 AM UTC." },
] as const;

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const prefs = await getNotificationSettings(session.user.id);

  return (
    <>
      <SettingsPageHead
        sub="Choose what Kontax tells you about, and where. Security and billing alerts are always on."
        title="Notifications"
      />

      <form action={updateNotificationPreferences} className="flex flex-col gap-6">
        <SettingsCard className="!py-1.5">
          <div className="divide-y divide-[#f2f4f0]">
            <CategoryRow
              email
              emailName="securityEmail"
              inApp
              inAppName="securityInApp"
              locked
              name="Security alerts"
              note="Always sent — cannot be disabled."
            />
            <CategoryRow
              email={prefs.sharingEmail}
              emailName="sharingEmail"
              inApp={prefs.sharingInApp}
              inAppName="sharingInApp"
              name="Contact sharing"
            />
            <CategoryRow
              email={prefs.syncEmail}
              emailName="syncEmail"
              inApp={prefs.syncInApp}
              inAppName="syncInApp"
              name="Sync status"
            />
            <CategoryRow
              email
              emailName="billingEmail"
              inApp
              inAppName="billingInApp"
              locked
              name="Billing"
              note="Always sent — cannot be disabled."
            />
            <CategoryRow
              email={prefs.remindersEmail}
              emailName="remindersEmail"
              inApp={prefs.remindersInApp}
              inAppName="remindersInApp"
              name="Birthday & anniversary reminders"
            />
            <CategoryRow
              email={prefs.productEmail}
              emailName="productEmail"
              inApp={prefs.productInApp}
              inAppName="productInApp"
              name="Product updates"
            />
          </div>
        </SettingsCard>

        <div>
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[#8b938c]">
            Email digest
          </p>
          <SettingsCard>
            <p className="mb-1 text-[13.5px] text-[#5c655e]">
              Instead of individual emails, receive a summary on a schedule.
            </p>
            <div className="flex flex-col">
              {DIGEST_OPTIONS.map((d) => (
                <label className="flex cursor-pointer items-start gap-3 py-3" key={d.id}>
                  <span className="relative mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center">
                    <input
                      className="peer sr-only"
                      defaultChecked={prefs.digest === d.id}
                      name="digest"
                      type="radio"
                      value={d.id}
                    />
                    <span className="h-[18px] w-[18px] rounded-full border-[1.8px] border-[#aeb4ac] transition-colors peer-checked:border-[#17352e]" />
                    <span className="absolute h-[9px] w-[9px] scale-0 rounded-full bg-[#17352e] transition-transform peer-checked:scale-100" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium text-[#1d2823]">{d.name}</span>
                    <span className="mt-0.5 block text-[12.5px] text-[#8b938c]">{d.note}</span>
                  </span>
                </label>
              ))}
            </div>
          </SettingsCard>
        </div>

        <div>
          <button
            className="h-11 rounded-xl bg-[#17352e] px-5 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
            type="submit"
          >
            Save preferences
          </button>
        </div>
      </form>
    </>
  );
}
