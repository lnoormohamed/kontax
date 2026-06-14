"use client";

import { useState, useTransition } from "react";

import { createApiToken, revokeApiToken } from "~/app/actions/api-tokens";
import type { ApiTokenScope, ApiTokenSummary } from "~/server/api-tokens";

function formatRelativeDate(value: Date | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 30)
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  if (diffDays >= 1) return `${diffDays}d ago`;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours >= 1) return `${diffHours}h ago`;
  return "Just now";
}

function ScopeBadge({ scope }: { scope: ApiTokenScope }) {
  const isWrite = scope === "READ_WRITE";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${
        isWrite
          ? "bg-[#f7e9e4] text-[#9a3a23]"
          : "bg-[#e7efe9] text-[#17352e]"
      }`}
    >
      {isWrite ? "Read / Write" : "Read only"}
    </span>
  );
}

function TokenReveal({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-[1.2rem] border border-[#b6d9c0] bg-[#e3efe7] px-4 py-4">
      <p className="text-[13.5px] font-semibold text-[#1d2823]">
        Copy your token now — it won&apos;t be shown again
      </p>
      <p className="mt-0.5 mb-3 text-[12.5px] text-[#5c655e]">
        Store it somewhere safe. Anyone with this token can access your Kontax data.
      </p>
      <code className="block break-all rounded-[0.8rem] bg-white px-3 py-3 font-mono text-[13px] text-[#1d2823] select-all">
        {token}
      </code>
      <button
        className="mt-3 inline-flex items-center gap-1.5 rounded-[1.1rem] border border-[#b6d9c0] bg-white px-4 py-2 text-[13px] font-semibold text-[#17352e] transition hover:bg-[#f0f8f3]"
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <>
            <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="14"><polyline points="20 6 9 17 4 12" /></svg>
            Copied
          </>
        ) : (
          "Copy token"
        )}
      </button>
    </div>
  );
}

function CreateTokenForm({ onCreated }: { onCreated: (token: string) => void }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiTokenScope>("READ_ONLY");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await createApiToken({ name, scope });
        setName("");
        setScope("READ_ONLY");
        onCreated(result.token);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setError(
          msg === "NAME_REQUIRED" ? "Please enter a name for this token." :
          msg === "NAME_TOO_LONG" ? "Name must be 64 characters or fewer." :
          msg === "UPGRADE_REQUIRED" ? "API access requires a Pro plan or above." :
          "Could not create token. Please try again."
        );
      }
    });
  };

  return (
    <form
      className="grid gap-4 rounded-[1.5rem] border border-[#d8ddd6] bg-[#f8faf8] p-4 md:p-5"
      onSubmit={handleSubmit}
    >
      <div>
        <p className="text-[14.5px] font-semibold text-[#1d2823]">Create a new token</p>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-[#5c655e]">
          Give it a name that describes where you&apos;ll use it.
        </p>
      </div>

      <label className="grid gap-1.5 text-[13px] font-medium text-[#5c655e]">
        Token name
        <input
          className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-3 text-[14px] text-[#1d2823] outline-none transition placeholder:text-[#8b938c] focus:border-[#4158f4] focus:ring-[3px] focus:ring-[#edf0fe]"
          disabled={isPending}
          maxLength={64}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My automation script"
          type="text"
          value={name}
        />
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-[13px] font-medium text-[#5c655e]">Scope</legend>
        <div className="flex flex-wrap gap-3">
          {(["READ_ONLY", "READ_WRITE"] as const).map((s) => (
            <label
              className="flex cursor-pointer items-center gap-2 text-[13.5px] text-[#1d2823]"
              key={s}
            >
              <input
                checked={scope === s}
                className="accent-[#17352e]"
                name="scope"
                onChange={() => setScope(s)}
                type="radio"
                value={s}
              />
              <span>
                {s === "READ_ONLY" ? "Read only" : "Read / Write"}
              </span>
              <span className="text-[12px] text-[#8b938c]">
                {s === "READ_ONLY" ? "— list and read contacts" : "— create, update, delete contacts"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="text-[13px] text-[#9a3a23]">{error}</p>
      )}

      <button
        className="w-fit rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
        disabled={isPending || !name.trim()}
        type="submit"
      >
        {isPending ? "Creating…" : "Create token"}
      </button>
    </form>
  );
}

function RevokeModal({
  token,
  onConfirm,
  onCancel,
}: {
  token: ApiTokenSummary;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await revokeApiToken(token.id);
        onConfirm();
      } catch {
        setError("Could not revoke this token. Try again.");
      }
    });
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2823]/40 px-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-[1.6rem] border border-[#d8ddd6] bg-white p-6 shadow-xl">
        <p className="text-[17px] font-semibold text-[#1d2823]">Revoke &ldquo;{token.name}&rdquo;?</p>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-[#5c655e]">
          Any application using this token will immediately lose access. This cannot be undone.
        </p>
        {error && (
          <p className="mt-3 text-[13px] text-[#9a3a23]">{error}</p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            className="rounded-[1.1rem] border border-[#d8ddd6] px-4 py-2 text-[13.5px] font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0] disabled:opacity-50"
            disabled={isPending}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-[1.1rem] bg-[#b5472f] px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-[#9a3a23] disabled:opacity-50"
            disabled={isPending}
            onClick={handleConfirm}
            type="button"
          >
            {isPending ? "Revoking…" : "Revoke token"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApiTokenManager({ tokens }: { tokens: ApiTokenSummary[] }) {
  const [newToken, setNewToken] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<ApiTokenSummary | null>(null);

  const activeTokens = tokens.filter((t) => !t.revokedAt);
  const revokedTokens = tokens.filter((t) => t.revokedAt);

  return (
    <div className="grid gap-5">
      <CreateTokenForm onCreated={(token) => setNewToken(token)} />

      {newToken && (
        <div className="grid gap-3">
          <TokenReveal token={newToken} />
          <button
            className="w-fit text-[13px] text-[#8b938c] transition hover:text-[#5c655e]"
            onClick={() => setNewToken(null)}
            type="button"
          >
            Done — I&apos;ve saved this token
          </button>
        </div>
      )}

      <div className="rounded-[1.5rem] border border-[#d8ddd6] bg-white">
        <div className="border-b border-[#e9ece7] px-4 py-4 md:px-5">
          <p className="text-[14.5px] font-semibold text-[#1d2823]">Active tokens</p>
          <p className="mt-0.5 text-[13px] text-[#5c655e]">
            Revoke any token you no longer use. Revocation takes effect immediately.
          </p>
        </div>

        {activeTokens.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[14px] font-semibold text-[#1d2823]">No active tokens</p>
            <p className="mt-1 text-[13px] text-[#8b938c]">
              Create a token above to start using the Kontax REST API.
            </p>
          </div>
        ) : (
          <div>
            {activeTokens.map((token, i) => (
              <div
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 md:px-5 ${
                  i > 0 ? "border-t border-[#f0f3ef]" : ""
                }`}
                key={token.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#1d2823]">{token.name}</span>
                    <ScopeBadge scope={token.scope} />
                  </div>
                  <p className="mt-0.5 font-mono text-[12px] text-[#8b938c]">
                    {token.tokenPrefix}…
                  </p>
                </div>

                <div className="hidden shrink-0 text-right md:block">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8b938c]">
                    Last used
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#5c655e]">
                    {formatRelativeDate(token.lastUsedAt)}
                  </p>
                </div>

                <div className="hidden shrink-0 text-right md:block">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8b938c]">
                    This month
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#5c655e]">
                    {token.requestCountThisMonth.toLocaleString()} /{" "}
                    {token.scope === "READ_ONLY" ? "1,000" : "200"} /hr
                  </p>
                </div>

                <button
                  className="shrink-0 rounded-[1.1rem] border border-[#ecd0c7] px-3 py-1.5 text-[13px] font-semibold text-[#9a3a23] transition hover:border-[#dcae9f] hover:bg-[#f7e9e4]"
                  onClick={() => setConfirmRevoke(token)}
                  type="button"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {revokedTokens.length > 0 && (
        <div className="rounded-[1.5rem] border border-[#d8ddd6] bg-white">
          <div className="border-b border-[#e9ece7] px-4 py-4 md:px-5">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">
              Revoked tokens
            </p>
          </div>
          {revokedTokens.map((token, i) => (
            <div
              className={`flex flex-wrap items-center gap-3 px-4 py-3 opacity-50 md:px-5 ${
                i > 0 ? "border-t border-[#f0f3ef]" : ""
              }`}
              key={token.id}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#1d2823] line-through">{token.name}</span>
                  <ScopeBadge scope={token.scope} />
                </div>
                <p className="mt-0.5 text-[12px] text-[#8b938c]">
                  Revoked {formatRelativeDate(token.revokedAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmRevoke && (
        <RevokeModal
          token={confirmRevoke}
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={() => setConfirmRevoke(null)}
        />
      )}
    </div>
  );
}
