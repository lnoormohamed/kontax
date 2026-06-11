"use client";

import { useEffect, useRef, useState } from "react";

const SE_TOTP = "123456"; // demo code — real TOTP comes in P18-07
const SE_SECRET = "JBSWY3DPEHPK3PXP";
const SE_RECOVERY = ["R3KP7Q4X2A","B7NM5T9WQ1","X2QF6K8PJ3","H4VN3R7BQ9","M9JW4T2LP5","K6CX8B1QN7","D5RP9X3NM8","W2TJ7K4QV6"];

// ── Deterministic pseudo-QR ───────────────────────────────────────────────────
function QrCode({ size = 196 }: { size?: number }) {
  const N = 25;
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >> 8) & 1; };
  const inFinder = (r: number, c: number) => {
    const f = (br: number, bc: number) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return f(0, 0) || f(0, N - 7) || f(N - 7, 0);
  };
  const cells: [number, number][] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (!inFinder(r, c) && rnd()) cells.push([r, c]); }
  const m = size / N;
  const finder = (br: number, bc: number) => (
    <g key={`f${br}${bc}`}>
      <rect fill="#1d2823" height={7 * m} rx={m} width={7 * m} x={bc * m} y={br * m} />
      <rect fill="#fff" height={5 * m} rx={m * 0.6} width={5 * m} x={(bc + 1) * m} y={(br + 1) * m} />
      <rect fill="#1d2823" height={3 * m} rx={m * 0.4} width={3 * m} x={(bc + 2) * m} y={(br + 2) * m} />
    </g>
  );
  return (
    <svg height={size} shapeRendering="crispEdges" viewBox={`0 0 ${size} ${size}`} width={size}>
      <rect fill="#fff" height={size} width={size} />
      {cells.map(([r, c], i) => <rect fill="#1d2823" height={m} key={i} width={m} x={c * m} y={r * m} />)}
      {finder(0, 0)}{finder(0, N - 7)}{finder(N - 7, 0)}
    </svg>
  );
}

// ── 6-digit OTP input ─────────────────────────────────────────────────────────
function OtpInput({ value, onChange, onComplete, error, disabled, autoFocus }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void;
  error?: boolean; disabled?: boolean; autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  const setAt = (i: number, ch: string) => {
    const next = (value.slice(0, i) + ch + value.slice(i + 1)).slice(0, 6);
    onChange(next);
    if (ch && i < 5) refs.current[i + 1]?.focus();
    if (next.length === 6 && !next.includes("") && onComplete) onComplete(next);
  };

  return (
    <div className={`flex gap-[9px] ${error ? "st-shake" : ""}`}>
      {digits.map((d, i) => (
        <input
          className="st-otp-box"
          disabled={disabled}
          inputMode="numeric"
          key={i}
          maxLength={1}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); if (v) setAt(i, v[v.length - 1]!); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") { if (!digits[i] && i > 0) { refs.current[i - 1]?.focus(); setAt(i - 1, ""); } else setAt(i, ""); }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { e.preventDefault(); const p = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (p) { onChange(p); if (p.length === 6 && onComplete) onComplete(p); else refs.current[Math.min(p.length, 5)]?.focus(); } }}
          ref={(el) => { refs.current[i] = el; }}
          style={error ? { borderColor: "#c0492f", color: "#9a3a23" } : {}}
          value={d}
        />
      ))}
    </div>
  );
}

