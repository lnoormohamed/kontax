"use client";

// This page is a client component so rename/delete can mutate state without
// a server round-trip for the list. Presets are fetched via the API.

import { useEffect, useRef, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

type Preset = {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
};

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function RenameInput({
  preset,
  taken,
  onSave,
  onCancel,
}: {
  preset: Preset;
  taken: string[];
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(preset.name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const trimmed = value.trim().toLowerCase();
  const isDup = trimmed !== preset.name.toLowerCase() && taken.includes(trimmed);
  const canSave = value.trim().length > 0 && !isDup;

  return (
    <div className="flex flex-1 flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          className="h-9 flex-1 min-w-0 rounded-[8px] border px-3 text-[13.5px] text-[#1d2823] focus:outline-none focus:ring-2 focus:ring-[#4158f4]/20"
          maxLength={100}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) onSave(value.trim());
            if (e.key === "Escape") onCancel();
          }}
          style={{ borderColor: isDup ? "#b5472f" : "#4158f4" }}
          type="text"
          value={value}
        />
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] transition disabled:opacity-40"
          disabled={!canSave}
          onClick={() => canSave && onSave(value.trim())}
          style={{ background: canSave ? "#1f8a5b" : "#e9ece7" }}
          type="button"
        >
          <WorkspaceIcon name="check" size={15} strokeWidth={2.4} className="text-white" />
        </button>
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-[#d8ddd6] bg-white transition hover:bg-[#f2f4f0]"
          onClick={onCancel}
          type="button"
        >
          <WorkspaceIcon name="x" size={15} className="text-[#8b938c]" />
        </button>
      </div>
      {isDup && <div className="text-[12px] text-[#b5472f]">A preset with this name already exists.</div>}
    </div>
  );
}

export default function ImportPresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    fetch("/api/imports/presets")
      .then((r) => r.json())
      .then((data: { presets: Preset[] }) => {
        setPresets(data.presets ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const handleRename = async (id: string, name: string) => {
    await fetch(`/api/imports/presets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setPresets((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
    setEditId(null);
    showFlash("Preset renamed");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    await fetch(`/api/imports/presets/${deleteTarget.id}`, { method: "DELETE" });
    const name = deleteTarget.name;
    setPresets((ps) => ps.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleteBusy(false);
    showFlash(`Deleted "${name}"`);
  };

  const takenNames = presets.map((p) => p.name.toLowerCase());

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6">
      <a
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5c655e] hover:text-[#1d2823]"
        href="/settings"
      >
        <WorkspaceIcon name="back" size={14} className="text-[#8b938c]" />
        Settings
      </a>

      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b938c]">Data</div>
      <h1 className="mb-1 text-[24px] font-bold tracking-[-0.01em] text-[#1d2823]">Import presets</h1>
      <p className="mb-6 text-[14px] leading-[1.55] text-[#5c655e]">
        Saved column mappings. Kontax applies a matching preset automatically when you import a file
        with the same columns.
      </p>

      {flash ? (
        <div className="mb-4 rounded-[10px] border border-[#c5d9cc] bg-[#edf5f0] px-3.5 py-2.5 text-[13.5px] font-medium text-[#17352e]">
          {flash}
        </div>
      ) : null}

      <div className="rounded-[14px] border border-[#d8ddd6] bg-white overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-[14px] text-[#8b938c]">Loading…</div>
        ) : presets.length === 0 ? (
          <div className="grid place-items-center gap-3 px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-[12px] bg-[#f2f4f0]">
              <WorkspaceIcon name="upload" size={22} className="text-[#8b938c]" strokeWidth={1.6} />
            </span>
            <div className="text-[15px] font-semibold text-[#1d2823]">No saved presets yet</div>
            <p className="max-w-[320px] text-[13.5px] leading-[1.5] text-[#5c655e]">
              When you finish an import, you can save its column mapping as a preset to reuse next
              time.
            </p>
            <a
              className="mt-1 inline-flex h-10 items-center rounded-[9px] border border-[#d8ddd6] bg-white px-4 text-[13.5px] font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0]"
              href="/import-export"
            >
              ← Start an import
            </a>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[#e9ece7] px-5 py-3.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b938c]">
                Saved presets
              </span>
              <span className="tabular-nums text-[12.5px] text-[#8b938c]">{presets.length}</span>
            </div>
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3.5 border-b border-[#f2f4f0] px-4 py-3.5 last:border-0 transition hover:bg-[#fbfcf9]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[#d8ddd6] bg-white">
                  <WorkspaceIcon name="upload" size={18} className="text-[#5c655e]" strokeWidth={1.7} />
                </span>

                {editId === p.id ? (
                  <RenameInput
                    preset={p}
                    taken={takenNames.filter((n) => n !== p.name.toLowerCase())}
                    onSave={(name) => void handleRename(p.id, name)}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-semibold text-[#1d2823]">{p.name}</div>
                      <div className="tabular-nums text-[12.5px] text-[#8b938c]">
                        Last used {relativeDate(p.lastUsedAt)} · Used {p.usageCount}{" "}
                        {p.usageCount === 1 ? "time" : "times"}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 [.iep-row:hover_&]:opacity-100">
                      <button
                        aria-label={`Rename ${p.name}`}
                        className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#d8ddd6] bg-white text-[#8b938c] transition hover:bg-[#f2f4f0] hover:text-[#1d2823]"
                        onClick={() => setEditId(p.id)}
                        title="Rename"
                        type="button"
                      >
                        <WorkspaceIcon name="edit" size={15} strokeWidth={1.7} />
                      </button>
                      <button
                        aria-label={`Delete ${p.name}`}
                        className="grid h-8 w-8 place-items-center rounded-[8px] border border-[#d8ddd6] bg-white text-[#8b938c] transition hover:border-[#e8b6a8] hover:bg-[#fff5f5] hover:text-[#b5472f]"
                        onClick={() => setDeleteTarget(p)}
                        title="Delete"
                        type="button"
                      >
                        <WorkspaceIcon name="trash" size={15} strokeWidth={1.7} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(20,30,25,0.42)] p-4"
          onClick={() => !deleteBusy && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-[18px] bg-white p-6 shadow-[0_24px_60px_rgba(20,30,25,0.25)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-3.5 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#fff5f5]">
                <WorkspaceIcon name="trash" size={20} className="text-[#b5472f]" />
              </span>
              <h3 className="text-[17px] font-semibold text-[#1d2823]">Delete this preset?</h3>
            </div>
            <p className="mb-5 text-[14px] leading-[1.55] text-[#5c655e]">
              &ldquo;<b className="font-semibold text-[#1d2823]">{deleteTarget.name}</b>&rdquo; will be
              removed. Imports you&rsquo;ve already run are unaffected — this only deletes the saved
              mapping.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                className="h-10 rounded-[10px] px-4 text-[14px] font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0]"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-[10px] bg-[#b5472f] px-4 text-[14px] font-semibold text-white transition hover:bg-[#9a3a23] disabled:opacity-50"
                disabled={deleteBusy}
                onClick={() => void handleDelete()}
                type="button"
              >
                {deleteBusy ? "Deleting…" : "Delete preset"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
