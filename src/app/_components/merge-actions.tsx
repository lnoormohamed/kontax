"use client";

import { useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { bulkAcceptHighConfidenceContacts, undoMergeContacts } from "~/app/actions/contacts";

// ── generic modal shell ───────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,30,25,0.4)] px-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-[440px] overflow-hidden rounded-[16px] border border-[#d8ddd6] bg-white shadow-[0_24px_60px_rgba(20,30,25,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── bulk-merge confirmation dialog ────────────────────────────────────────────
export function BulkMergeButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  if (count < 1) return null;

  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded-[10px] bg-[#17352e] px-3.5 py-2 text-[13.5px] font-semibold text-white transition hover:bg-[#20443b]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <WorkspaceIcon name="merge" size={16} strokeWidth={2} />
        Accept all {count} high-confidence
      </button>

      {open && (
        <Modal onClose={merging ? () => undefined : () => setOpen(false)}>
          <div className="px-6 pb-1 pt-[22px]">
            <h3 className="text-[18px] font-bold tracking-tight text-[#1d2823]">
              Merge {count} duplicate pair{count === 1 ? "" : "s"}?
            </h3>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-[#5c655e]">
              These are all high-confidence matches. Each pair will be merged, keeping the contact
              that was added first. You can undo any of them afterwards.
            </p>
          </div>

          <div className="flex justify-end gap-2.5 px-5 pb-[18px] pt-3">
            <button
              className="px-2 py-2.5 text-[13.5px] font-semibold text-[#5c655e] disabled:opacity-50"
              disabled={merging}
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <form
              action={async (fd) => {
                setMerging(true);
                await bulkAcceptHighConfidenceContacts(fd);
                setOpen(false);
                setMerging(false);
              }}
            >
              <input name="redirectTo" type="hidden" value="/contacts?tab=duplicates" />
              <button
                className="inline-flex h-[42px] items-center gap-2 rounded-[10px] bg-[#17352e] px-[18px] text-[13.5px] font-semibold text-white transition hover:bg-[#20443b] disabled:opacity-80"
                disabled={merging}
                type="submit"
              >
                {merging ? (
                  <>
                    <span
                      className="h-[15px] w-[15px] animate-spin rounded-full border-[2.2px] border-white/40 border-t-white"
                      style={{ display: "block" }}
                    />
                    Merging…
                  </>
                ) : (
                  <>
                    <WorkspaceIcon name="merge" size={16} strokeWidth={2} />
                    Merge {count} pair{count === 1 ? "" : "s"}
                  </>
                )}
              </button>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── undo merge button + confirmation dialog ───────────────────────────────────
export function UndoMergeButton({
  decisionId,
  survivorName,
  absorbedName,
}: {
  decisionId: string;
  survivorName?: string;
  absorbedName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#d8ddd6] bg-white px-3 py-[5px] text-[12.5px] font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <WorkspaceIcon name="restore" size={14} strokeWidth={1.8} />
        Undo
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="px-6 py-[22px]">
            <h3 className="text-[17px] font-bold tracking-tight text-[#1d2823]">Undo this merge?</h3>
            <p className="mt-2 mb-[18px] text-[13.5px] leading-[1.55] text-[#5c655e]">
              {survivorName && absorbedName ? (
                <>
                  This restores{" "}
                  <strong className="font-semibold text-[#1d2823]">{absorbedName}</strong> as a
                  separate record, reverts{" "}
                  <strong className="font-semibold text-[#1d2823]">{survivorName}</strong> to its
                  pre-merge state, and re-opens the duplicate suggestion.
                </>
              ) : (
                "This restores the absorbed contact as a separate record, reverts the surviving contact to its pre-merge state, and re-opens the duplicate suggestion."
              )}
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                className="px-2 py-2.5 text-[13.5px] font-semibold text-[#5c655e]"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <form action={undoMergeContacts}>
                <input name="decisionId" type="hidden" value={decisionId} />
                <input name="redirectTo" type="hidden" value="/contacts?tab=duplicates" />
                <button
                  className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] bg-[#17352e] px-[18px] text-[13.5px] font-semibold text-white transition hover:bg-[#20443b]"
                  type="submit"
                >
                  <WorkspaceIcon name="restore" size={16} strokeWidth={1.8} />
                  Undo merge
                </button>
              </form>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
