"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getDeleteAccountInfo, scheduleAccountDeletion } from "~/app/actions/account";
import { signOutAction } from "~/app/actions/auth";

function Spinner({ size = 15, light = true }: { size?: number; light?: boolean }) {
  return <span className="st-spin inline-block rounded-full" style={{ width: size, height: size, border: `2px solid ${light ? "rgba(255,255,255,.35)" : "rgba(23,53,46,.2)"}`, borderTopColor: light ? "#fff" : "#17352e" }} />;
}

export function DeleteAccountSection() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [contactCount, setContactCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getDeleteAccountInfo().then(({ email: e, contactCount: c }) => {
      setEmail(e); setContactCount(c);
    }).catch(console.error);
  }, []);

  const matches = !!email && confirmEmail.trim().toLowerCase() === email.toLowerCase();

  const handleDelete = () => {
    setError("");
    startTransition(async () => {
      const result = await scheduleAccountDeletion({ confirmEmail });
      if ("success" in result) {
        await signOutAction();
        router.push("/account-deleted");
      } else {
        setError(
          result.error === "EMAIL_MISMATCH" ? "Email address does not match." :
          result.error === "OWNS_ACTIVE_GROUP" ? "You must transfer or delete your Family/Teams group before closing your account." :
          "Something went wrong. Please try again."
        );
      }
    });
  };

  return (
    <section className="rounded-[2rem] border border-[#dcae9f] bg-[#fdf8f6] p-6">
      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#b5472f]">Danger zone</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#1d2823]">Delete account</p>
          <p className="mt-1 max-w-[480px] text-[13.5px] leading-[1.5] text-[#5c655e]">
            Permanently delete your account and all associated data. Before you go,{" "}
            <a className="font-medium text-[#4158f4] hover:underline" href="/import-export">export your contacts</a>.
          </p>
        </div>
        <button
          className="shrink-0 rounded-[1.2rem] border border-[#dcae9f] bg-white px-4 py-[9px] text-[13.5px] font-semibold text-[#b5472f] transition hover:bg-[#f3e1da]"
          onClick={() => setOpen(true)}
          type="button"
        >
          Delete my account
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(20,30,25,0.42)] p-4" onClick={() => { setOpen(false); setConfirmEmail(""); setError(""); }}>
          <div className="st-modal-in w-full max-w-[480px] rounded-[1.6rem] bg-white p-6 shadow-[0_24px_60px_rgba(20,30,25,0.25)]" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]">Delete your Kontax account?</h3>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-[#5c655e]">This will permanently delete:</p>
            <ul className="mt-2 grid gap-1 text-[13.5px] text-[#5c655e]">
              <li>• All your contacts ({contactCount.toLocaleString()} contact{contactCount === 1 ? "" : "s"})</li>
              <li>• All sync connections and activity history</li>
              <li>• Your subscription (if active)</li>
            </ul>

            <div className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-[#e6d3a3] bg-[#f6edd9] px-[15px] py-[13px]">
              <svg fill="none" height="16" stroke="#7c5511" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" style={{ flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" width="16"><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
              <p className="text-[13px] text-[#7c5511]">
                Your account will be deleted in <strong className="font-semibold">30 days</strong>. You can sign back in during that period to cancel.
              </p>
            </div>

            <div className="mt-5">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">To confirm, type your email address</span>
                <input
                  autoFocus
                  className={`mt-[6px] w-full rounded-[1.2rem] border px-4 py-3 text-[14px] text-[#1d2823] outline-none transition focus:ring-[3px] focus:ring-[#edf0fe] ${error ? "border-[#c98a76] focus:border-[#c98a76]" : "border-[#d8ddd6] focus:border-[#4158f4]"}`}
                  onChange={(e) => { setConfirmEmail(e.target.value); if (error) setError(""); }}
                  placeholder={email}
                  type="email"
                  value={confirmEmail}
                />
                {error && <p className="mt-[6px] text-[12.5px] text-[#9a3a23]">{error}</p>}
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-[11px] text-[14px] font-semibold text-[#1d2823] hover:bg-[#f2f4f0]" onClick={() => { setOpen(false); setConfirmEmail(""); setError(""); }} type="button">Cancel</button>
              <button
                className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#b5472f] px-4 py-[11px] text-[14px] font-semibold text-white hover:bg-[#9a3a23] disabled:cursor-default disabled:opacity-45"
                disabled={!matches || isPending}
                onClick={handleDelete}
                type="button"
              >
                {isPending ? <><Spinner size={15} /> Deleting…</> : "Delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
