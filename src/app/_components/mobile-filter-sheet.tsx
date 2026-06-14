"use client";

// P31B-08: "Filter & organize" bottom sheet — the mobile home for labels,
// lists, books, and quick filters. Opened from the filter glyph in the header.
// P31B-09: Mobile manage panel (full-screen) + edit sheet (bottom sheet).

import { createPortal } from "react-dom";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteLabel,
  mergeLabels,
  recolorLabel,
  renameLabel,
} from "~/app/actions/labels";
import { LabelChip, LabelDot, RecolorSwatches } from "~/app/_components/label-chip";
import { ConfirmDialog } from "~/app/_components/confirm-dialog";
import type { SidebarLabel } from "~/app/_components/labels-sidebar";
import type { SmartList } from "~/app/_components/smart-lists-books";
import type { PersonalBook } from "~/app/_components/smart-lists-books";

// ── Filter glyph icon ─────────────────────────────────────────────────────────
function FilterIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#17352e" : "#5c655e"} strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

// ── Section header inside the sheet ──────────────────────────────────────────
function SheetSection({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 6px" }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#8b938c", flex: 1 }}>
        {title}
      </span>
      {action}
    </div>
  );
}

// ── A row inside the sheet ────────────────────────────────────────────────────
function SheetRow({
  icon,
  dot,
  name,
  count,
  active,
  onClick,
}: {
  icon?: React.ReactNode;
  dot?: string;
  name: string;
  count?: number | null;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        width: "100%",
        height: 48,
        padding: "0 16px",
        border: "none",
        background: active ? "#e7efe9" : "transparent",
        borderLeft: `3px solid ${active ? "#17352e" : "transparent"}`,
        cursor: "pointer",
        fontFamily: "inherit",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {dot ? (
        <span style={{ width: 18, display: "grid", placeItems: "center" }}>
          <LabelDot col={dot} size={10} />
        </span>
      ) : icon ? (
        <span style={{ width: 18, display: "grid", placeItems: "center" }}>{icon}</span>
      ) : null}
      <span style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: active ? 600 : 500, color: active ? "#17352e" : "#1d2823" }}>
        {name}
      </span>
      {count != null && (
        <span style={{ fontSize: 13, color: "#8b938c" }}>{count}</span>
      )}
      {active && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17352e" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12l5 5L19 7" />
        </svg>
      )}
    </button>
  );
}

