"use client";

import { useActionState } from "react";

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

const formatTimestamp = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Never";

export function AppPasswordManager({
  allowance,
  appPasswords,
}: {
  allowance: AppPasswordAllowance;
  appPasswords: AppPasswordSummary[];
}) {
  const [createState, createAction, isCreating] = useActionState(createAppPassword, initialState);

  return (
    <div className="grid gap-5">
      <form action={createAction} className="grid gap-4 rounded-[1.5rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Create a new app password</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Good labels are things like `iPhone`, `Work Mac`, or `DAVx5`.
          </p>
        </div>

        <label className="grid gap-2 text-sm text-slate-700">
          <span>Label</span>
          <input
            className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4158f4]"
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
          <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            <p className="font-semibold">Copy this app password now.</p>
            <p className="mt-2 break-all font-mono text-base">{createState.formattedToken}</p>
            <p className="mt-2 text-sm text-emerald-700">
              This is the only time Kontax will show the plaintext value.
            </p>
          </div>
        ) : null}

        <button
          className="w-fit rounded-[1.2rem] bg-[#17352e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!allowance.allowed || isCreating}
          type="submit"
        >
          {isCreating ? "Creating..." : "Create app password"}
        </button>
      </form>

      <div className="rounded-[1.5rem] border border-[#d8ddd6] bg-white">
        <div className="border-b border-[#e6ebe5] px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Existing app passwords</p>
          <p className="mt-1 text-sm text-slate-500">
            Revoke anything you no longer trust. Revocation takes effect immediately.
          </p>
        </div>

        {appPasswords.length === 0 ? (
          <div className="px-4 py-5 text-sm text-slate-500">
            No app passwords yet. Create one when you are ready to connect an iPhone, Mac, or Android CardDAV client.
          </div>
        ) : (
          <div className="grid gap-0">
            {appPasswords.map((appPassword) => (
              <div
                className="grid gap-3 border-t border-[#eef2ec] px-4 py-4 md:grid-cols-[minmax(0,1.3fr)_160px_160px_auto] md:items-center"
                key={appPassword.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{appPassword.label}</p>
                </div>
                <div className="text-sm text-slate-500">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Created
                  </p>
                  <p className="mt-1">{formatTimestamp(appPassword.createdAt)}</p>
                </div>
                <div className="text-sm text-slate-500">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Last used
                  </p>
                  <p className="mt-1">{formatTimestamp(appPassword.lastUsedAt)}</p>
                </div>
                <form action={revokeAppPassword} className="md:justify-self-end">
                  <input name="appPasswordId" type="hidden" value={appPassword.id} />
                  <button
                    className="rounded-[1.1rem] border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50"
                    type="submit"
                  >
                    Revoke
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
