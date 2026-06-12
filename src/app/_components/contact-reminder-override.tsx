"use client";

import { useRef, useTransition } from "react";

import { setContactReminderOverride } from "~/app/actions/contacts";

const OPTIONS = [
  { value: 1, label: "1 day before" },
  { value: 3, label: "3 days before" },
  { value: 7, label: "1 week before" },
  { value: 14, label: "2 weeks before" },
  { value: 30, label: "1 month before" },
] as const;

const labelFor = (days: number) => OPTIONS.find((o) => o.value === days)?.label ?? `${days} days before`;

/**
 * P22-10: per-contact reminder lead-time override. "Use default" clears the
 * override so the contact follows the account-level setting. Auto-saves on change.
 */
export function ContactReminderOverride({
  contactId,
  override,
  userDefault,
}: {
  contactId: string;
  override: number | null;
  userDefault: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white">
      <h3 className="px-5 pt-3.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
        Reminder
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[13.5px] text-[#1d2823]">Remind me before this date</p>
          <p className="mt-0.5 text-[12px] text-[#8b938c]">
            {override == null
              ? `Using your default (${labelFor(userDefault)})`
              : "Overrides your account default for this contact"}
          </p>
        </div>
        <form action={setContactReminderOverride} ref={formRef}>
          <input name="contactId" type="hidden" value={contactId} />
          <select
            className="h-9 rounded-lg border border-[#d8ddd6] bg-white px-2.5 text-[13px] text-[#1d2823] outline-none focus:border-[#4158f4] disabled:opacity-50"
            defaultValue={override == null ? "" : String(override)}
            disabled={pending}
            name="reminderLeadDays"
            onChange={() => startTransition(() => formRef.current?.requestSubmit())}
          >
            <option value="">Use default</option>
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </form>
      </div>
    </section>
  );
}