// ── Mobile edit bottom sheet (P31B-09) ────────────────────────────────────────
function MobileEditSheet({
  label,
  labels,
  onClose,
  onMutated,
}: {
  label: SidebarLabel;
  labels: SidebarLabel[];
  onClose: () => void;
  onMutated: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [mergePickerOpen, setMergePickerOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<SidebarLabel | null>(null);
  const [mergeConfirm, setMergeConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setName(label.name);
    setColor(label.color);
    setMergeTarget(null);
  }, [label.id, label.name, label.color]);

  const handleSave = () => {
    const trimmedName = name.trim();
    startTransition(async () => {
      if (trimmedName && trimmedName !== label.name) await renameLabel({ id: label.id, name: trimmedName });
      if (color !== label.color) await recolorLabel({ id: label.id, color });
      onMutated();
    });
    onClose();
  };

  return (
    <div
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0 -8px 30px rgba(0,0,0,.18)", zIndex: 10 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* handle */}
      <div style={{ display: "grid", placeItems: "center", padding: "9px 0 4px" }}>
        <span style={{ width: 38, height: 5, borderRadius: 3, background: "#d8ddd6" }} />
      </div>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px 14px" }}>
        <LabelChip name={label.name} col={label.color} sz="md" />
        <span style={{ fontSize: 12.5, color: "#8b938c" }}>{label.count} contacts tagged</span>
        <button type="button" onClick={onClose} style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: "50%", background: "#f2f4f0", border: "none", display: "grid", placeItems: "center", cursor: "pointer", fontSize: 16, color: "#5c655e" }}>✕</button>
      </div>
      {/* fields */}
      <div style={{ padding: "0 16px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#8b938c", marginBottom: 7 }}>Name</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ height: 48, width: "100%", borderRadius: 12, border: "1.5px solid #d8ddd6", padding: "0 14px", fontSize: 16, color: "#1d2823", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />

        <div style={{ fontSize: 12, fontWeight: 600, color: "#8b938c", marginTop: 18, marginBottom: 9 }}>Color</div>
        <RecolorSwatches value={color} onPick={setColor} size={32} />

        <button
          type="button"
          onClick={() => setMergePickerOpen(true)}
          style={{ marginTop: 18, width: "100%", height: 48, border: "1.5px solid #d8ddd6", borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "0 14px", fontFamily: "inherit", cursor: "pointer" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5c655e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4v5a4 4 0 004 4h8M14 9l4 4-4 4M6 20v-3" />
          </svg>
          <span style={{ flex: 1, textAlign: "left", fontSize: 15, color: mergeTarget ? "#1d2823" : "#8b938c" }}>
            {mergeTarget ? mergeTarget.name : "Merge into…"}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b938c" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            style={{ flexShrink: 0, height: 50, padding: "0 16px", borderRadius: 13, border: "1px solid #b5472f", background: "#fff", color: "#b5472f", fontSize: 15, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: "inherit" }}
          >
            Delete
          </button>
          {mergeTarget && (
            <button
              type="button"
              onClick={() => setMergeConfirm(true)}
              style={{ flexShrink: 0, height: 50, padding: "0 16px", borderRadius: 13, border: "1px solid #bf8526", background: "#fff", color: "#bf8526", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Merge
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            style={{ flex: 1, height: 50, borderRadius: 13, border: "none", background: "#4158f4", color: "#fff", fontSize: 15.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Save changes
          </button>
        </div>
      </div>

      {/* Merge picker sheet */}
      {mergePickerOpen && (
        <div style={{ position: "absolute", inset: 0, background: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, overflowY: "auto" }}>
          <div style={{ display: "grid", placeItems: "center", padding: "9px 0 2px" }}>
            <span style={{ width: 38, height: 5, borderRadius: 3, background: "#d8ddd6" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", padding: "6px 12px 8px 16px" }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Merge into…</span>
            <button type="button" onClick={() => setMergePickerOpen(false)} style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: "50%", background: "#f2f4f0", border: "none", display: "grid", placeItems: "center", cursor: "pointer", fontSize: 16, color: "#5c655e" }}>✕</button>
          </div>
          <div style={{ margin: "0 16px", border: "1px solid #d8ddd6", borderRadius: 14, overflow: "hidden" }}>
            {labels.filter((l) => l.id !== label.id).map((l, i, arr) => (
              <button
                key={l.id}
                type="button"
                onClick={() => { setMergeTarget(l); setMergePickerOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", height: 52, padding: "0 16px", border: "none", background: "#fff", borderBottom: i < arr.length - 1 ? "1px solid #e9ece7" : "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                <LabelDot col={l.color} size={11} />
                <span style={{ flex: 1, textAlign: "left", fontSize: 15, color: "#1d2823" }}>{l.name}</span>
                <span style={{ fontSize: 13, color: "#8b938c" }}>{l.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={mergeConfirm}
        title={`Merge "${label.name}" into "${mergeTarget?.name ?? ""}"?`}
        body={`${label.count} contacts keep "${mergeTarget?.name ?? ""}". "${label.name}" is removed everywhere. This can't be undone.`}
        confirmLabel="Merge labels"
        onConfirm={() => {
          if (!mergeTarget) return;
          startTransition(async () => {
            await mergeLabels({ sourceId: label.id, targetId: mergeTarget.id });
            onMutated();
          });
          setMergeConfirm(false);
          onClose();
        }}
        onClose={() => setMergeConfirm(false)}
      />
      <ConfirmDialog
        open={deleteConfirm}
        title={`Delete "${label.name}"?`}
        body={`Removes the label from ${label.count} contacts. The contacts aren't deleted.`}
        confirmLabel="Delete label"
        destructive
        onConfirm={() => {
          startTransition(async () => {
            await deleteLabel({ id: label.id });
            onMutated();
          });
          setDeleteConfirm(false);
          onClose();
        }}
        onClose={() => setDeleteConfirm(false)}
      />
    </div>
  );
}

// ── Mobile manage panel (P31B-09) ─────────────────────────────────────────────
function MobileManagePanel({
  labels,
  onClose,
  onMutated: _onMutated,
}: {
  labels: SidebarLabel[];
  onClose: () => void;
  onMutated: () => void;
}) {
  const router = useRouter();
  const [editingLabel, setEditingLabel] = useState<SidebarLabel | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { if (editingLabel) { setEditingLabel(null); } else { onClose(); } } };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [editingLabel, onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "#f6f7f4", display: "flex", flexDirection: "column" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", height: 52, padding: "0 6px 0 4px", background: "#fff", borderBottom: "1px solid #d8ddd6", flexShrink: 0 }}>
        <button
          type="button"
          onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 4, height: 44, padding: "0 8px", border: "none", background: "transparent", color: "#5c655e", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c655e" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </button>
        <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: "#1d2823", textAlign: "center" }}>Manage labels</span>
        <button
          type="button"
          onClick={() => {/* new label — handled inline */}}
          style={{ display: "flex", alignItems: "center", gap: 5, height: 44, padding: "0 12px", border: "none", background: "transparent", color: "#4158f4", fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          + New
        </button>
      </div>

      {/* label list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 0 24px" }}>
        <div style={{ margin: "0 16px", border: "1px solid #d8ddd6", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
          {labels.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setEditingLabel(l)}
              style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", height: 52, padding: "0 16px", border: "none", background: "#fff", borderBottom: i < labels.length - 1 ? "1px solid #e9ece7" : "none", cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}
            >
              <LabelDot col={l.color} size={11} />
              <span style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: 500, color: "#1d2823" }}>{l.name}</span>
              <span style={{ fontSize: 13, color: "#8b938c" }}>{l.count}</span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#d8ddd6" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          ))}
        </div>
        <p style={{ padding: "12px 20px 0", fontSize: 12.5, color: "#8b938c", lineHeight: 1.5 }}>
          Tap a label to rename, recolor, merge or delete it.
        </p>
      </div>

      {/* Edit sheet overlay */}
      {editingLabel && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 10 }}
          onClick={() => setEditingLabel(null)}
        >
          <MobileEditSheet
            label={editingLabel}
            labels={labels}
            onClose={() => setEditingLabel(null)}
            onMutated={() => {
              router.refresh();
              setEditingLabel(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main export: filter button + sheet ────────────────────────────────────────
interface MobileFilterSheetProps {
  labels: SidebarLabel[];
  savedFilters: SmartList[];
  personalBooks: PersonalBook[];
  activeLabel: string | null;
  activeBook: string | null;
  currentFilter: string;
}

export function MobileFilterButton({
  labels,
  savedFilters,
  personalBooks,
  activeLabel,
  activeBook,
  currentFilter,
}: MobileFilterSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const hasActiveFilter =
    activeLabel !== null || activeBook !== null || (currentFilter !== "" && currentFilter !== "all");

  const applyLabel = (name: string) => {
    router.push(`/contacts?tab=people&filter=all&label=${encodeURIComponent(name)}`);
    setOpen(false);
  };

  const applyFilter = (filter: string) => {
    router.push(`/contacts?tab=people&filter=${encodeURIComponent(filter)}`);
    setOpen(false);
  };

  const applyBook = (bookId: string) => {
    router.push(`/contacts?tab=people&filter=all&book=${encodeURIComponent(bookId)}`);
    setOpen(false);
  };

  const applyList = (filterState: unknown) => {
    if (filterState && typeof filterState === "object") {
      const params = new URLSearchParams();
      const s = filterState as Record<string, string | undefined>;
      if (s.tab) params.set("tab", s.tab);
      if (s.filter) params.set("filter", s.filter);
      if (s.q) params.set("q", s.q);
      if (s.book) params.set("book", s.book);
      if (s.label) params.set("label", s.label);
      router.push(`/contacts?${params.toString()}`);
    }
    setOpen(false);
  };

  const ListIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5c655e" strokeWidth="1.9" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
  const FolderIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5c655e" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
    </svg>
  );

  const quickFilters: { label: string; value: string }[] = [
    { label: "All", value: "all" },
    { label: "Favorites", value: "favorites" },
    { label: "Missing details", value: "incomplete" },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Filter & organize"
        onClick={() => setOpen(true)}
        style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      >
        <FilterIcon active={hasActiveFilter} />
        {hasActiveFilter && (
          <span style={{ position: "absolute", top: 9, right: 9, width: 7, height: 7, borderRadius: "50%", background: "#17352e", border: "1.5px solid #fff" }} />
        )}
      </button>

      {mounted && open ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter & organize"
          className="md:hidden"
          style={{ position: "fixed", inset: 0, zIndex: 100 }}
        >
          {/* scrim */}
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(20,30,25,.42)" }} />

          {/* sheet */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, height: "90%", display: "flex", flexDirection: "column", boxShadow: "0 -8px 30px rgba(0,0,0,.18)" }}>
            {/* handle */}
            <div style={{ display: "grid", placeItems: "center", padding: "9px 0 2px", flexShrink: 0 }}>
              <span style={{ width: 38, height: 5, borderRadius: 3, background: "#d8ddd6" }} />
            </div>
            {/* title row */}
            <div style={{ display: "flex", alignItems: "center", padding: "6px 12px 8px 16px", flexShrink: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#1d2823", flex: 1 }}>Filter &amp; organize</span>
              <button type="button" onClick={() => setOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "#f2f4f0", border: "none", display: "grid", placeItems: "center", cursor: "pointer", fontSize: 16, color: "#5c655e" }}>✕</button>
            </div>

            {/* scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>

              {/* Quick filters */}
              <SheetSection title="Quick filters" />
              <div style={{ display: "flex", gap: 8, padding: "2px 16px 4px", flexWrap: "wrap" }}>
                {quickFilters.map(({ label, value }) => {
                  const on = currentFilter === value && !activeLabel && !activeBook;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => applyFilter(value)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 999, border: "none", background: on ? "#e7efe9" : "#f2f4f0", color: on ? "#17352e" : "#5c655e", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17352e" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12l5 5L19 7" /></svg>}
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* My Lists */}
              {savedFilters.length > 0 && (
                <>
                  <SheetSection title="My Lists" />
                  {savedFilters.map((l) => (
                    <SheetRow key={l.id} icon={<ListIcon />} name={l.name} onClick={() => applyList(l.filterState)} />
                  ))}
                </>
              )}

              {/* Books */}
              {personalBooks.filter((b) => !b.isDefault).length > 0 && (
                <>
                  <SheetSection title="Books" />
                  {personalBooks.filter((b) => !b.isDefault).map((b) => (
                    <SheetRow key={b.id} icon={<FolderIcon />} name={b.name} count={b.count} active={activeBook === b.id} onClick={() => applyBook(b.id)} />
                  ))}
                </>
              )}

              {/* Labels */}
              <SheetSection
                title="Labels"
                action={
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setShowManage(true); }}
                    style={{ border: "none", background: "transparent", color: "#4158f4", fontSize: 13, fontWeight: 700, padding: 0, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Manage
                  </button>
                }
              />
              {labels.length === 0 ? (
                <p style={{ padding: "4px 16px 8px", fontSize: 13, color: "#8b938c" }}>
                  Tag a contact to start a label.
                </p>
              ) : (
                labels.map((l) => (
                  <SheetRow
                    key={l.id}
                    dot={l.color}
                    name={l.name}
                    count={l.count}
                    active={activeLabel?.toLowerCase() === l.name.toLowerCase()}
                    onClick={() => applyLabel(l.name)}
                  />
                ))
              )}

              {/* bottom safe area */}
              <div style={{ height: 32 }} />
            </div>
          </div>

          {/* Mobile manage panel (rendered on top of sheet) */}
          {showManage && (
            <MobileManagePanel
              labels={labels}
              onClose={() => setShowManage(false)}
              onMutated={() => {/* router.refresh() already called inside */}}
            />
          )}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
