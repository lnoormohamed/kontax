"use client";

import Link from "next/link";
import { useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

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

export function ExportCard({
  premiumExport,
  hasContacts,
}: {
  /** true on Pro+: vCard export is selectable. */
  premiumExport: boolean;
  hasContacts: boolean;
}) {
  const [fmt, setFmt] = useState<"csv" | "vcard">("csv");
  const [archived, setArchived] = useState(false);
  const [pop, setPop] = useState(false);
  const [busy, setBusy] = useState(false);

  const pickVcard = () => {
    if (!premiumExport) {
      setPop(true);
      return;
    }
    setFmt("vcard");
  };

  const doExport = () => {
    if (!hasContacts || busy) return;
    setBusy(true);
    const params = new URLSearchParams();
    if (archived && fmt === "csv") params.set("includeArchived", "true");
    const qs = params.toString();
    window.location.href = `/api/exports/contacts/${fmt}${qs ? `?${qs}` : ""}`;
    setTimeout(() => setBusy(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.03)]">
      <div className="mb-3.5 flex items-center gap-2.5">
        <WorkspaceIcon name="download" size={15} />
        <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">Export</span>
      </div>

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

      <button
        className="mt-[18px] flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] bg-[#4158f4] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!hasContacts || busy}
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
      ) : null}

      <p className="mt-4 border-t border-[#e9ece7] pt-3.5 text-[12.5px] leading-[1.5] text-[#8b938c]">
        To export a specific selection, choose contacts in your{" "}
        <Link className="text-[#5c655e] underline underline-offset-2" href="/">contacts list</Link> and use the bulk-export
        action.
      </p>
    </section>
  );
}
