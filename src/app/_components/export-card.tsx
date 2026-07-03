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

// ── P45-DB01 types (Surface 2 & 4) ────────────────────────────────────────────

type ArchiveEstimate = {
  contactCount: number;
  photoCount: number;
  estimatedBytes: number;
  estimatedBytesWithoutPhotos: number;
};

type KontaxJob = {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progressCount: number;
  totalCount: number | null;
  photoCount: number;
  exportedCount: number;
  downloadUrl: string | null;
  fileSizeBytes: number | null;
  expiresAt: string | null;
  createdAt: string;
};

function formatEstimateMb(bytes: number): string {
  if (bytes < 1024 * 1024) return "<1 MB";
  return `~${Math.round(bytes / (1024 * 1024))} MB`;
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

// ── P45-DB01 Surface 2: toggles, honesty note, comparison table ──────────────

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      aria-checked={on}
      className="relative mt-px h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
      onClick={() => onChange(!on)}
      role="switch"
      style={{ background: on ? "#4158f4" : "#d8ddd6" }}
      type="button"
    >
      <span
        className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(20,30,25,0.2)] transition-all"
        style={{ left: on ? 18 : 3 }}
      />
    </button>
  );
}

function HonestyNote({ fmt, onSeeKept }: { fmt: "csv" | "vcard"; onSeeKept: () => void }) {
  return (
    <div className="flex gap-2.5 rounded-[10px] border border-[#e8d8b0] bg-[#f6edd9] p-3 text-[12.5px] leading-[1.5] text-[#8a6a2a]">
      <svg className="mt-px shrink-0" fill="none" height={15} stroke="#7a5a1a" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24" width={15}>
        <path d="M12 3L2.5 20h19L12 3z" />
        <path d="M12 10v4" />
        <path d="M12 17.2h.01" />
      </svg>
      <span>
        <b className="font-bold text-[#7a5a1a]">Some data won&apos;t be included.</b>{" "}
        {fmt === "vcard"
          ? "Custom fields and labels aren't part of vCard."
          : "Photos, custom fields, and labels aren't part of CSV."}{" "}
        <button
          className="underline underline-offset-2 transition hover:opacity-75"
          onClick={onSeeKept}
          type="button"
        >
          See what&apos;s kept
        </button>{" "}
        before you export.
      </span>
    </div>
  );
}

function Mark({ kind, note }: { kind: "yes" | "partial" | "no"; note?: string }) {
  const style =
    kind === "yes"
      ? { background: "#e3efe7", color: "#1f8a5b" }
      : kind === "partial"
        ? { background: "#f6edd9", color: "#7a5a1a" }
        : { background: "#f2f4f0", color: "#aeb4ac" };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] text-[13px] font-bold"
        style={style}
      >
        {kind === "yes" ? "✓" : kind === "partial" ? "–" : "✕"}
      </span>
      {note ? <span className="text-[11.5px] text-[#7a5a1a]">{note}</span> : null}
    </span>
  );
}

type CompareCell = { kind: "yes" | "partial" | "no"; note?: string };
type CompareRow = { label: string; sub?: string; cells: [CompareCell, CompareCell, CompareCell] };

const COMPARE_ROWS: CompareRow[] = [
  { label: "Names, phones, emails", sub: "structured, all labels", cells: [{ kind: "yes" }, { kind: "yes" }, { kind: "yes" }] },
  { label: "Addresses, org, title, notes", cells: [{ kind: "yes" }, { kind: "yes" }, { kind: "partial", note: "flattened" }] },
  { label: "Photos", sub: "full resolution", cells: [{ kind: "yes" }, { kind: "partial", note: "embedded" }, { kind: "no" }] },
  { label: "Custom fields", cells: [{ kind: "yes" }, { kind: "no" }, { kind: "no" }] },
  { label: "Labels & groups", cells: [{ kind: "yes" }, { kind: "partial", note: "as categories" }, { kind: "no" }] },
  { label: "Relationships & links", cells: [{ kind: "yes" }, { kind: "no" }, { kind: "no" }] },
];

