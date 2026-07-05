"use client";

import Link from "next/link";
import { useState } from "react";

import { signOutAction } from "~/app/actions/auth";
import { SettingsPageHead, StSecLabel } from "~/app/_components/settings-ui";
import { DeleteAccountSection } from "./delete-account-section";
import { SessionsSection } from "./sessions-section";
import { TwoFactorSection } from "./two-factor-section";

type ConnectedAccountsData = {
  primaryEmail: string;
  emailVerifiedAt: string | null;
  hasPassword: boolean;
  totpEnabled: boolean;
  totpVerifiedAt: string | null;
  activeSessionCount: number;
  activeAppPasswordCount: number;
  syncProviderConnections: Array<{
    provider: "GOOGLE" | "MICROSOFT";
    count: number;
  }>;
};

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-[22px] left-1/2 z-[200] max-w-[90vw] -translate-x-1/2 rounded-[10px] bg-[#23302a] px-[18px] py-[11px] text-[13.5px] text-white shadow-[0_10px_34px_rgba(0,0,0,0.28)]">
      {message}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg height="20" viewBox="0 0 24 24" width="20">
      <path d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.17a5.27 5.27 0 01-2.29 3.46v2.88h3.71C21.46 18.92 23 15.92 23 12.27z" fill="#4285F4" />
      <path d="M12 23c3.1 0 5.7-1.03 7.6-2.79l-3.71-2.88c-1.03.69-2.35 1.1-3.89 1.1-2.99 0-5.52-2.02-6.43-4.74H1.74v2.97A11 11 0 0012 23z" fill="#34A853" />
      <path d="M5.57 13.69a6.6 6.6 0 010-4.21V6.51H1.74a11 11 0 000 9.87l3.83-2.69z" fill="#FBBC05" />
      <path d="M12 4.75c1.69 0 3.2.58 4.39 1.72l3.29-3.29C17.69 1.32 15.09 0 12 0A11 11 0 001.74 6.51l3.83 2.97C6.48 6.77 9.01 4.75 12 4.75z" fill="#EA4335" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg fill="#1d2823" height="20" viewBox="0 0 24 24" width="20">
      <path d="M16.36 12.78c.02 2.5 2.19 3.33 2.22 3.34-.02.06-.35 1.2-1.15 2.37-.69 1.02-1.41 2.03-2.54 2.05-1.11.02-1.47-.66-2.74-.66-1.27 0-1.66.64-2.71.68-1.09.04-1.92-1.1-2.62-2.11-1.42-2.07-2.51-5.85-1.05-8.41a4.07 4.07 0 013.44-2.1c1.07-.02 2.08.72 2.74.72.65 0 1.88-.89 3.17-.76.54.02 2.06.22 3.03 1.65-.08.05-1.81 1.06-1.79 3.16M14.28 4.38c.58-.71.98-1.69.87-2.67-.84.03-1.86.56-2.47 1.26-.54.62-1.01 1.62-.88 2.58.94.07 1.9-.48 2.48-1.17" />
    </svg>
  );
}

