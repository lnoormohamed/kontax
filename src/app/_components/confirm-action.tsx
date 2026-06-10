"use client";

import { useState } from "react";

type ConfirmActionProps = {
  /** A server action bound to a form. */
  action: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
  trigger: string;
  triggerClassName?: string;
  title: string;
  body?: string;
  confirmLabel: string;
  danger?: boolean;
};

/**
 * Renders a trigger button that opens a confirmation modal; confirming submits a
 * `<form action={serverAction}>` with the given hidden fields. Used for
 * destructive settings actions (remove member, leave, delete group).
 */
export function ConfirmAction({
  action,
  fields,
  trigger,
  triggerClassName,
  title,
  body,
  confirmLabel,
  danger,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={
          triggerClassName ??
          "rounded-lg border border-[#dcae9f] px-3 py-1.5 text-[13px] font-semibold text-[#b5472f] transition hover:bg-[#f3e1da]"
        }
        onClick={() => setOpen(true)}
        type="button"
      >
        {trigger}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(15,23,42,0.45)] p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-[18px] font-semibold text-[#1d2823]">{title}</h3>
            {body ? <p className="mt-2 text-[14px] leading-6 text-[#5c655e]">{body}</p> : null}
            <form action={action} className="mt-5 flex justify-end gap-2">
              {Object.entries(fields ?? {}).map(([k, v]) => (
                <input key={k} name={k} type="hidden" value={v} />
              ))}
              <button
                className="rounded-xl border border-[#d8ddd6] px-4 py-2.5 text-[14px] font-semibold text-[#3a4540] transition hover:bg-[#f6f7f4]"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={
                  danger
                    ? "rounded-xl bg-[#b5472f] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#9a3a23]"
                    : "rounded-xl bg-[#17352e] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
                }
                type="submit"
              >
                {confirmLabel}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