function FormatComparison() {
  const th = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[#8b938c]";
  return (
    <div className="mt-2.5 overflow-x-auto rounded-[11px] border border-[#d8ddd6]">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#e9ece7]">
            <th className={th}>Your data</th>
            <th className={`${th} bg-[#e7efe9] normal-case tracking-normal`} style={{ color: "#17352e", fontSize: 12 }}>
              Kontax Archive (.zip)
            </th>
            <th className={`${th} normal-case tracking-normal`} style={{ fontSize: 12 }}>vCard (.vcf)</th>
            <th className={`${th} normal-case tracking-normal`} style={{ fontSize: 12 }}>CSV (.csv)</th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((row) => (
            <tr className="border-b border-[#e9ece7] last:border-0" key={row.label}>
              <td className="px-3 py-2 text-[#1d2823]">
                {row.label}
                {row.sub ? <span className="block text-[11.5px] text-[#8b938c]">{row.sub}</span> : null}
              </td>
              <td className="bg-[#f4faf6] px-3 py-2"><Mark {...row.cells[0]} /></td>
              <td className="px-3 py-2"><Mark {...row.cells[1]} /></td>
              <td className="px-3 py-2"><Mark {...row.cells[2]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [fmt, setFmt] = useState<"kontax" | "csv" | "vcard">("kontax");
  const [archived, setArchived] = useState(false);
  const [pop, setPop] = useState(false);
  const [busy, setBusy] = useState(false);

  // P45-DB01 Surface 2: Kontax Archive options + format comparison
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeVcf, setIncludeVcf] = useState(false);
  const [estimate, setEstimate] = useState<ArchiveEstimate | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  // P45-DB01 Surface 4: async archive job
  const [job, setJob] = useState<KontaxJob | null>(null);

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

  // Size estimate for the archive toggles — refreshed when the scope changes.
  useEffect(() => {
    void fetch("/api/exports/kontax/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeArchived: archived }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<ArchiveEstimate>) : null))
      .then((d) => { if (d) setEstimate(d); })
      .catch(() => undefined);
  }, [archived]);

  // Resume an in-flight or recent archive job on page load.
  useEffect(() => {
    void fetch("/api/exports/kontax")
      .then((r) => (r.ok ? (r.json() as Promise<{ job: KontaxJob | null }>) : null))
      .then((d) => {
        const j = d?.job;
        if (!j) return;
        if (j.status === "PENDING" || j.status === "PROCESSING") setJob(j);
        else if (
          j.status === "COMPLETED" &&
          j.downloadUrl &&
          (!j.expiresAt || new Date(j.expiresAt) > new Date())
        ) {
          setJob(j);
        }
      })
      .catch(() => undefined);
  }, []);

  // Poll while the job is packing.
  const jobActive = job !== null && (job.status === "PENDING" || job.status === "PROCESSING");
  const jobId = job?.id;
  useEffect(() => {
    if (!jobActive || !jobId) return;
    const timer = setInterval(() => {
      void fetch(`/api/exports/kontax/${jobId}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ job: KontaxJob }>) : null))
        .then((d) => { if (d?.job) setJob(d.job); })
        .catch(() => undefined);
    }, 1500);
    return () => clearInterval(timer);
  }, [jobActive, jobId]);

  const startKontaxExport = () => {
    if (busy) return;
    setBusy(true);
    void fetch("/api/exports/kontax", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        includePhotos,
        includeVcardFallback: includeVcf,
        includeArchived: archived,
      }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ jobId: string }>) : Promise.reject(new Error("Export failed"))))
      .then((d) => {
        setJob({
          id: d.jobId,
          status: "PENDING",
          progressCount: 0,
          totalCount: estimate?.contactCount ?? null,
          photoCount: estimate?.photoCount ?? 0,
          exportedCount: 0,
          downloadUrl: null,
          fileSizeBytes: null,
          expiresAt: null,
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const cancelKontaxJob = () => {
    const id = job?.id;
    setJob(null);
    if (id) void fetch(`/api/exports/kontax/${id}`, { method: "DELETE" }).catch(() => undefined);
  };

  const pickVcard = () => {
    if (!premiumExport) { setPop(true); return; }
    setFmt("vcard");
    setFieldMode("all"); // vCard always all fields
  };

  const doExport = () => {
    if (!hasContacts || busy) return;

    if (fmt === "kontax") {
      startKontaxExport();
      return;
    }
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
      void fetch("/api/exports/contacts/csv", {
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
        {/* Kontax Archive — recommended default (P45-DB01 Surface 2) */}
        <button
          className="flex gap-2.5 rounded-[11px] p-3.5 text-left transition"
          onClick={() => setFmt("kontax")}
          style={{ border: `1px solid ${fmt === "kontax" ? "#4158f4" : "#d8ddd6"}`, background: fmt === "kontax" ? "#edf0fe" : "#fff" }}
          type="button"
        >
          <Radio on={fmt === "kontax"} />
          <span className="flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold text-[#1d2823]">Kontax Archive</span>
              <span className="inline-flex h-5 items-center gap-1 rounded-md bg-[#17352e] px-2 text-[10.5px] font-bold tracking-[0.04em] text-[#dff0e7]">
                <svg fill="none" height={9} stroke="#dff0e7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} viewBox="0 0 12 12" width={9}>
                  <path d="M2 6l3 3 5-5" />
                </svg>
                RECOMMENDED
              </span>
              <span className="rounded bg-[#e7efe9] px-1.5 font-mono text-[12px] text-[#17352e]">.zip</span>
            </span>
            <span className="mt-0.5 block text-[13px] leading-[1.45] text-[#5c655e]">
              Everything — photos, custom fields, labels. Best for backup and moving to Kontax.
            </span>
          </span>
        </button>

        {fmt === "kontax" ? (
          <div className="ml-8 grid gap-3 border-l-2 border-[#edf0fe] pl-4">
            <div className="flex items-start gap-3">
              <Switch on={includePhotos} onChange={setIncludePhotos} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-[#1d2823]">Include photos</span>
                <span className="block text-[12.5px] text-[#8b938c]">Full-resolution, in a media/ folder</span>
              </span>
              <span className="whitespace-nowrap font-mono text-[12px] tabular-nums text-[#5c655e]">
                {estimate
                  ? includePhotos
                    ? formatEstimateMb(estimate.estimatedBytes)
                    : `${formatEstimateMb(estimate.estimatedBytesWithoutPhotos)} · text only`
                  : "…"}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Switch on={includeVcf} onChange={setIncludeVcf} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-[#1d2823]">Add a compatibility copy (.vcf)</span>
                <span className="block text-[12.5px] text-[#8b938c]">A vCard fallback inside the zip for apps that can&apos;t read the archive</span>
              </span>
            </div>
          </div>
        ) : null}

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
                Works with Apple, Google, Outlook. No custom fields or labels.
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

        {fmt === "vcard" ? <HonestyNote fmt="vcard" onSeeKept={() => setShowCompare(true)} /> : null}

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
              Spreadsheets. Text fields only.
            </span>
          </span>
        </button>

        {fmt === "csv" ? <HonestyNote fmt="csv" onSeeKept={() => setShowCompare(true)} /> : null}
      </div>

      {/* What each format keeps (P45-DB01 Surface 2) */}
      <div className="mt-3">
        <button
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#4158f4] transition hover:opacity-75"
          onClick={() => setShowCompare((v) => !v)}
          type="button"
        >
          <svg fill="none" height={13} stroke="#4158f4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24" width={13}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </svg>
          What does each format keep?
        </button>
        {showCompare ? <FormatComparison /> : null}
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

      {fmt === "kontax" && job && job.status !== "COMPLETED" ? null : (
        <button
          className="mt-[18px] flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] bg-[#4158f4] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasContacts || busy || (fmt === "csv" && fieldMode === "choose" && selectedCount === 0)}
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
      )}
      {!hasContacts ? (
        <div className="mt-2 text-[13px] text-[#8b938c]">You have no contacts. Import or create some first.</div>
      ) : fmt === "csv" && fieldMode === "choose" && selectedCount === 0 ? (
        <div className="mt-2 text-[13px] text-[#b5472f]">Select at least one field to export.</div>
      ) : null}

      {/* P45-DB01 Surface 4: inline archive job panel */}
      {fmt === "kontax" && job ? (
        job.status === "PENDING" || job.status === "PROCESSING" ? (
          <div className="mt-[18px] rounded-[11px] border border-[#d8ddd6] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#edf0fe]">
                <svg fill="none" height={18} stroke="#4158f4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} viewBox="0 0 24 24" width={18}>
                  <path d="M20.5 12a8.5 8.5 0 10-2.6 6.1" />
                  <path d="M20.5 13.5V18h-4.5" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#1d2823]">Preparing your archive…</span>
                <span className="block text-[12.5px] text-[#8b938c]">You can leave this page — we&apos;ll notify you.</span>
              </span>
              <button
                className="h-8 shrink-0 rounded-[7px] border border-[#d8ddd6] px-3 text-[12.5px] font-medium text-[#5c655e] transition hover:bg-[#f2f4f0]"
                onClick={cancelKontaxJob}
                type="button"
              >
                Cancel
              </button>
            </div>
            <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-[#e9ece7]">
              <div
                className="h-full rounded-full bg-[#4158f4] transition-all"
                style={{
                  width: job.totalCount && job.totalCount > 0
                    ? `${Math.min(100, Math.round((job.progressCount / job.totalCount) * 100))}%`
                    : "0%",
                }}
              />
            </div>
            <div className="mt-2 text-[12px] tabular-nums text-[#8b938c]">
              Packing contacts · {job.progressCount.toLocaleString()} of {(job.totalCount ?? 0).toLocaleString()}
            </div>
          </div>
        ) : job.status === "COMPLETED" && job.downloadUrl ? (
          <div className="mt-[18px] rounded-[11px] border border-[#d8ddd6] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#e3efe7]">
                <svg fill="none" height={18} stroke="#1f8a5b" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} viewBox="0 0 24 24" width={18}>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#1d2823]">Your archive is ready</span>
                <span className="block text-[12.5px] text-[#8b938c]">
                  {job.exportedCount.toLocaleString()} contacts · {job.photoCount.toLocaleString()} photos · expires in 7 days
                </span>
              </span>
              <span className="shrink-0 text-right font-mono text-[12px] tabular-nums text-[#5c655e]">
                {Math.max(1, Math.round((job.fileSizeBytes ?? 0) / (1024 * 1024)))} MB
                <span className="block text-[#8b938c]">.zip</span>
              </span>
            </div>
            <a
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[9px] bg-[#4158f4] text-[13.5px] font-semibold text-white transition hover:bg-[#3347d8]"
              href={job.downloadUrl}
            >
              <WorkspaceIcon name="download" size={15} strokeWidth={2} /> Download
            </a>
          </div>
        ) : job.status === "FAILED" ? (
          <div className="mt-[18px] rounded-[11px] border border-[#d8ddd6] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#f3e1da]">
                <svg fill="none" height={18} stroke="#b5472f" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} viewBox="0 0 24 24" width={18}>
                  <path d="M12 3L2.5 20h19L12 3z" />
                  <path d="M12 10v4" />
                  <path d="M12 17.2h.01" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#1d2823]">Export didn&apos;t finish</span>
                <span className="block text-[12.5px] text-[#8b938c]">Something interrupted the job — your contacts are untouched.</span>
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                className="flex h-9 items-center rounded-[9px] bg-[#4158f4] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#3347d8] disabled:opacity-50"
                disabled={busy}
                onClick={startKontaxExport}
                type="button"
              >
                Try again
              </button>
              <Link className="text-[12.5px] text-[#8b938c] underline underline-offset-2 transition hover:text-[#5c655e]" href="/help">
                Contact support
              </Link>
            </div>
          </div>
        ) : null
      ) : null}

      <p className="mt-4 border-t border-[#e9ece7] pt-3.5 text-[12.5px] leading-[1.5] text-[#8b938c]">
        To export a specific selection, choose contacts in your{" "}
        <Link className="text-[#5c655e] underline underline-offset-2" href="/contacts">contacts list</Link> and use the bulk-export
        action.
      </p>
    </section>
  );
}
