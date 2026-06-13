import { redirect } from "next/navigation";

import { updateNotificationPreferences } from "~/app/actions/notifications";
import { CalendarFeedSection } from "~/app/_components/calendar-feed-section";
import { SettingsCard, SettingsPageHead } from "~/app/_components/settings-ui";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { appUrl } from "~/server/email";
import { getNotificationSettings } from "~/server/notifications";

// P22-10: user-level reminder lead-time options.
const LEAD_TIME_OPTIONS = [
  { value: 1, label: "1 day before" },
  { value: 3, label: "3 days before" },
  { value: 7, label: "1 week before" },
  { value: 14, label: "2 weeks before" },
  { value: 30, label: "1 month before" },
] as const;

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
      className={`flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-[#f8faf8] px-3 py-2 md:min-h-0 md:justify-start md:bg-transparent md:px-0 md:py-0 ${locked ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
      title={locked ? "Security and billing alerts cannot be disabled." : undefined}
    >
      <span className="text-[13px] font-medium text-[#5c655e]">{label}</span>
      <span className="relative inline-flex h-6 w-11 items-center md:h-5 md:w-9">
        <input
          className="peer sr-only"
          defaultChecked={on}
          disabled={locked}
          name={locked ? undefined : name}
          type="checkbox"
        />
        <span className="h-6 w-11 rounded-full bg-[#d8ddd6] transition-colors peer-checked:bg-[#17352e] md:h-5 md:w-9" />
        <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] transition-transform peer-checked:translate-x-5 md:h-4 md:w-4 md:peer-checked:translate-x-4" />
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
    <div className="flex flex-col gap-3 py-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-5">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-[#1d2823]">{name}</div>
        {note ? <div className="mt-0.5 text-[12px] text-[#8b938c]">{note}</div> : null}
      </div>
      <div className="grid gap-2 md:flex md:flex-none md:gap-7">
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
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { reminderLeadDays: true, calToken: true },
  });
  const leadDays = user?.reminderLeadDays ?? 7;

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
            <div>
              <CategoryRow
                email={prefs.remindersEmail}
                emailName="remindersEmail"
                inApp={prefs.remindersInApp}
                inAppName="remindersInApp"
                name="Birthday & anniversary reminders"
              />
              {/* P22-10: lead-time preference */}
              <div className="-mt-1 flex items-center gap-3 pb-4 pl-0.5">
                <span className="text-[13px] text-[#5c655e]">Remind me</span>
                <select
                  className="h-9 rounded-lg border border-[#d8ddd6] bg-white px-2.5 text-[16px] text-[#1d2823] outline-none focus:border-[#4158f4] disabled:opacity-45 md:text-[13px]"
                  defaultValue={String(leadDays)}
                  disabled={!prefs.remindersInApp}
                  name="reminderLeadDays"
                >
                  {LEAD_TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
          <SettingsCard lazy>
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

        <CalendarFeedSection baseUrl={appUrl()} initialToken={user?.calToken ?? null} />

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