function Spinner({ size = 15, light = true }: { size?: number; light?: boolean }) {
  return <span className="st-spin inline-block rounded-full" style={{ width: size, height: size, border: `2px solid ${light ? "rgba(255,255,255,.35)" : "rgba(23,53,46,.2)"}`, borderTopColor: light ? "#fff" : "#17352e" }} />;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function TwoFactorModal({
  onCancel,
  onEnabled,
}: {
  onCancel: () => void;
  onEnabled: () => void;
}) {
  const [step, setStep] = useState<"qr" | "verify" | "codes">("qr");
  const [showManual, setShowManual] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const verify = (val?: string) => {
    const v = val ?? code;
    if (v.length !== 6) return;
    setBusy(true); setErr(false);
    setTimeout(() => {
      setBusy(false);
      if (v === SE_TOTP) setStep("codes");
      else { setErr(true); setCode(""); setTimeout(() => setErr(false), 600); }
    }, 850);
  };

  const copyAll = () => {
    try { void navigator.clipboard.writeText(SE_RECOVERY.join("\n")); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    try {
      const blob = new Blob([SE_RECOVERY.join("\n") + "\n"], { type: "text/plain" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "kontax-recovery-codes.txt"; a.click(); URL.revokeObjectURL(a.href);
    } catch {}
  };

  const secretSpaced = SE_SECRET.replace(/(.{4})/g, "$1 ").trim();

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(20,30,25,0.42)] p-4"
      onClick={step === "codes" ? undefined : onCancel}
    >
      <div
        className="st-modal-in w-full max-w-[460px] rounded-[1.6rem] bg-white p-6 shadow-[0_24px_60px_rgba(20,30,25,0.25)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {step === "qr" && (
          <>
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]">Set up two-factor authentication</h3>
            <p className="mt-[6px] text-[13px] font-semibold tracking-[0.02em] text-[#17352e]">Step 1 of 2</p>
            <p className="mt-[6px] text-[14px] leading-[1.55] text-[#5c655e]">
              Scan this QR code with your authenticator app (1Password, Authy, Google Authenticator…).
            </p>
            <div className="my-4 grid place-items-center">
              <div className="rounded-[18px] border border-[#d8ddd6] bg-white p-3">
                <QrCode />
              </div>
            </div>
            <button
              className="inline-flex items-center gap-[7px] border-none bg-transparent p-0 text-[13px] font-semibold text-[#5c655e] transition hover:text-[#1d2823]"
              onClick={() => setShowManual((s) => !s)}
              type="button"
            >
              <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" style={{ transform: showManual ? "rotate(180deg)" : "none", transition: "transform .15s" }} viewBox="0 0 24 24" width="15"><polyline points="6 9 12 15 18 9" /></svg>
              Can&apos;t scan? Enter this code manually
            </button>
            {showManual && (
              <div className="mt-[10px] rounded-xl border border-[#e9ece7] bg-[#f2f4f0] px-[14px] py-3 text-center font-mono text-[15px] tracking-[0.12em] text-[#1d2823]">
                {secretSpaced}
              </div>
            )}
            <div className="mt-[22px] flex justify-end gap-2.5">
              <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-[11px] text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]" onClick={onCancel} type="button">Cancel</button>
              <button className="rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b]" onClick={() => setStep("verify")} type="button">Continue →</button>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]">Set up two-factor authentication</h3>
            <p className="mt-[6px] text-[13px] font-semibold text-[#17352e]">Step 2 of 2</p>
            <p className="mt-[6px] mb-4 text-[14px] leading-[1.55] text-[#5c655e]">
              Enter the 6-digit code from your authenticator app.{" "}
              <span className="text-[#8b938c]">(Demo code: 123456)</span>
            </p>
            <OtpInput value={code} onChange={setCode} onComplete={verify} error={err} disabled={busy} autoFocus />
            {err && <p className="mt-[10px] text-[13px] text-[#9a3a23]">Incorrect code. Try again.</p>}
            <div className="mt-[22px] flex items-center justify-between gap-2.5">
              <button className="border-none bg-transparent p-[4px_2px] text-[13px] font-semibold text-[#5c655e] transition hover:text-[#1d2823]" onClick={() => { setStep("qr"); setCode(""); setErr(false); }} type="button">← Back</button>
              <button
                className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
                disabled={code.length !== 6 || busy}
                onClick={() => verify()}
                type="button"
              >
                {busy ? <><Spinner size={15} /> Verifying…</> : "Verify and enable"}
              </button>
            </div>
          </>
        )}

        {step === "codes" && (
          <>
            <div className="flex items-center gap-[10px]">
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#e7efe9] text-[#17352e]">
                <svg fill="none" height="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="17"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]">Two-factor is enabled</h3>
            </div>
            <div className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-[#e6d3a3] bg-[#f6edd9] px-[15px] py-[13px]">
              <svg fill="none" height="17" stroke="#7c5511" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" style={{ flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" width="17"><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
              <span className="text-[13.5px] leading-[1.5] text-[#7c5511]">
                Save your recovery codes somewhere safe. If you lose your authenticator app, these are the <strong className="font-semibold">only</strong> way to recover your account.
              </span>
            </div>
            <div className="mt-[14px] grid grid-cols-2 gap-2 rounded-[14px] border border-[#e9ece7] bg-[#f8faf8] p-[14px]">
              {SE_RECOVERY.map((c) => (
                <span className="rounded-lg border border-[#e9ece7] bg-white py-[7px] text-center font-mono text-[15px] tracking-[0.06em] text-[#1d2823]" key={c}>{c}</span>
              ))}
            </div>
            <div className="mt-[14px] flex flex-wrap gap-2.5">
              <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-[9px] text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]" onClick={copyAll} type="button">{copied ? "Copied ✓" : "Copy all codes"}</button>
              <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-[9px] text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]" onClick={download} type="button">Download as .txt</button>
            </div>
            <button className="mt-[18px] w-full rounded-[1.2rem] bg-[#17352e] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b]" onClick={onEnabled} type="button">I&apos;ve saved my codes →</button>
          </>
        )}
      </div>
    </div>
  );
}
