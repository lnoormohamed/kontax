"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { EXPORT_FIELD_GROUPS, type ExportFieldSelection } from "~/server/contact-portability";

// ── types ─────────────────────────────────────────────────────────────────────

type SavedPreset = {
  id: string;
  name: string;
  fieldSelection: ExportFieldSelection[];
};

// ── helpers ───────────────────────────────────────────────────────────────────

const ALL_FIELDS: ExportFieldSelection[] = EXPORT_FIELD_GROUPS.flatMap((g) =>
  g.fields.map((f) => ({ key: f.key, included: true })),
);

function buildDefaultSelection(): ExportFieldSelection[] {
  return ALL_FIELDS.map((f) => ({ ...f }));
}

// ── small UI primitives ───────────────────────────────────────────────────────

function Radio({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-white"
      style={{ border: `1.8px solid ${on ? "#4158f4" : disabled ? "#d8ddd6" : "#aeb4ac"}` }}
    >
      {on ? <span className="h-[9px] w-[9px] rounded-full bg-[#4158f4]" /> : null}
    </span>
  );
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <span
      className="grid h-[17px] w-[17px] shrink-0 cursor-pointer place-items-center rounded"
      onClick={() => onChange(!checked)}
      style={{
        border: `1.5px solid ${checked ? "#4158f4" : "#aeb4ac"}`,
        background: checked ? "#4158f4" : "#fff",
      }}
    >
      {checked ? (
        <svg fill="none" height={10} stroke="#fff" strokeLinecap="round" strokeWidth={2.2} viewBox="0 0 12 12" width={10}>
          <path d="M2 6l3 3 5-5" />
        </svg>
      ) : null}
    </span>
  );
}

// ── field selection panel ─────────────────────────────────────────────────────

