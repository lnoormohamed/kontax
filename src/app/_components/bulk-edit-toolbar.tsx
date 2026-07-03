"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "~/app/_components/confirm-dialog";
import { OfflineWriteNote } from "~/app/_components/connection-banner";
import { useOffline } from "~/app/_components/connectivity";
import { archiveContactsBulk, deleteContactsBulk, favoriteContactsBulk, restoreContactsBulk } from "~/app/actions/contacts";
import { addLabelBulk, mergeContactsBulk, removeLabelBulk, setCompanyBulk } from "~/app/actions/bulk-edit";
import { moveContactsToBook } from "~/app/actions/address-books";

export type ToolbarBook = { id: string; name: string; isDefault: boolean };
export type ToolbarContact = { id: string; name: string; labels: string[] };

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
const IconMerge = () => <S d="M7 21V9a4 4 0 004 4h6|M17 13l3-3-3-3|M7 3v6" />;
const IconMore = () => <S d="M5 12h.01|M12 12h.01|M19 12h.01" sw={2.4} />;
const IconClose = () => <S d="M6 6l12 12M18 6L6 18" sw={2} />;
const IconRestore = () => <S d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8|M3 4v4h4" />;
const Chev = () => <S d="M6 15l6-6 6 6" w={13} sw={2} />;

