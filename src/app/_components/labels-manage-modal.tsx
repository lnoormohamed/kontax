"use client";

// P31B-07: label management modal — two-pane (left rail + edit pane).
// Operations: rename, recolor, merge, delete. Amber confirm for merge, red for delete.

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  deleteLabel,
  mergeLabels,
  recolorLabel,
  renameLabel,
} from "~/app/actions/labels";
import { LabelChip, LabelDot, RecolorSwatches } from "~/app/_components/label-chip";
import type { SidebarLabel } from "~/app/_components/labels-sidebar";

// ── merge confirm ─────────────────────────────────────────────────────────────
function MergeConfirm({
  source,
  target,
  onConfirm,
  onCancel,
}: {
  source: SidebarLabel;
  target: SidebarLabel;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(29,40,35,0.5)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 380, background: "#fff", borderRadius: 16, boxShadow: "0 24px 60px rgba(20,30,25,0.28)", padding: 22 }}>
        <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: "#f6edd9", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#bf8526" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4v5a4 4 0 004 4h8M14 9l4 4-4 4M6 20v-3" />
            </svg>
          </span>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: "#1d2823", letterSpacing: "-0.01em" }}>
              Merge &ldquo;{source.name}&rdquo; into &ldquo;{target.name}&rdquo;?
            </div>
            <div style={{ fontSize: 13, color: "#5c655e", marginTop: 6, lineHeight: 1.5 }}>
              <strong style={{ color: "#1d2823" }}>{source.count} contacts</strong> keep &ldquo;{target.name}&rdquo;. &ldquo;{source.name}&rdquo; is removed everywhere. This can&apos;t be undone.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCancel}
            style={{ height: 36, padding: "0 16px", borderRadius: 9, border: "1px solid #d8ddd6", background: "#fff", color: "#5c655e", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            style={{ height: 36, padding: "0 16px", borderRadius: 9, border: "none", background: "#bf8526", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            Merge labels
          </button>
        </div>
      </div>
    </div>
  );
}

// ── delete confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({
  label,
  onConfirm,
  onCancel,
}: {
  label: SidebarLabel;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(29,40,35,0.5)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 380, background: "#fff", borderRadius: 16, boxShadow: "0 24px 60px rgba(20,30,25,0.28)", padding: 22 }}>
        <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: "#faeae7", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b5472f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </span>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: "#1d2823", letterSpacing: "-0.01em" }}>
              Delete &ldquo;{label.name}&rdquo;?
            </div>
            <div style={{ fontSize: 13, color: "#5c655e", marginTop: 6, lineHeight: 1.5 }}>
              Removes the label from <strong style={{ color: "#1d2823" }}>{label.count} contacts</strong>. The contacts aren&apos;t deleted.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCancel}
            style={{ height: 36, padding: "0 16px", borderRadius: 9, border: "1px solid #d8ddd6", background: "#fff", color: "#5c655e", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            style={{ height: 36, padding: "0 16px", borderRadius: 9, border: "none", background: "#b5472f", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            Delete label
          </button>
        </div>
      </div>
    </div>
  );
}

// ── edit pane ─────────────────────────────────────────────────────────────────
function EditPane({
  label,
  labels,
  onClose,
  onMutated,
}: {
  label: SidebarLabel;
  labels: SidebarLabel[];
  onClose: () => void;
  onMutated: (navigateAway?: boolean) => void;
}) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [mergeTarget, setMergeTarget] = useState<SidebarLabel | null>(null);
  const [mergePickerOpen, setMergePickerOpen] = useState(false);
  const [mergeConfirm, setMergeConfirm] = useState<SidebarLabel | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [, startTransition] = useTransition();
  const mergePickerRef = useRef<HTMLDivElement>(null);

  // Reset fields when label changes.
  useEffect(() => {
    setName(label.name);
    setColor(label.color);
    setMergeTarget(null);
  }, [label.id, label.name, label.color]);

  useEffect(() => {
    if (!mergePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (mergePickerRef.current && !mergePickerRef.current.contains(e.target as Node)) {
        setMergePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mergePickerOpen]);

  const handleSave = () => {
    const trimmedName = name.trim();
    const nameChanged = trimmedName && trimmedName !== label.name;
    const colorChanged = color !== label.color;
    if (!nameChanged && !colorChanged) { onClose(); return; }

    startTransition(async () => {
      if (nameChanged) await renameLabel({ id: label.id, name: trimmedName });
      if (colorChanged) await recolorLabel({ id: label.id, color });
      onMutated();
    });
  };

  const handleMerge = () => {
    if (!mergeTarget) return;
    setMergeConfirm(mergeTarget);
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteLabel({ id: label.id });
      onMutated(true);
    });
    setDeleteConfirm(false);
  };

  return (
    <div style={{ flex: 1, minWidth: 0, padding: "18px 22px 22px", display: "flex", flexDirection: "column" }}>
      {/* chip header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <LabelChip name={label.name} col={label.color} sz="md" />
        <span style={{ fontSize: 12.5, color: "#8b938c" }} className="tabular-nums">{label.count} contacts tagged</span>
      </div>

      {/* name */}
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8b938c", marginBottom: 6, display: "block" }}>Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ height: 40, width: "100%", borderRadius: 10, border: "1.5px solid #d8ddd6", padding: "0 12px", fontSize: 14, color: "#1d2823", outline: "none", fontFamily: "inherit" }}
        onFocus={(e) => e.currentTarget.style.borderColor = "#4158f4"}
        onBlur={(e) => e.currentTarget.style.borderColor = "#d8ddd6"}
      />

      {/* color */}
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8b938c", marginTop: 18, marginBottom: 8, display: "block" }}>Color</label>
      <RecolorSwatches value={color} onPick={setColor} size={28} />

      {/* merge */}
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8b938c", marginTop: 18, marginBottom: 6, display: "block" }}>Merge into…</label>
      <div style={{ position: "relative" }} ref={mergePickerRef}>
        <button
          type="button"
          onClick={() => setMergePickerOpen((o) => !o)}
          style={{ width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #d8ddd6", padding: "0 12px", display: "flex", alignItems: "center", gap: 8, background: "#fff", cursor: "pointer", fontFamily: "inherit" }}
        >
          {mergeTarget ? (
            <>
              <LabelDot col={mergeTarget.color} size={9} />
              <span style={{ flex: 1, textAlign: "left", fontSize: 14, color: "#1d2823" }}>{mergeTarget.name}</span>
            </>
          ) : (
            <span style={{ flex: 1, textAlign: "left", fontSize: 14, color: "#8b938c" }}>Choose a label…</span>
          )}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b938c" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {mergePickerOpen && (
          <div style={{ position: "absolute", top: 46, left: 0, right: 0, zIndex: 6, background: "#fff", borderRadius: 12, border: "1px solid #d8ddd6", boxShadow: "0 12px 34px rgba(20,30,25,0.16)", overflow: "hidden" }}>
            {labels.filter((l) => l.id !== label.id).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => { setMergeTarget(l); setMergePickerOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", border: "none", background: mergeTarget?.id === l.id ? "#f2f4f0" : "#fff", cursor: "pointer", fontFamily: "inherit" }}
              >
                <LabelDot col={l.color} size={9} />
                <span style={{ flex: 1, textAlign: "left", fontSize: 13.5, color: "#1d2823" }}>{l.name}</span>
                <span style={{ fontSize: 12.5, color: "#8b938c" }}>{l.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* action row */}
      <div style={{ display: "flex", alignItems: "center", marginTop: "auto", paddingTop: 20, borderTop: "1px solid #edf0ea" }}>
        <button
          type="button"
          onClick={() => setDeleteConfirm(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid #b5472f", background: "#fff", color: "#b5472f", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          Delete label
        </button>
        {mergeTarget && (
          <button
            type="button"
            onClick={handleMerge}
            style={{ marginLeft: 8, display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid #bf8526", background: "#fff", color: "#bf8526", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            Merge
          </button>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose}
            style={{ height: 34, padding: "0 14px", borderRadius: 9, border: "1px solid #d8ddd6", background: "#fff", color: "#5c655e", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            style={{ height: 34, padding: "0 14px", borderRadius: 9, border: "none", background: "#4158f4", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Save changes
          </button>
        </div>
      </div>

      {mergeConfirm && (
        <MergeConfirm
          source={label}
          target={mergeConfirm}
          onCancel={() => setMergeConfirm(null)}
          onConfirm={() => {
            startTransition(async () => {
              await mergeLabels({ sourceId: label.id, targetId: mergeConfirm.id });
              onMutated(true);
            });
            setMergeConfirm(null);
          }}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirm
          label={label}
          onCancel={() => setDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// ── main modal ────────────────────────────────────────────────────────────────
export function LabelsManageModal({
  labels,
  onClose,
}: {
  labels: SidebarLabel[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SidebarLabel | null>(labels[0] ?? null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(29,40,35,0.5)" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage labels"
        style={{ position: "relative", width: "100%", maxWidth: 720, background: "#fff", borderRadius: 16, boxShadow: "0 24px 60px rgba(20,30,25,0.28)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", padding: "18px 22px 14px", borderBottom: "1px solid #edf0ea" }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#1d2823" }}>Manage labels</span>
          <button type="button" onClick={onClose} style={{ marginLeft: "auto", display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 999, border: "none", background: "#f2f4f0", cursor: "pointer", fontSize: 16, color: "#5c655e" }}>✕</button>
        </div>

        {/* body: left rail + edit pane */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* left rail */}
          <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid #edf0ea", padding: "8px 8px", overflowY: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8b938c", padding: "4px 8px 6px" }}>All labels</div>
            {labels.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelected(l)}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", height: 32, padding: "0 8px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit",
                  background: selected?.id === l.id ? "#e3efe7" : "transparent",
                  borderLeft: `3px solid ${selected?.id === l.id ? "#17352e" : "transparent"}` }}
              >
                <LabelDot col={l.color} size={9} />
                <span style={{ flex: 1, textAlign: "left", fontSize: 12.5, fontWeight: 500, color: selected?.id === l.id ? "#17352e" : "#5c655e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                <span style={{ fontSize: 12, color: "#8b938c" }}>{l.count}</span>
              </button>
            ))}
          </div>

          {/* edit pane */}
          {selected ? (
            <EditPane
              key={selected.id}
              label={selected}
              labels={labels}
              onClose={onClose}
              onMutated={(navigateAway) => {
                router.refresh();
                if (navigateAway) onClose();
              }}
            />
          ) : (
            <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#8b938c", fontSize: 14 }}>
              Select a label to manage it.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