function ConnectedAccountsSection({
  data,
}: {
  data: ConnectedAccountsData;
}) {
  const emailVerifiedLabel = data.emailVerifiedAt
    ? `Verified on ${new Date(data.emailVerifiedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`
    : "Email not verified yet";
  const totpLabel = data.totpEnabled
    ? data.totpVerifiedAt
      ? `Enabled on ${new Date(data.totpVerifiedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : "Enabled"
    : "Not enabled";

  const syncProviderSummary = data.syncProviderConnections.length
    ? data.syncProviderConnections
        .map((entry) => `${entry.provider === "GOOGLE" ? "Google" : "Microsoft"} (${entry.count})`)
        .join(" · ")
    : null;

  return (
    <section className="rounded-[2rem] border border-[#d8ddd6] bg-[#fbfcf9] p-4 shadow-none md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[16px] font-semibold text-[#1d2823]">
            Connected accounts &amp; sign-in methods
          </div>
          <p className="mt-1 max-w-[680px] text-[14px] leading-[1.55] text-[#5c655e]">
            See how you sign in today, how recoverable your account is, and which external
            providers are connected for sync versus sign-in.
          </p>
        </div>
        <Link
          className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-[9px] text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          href="/settings/account"
        >
          Manage account
        </Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold text-[#1d2823]">Email &amp; password</div>
              <div className="mt-1 text-[12.5px] text-[#8b938c]">{data.primaryEmail}</div>
            </div>
            <span className="rounded-full border border-[#bcdac9] bg-[#e7efe9] px-[10px] py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#17352e]">
              {data.hasPassword ? "Active" : "Unavailable"}
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-[1.55] text-[#5c655e]">
            This workspace currently uses email and password as the primary sign-in method.
            {` ${emailVerifiedLabel}.`}
          </p>
        </div>

        <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold text-[#1d2823]">Recovery posture</div>
              <div className="mt-1 text-[12.5px] text-[#8b938c]">
                Sessions, two-factor coverage, and app passwords
              </div>
            </div>
            <span className={`rounded-full border px-[10px] py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
              data.totpEnabled
                ? "border-[#bcdac9] bg-[#e7efe9] text-[#17352e]"
                : "border-[#e6d3a3] bg-[#f6edd9] text-[#7c5511]"
            }`}>
              {data.totpEnabled ? "Strong" : "Basic"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-[13px] text-[#5c655e]">
            <div className="flex items-start justify-between gap-3">
              <span>Authenticator app</span>
              <span className="text-right font-medium text-[#1d2823]">{totpLabel}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span>Active sessions</span>
              <span className="text-right font-medium text-[#1d2823]">{data.activeSessionCount}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span>App passwords</span>
              <span className="text-right font-medium text-[#1d2823]">
                {data.activeAppPasswordCount === 0
                  ? "None issued"
                  : `${data.activeAppPasswordCount} active`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[1.4rem] border border-[#d8ddd6] bg-white px-4 py-4">
        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="text-[14px] font-semibold text-[#1d2823]">Linked sign-in providers</span>
          <span className="rounded-[6px] bg-[#f2f4f0] px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.06em] text-[#8b938c]">
            Ready for rollout
          </span>
        </div>
        <p className="mt-1 max-w-[680px] text-[13px] leading-[1.55] text-[#5c655e]">
          Google and Apple sign-in providers will appear here once this workspace enables linked
          identity login. For now, no external sign-in identities are attached to this account.
        </p>
        <div className="mt-4 grid gap-[10px] opacity-80 md:grid-cols-2">
          {[
            {
              id: "google",
              name: "Google",
              subtitle: "Not linked for sign-in",
              mark: <GoogleMark />,
            },
            {
              id: "apple",
              name: "Apple",
              subtitle: "Not linked for sign-in",
              mark: <AppleMark />,
            },
          ].map((provider) => (
            <div
              key={provider.id}
              className="flex items-center gap-[13px] rounded-[14px] border border-[#d8ddd6] bg-[#fbfcf9] px-[14px] py-3"
            >
              <span className="grid h-[32px] w-[32px] shrink-0 place-items-center">
                {provider.mark}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#1d2823]">{provider.name}</span>
                <span className="block text-[12.5px] text-[#8b938c]">{provider.subtitle}</span>
              </span>
              <span className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-[7px] text-[13px] font-semibold text-[#8b938c]">
                Not linked
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[1.4rem] border border-[#d8ddd6] bg-[#f8faf8] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-[#1d2823]">Connected sync providers</div>
            <div className="mt-1 text-[12.5px] leading-[1.5] text-[#5c655e]">
              {syncProviderSummary
                ? `${syncProviderSummary}. These accounts sync contacts but do not sign you into Kontax.`
                : "No Google or Microsoft sync providers are connected right now."}
            </div>
          </div>
          <Link
            className="rounded-[1.1rem] border border-[#d8ddd6] bg-white px-4 py-[8px] text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
            href="/sync"
          >
            Review sync accounts
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SecurityPageClient({
  connectedAccounts,
}: {
  connectedAccounts: ConnectedAccountsData;
}) {
  const [toast, setToast] = useState("");

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  return (
    <>
      <SettingsPageHead
        title="Security"
        sub="Protect your account with two-factor authentication, review where you're signed in, and understand how sign-in and sync connections relate."
      />

      <StSecLabel>Two-factor authentication</StSecLabel>
      <TwoFactorSection flash={flash} />

      <StSecLabel>Active sessions</StSecLabel>
      <SessionsSection flash={flash} />

      {/* P46-13 / DB07: the account-session sign-out card, relocated from the
          old root #plan-billing section — sign-out's home is with sessions. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d8ddd6] bg-white p-5">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8b938c]">
            This device
          </p>
          <p className="mt-1.5 text-[14px] text-[#3a4540]">
            Signed in as <span className="font-semibold text-[#1d2823]">{connectedAccounts.primaryEmail}</span>
          </p>
        </div>
        <form action={signOutAction}>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8ddd6] px-4 text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </div>

      <StSecLabel>Connected accounts</StSecLabel>
      <ConnectedAccountsSection data={connectedAccounts} />

      <div id="delete">
        <StSecLabel>Danger zone</StSecLabel>
        <DeleteAccountSection />
      </div>

      {toast && <Toast message={toast} />}
    </>
  );
}
