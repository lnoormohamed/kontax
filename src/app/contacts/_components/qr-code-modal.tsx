"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getOrCreateVcardShareLink } from "~/app/actions/shares";

// P28-06 — vCard QR modal (P28-DB09 §5). Generates the QR client-side from the
// contact's /share/{token} URL (reusing an existing non-expired link). Desktop:
// compact centered modal; mobile: bottom sheet. Download PNG + Copy link.

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

export function QrCodeModal({
  contactId,
  contactName,
  onClose,
}: {
  contactId: string;
  contactName: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Get / create the share link.
  useEffect(() => {
    let active = true;
    getOrCreateVcardShareLink(contactId)
      .then((res) => {
        if (!active) return;
        setShareUrl(res.url);
        setExpiresAt(res.expiresAt);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Couldn’t create a share link."));
    return () => {
      active = false;
    };
  }, [contactId]);

  // Render the QR once we have a URL and the canvas is mounted.
  useEffect(() => {
    if (!shareUrl || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, shareUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#1d2823", light: "#ffffff" },
    });
  }, [shareUrl]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${contactName.toLowerCase().replace(/\s+/g, "-") || "contact"}-qr.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context / permissions) — surface a
      // hint near the button rather than clobbering the QR (separate from `error`).
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2500);
    }
  };

  if (!mounted) return null;

  const loading = !shareUrl && !error;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Share ${contactName}`}>
      <div onClick={onClose} className="absolute inset-0" style={{ background: "rgba(29,40,35,0.5)" }} />
      <div className="relative w-full rounded-t-2xl bg-white sm:w-auto sm:max-w-[380px] sm:rounded-2xl" style={{ boxShadow: "0 24px 60px rgba(20,30,25,0.28)" }}>
        {/* header */}
        <div className="flex items-center gap-3 px-6 pt-5">
          <span className="text-[16px] font-bold tracking-[-0.01em] text-[#1d2823]">Share {contactName}</span>
          <button type="button" aria-label="Close" onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-[#5c655e] transition hover:bg-[#f2f4f0]">
            ✕
          </button>
        </div>

        {/* body */}
        <div className="flex flex-col items-center px-6 pb-2 pt-5">
          <div className="rounded-2xl border border-[#e9ece7] bg-white p-4" style={{ boxShadow: "0 1px 2px rgba(20,30,25,0.04)" }}>
            {loading ? (
              <div className="grid h-[200px] w-[200px] place-items-center rounded-xl bg-[#f2f4f0] text-[13px] text-[#8b938c]">
                Generating…
              </div>
            ) : error ? (
              <div className="grid h-[200px] w-[200px] place-items-center rounded-xl bg-[#fbeae6] px-4 text-center text-[13px] text-[#b5472f]">
                {error}
              </div>
            ) : (
              <canvas ref={canvasRef} width={200} height={200} className="block h-[200px] w-[200px]" />
            )}
          </div>

          <p className="mt-4 max-w-[280px] text-center text-[13.5px] leading-snug text-[#5c655e]">
            Scan to add {firstName(contactName)}’s contact to any phone.
          </p>

          {/* link scope (resolved decision: never-expires for paid; honest expiry for free) */}
          {shareUrl ? (
            <div className="mt-3 flex w-full items-center gap-2 rounded-[10px] border border-[#e9ece7] bg-[#f6f7f4] px-3 py-2 text-[12.5px] text-[#5c655e]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b938c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 14.5l5-5M8 12l-2 2a3.5 3.5 0 005 5l2-2M16 12l2-2a3.5 3.5 0 00-5-5l-2 2" />
              </svg>
              <span>
                Public link ·{" "}
                <b className="font-semibold text-[#1d2823]">
                  {expiresAt ? `expires ${fmtDate(expiresAt)}` : "doesn’t expire"}
                </b>
              </span>
            </div>
          ) : null}
        </div>

        {/* actions */}
        <div className="flex gap-2.5 px-6 pb-6 pt-4" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || !!error}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#4158f4] text-[14px] font-semibold text-white transition hover:bg-[#3248db] disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M8 11l4 4 4-4M5 19h14" />
            </svg>
            Download QR
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading || !!error}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#d8ddd6] bg-white text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0] disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 14.5l5-5M8 12l-2 2a3.5 3.5 0 005 5l2-2M16 12l2-2a3.5 3.5 0 00-5-5l-2 2" />
            </svg>
            {copied ? "Copied!" : copyFailed ? "Press ⌘C" : "Copy link"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
