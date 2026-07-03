"use client";

// P31B-04: real "Labels" sidebar section — replaces the hardcoded placeholder.
// All six states: default, empty, context menu, rename (inline), recolor, create.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createLabel,
  deleteLabel,
  mergeLabels,
  recolorLabel,
  renameLabel,
} from "~/app/actions/labels";
import { LabelDot, RecolorSwatches } from "~/app/_components/label-chip";
import { ConfirmDialog } from "~/app/_components/confirm-dialog";

export type SidebarLabel = {
  id: string;
  name: string;
  color: string;
  count: number;
};

// ── tiny SVG icons ────────────────────────────────────────────────────────────
const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#5c655e">
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4158f4" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// ── context menu ──────────────────────────────────────────────────────────────
function LabelMenu({
  onRename,
  onRecolor,
  onMerge,
  onDelete,
  onClose,
}: {
  onRename: () => void;
  onRecolor: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      className={`flex w-full items-center px-3.5 py-2 text-left text-[13px] font-medium transition hover:bg-[#f2f4f0] ${danger ? "text-[#b5472f]" : "text-[#1d2823]"}`}
      onClick={() => { onClick(); onClose(); }}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={ref}
      className="absolute left-10 top-8 z-50 w-44 overflow-hidden rounded-[0.9rem] border border-[#d8ddd6] bg-white py-1 shadow-[0_12px_34px_rgba(20,30,25,0.16)]"
    >
      {item("Rename", onRename)}
      {item("Recolor", onRecolor)}
      {item("Merge into…", onMerge)}
      <div className="my-1 border-t border-[#edf0ea]" />
      {item("Delete", onDelete, true)}
    </div>
  );
}

