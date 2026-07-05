"use client";

// P45-DB01 Surface 3: single-contact export entry points.
// Desktop: split button (main body = document download, caret = format menu).
// Mobile: bottom sheet with format radio cards + share-sheet handoff.

import { useEffect, useRef, useState } from "react";

import { MobileBottomSheet } from "~/app/_components/mobile-bottom-sheet";

type ExportFormat = "document" | "archive" | "vcard";

const formatUrl = (contactId: string, format: ExportFormat) =>
  format === "vcard"
    ? `/api/contacts/${contactId}/vcard`
    : `/api/contacts/${contactId}/export?as=${format}`;

const triggerDownload = (url: string) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const DownloadIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    aria-hidden
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M12 3v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M5 20h14" />
  </svg>
);

const ChevronDownIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    aria-hidden
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const FileIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    aria-hidden
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.8}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);

const BoxIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    aria-hidden
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.8}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
    <path d="M3 8l9 5 9-5" />
    <path d="M12 13v8" />
  </svg>
);

const PeopleIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    aria-hidden
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.8}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CheckIcon = ({ size = 10 }: { size?: number }) => (
  <svg
    aria-hidden
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2.5}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

const MonoChip = ({ label }: { label: string }) => (
  <span className="rounded bg-[#e7efe9] px-1.5 font-mono text-[12px] text-[#17352e]">
    {label}
  </span>
);

/** Desktop split button: Export (document) + caret menu with all three formats. */
export function ContactExportButton({
  contactId,
  contactName,
}: {
  contactId: string;
  contactName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const download = (format: ExportFormat) => {
    setOpen(false);
    triggerDownload(formatUrl(contactId, format));
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex h-[34px] items-stretch overflow-hidden rounded-[8px] border border-[#d8ddd6] bg-white">
        <button
          aria-label={`Export ${contactName}`}
          className="flex cursor-pointer items-center gap-1.5 px-3 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          onClick={() => download("document")}
          type="button"
        >
          <DownloadIcon />
          Export
        </button>
        <span aria-hidden className="w-px bg-[#e9ece7]" />
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Export formats"
          className="grid cursor-pointer place-items-center px-2 text-[#5c655e] transition hover:bg-[#f2f4f0]"
          onClick={() => setOpen((o) => !o)}
          type="button"
        >
          <ChevronDownIcon />
        </button>
      </div>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-1 w-[308px] rounded-[13px] border border-[#d8ddd6] bg-white p-1.5 shadow-lg"
          role="menu"
        >
          <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.08em] text-[#8b938c] uppercase">
            Export this contact
          </p>

          <button
            className="flex w-full cursor-pointer items-start gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition hover:bg-[#f2f4f0]"
            onClick={() => download("document")}
            role="menuitem"
            type="button"
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] bg-[#e7efe9] text-[#17352e]">
              <FileIcon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[#1d2823]">Document</span>
                <MonoChip label=".json" />
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[#5c655e]">
                One file, photo included. Best for a quick backup.
              </span>
            </span>
            <span className="mt-1 flex shrink-0 items-center gap-1 rounded-md bg-[#17352e] px-1.5 py-0.5 text-[10.5px] font-bold text-[#dff0e7]">
              <CheckIcon />
              DEFAULT
            </span>
          </button>

          <button
            className="flex w-full cursor-pointer items-start gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition hover:bg-[#f2f4f0]"
            onClick={() => download("archive")}
            role="menuitem"
            type="button"
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] bg-[#e7efe9] text-[#17352e]">
              <BoxIcon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[#1d2823]">Archive</span>
                <MonoChip label=".zip" />
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[#5c655e]">
                Photo as a separate file. For moving into another Kontax.
              </span>
            </span>
          </button>

          <button
            className="flex w-full cursor-pointer items-start gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition hover:bg-[#f2f4f0]"
            onClick={() => download("vcard")}
            role="menuitem"
            type="button"
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] bg-[#f2f4f0] text-[#5c655e]">
              <PeopleIcon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[#1d2823]">vCard</span>
                <MonoChip label=".vcf" />
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[#5c655e]">
                Add to Apple, Google, or Outlook contacts.
              </span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

const MOBILE_OPTIONS: Array<{
  format: ExportFormat;
  title: string;
  chip: string;
  description: string;
}> = [
  {
    format: "document",
    title: "Document",
    chip: ".json",
    description: "One file, photo included. Best for a quick backup.",
  },
  {
    format: "archive",
    title: "Archive",
    chip: ".zip",
    description: "Photo as a separate file.",
  },
  {
    format: "vcard",
    title: "vCard",
    chip: ".vcf",
    description: "Add to Apple, Google, or Outlook.",
  },
];

const formatMime = (format: ExportFormat) =>
  format === "vcard" ? "text/vcard" : format === "archive" ? "application/zip" : "application/json";

const formatExtension = (format: ExportFormat) =>
  format === "vcard" ? "vcf" : format === "archive" ? "zip" : "json";

/** Mobile export sheet — format picker + Export and share (share sheet when available). */
export function MobileContactExport({
  contactId,
  contactName,
  isOpen,
  onClose,
}: {
  contactId: string;
  contactName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("document");
  const [busy, setBusy] = useState(false);

  const runExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const url = formatUrl(contactId, format);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();

      const slug =
        contactName
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "contact";
      const filename = `${slug}.${formatExtension(format)}`;
      const type = formatMime(format);
      const file = new File([blob], filename, { type });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch (err) {
          // User dismissed the share sheet — not an error.
          if (!(err instanceof DOMException && err.name === "AbortError")) throw err;
        }
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobileBottomSheet
      footer={
        <button
          className="h-12 w-full cursor-pointer rounded-[12px] bg-[#4158f4] text-[15px] font-bold text-white transition disabled:opacity-60"
          disabled={busy}
          onClick={() => void runExport()}
          type="button"
        >
          {busy ? "Preparing…" : "Export and share"}
        </button>
      }
      isOpen={isOpen}
      onClose={onClose}
      title={`Export ${contactName}`}
    >
      <div className="flex flex-col gap-2.5">
        {MOBILE_OPTIONS.map((option) => {
          const selected = format === option.format;
          return (
            <button
              aria-pressed={selected}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-[10px] border p-3 text-left transition ${
                selected ? "border-[#4158f4] bg-[#edf0fe]" : "border-[#d8ddd6] bg-white"
              }`}
              key={option.format}
              onClick={() => setFormat(option.format)}
              type="button"
            >
              <span
                aria-hidden
                className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2 ${
                  selected ? "border-[#4158f4]" : "border-[#d8ddd6]"
                }`}
              >
                {selected ? <span className="size-[9px] rounded-full bg-[#4158f4]" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-[#1d2823]">{option.title}</span>
                  <MonoChip label={option.chip} />
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-[#5c655e]">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </MobileBottomSheet>
  );
}