function FieldPanel({
  selection,
  onChange,
}: {
  selection: ExportFieldSelection[];
  onChange: (next: ExportFieldSelection[]) => void;
}) {
  const toggle = (key: string, included: boolean) => {
    onChange(selection.map((f) => (f.key === key ? { ...f, included } : f)));
  };

  const setHeader = (key: string, val: string) => {
    onChange(selection.map((f) => (f.key === key ? { ...f, headerOverride: val || undefined } : f)));
  };

  const selectAll = () => onChange(selection.map((f) => ({ ...f, included: true })));
  const clearAll = () => onChange(selection.map((f) => ({ ...f, included: false })));

  return (
    <div className="mt-3 rounded-[11px] border border-[#d8ddd6] bg-[#fbfcf9] overflow-hidden">
      {EXPORT_FIELD_GROUPS.map((group) => {
        const groupFields = group.fields.map((gf) =>
          selection.find((s) => s.key === gf.key) ?? { key: gf.key, included: false },
        );
        return (
          <div key={group.group} className="border-b border-[#e9ece7] last:border-0">
            <div className="px-3.5 pt-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8b938c]">
              {group.group}
            </div>
            {group.fields.map((gf) => {
              const entry = groupFields.find((x) => x.key === gf.key)!;
              const defaultHeader =
                EXPORT_FIELD_GROUPS.flatMap((g) => g.fields).find((f) => f.key === gf.key)?.label ??
                gf.key;
              return (
                <div key={gf.key} className="flex items-center gap-2.5 px-3 py-1.5">
                  <Checkbox checked={entry.included} onChange={(v) => toggle(gf.key, v)} />
                  <span
                    className="w-[130px] shrink-0 text-[13.5px]"
                    style={{ color: entry.included ? "#1d2823" : "#aeb4ac" }}
                  >
                    {gf.label}
                  </span>
                  {entry.included ? (
                    <input
                      className="h-7 min-w-0 flex-1 rounded-[6px] border border-[#d8ddd6] bg-white px-2 text-[12.5px] text-[#5c655e] focus:outline-none focus:ring-2 focus:ring-[#4158f4]/20"
                      onChange={(e) => setHeader(gf.key, e.target.value)}
                      placeholder={defaultHeader}
                      type="text"
                      value={entry.headerOverride ?? ""}
                    />
                  ) : (
                    <span className="h-7 min-w-0 flex-1" />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="flex gap-3 border-t border-[#e9ece7] px-3.5 py-2.5">
        <button
          className="text-[12.5px] font-semibold text-[#4158f4] transition hover:opacity-70"
          onClick={selectAll}
          type="button"
        >
          Select all
        </button>
        <button
          className="text-[12.5px] font-semibold text-[#5c655e] transition hover:opacity-70"
          onClick={clearAll}
          type="button"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function ExportCard({
  premiumExport,
  hasContacts,
}: {
  premiumExport: boolean;
  hasContacts: boolean;
}) {
  const [fmt, setFmt] = useState<"csv" | "vcard">("csv");
  const [archived, setArchived] = useState(false);
  const [pop, setPop] = useState(false);
  const [busy, setBusy] = useState(false);

  // Field selection state
  const [fieldMode, setFieldMode] = useState<"all" | "choose">("all");
  const [fieldSelection, setFieldSelection] = useState<ExportFieldSelection[]>(buildDefaultSelection);

  // Presets
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showPresetDrop, setShowPresetDrop] = useState(false);

  // Load presets lazily when the choose-fields panel opens
  useEffect(() => {
    if (fieldMode === "choose" && !presetsLoaded) {
      fetch("/api/exports/presets")
        .then((r) => r.json())
        .then((d: { presets: SavedPreset[] }) => {
          setPresets(d.presets ?? []);
          setPresetsLoaded(true);
        })
        .catch(() => setPresetsLoaded(true));
    }
  }, [fieldMode, presetsLoaded]);

  const pickVcard = () => {
    if (!premiumExport) { setPop(true); return; }
    setFmt("vcard");
    setFieldMode("all"); // vCard always all fields
  };

  const doExport = () => {
    if (!hasContacts || busy) return;
    setBusy(true);

    if (fmt === "vcard" || fieldMode === "all") {
      const params = new URLSearchParams();
      if (archived && fmt === "csv") params.set("includeArchived", "true");
      const qs = params.toString();
      window.location.href = `/api/exports/contacts/${fmt}${qs ? `?${qs}` : ""}`;
      setTimeout(() => setBusy(false), 2000);
    } else {
      // Field-selection export via POST → blob download
      const sel = fieldSelection.some((f) => f.included) ? fieldSelection : buildDefaultSelection();
      fetch("/api/exports/contacts/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldSelection: sel, includeArchived: archived }),
      })
        .then((r) => r.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `kontax-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        })
        .finally(() => setBusy(false));
    }
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    setSavingPreset(true);
    const r = await fetch("/api/exports/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, fieldSelection }),
    });
    if (r.ok) {
      const data = (await r.json()) as { preset: SavedPreset };
      const created = { ...data.preset, fieldSelection };
      setPresets((ps) => [created, ...ps]);
      setPresetName("");
      setShowSaveInput(false);
    }
    setSavingPreset(false);
  };

  const loadPreset = (p: SavedPreset) => {
    setFieldSelection(
      buildDefaultSelection().map((def) => {
        const saved = p.fieldSelection.find((s) => s.key === def.key);
        return saved ? { ...def, ...saved } : { ...def, included: false };
      }),
    );
    setShowPresetDrop(false);
  };

  const selectedCount = fieldSelection.filter((f) => f.included).length;

  return (
    <section className="rounded-2xl border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.03)]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <WorkspaceIcon name="download" size={15} />
        <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">Export</span>
      </div>

      {/* Format selection */}
      <div className="grid gap-2">
        <button
          className="flex gap-2.5 rounded-[11px] p-3.5 text-left transition"
          onClick={() => setFmt("csv")}
          style={{ border: `1px solid ${fmt === "csv" ? "#4158f4" : "#d8ddd6"}`, background: fmt === "csv" ? "#edf0fe" : "#fff" }}
          type="button"
        >
          <Radio on={fmt === "csv"} />
          <span>
            <span className="text-[14px] font-semibold text-[#1d2823]">
              CSV <span className="font-medium text-[#8b938c]">· all plans</span>
            </span>
            <span className="mt-0.5 block text-[13px] leading-[1.45] text-[#5c655e]">
              Compatible with Google Contacts, Outlook, and most apps.
            </span>
          </span>
        </button>

        <div className="relative">
          <button
            className="flex w-full gap-2.5 rounded-[11px] p-3.5 text-left transition"
            onClick={pickVcard}
            style={{
              border: `1px solid ${fmt === "vcard" ? "#4158f4" : "#d8ddd6"}`,
              background: fmt === "vcard" ? "#edf0fe" : "#fff",
              opacity: premiumExport ? 1 : 0.55,
              cursor: premiumExport ? "pointer" : "not-allowed",
            }}
            type="button"
          >
            <Radio disabled={!premiumExport} on={fmt === "vcard"} />
            <span className="flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[#1d2823]">vCard 4.0</span>
                <span className="rounded bg-[#f2f4f0] px-1.5 py-px text-[10px] font-bold tracking-[0.04em] text-[#5c655e]">PRO</span>
              </span>
              <span className="mt-0.5 block text-[13px] leading-[1.45] text-[#5c655e]">
                Standard format for Apple Contacts, iOS, and Android.
              </span>
            </span>
          </button>
          {pop && !premiumExport ? (
            <>
              <span className="fixed inset-0 z-30" onClick={() => setPop(false)} />
              <div className="absolute inset-x-3 top-[calc(100%+6px)] z-40 rounded-xl border border-[#d8ddd6] bg-white p-3.5 shadow-[0_14px_34px_rgba(20,30,25,0.18)]">
                <div className="text-[13px] leading-[1.5] text-[#1d2823]">
                  vCard export is a <b className="font-semibold">Pro</b> feature.
                </div>
                <Link className="mt-2.5 inline-flex h-8 items-center rounded-lg bg-[#4158f4] px-3 text-[13px] font-semibold text-white" href="/pricing">
                  Upgrade →
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Include archived */}
      <label className="mt-4 flex cursor-pointer items-center gap-2.5">
        <span
          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded"
          style={{ border: `1.6px solid ${archived ? "#4158f4" : "#aeb4ac"}`, background: archived ? "#4158f4" : "#fff" }}
        >
          {archived ? <WorkspaceIcon name="check" size={12} strokeWidth={2.4} /> : null}
        </span>
        <input checked={archived} className="hidden" onChange={(e) => setArchived(e.target.checked)} type="checkbox" />
        <span className="text-[14px] text-[#1d2823]">Include archived contacts</span>
      </label>

      {/* Fields section (CSV only) */}
      {fmt === "csv" ? (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b938c]">Fields</div>
          <div className="flex gap-4">
            {(["all", "choose"] as const).map((mode) => (
              <button
                key={mode}
                className="flex items-center gap-2 text-[14px]"
                onClick={() => setFieldMode(mode)}
                type="button"
              >
                <Radio on={fieldMode === mode} />
                <span style={{ color: fieldMode === mode ? "#1d2823" : "#5c655e" }}>
                  {mode === "all" ? "All fields" : "Choose fields"}
                </span>
              </button>
            ))}
          </div>

          {fieldMode === "choose" ? (
            <div>
              <FieldPanel selection={fieldSelection} onChange={setFieldSelection} />

              {/* Preset bar */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {showSaveInput ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      className="h-8 min-w-0 flex-1 rounded-[7px] border border-[#4158f4] px-2.5 text-[13px] text-[#1d2823] focus:outline-none focus:ring-2 focus:ring-[#4158f4]/20"
                      maxLength={100}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void savePreset();
                        if (e.key === "Escape") { setShowSaveInput(false); setPresetName(""); }
                      }}
                      placeholder="Preset name…"
                      type="text"
                      value={presetName}
                    />
                    <button
                      className="h-8 rounded-[7px] bg-[#1f8a5b] px-3 text-[12.5px] font-semibold text-white transition disabled:opacity-50"
                      disabled={!presetName.trim() || savingPreset}
                      onClick={() => void savePreset()}
                      type="button"
                    >
                      Save
                    </button>
                    <button
                      className="h-8 rounded-[7px] border border-[#d8ddd6] px-2.5 text-[12.5px] text-[#5c655e] transition hover:bg-[#f2f4f0]"
                      onClick={() => { setShowSaveInput(false); setPresetName(""); }}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex h-8 items-center gap-1.5 rounded-[7px] border border-[#d8ddd6] bg-white px-3 text-[12.5px] font-medium text-[#5c655e] transition hover:bg-[#f2f4f0]"
                    disabled={selectedCount === 0}
                    onClick={() => setShowSaveInput(true)}
                    type="button"
                  >
                    <WorkspaceIcon name="upload" size={13} className="rotate-180" strokeWidth={1.7} />
                    Save as preset…
                  </button>
                )}

                {presets.length > 0 ? (
                  <div className="relative">
                    <button
                      className="flex h-8 items-center gap-1.5 rounded-[7px] border border-[#d8ddd6] bg-white px-3 text-[12.5px] font-medium text-[#5c655e] transition hover:bg-[#f2f4f0]"
                      onClick={() => setShowPresetDrop((v) => !v)}
                      type="button"
                    >
                      Load preset ▾
                    </button>
                    {showPresetDrop ? (
                      <>
                        <span className="fixed inset-0 z-30" onClick={() => setShowPresetDrop(false)} />
                        <div className="absolute left-0 top-[calc(100%+4px)] z-40 min-w-[180px] rounded-[10px] border border-[#d8ddd6] bg-white py-1 shadow-[0_8px_24px_rgba(20,30,25,0.14)]">
                          {presets.map((p) => (
                            <button
                              className="w-full px-3.5 py-2 text-left text-[13.5px] text-[#1d2823] transition hover:bg-[#f2f4f0]"
                              key={p.id}
                              onClick={() => loadPreset(p)}
                              type="button"
                            >
                              {p.name}
                            </button>
                          ))}
                          <div className="border-t border-[#f2f4f0] px-3.5 py-1.5">
                            <Link className="text-[12px] text-[#8b938c] underline underline-offset-2 hover:text-[#5c655e]" href="/settings/export-presets">
                              Manage presets →
                            </Link>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

                <span className="ml-auto tabular-nums text-[12.5px] text-[#8b938c]">
                  {selectedCount} field{selectedCount !== 1 ? "s" : ""} selected
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        className="mt-[18px] flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] bg-[#4158f4] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!hasContacts || busy || (fieldMode === "choose" && selectedCount === 0)}
        onClick={doExport}
        type="button"
      >
        {busy ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/45 border-t-white" />
            Preparing export…
          </>
        ) : !hasContacts ? (
          "Nothing to export"
        ) : (
          <>
            <WorkspaceIcon name="download" size={17} strokeWidth={2} /> Export and download
          </>
        )}
      </button>
      {!hasContacts ? (
        <div className="mt-2 text-[13px] text-[#8b938c]">You have no contacts. Import or create some first.</div>
      ) : fieldMode === "choose" && selectedCount === 0 ? (
        <div className="mt-2 text-[13px] text-[#b5472f]">Select at least one field to export.</div>
      ) : null}

      <p className="mt-4 border-t border-[#e9ece7] pt-3.5 text-[12.5px] leading-[1.5] text-[#8b938c]">
        To export a specific selection, choose contacts in your{" "}
        <Link className="text-[#5c655e] underline underline-offset-2" href="/contacts">contacts list</Link> and use the bulk-export
        action.
      </p>
    </section>
  );
}