// ── dark action button ────────────────────────────────────────────────────────
function Act({
  children,
  open,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  open?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[13px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
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

// tri-state checkbox glyph for the label manager
function TriCheck({ state }: { state: "on" | "off" | "mixed" }) {
  return (
    <span
      className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border-[1.6px] ${
        state === "off" ? "border-slate-300 bg-white" : "border-[#4158f4] bg-[#4158f4]"
      }`}
    >
      {state === "on" ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3L9.5 3.5" /></svg>
      ) : state === "mixed" ? (
        <span className="h-[2px] w-[9px] rounded bg-white" />
      ) : null}
    </span>
  );
}

export function BulkEditToolbar({
  selectedIds,
  selectedContacts,
  mode,
  books,
  labelSuggestions,
  onClear,
  onOptimisticPatch,
  onOptimisticRemove,
  onOptimisticError,
}: {
  selectedIds: string[];
  selectedContacts: ToolbarContact[];
  mode: "active" | "archived";
  books: ToolbarBook[];
  labelSuggestions: string[];
  onClear: () => void;
  // P38-05: optimistic hooks — patch/hide the on-screen rows immediately;
  // onOptimisticError reverts both when the action fails.
  onOptimisticPatch?: (patches: Record<string, { isFavorite?: boolean; company?: string | null; labels?: string[] }>) => void;
  onOptimisticRemove?: (ids: string[]) => void;
  onOptimisticError?: (ids: string[]) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [open, setOpen] = useState<null | "move" | "labels" | "company" | "more">(null);
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const [labelOverrides, setLabelOverrides] = useState<Record<string, boolean>>({});
  const [companyText, setCompanyText] = useState("");

  const count = selectedIds.length;

  // P42-DB01 Surface 2b: bulk actions need a connection. The whole action
  // toolbar disables while offline; the selection itself is preserved. Open
  // popovers close so a disabled action can't be half-finished.
  const offline = useOffline();
  useEffect(() => {
    if (offline) setOpen(null);
  }, [offline]);

  // Per-label membership across the selection → tri-state. Reset overrides when
  // the selection changes so the manager reflects the new set.
  const labelCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of selectedContacts) for (const l of c.labels) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  }, [selectedContacts]);
  useEffect(() => setLabelOverrides({}), [selectedContacts]);

  const run = (fn: () => Promise<unknown>, optimistic?: () => void) => {
    setBusy(true);
    const ids = selectedIds;
    optimistic?.();
    void (async () => {
      try {
        await fn();
        setOpen(null);
        setConfirm(null);
        setMergeOpen(false);
        onClear();
        startTransition(() => router.refresh());
      } catch (err) {
        onOptimisticError?.(ids);
        alert(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    })();
  };

  // No redirectTo: a server-action redirect() re-runs middleware via a cookieless
  // internal sub-request and bounces to /login. Instead the action revalidates and
  // we refresh + clear on the client.
  const runForm = (action: (fd: FormData) => Promise<void>, optimistic?: () => void) => {
    setBusy(true);
    const ids = selectedIds;
    optimistic?.();
    const fd = new FormData();
    selectedIds.forEach((id) => fd.append("contactIds", id));
    startTransition(async () => {
      try {
        await action(fd);
        setOpen(null);
        setConfirm(null);
        setMergeOpen(false);
        onClear();
        router.refresh();
      } catch (err) {
        onOptimisticError?.(ids);
        alert(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    });
  };

  // ── label manager ───────────────────────────────────────────────────────────
  const labelCatalog = useMemo(() => {
    const all = new Set<string>(labelSuggestions);
    for (const l of labelCounts.keys()) all.add(l);
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [labelSuggestions, labelCounts]);
  const filteredLabels = labelCatalog.filter(
    (l) => !labelSearch.trim() || l.toLowerCase().includes(labelSearch.trim().toLowerCase()),
  );
  const labelState = (label: string): "on" | "off" | "mixed" => {
    if (label in labelOverrides) return labelOverrides[label] ? "on" : "off";
    const n = labelCounts.get(label) ?? 0;
    if (n === 0) return "off";
    return n === count ? "on" : "mixed";
  };
  const toggleLabel = (label: string) =>
    setLabelOverrides((o) => ({ ...o, [label]: labelState(label) !== "on" }));
  const showCreateLabel =
    labelSearch.trim().length > 0 &&
    !labelCatalog.some((l) => l.toLowerCase() === labelSearch.trim().toLowerCase());
  const pendingLabelChanges = Object.keys(labelOverrides).filter((l) => {
    const n = labelCounts.get(l) ?? 0;
    const was = n === count && n > 0;
    return labelOverrides[l] !== was;
  });
  const applyLabels = () =>
    run(
      async () => {
        for (const label of pendingLabelChanges) {
          if (labelOverrides[label]) await addLabelBulk({ contactIds: selectedIds, label });
          else await removeLabelBulk({ contactIds: selectedIds, label });
        }
      },
      () => {
        // P38-05: chips update immediately on every selected row.
        const patches: Record<string, { labels: string[] }> = {};
        for (const c of selectedContacts) {
          let next = [...c.labels];
          for (const label of pendingLabelChanges) {
            if (labelOverrides[label]) {
              if (!next.some((l) => l.toLowerCase() === label.toLowerCase())) next.push(label);
            } else {
              next = next.filter((l) => l.toLowerCase() !== label.toLowerCase());
            }
          }
          patches[c.id] = { labels: next };
        }
        onOptimisticPatch?.(patches);
      },
    );

  // ── merge ─────────────────────────────────────────────────────────────────
  const personalBooks = books;

  if (count === 0) return null;

  return (
    <>
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-[88px] z-40 flex flex-col items-center gap-2 px-3 md:bottom-6">
        {offline ? (
          <div className="pointer-events-auto w-full max-w-[430px]">
            <OfflineWriteNote
              title="Bulk actions need a connection."
              body="Your selection is kept — reconnect and try again."
            />
          </div>
        ) : null}
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

          {/* P42-DB01: the whole action set disables while offline; X (clear
              selection) stays live — it's local, not a write. */}
          <div
            aria-disabled={offline}
            className="flex items-center gap-1"
            style={offline ? { pointerEvents: "none", opacity: 0.45 } : undefined}
          >
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

              {/* Manage labels (tri-state add/remove) */}
              <div className="relative">
                <Act open={open === "labels"} onClick={() => setOpen(open === "labels" ? null : "labels")}>
                  <IconTag />
                  <span className="hidden md:inline">Labels</span>
                  <Chev />
                </Act>
                {open === "labels" ? (
                  <Pop onClose={() => setOpen(null)} width={244}>
                    <div className="p-1">
                      <input
                        autoFocus
                        value={labelSearch}
                        onChange={(e) => setLabelSearch(e.target.value)}
                        placeholder="Search or create…"
                        className="h-9 w-full rounded-[9px] border-[1.5px] border-[#d8ddd6] px-2.5 text-[13px] text-[#1d2823] outline-none focus:border-[#4158f4]"
                      />
                    </div>
                    <div className="max-h-[210px] overflow-y-auto">
                      {filteredLabels.map((l) => {
                        const st = labelState(l);
                        return (
                          <button key={l} type="button" className={popItem} onClick={() => toggleLabel(l)}>
                            <TriCheck state={st} />
                            <span className="truncate">{l}</span>
                          </button>
                        );
                      })}
                      {showCreateLabel ? (
                        <button
                          type="button"
                          className={`${popItem} text-[#4158f4]`}
                          disabled={busy}
                          onClick={() => run(() => addLabelBulk({ contactIds: selectedIds, label: labelSearch }))}
                        >
                          Create “{labelSearch.trim()}”
                        </button>
                      ) : null}
                      {filteredLabels.length === 0 && !showCreateLabel ? (
                        <div className="px-2.5 py-2 text-[12.5px] text-[#8b938c]">No labels yet.</div>
                      ) : null}
                    </div>
                    {pendingLabelChanges.length > 0 ? (
                      <div className="mt-1 flex justify-end border-t border-[#e9ece7] p-1.5">
                        <button type="button" disabled={busy} className="h-8 rounded-lg bg-[#4158f4] px-3 text-[13px] font-semibold text-white disabled:opacity-50" onClick={applyLabels}>
                          Apply
                        </button>
                      </div>
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
                          if (e.key === "Enter") run(() => setCompanyBulk({ contactIds: selectedIds, company: companyText }), () => onOptimisticPatch?.(Object.fromEntries(selectedIds.map((id) => [id, { company: companyText.trim() || null }]))));
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
                      <button type="button" disabled={busy} className="h-8 rounded-lg bg-[#4158f4] px-3 text-[13px] font-semibold text-white disabled:opacity-50" onClick={() => run(() => setCompanyBulk({ contactIds: selectedIds, company: companyText }), () => onOptimisticPatch?.(Object.fromEntries(selectedIds.map((id) => [id, { company: companyText.trim() || null }]))))}>
                        Apply to {count}
                      </button>
                    </div>
                  </Pop>
                ) : null}
              </div>

              {/* Merge */}
              <Act onClick={() => setMergeOpen(true)} disabled={count < 2}>
                <IconMerge />
                <span className="hidden md:inline">Merge</span>
              </Act>

              {/* Archive */}
              <Act onClick={() => setConfirm("archive")}>
                <IconArchive />
                <span className="hidden md:inline">Archive</span>
              </Act>
            </div>
          ) : (
            <Act onClick={() => runForm(restoreContactsBulk, () => onOptimisticRemove?.(selectedIds))}>
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
                  <button type="button" className={popItem} onClick={() => runForm(favoriteContactsBulk, () => onOptimisticPatch?.(Object.fromEntries(selectedIds.map((id) => [id, { isFavorite: true }]))))}>
                    Favorite all
                  </button>
                ) : null}
                <a
                  className={popItem}
                  href={`/api/exports/contacts/csv?ids=${encodeURIComponent(selectedIds.join(","))}`}
                  onClick={() => setOpen(null)}
                >
                  Export as CSV
                </a>
                <button
                  type="button"
                  className={popItem}
                  onClick={() => {
                    setOpen(null);
                    window.open(`/contacts/print?ids=${encodeURIComponent(selectedIds.join(","))}`, "_blank", "noopener");
                  }}
                >
                  Print
                </button>
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
        </div>
            </div>,
            document.body,
          )
        : null}

      {/* Merge modal — pick the primary the others fold into */}
      {mergeOpen ? <MergeModal contacts={selectedContacts} busy={busy} onCancel={() => setMergeOpen(false)} onMerge={(primaryId) => run(() => mergeContactsBulk({ primaryContactId: primaryId, secondaryContactIds: selectedIds.filter((id) => id !== primaryId) }))} /> : null}

      <ConfirmDialog
        open={confirm === "archive"}
        busy={busy}
        destructive
        title={`Archive ${count} contact${count === 1 ? "" : "s"}?`}
        body="They’ll be hidden from People and your books, but never deleted. You can restore them anytime."
        confirmLabel="Archive"
        onClose={() => setConfirm(null)}
        onConfirm={() => runForm(archiveContactsBulk, () => onOptimisticRemove?.(selectedIds))}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        busy={busy}
        destructive
        title={`Delete ${count} contact${count === 1 ? "" : "s"} permanently?`}
        body="This can’t be undone. The contacts and their sync links will be removed from Kontax."
        confirmLabel={`Delete ${count}`}
        onClose={() => setConfirm(null)}
        onConfirm={() => runForm(deleteContactsBulk, () => onOptimisticRemove?.(selectedIds))}
      />
    </>
  );
}

