"use client";

import { useState } from "react";

import { QrCodeModal } from "~/app/contacts/_components/qr-code-modal";

const BTN: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #d8ddd6",
  background: "#fff",
  color: "#1d2823",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  width: "100%",
  textAlign: "left" as const,
};

function CopyButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  return (
    <button type="button" style={BTN} onClick={handleCopy}>
      {state === "copied" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17352e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
      {state === "copied" ? "Copied!" : state === "failed" ? "Press ⌘C to copy" : "Copy card link"}
    </button>
  );
}

function EmailSignaturePanel({ url, displayName, jobTitle, company }: {
  url: string;
  displayName: string;
  jobTitle?: string | null;
  company?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const subtitle = [jobTitle, company].filter(Boolean).join(" at ");

  const html = [
    `<p style="font-family:sans-serif;font-size:13px;color:#1d2823;margin:0 0 6px">`,
    `  <strong>${displayName}</strong>`,
    subtitle ? `<br>${subtitle}` : "",
    `</p>`,
    `<p style="margin:0">`,
    `  <a href="${url}" style="font-family:sans-serif;font-size:12px;color:#4158f4;text-decoration:none">`,
    `    Save my contact on Kontax →`,
    `  </a>`,
    `</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  const handleCopy = async () => {
    try {
      // Try rich HTML copy for email clients
      const blob = new Blob([html], { type: "text/html" });
      const plain = `${displayName}${subtitle ? `\n${subtitle}` : ""}\nSave my contact on Kontax → ${url}`;
      const plainBlob = new Blob([plain], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob, "text/plain": plainBlob }),
      ]);
    } catch {
      // Fallback: copy raw HTML text
      try { await navigator.clipboard.writeText(html); } catch { /* ignore */ }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 12,
        border: "1px solid #e9ece7",
        background: "#f6f7f4",
        overflow: "hidden",
      }}
    >
      {/* Preview */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e9ece7" }}>
        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#1d2823" }}>{displayName}</p>
        {subtitle && <p style={{ margin: "0 0 6px", fontSize: 12, color: "#5c655e" }}>{subtitle}</p>}
        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#4158f4", textDecoration: "none" }}>
          Save my contact on Kontax →
        </a>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "10px 16px",
          background: "transparent",
          border: "none",
          fontSize: 12,
          fontWeight: 500,
          color: "#5c655e",
          cursor: "pointer",
          textAlign: "left" as const,
        }}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17352e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
        {copied ? "Copied as rich text!" : "Copy as email signature"}
      </button>
    </div>
  );
}

export function CardShareTools({
  username,
  displayName,
  jobTitle,
  company,
}: {
  username: string;
  displayName: string;
  jobTitle?: string | null;
  company?: string | null;
}) {
  const cardUrl = `https://getkontax.com/u/${username}`;
  const [showQr, setShowQr] = useState(false);
  const [showSig, setShowSig] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <CopyButton url={cardUrl} />

      <button type="button" style={BTN} onClick={() => setShowQr(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01" />
        </svg>
        Show QR code
      </button>

      <button type="button" style={BTN} onClick={() => setShowSig((v) => !v)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="3" />
          <path d="M2 7l10 7 10-7" />
        </svg>
        {showSig ? "Hide email signature" : "Email signature snippet"}
      </button>

      {showSig && (
        <EmailSignaturePanel
          url={cardUrl}
          displayName={displayName}
          jobTitle={jobTitle}
          company={company}
        />
      )}

      {showQr && (
        <QrCodeModal
          shareUrl={cardUrl}
          title="Your card QR"
          downloadFilename={`kontax-card-${username}`}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
