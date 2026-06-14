"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "~/app/_components/confirm-dialog";
import { archiveContactsBulk, deleteContactsBulk, favoriteContactsBulk, restoreContactsBulk } from "~/app/actions/contacts";
import { addLabelBulk, setCompanyBulk } from "~/app/actions/bulk-edit";
import { moveContactsToBook } from "~/app/actions/address-books";

export type ToolbarBook = { id: string; name: string; isDefault: boolean };

// ── inline glyphs ─────────────────────────────────────────────────────────────
const S = ({ d, w = 16, sw = 1.8 }: { d: string; w?: number; sw?: number }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d.split("|").map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);
const IconFolder = () => <S d="M3 7.5A1.5 1.5 0 014.5 6H9l2 2.2h8.5A1.5 1.5 0 0121 9.7V18a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18z" />;
const IconTag = () => <S d="M3 11l8-8 9 .5.5 9-8 8z|M7.5 7.5h.01" />;
const IconBuilding = () => <S d="M4 21V5l8-2v18|M12 21V9l6 2v10|M7 8h.01|M7 12h.01|M7 16h.01" />;
const IconArchive = () => <S d="M3 7h18M5 7l1 13h12l1-13M9 11h6" />;
const IconMore = () => <S d="M5 12h.01|M12 12h.01|M19 12h.01" sw={2.4} />;
const IconClose = () => <S d="M6 6l12 12M18 6L6 18" sw={2} />;
const IconRestore = () => <S d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8|M3 4v4h4" />;
const Chev = () => <S d="M6 15l6-6 6 6" w={13} sw={2} />;

// ── dark action button ────────────────────────────────────────────────────────
function Act({
  children,
  open,
  onClick,
}: {
  children: React.ReactNode;
  open?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[13px] font-semibold text-white transition hover:bg-white/10"
      style={{ background: open ? "rgba(255,255,255,0.14)" : undefined }}
    >
      {children}
    </button>
  );
}

