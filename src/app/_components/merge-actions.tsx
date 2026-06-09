"use client";

import { useState } from "react";

import { bulkAcceptHighConfidenceContacts, undoMergeContacts } from "~/app/actions/contacts";

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  confirmAction,
  hidden,
  onCancel,
  danger,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmAction: (formData: FormData) => void;
  hidden: Record<string, string>;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-[1.4rem] border border-[#d8ddd6] bg-white p-6 shadow-xl">
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-500">{body}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            className="rounded-[1.1rem] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <form action={confirmAction}>
            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} name={name} type="hidden" value={value} />
            ))}
            <button
              className={`rounded-[1.1rem] px-4 py-2 text-sm font-semibold text-white transition ${
                danger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#17352e] hover:bg-[#20443b]"
              }`}
              type="submit"
            >
              {confirmLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function BulkMergeButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  if (count < 1) {
    return null;
  }
  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded-lg bg-[#17352e] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#20443b]"
        onClick={() => setOpen(true)}
        type="button"
      >
        Accept all {count} high-confidence
      </button>
      {open ? (
        <ConfirmDialog
          body={`These are all high-confidence matches. Each pair will be merged, keeping the contact that was added first. You can undo any of them afterwards.`}
          confirmAction={bulkAcceptHighConfidenceContacts}
          confirmLabel={`Merge ${count} pair${count === 1 ? "" : "s"}`}
          hidden={{ redirectTo: "/?tab=duplicates" }}
          onCancel={() => setOpen(false)}
          title={`Merge ${count} duplicate pair${count === 1 ? "" : "s"}?`}
        />
      ) : null}
    </>
  );
}

export function UndoMergeButton({ decisionId }: { decisionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="rounded-lg border border-[#d8ddd6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d2823] transition hover:bg-slate-50"
        onClick={() => setOpen(true)}
        type="button"
      >
        Undo
      </button>
      {open ? (
        <ConfirmDialog
          body={
            "This restores the absorbed contact as a separate record, reverts the surviving contact to its pre-merge state, and re-opens the duplicate suggestion."
          }
          confirmAction={undoMergeContacts}
          confirmLabel="Undo merge"
          hidden={{ decisionId, redirectTo: "/?tab=duplicates" }}
          onCancel={() => setOpen(false)}
          title="Undo this merge?"
        />
      ) : null}
    </>
  );
}