// ── merge picker dropdown ─────────────────────────────────────────────────────
function MergePicker({
  labels,
  excludeId,
  onPick,
  onClose,
}: {
  labels: SidebarLabel[];
  excludeId: string;
  onPick: (targetId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-[0.9rem] border border-[#d8ddd6] bg-white py-1 shadow-[0_12px_34px_rgba(20,30,25,0.16)]"
    >
      <div className="px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8b938c]">Merge into…</div>
      {labels.filter((l) => l.id !== excludeId).map((l) => (
        <button
          key={l.id}
          type="button"
          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-[#1d2823] transition hover:bg-[#f2f4f0]"
          onClick={() => { onPick(l.id); onClose(); }}
        >
          <LabelDot col={l.color} size={9} />
          <span className="flex-1">{l.name}</span>
          <span className="tabular-nums text-[12px] text-[#8b938c]">{l.count}</span>
        </button>
      ))}
    </div>
  );
}

// ── a single label row ────────────────────────────────────────────────────────
function LabelRow({
  label,
  active,
  labels,
  onNavigate,
  onMutated,
}: {
  label: SidebarLabel;
  active: boolean;
  labels: SidebarLabel[];
  onNavigate: (name: string) => void;
  onMutated: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [recoloring, setRecoloring] = useState(false);
  const [mergingWith, setMergingWith] = useState(false);
  const [showMergeConfirm, setShowMergeConfirm] = useState<SidebarLabel | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [, startTransition] = useTransition();
  const renameRef = useRef<HTMLInputElement>(null);

  const handleRename = () => {
    const next = renameRef.current?.value.trim();
    if (!next || next === label.name) { setRenaming(false); return; }
    startTransition(async () => {
      await renameLabel({ id: label.id, name: next });
      onMutated();
    });
    setRenaming(false);
  };

  return (
    <>
      <div
        className={`relative flex h-8 cursor-pointer items-center gap-2.5 rounded-[10px] pl-3 pr-1.5 transition ${
          active ? "bg-[#e3efe7]" : ""
        } ${hover && !active ? "bg-[#f2f4f0]" : ""}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); if (!menuOpen && !recoloring && !mergingWith) setMenuOpen(false); }}
        onClick={() => { if (!renaming && !menuOpen) onNavigate(label.name); }}
      >
        {active ? (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#17352e]" />
        ) : null}
        <LabelDot col={label.color} size={9} />

        {renaming ? (
          <input
            ref={renameRef}
            className="h-6 min-w-0 flex-1 rounded border border-[#4158f4] px-1.5 text-[12.5px] font-medium text-[#1d2823] outline-none ring-2 ring-[#edf0fe]"
            defaultValue={label.name}
            autoFocus
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`min-w-0 flex-1 truncate text-[12.5px] font-medium ${
              active ? "text-[#1d2823]" : "text-[#5c655e]"
            }`}
          >
            {label.name}
          </span>
        )}

        {!renaming && (
          hover || menuOpen || recoloring || mergingWith ? (
            <button
              type="button"
              aria-label={`Options for ${label.name}`}
              className="grid h-5 w-5 shrink-0 place-items-center rounded transition hover:bg-[#e9ece7]"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            >
              <DotsIcon />
            </button>
          ) : (
            <span className="min-w-[20px] shrink-0 text-right tabular-nums text-[12px] text-[#8b938c]">
              {label.count}
            </span>
          )
        )}

        {menuOpen && (
          <LabelMenu
            onRename={() => { setRenaming(true); setMenuOpen(false); }}
            onRecolor={() => { setRecoloring((o) => !o); setMenuOpen(false); }}
            onMerge={() => { setMergingWith(true); setMenuOpen(false); }}
            onDelete={() => { setShowDeleteConfirm(true); setMenuOpen(false); }}
            onClose={() => setMenuOpen(false)}
          />
        )}

        {recoloring && (
          <div
            className="absolute left-2 top-9 z-50 rounded-[0.9rem] border border-[#d8ddd6] bg-white p-3 shadow-[0_12px_34px_rgba(20,30,25,0.16)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8b938c]">Recolor</div>
            <RecolorSwatches
              value={label.color}
              onPick={(col) => {
                startTransition(async () => {
                  await recolorLabel({ id: label.id, color: col });
                  onMutated();
                });
                setRecoloring(false);
              }}
            />
          </div>
        )}

        {mergingWith && (
          <MergePicker
            labels={labels}
            excludeId={label.id}
            onPick={(targetId) => {
              const target = labels.find((l) => l.id === targetId);
              if (target) setShowMergeConfirm(target);
              setMergingWith(false);
            }}
            onClose={() => setMergingWith(false)}
          />
        )}
      </div>

      {showMergeConfirm && (
        <ConfirmDialog
          open
          title={`Merge "${label.name}" into "${showMergeConfirm.name}"?`}
          body={`${label.count} contacts will keep "${showMergeConfirm.name}". "${label.name}" is removed everywhere. This can't be undone.`}
          confirmLabel="Merge labels"
          destructive={false}
          onConfirm={() => {
            startTransition(async () => {
              await mergeLabels({ sourceId: label.id, targetId: showMergeConfirm.id });
              onMutated();
            });
            setShowMergeConfirm(null);
          }}
          onClose={() => setShowMergeConfirm(null)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          open
          title={`Delete "${label.name}"?`}
          body={`Removes the label from ${label.count} contacts. The contacts aren't deleted.`}
          confirmLabel="Delete label"
          destructive
          onConfirm={() => {
            startTransition(async () => {
              await deleteLabel({ id: label.id });
              onMutated();
            });
            setShowDeleteConfirm(false);
          }}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

// ── main export ───────────────────────────────────────────────────────────────
export function LabelsSidebar({
  labels: initialLabels,
  activeLabel,
}: {
  labels: SidebarLabel[];
  activeLabel: string | null;
}) {
  const router = useRouter();
  const [labels, setLabels] = useState(initialLabels);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [, startTransition] = useTransition();
  const createRef = useRef<HTMLInputElement>(null);

  // Keep in sync when the server re-renders with fresh data.
  useEffect(() => { setLabels(initialLabels); }, [initialLabels]);

  const navigate = (name: string) => {
    router.push(`/contacts?tab=people&filter=all&label=${encodeURIComponent(name)}`);
  };

  const handleCreate = () => {
    const name = createName.trim();
    if (!name) { setCreating(false); setCreateName(""); return; }
    startTransition(async () => {
      await createLabel({ name });
      router.refresh();
    });
    setCreating(false);
    setCreateName("");
  };

  return (
    <div className="mt-3">
      {/* section header */}
      <div className="flex items-center gap-1 px-2.5 py-1">
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">Labels</span>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold text-[#4158f4] transition hover:bg-[#edf0fe]"
          onClick={() => { setCreating(true); setTimeout(() => createRef.current?.focus(), 10); }}
        >
          <PlusIcon /> New label
        </button>
      </div>

      {/* inline create row */}
      {creating && (
        <div className="flex h-8 items-center gap-2.5 px-3">
          <span className="h-[14px] w-[14px] rounded-[4px] bg-[#6fa3a0]" />
          <input
            ref={createRef}
            className="h-7 min-w-0 flex-1 rounded border border-[#4158f4] px-1.5 text-[12.5px] text-[#1d2823] outline-none ring-2 ring-[#edf0fe]"
            placeholder="Label name…"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onBlur={handleCreate}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setCreating(false); setCreateName(""); }
            }}
          />
        </div>
      )}

      {/* empty state */}
      {labels.length === 0 && !creating && (
        <p className="px-3 py-1 text-[12px] leading-relaxed text-[#8b938c]">
          Tag a contact to start a label — it shows up here.
        </p>
      )}

      {/* label rows */}
      {labels.map((l) => (
        <LabelRow
          key={l.id}
          label={l}
          active={activeLabel?.toLowerCase() === l.name.toLowerCase()}
          labels={labels}
          onNavigate={navigate}
          onMutated={() => router.refresh()}
        />
      ))}
    </div>
  );
}