// ── merge modal ────────────────────────────────────────────────────────────────
function MergeModal({
  contacts,
  busy,
  onCancel,
  onMerge,
}: {
  contacts: ToolbarContact[];
  busy: boolean;
  onCancel: () => void;
  onMerge: (primaryId: string) => void;
}) {
  const [primaryId, setPrimaryId] = useState(contacts[0]?.id ?? "");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onCancel}>
      <div className="w-full max-w-[420px] rounded-[16px] bg-white p-5 shadow-[0_24px_60px_rgba(20,30,25,0.25)]" onClick={(e) => e.stopPropagation()}>
        <h3 className="m-0 text-[17px] font-bold text-[#1d2823]">Merge {contacts.length} contacts</h3>
        <p className="mb-3 mt-2 text-[13.5px] leading-relaxed text-[#5c655e]">
          Choose which contact to keep. The others are merged into it — their details fill any gaps, and the duplicates are removed.
        </p>
        <div className="max-h-[260px] overflow-y-auto rounded-[10px] border border-[#e9ece7]">
          {contacts.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-[#f1f3ef] px-3 py-2.5 last:border-b-0 hover:bg-[#f7f8f5]">
              <input type="radio" name="primary" checked={primaryId === c.id} onChange={() => setPrimaryId(c.id)} className="accent-[#4158f4]" />
              <span className="truncate text-[14px] font-medium text-[#1d2823]">{c.name}</span>
              {primaryId === c.id ? <span className="ml-auto rounded-full bg-[#e3efe7] px-2 py-0.5 text-[11px] font-semibold text-[#1c6b48]">Keep</span> : null}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="h-9 rounded-[9px] px-3 text-[13.5px] font-semibold text-[#5c655e]" onClick={onCancel}>Cancel</button>
          <button type="button" disabled={busy || !primaryId} className="h-9 rounded-[9px] bg-[#4158f4] px-4 text-[13.5px] font-semibold text-white disabled:opacity-50" onClick={() => onMerge(primaryId)}>
            Merge {contacts.length}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
