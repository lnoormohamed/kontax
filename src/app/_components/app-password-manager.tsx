"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import { createAppPassword, revokeAppPassword } from "~/app/actions/app-passwords";
import type { AppPasswordSummary } from "~/server/app-passwords";

type AppPasswordAllowance = {
  allowed: boolean;
  current: number;
  limit: number | null;
};

type CreateActionState =
  | {
      ok: true;
      appPasswordId: string;
      token: string;
      formattedToken: string;
    }
  | {
      ok: false;
      error: string;
    }
  | null;

const initialState: CreateActionState = null;

const inferPlatformGlyph = (label: string) => {
  const value = label.toLowerCase();
  if (value.includes("iphone") || value.includes("ipad") || value.includes("ios")) {
    return "📱";
  }
  if (value.includes("mac")) {
    return "💻";
  }
  if (value.includes("android") || value.includes("davx") || value.includes("pixel")) {
    return "🤖";
  }
  return "🔑";
};

const formatRelativeDate = (value: Date | null) => {
  if (!value) {
    return "Never used";
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  if (diffDays >= 1) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours >= 1) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  return "Just now";
};

function TokenReveal({ formattedToken }: { formattedToken: string }) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedToken.replaceAll("-", ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (acknowledged) {
    return (
      <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Password saved. Your device is ready to connect — use it in the connection guide below.
      </div>
    );
  }

  return (
    <div
      className="rounded-[1.2rem] border border-amber-300 bg-amber-50 px-4 py-4"
      role="status"
    >
      <p className="text-sm font-semibold text-amber-900">
        Save this password now. You won&apos;t be able to see it again.
      </p>
      <p className="mt-3 break-all rounded-[0.9rem] bg-white px-3 py-3 text-center font-mono text-lg tracking-wide text-slate-900">
        {formattedToken}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-[1rem] border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
          onClick={handleCopy}
          type="button"
        >
          {copied ? "Copied" : "Copy password"}
        </button>
        <button
          className="rounded-[1rem] bg-[#17352e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#20443b]"
          onClick={() => setAcknowledged(true)}
          type="button"
        >
          I&apos;ve copied this password
        </button>
      </div>
    </div>
  );
}

export function AppPasswordManager({
  allowance,
  appPasswords,
}: {
  allowance: AppPasswordAllowance;
  appPasswords: AppPasswordSummary[];
}) {
  const [createState, createAction, isCreating] = useActionState(createAppPassword, initialState);
  const [confirmRevoke, setConfirmRevoke] = useState<AppPasswordSummary | null>(null);
  const [revokePending, startRevoke] = useTransition();
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Reset the success banner key so a fresh token reveal mounts per creation.
  const [revealKey, setRevealKey] = useState(0);
  useEffect(() => {
    if (createState?.ok) {
      setRevealKey((key) => key + 1);
    }
  }, [createState]);

  const handleRevoke = (appPassword: AppPasswordSummary) => {
    setRevokeError(null);
    startRevoke(async () => {
      try {
        const formData = new FormData();
        formData.set("appPasswordId", appPassword.id);
        await revokeAppPassword(formData);
        setConfirmRevoke(null);
      } catch {
        setRevokeError("Could not revoke this password. Try again.");
      }
    });
  };

  const limitLabel =
    allowance.limit == null
      ? "Unlimited app passwords on your plan"
      : `Using ${allowance.current} of ${allowance.limit} app password${allowance.limit === 1 ? "" : "s"}`;

  return (
    <div className="grid gap-5">
      <form
        action={createAction}
        className="grid gap-4 rounded-[1.5rem] border border-[#d8ddd6] bg-[#f8faf8] p-4"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">Create a new app password</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Name it after the device you&apos;re connecting, like “iPhone”, “Work Mac”, or “Pixel 8”.
          </p>
        </div>

        <label className="grid gap-2 text-sm text-slate-700">
          <span>Device name</span>
          <input
            className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4158f4] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!allowance.allowed || isCreating}
            maxLength={64}
            name="label"
            placeholder="iPhone"
            type="text"
          />
        </label>

        {createState?.ok === false ? (
          <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {createState.error}
          </div>
        ) : null}

        {createState?.ok ? (
          <TokenReveal key={revealKey} formattedToken={createState.formattedToken} />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            className="w-fit rounded-[1.2rem] bg-[#17352e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!allowance.allowed || isCreating}
            type="submit"
          >
            {isCreating ? "Creating…" : "Generate password"}
          </button>
          <span
            className={`text-xs font-semibold ${
              allowance.allowed ? "text-slate-500" : "text-amber-700"
            }`}
          >
            {limitLabel}
          </span>
        </div>

        {!allowance.allowed ? (
          <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You&apos;ve reached your plan&apos;s app password limit. Revoke one you no longer use, or
            upgrade for more device connections.
          </div>
        ) : null}
      </form>

      <div className="rounded-[1.5rem] border border-[#d8ddd6] bg-white">
        <div className="border-b border-[#e6ebe5] px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Your devices</p>
          <p className="mt-1 text-sm text-slate-500">
            Revoke anything you no longer trust. Revocation takes effect immediately.
          </p>
        </div>

        {appPasswords.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-2xl">📱 💻 🤖</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">Connect your first device</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Create an app password above to connect your iPhone, Mac, or Android phone. App
              passwords are separate from your Kontax login — you can revoke them at any time.
            </p>
          </div>
        ) : (
          <div className="grid gap-0">
            {appPasswords.map((appPassword) => (
              <div
                className="grid gap-3 border-t border-[#eef2ec] px-4 py-4 md:grid-cols-[minmax(0,1.3fr)_150px_150px_auto] md:items-center"
                key={appPassword.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="text-xl">
                    {inferPlatformGlyph(appPassword.label)}
                  </span>
                  <p className="truncate font-semibold text-slate-900">{appPassword.label}</p>
                </div>
                <div className="text-sm text-slate-500">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Created
                  </p>
                  <p className="mt-1">{formatRelativeDate(appPassword.createdAt)}</p>
                </div>
                <div className="text-sm text-slate-500">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Last used
                  </p>
                  <p className="mt-1">{formatRelativeDate(appPassword.lastUsedAt)}</p>
                </div>
                <button
                  className="rounded-[1.1rem] border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50 md:justify-self-end"
                  onClick={() => {
                    setRevokeError(null);
                    setConfirmRevoke(appPassword);
                  }}
                  type="button"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmRevoke ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-[1.6rem] border border-[#d8ddd6] bg-white p-6 shadow-xl">
            <p className="text-lg font-semibold text-slate-900">Revoke this password?</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              The device connected with “{confirmRevoke.label}” will stop syncing immediately. This
              cannot be undone.
            </p>
            {revokeError ? (
              <div className="mt-3 rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {revokeError}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-[1.1rem] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                disabled={revokePending}
                onClick={() => setConfirmRevoke(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-[1.1rem] bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                disabled={revokePending}
                onClick={() => handleRevoke(confirmRevoke)}
                type="button"
              >
                {revokePending ? "Revoking…" : "Revoke password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