// ── popover shell (opens upward from the bar) ─────────────────────────────────
function Pop({ children, onClose, width = 210 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 rounded-[11px] border border-black/5 bg-white p-1.5 text-[#1d2823] shadow-[0_14px_40px_rgba(20,30,25,0.28)]"
      style={{ width }}
    >
      {children}
    </div>
  );
}

const popLabel = "px-2 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8b938c]";
const popItem = "flex h-9 w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[13px] font-medium text-[#1d2823] transition hover:bg-[#f2f4f0]";

export function BulkEditToolbar({
  selectedIds,
  mode,
  books,
  labelSuggestions,
  redirectTo,
  onClear,
}: {
  selectedIds: string[];
  mode: "active" | "archived";
  books: ToolbarBook[];
  labelSuggestions: string[];
  redirectTo: string;
  onClear: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Portal to body so position:fixed escapes the virtualizer's transformed
  // ancestor (a fixed descendant of a transformed element is contained by it).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [open, setOpen] = useState<null | "move" | "label" | "company" | "more">(null);
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const [labelText, setLabelText] = useState("");
  const [companyText, setCompanyText] = useState("");

  const count = selectedIds.length;
  if (count === 0) return null;

  const run = (fn: () => Promise<unknown>) => {
    setBusy(true);
    void (async () => {
      try {
        await fn();
        setOpen(null);
        setConfirm(null);
        onClear();
        startTransition(() => router.refresh());
      } catch (err) {
        alert(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    })();
  };

  // archive / delete / restore reuse the FormData server actions (they emit
  // activity + security signals and redirect, which refreshes the view).
  const runForm = (action: (fd: FormData) => Promise<void>) => {
    setBusy(true);
    const fd = new FormData();
    selectedIds.forEach((id) => fd.append("contactIds", id));
    fd.set("redirectTo", redirectTo);
    startTransition(async () => {
      try {
        await action(fd);
      } catch (err) {
        // NEXT_REDIRECT is expected (the action redirects on success).
        if (!(err instanceof Error) || !err.message.includes("NEXT_REDIRECT")) {
          alert(err instanceof Error ? err.message : "Something went wrong.");
          setBusy(false);
        }
      }
    });
  };

  const filteredLabels = labelSuggestions.filter(
    (l) => labelText.trim() && l.toLowerCase().startsWith(labelText.trim().toLowerCase()),
  );
  const showCreateLabel =
    labelText.trim().length > 0 &&
    !labelSuggestions.some((l) => l.toLowerCase() === labelText.trim().toLowerCase());

  const personalBooks = books; // includes Default; moveContactsToBook validates ownership.

  return (
    <>
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-[88px] z-40 flex justify-center px-3 md:bottom-6">
        <div
          className="pointer-events-auto flex h-14 max-w-[calc(100vw-24px)] items-center gap-2 rounded-[14px] px-3 text-white shadow-[0_14px_36px_rgba(20,30,25,0.34)] md:gap-2 md:px-5"
          style={{ background: "#1d2823" }}
        >
          <button
            type="button"
            aria-label="Clear selection"
            onClick={onClear}
            className="grid h-[30px] w-[30px] place-items-center rounded-lg text-[#cfe0d6] transition hover:bg-white/10 hover:text-white"
          >
            <IconClose />
          </button>
          <span className="whitespace-nowrap text-[13.5px] font-semibold">
            <span className="hidden sm:inline">{count} contact{count === 1 ? "" : "s"} selected</span>
            <span className="sm:hidden">{count} selected</span>
          </span>
          <div className="mx-1 h-6 w-px bg-white/15" />

          {mode === "active" ? (
            <div className="flex items-center gap-1">
              {/* Move to book */}
              <div className="relative">
                <Act open={open === "move"} onClick={() => setOpen(open === "move" ? null : "move")}>
                  <IconFolder />
                  <span className="hidden md:inline">Move to book</span>
                  <Chev />
                </Act>
                {open === "move" ? (
                  <Pop onClose={() => setOpen(null)} width={210}>
                    <div className={popLabel}>Move {count} to…</div>
                    {personalBooks.map((b) => (
                      <button key={b.id} type="button" className={popItem} disabled={busy} onClick={() => run(() => moveContactsToBook({ contactIds: selectedIds, targetBookId: b.id }))}>
                        <span className="text-[#5c655e]"><IconFolder /></span>
                        {b.name}
                      </button>
                    ))}
                  </Pop>
                ) : null}
              </div>

              {/* Add label */}
              <div className="relative">
                <Act open={open === "label"} onClick={() => setOpen(open === "label" ? null : "label")}>
                  <IconTag />
                  <span className="hidden md:inline">Add label</span>
                  <Chev />
                </Act>
                {open === "label" ? (
                  <Pop onClose={() => setOpen(null)} width={230}>
                    <div className="p-1">
                      <input
                        autoFocus
                        value={labelText}
                        onChange={(e) => setLabelText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && labelText.trim()) run(() => addLabelBulk({ contactIds: selectedIds, label: labelText }));
                        }}
                        placeholder="Label name…"
                        className="h-9 w-full rounded-[9px] border-[1.5px] border-[#4158f4] px-2.5 text-[13px] text-[#1d2823] outline-none"
                        style={{ boxShadow: "0 0 0 3px rgba(65,88,244,0.12)" }}
                      />
                    </div>
                    {filteredLabels.map((l) => (
                      <button key={l} type="button" className={popItem} disabled={busy} onClick={() => run(() => addLabelBulk({ contactIds: selectedIds, label: l }))}>
                        {l}
                      </button>
                    ))}
                    {showCreateLabel ? (
                      <button type="button" className={`${popItem} text-[#4158f4]`} disabled={busy} onClick={() => run(() => addLabelBulk({ contactIds: selectedIds, label: labelText }))}>
                        Create “{labelText.trim()}”
                      </button>
                    ) : null}
                  </Pop>
                ) : null}
              </div>

              {/* Set company */}
              <div className="relative">
                <Act open={open === "company"} onClick={() => setOpen(open === "company" ? null : "company")}>
                  <IconBuilding />
                  <span className="hidden md:inline">Set company</span>
                </Act>
                {open === "company" ? (
                  <Pop onClose={() => setOpen(null)} width={248}>
                    <div className={popLabel}>Set company for {count}</div>
                    <div className="p-1">
                      <input
                        autoFocus
                        value={companyText}
                        onChange={(e) => setCompanyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") run(() => setCompanyBulk({ contactIds: selectedIds, company: companyText }));
                        }}
                        placeholder="Company name…"
                        className="h-9 w-full rounded-[9px] border-[1.5px] border-[#4158f4] px-2.5 text-[13px] text-[#1d2823] outline-none"
                        style={{ boxShadow: "0 0 0 3px rgba(65,88,244,0.12)" }}
                      />
                    </div>
                    <div className="flex justify-end gap-2 p-1">
                      <button type="button" className="h-8 rounded-lg border border-[#d8ddd6] px-3 text-[13px] font-semibold text-[#5c655e]" onClick={() => setOpen(null)}>
                        Cancel
                      </button>
                      <button type="button" disabled={busy} className="h-8 rounded-lg bg-[#4158f4] px-3 text-[13px] font-semibold text-white disabled:opacity-50" onClick={() => run(() => setCompanyBulk({ contactIds: selectedIds, company: companyText }))}>
                        Apply to {count}
                      </button>
                    </div>
                  </Pop>
                ) : null}
              </div>

              {/* Archive */}
              <Act onClick={() => setConfirm("archive")}>
                <IconArchive />
                <span className="hidden md:inline">Archive</span>
              </Act>
            </div>
          ) : (
            <Act onClick={() => runForm(restoreContactsBulk)}>
              <IconRestore />
              <span className="hidden md:inline">Restore</span>
            </Act>
          )}

          {/* More */}
          <div className="relative">
            <Act open={open === "more"} onClick={() => setOpen(open === "more" ? null : "more")}>
              <IconMore />
            </Act>
            {open === "more" ? (
              <Pop onClose={() => setOpen(null)} width={224}>
                {mode === "active" ? (
                  <button type="button" className={popItem} onClick={() => runForm(favoriteContactsBulk)}>
                    Favorite all
                  </button>
                ) : null}
                <a
                  className={popItem}
                  href={`/api/exports/contacts/csv?ids=${encodeURIComponent(selectedIds.join(","))}`}
                  onClick={() => setOpen(null)}
                >
                  Export selection as CSV
                </a>
                <div className="my-1 h-px bg-[#e9ece7]" />
                <button
                  type="button"
                  className={`${popItem} text-[#b5472f] hover:bg-[#fbeae6]`}
                  onClick={() => {
                    setOpen(null);
                    setConfirm("delete");
                  }}
                >
                  Delete permanently
                </button>
              </Pop>
            ) : null}
          </div>
        </div>
            </div>,
            document.body,
          )
        : null}

      <ConfirmDialog
        open={confirm === "archive"}
        busy={busy}
        destructive
        title={`Archive ${count} contact${count === 1 ? "" : "s"}?`}
        body="They’ll be hidden from People and your books, but never deleted. You can restore them anytime."
        confirmLabel="Archive"
        onClose={() => setConfirm(null)}
        onConfirm={() => runForm(archiveContactsBulk)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        busy={busy}
        destructive
        title={`Delete ${count} contact${count === 1 ? "" : "s"} permanently?`}
        body="This can’t be undone. The contacts and their sync links will be removed from Kontax."
        confirmLabel={`Delete ${count}`}
        onClose={() => setConfirm(null)}
        onConfirm={() => runForm(deleteContactsBulk)}
      />
    </>
  );
}
