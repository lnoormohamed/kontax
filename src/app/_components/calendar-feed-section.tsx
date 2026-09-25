"use client";

import { useState, useTransition } from "react";

import { ensureCalTokenAction, regenerateCalTokenAction } from "~/app/actions/notifications";

/**
 * P22-11: calendar-feed token management. Generate the subscribable .ics URL,
 * copy it, or regenerate (revoking the old token). Lives in /settings/notifications.
 *
 * P48-18: `initialUnavailable` means a token exists but its encrypted display
 * copy could not be decrypted (e.g. the key was retired) — the old URL may
 * still work for existing subscribers, but it can't be shown, so the only
 * offer is "Regenerate link".
 */
export function CalendarFeedSection({
  baseUrl,
  initialToken,
  initialUnavailable = false,
}: {
  baseUrl: string;
  initialToken: string | null;
  initialUnavailable?: boolean;
}) {
  const [token, setToken] = useState(initialToken);
  const [unavailable, setUnavailable] = useState(!initialToken && initialUnavailable);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const url = token ? `${baseUrl}/api/calendar/birthdays.ics?calToken=${token}` : "";

  const generate = () =>
    startTransition(async () => {
      setError(null);
      try {
        setToken(await ensureCalTokenAction());
      } catch {
        // The only expected failure is an existing token that can't be shown.
        setUnavailable(true);
      }
    });

  const regenerate = () =>
    startTransition(async () => {
      setError(null);
      try {
        setToken(await regenerateCalTokenAction());
        setUnavailable(false);
        setCopied(false);
      } catch {
        setError("Couldn't regenerate the calendar link. Try again.");
      }
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — user can select the field manually */
    }
  };

  return (
    <div>
      <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[#8b938c]">
        Calendar feed
      </p>
      <section className="rounded-2xl border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <p className="text-[13.5px] leading-6 text-[#5c655e]">
          Subscribe to your contacts&apos; birthdays, anniversaries, lunar birthdays, and other
          saved dates in Google Calendar, Apple Calendar, or Outlook. The link contains a private
          token — anyone with it can see your contacts&apos; date feed, so keep it to yourself.
        </p>

        {token ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-lg border border-[#d8ddd6] bg-[#f6f7f4] px-3 text-[13px] text-[#1d2823] outline-none"
                onFocus={(e) => e.target.select()}
                readOnly
                value={url}
              />
              <button
                className="h-10 rounded-lg bg-[#17352e] px-4 text-[13px] font-semibold text-white transition hover:bg-[#20443b]"
                onClick={copy}
                type="button"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              className="mt-3 text-[13px] font-medium text-[#b5472f] hover:underline disabled:opacity-50"
              disabled={pending}
              onClick={regenerate}
              type="button"
            >
              {pending ? "Regenerating…" : "Regenerate link (revokes the old one)"}
            </button>
          </>
        ) : unavailable ? (
          <>
            <p className="mt-4 rounded-lg border border-[#ecd9cf] bg-[#fbf4f0] px-3 py-2.5 text-[13px] leading-5 text-[#7a3a26]">
              Your calendar link can&apos;t be displayed any more. Existing subscriptions may keep
              working, but to copy the link again you need to regenerate it — this revokes the old
              one.
            </p>
            <button
              className="mt-3 h-10 rounded-lg bg-[#17352e] px-4 text-[13px] font-semibold text-white transition hover:bg-[#20443b] disabled:opacity-50"
              disabled={pending}
              onClick={regenerate}
              type="button"
            >
              {pending ? "Regenerating…" : "Regenerate link"}
            </button>
          </>
        ) : (
          <button
            className="mt-4 h-10 rounded-lg bg-[#17352e] px-4 text-[13px] font-semibold text-white transition hover:bg-[#20443b] disabled:opacity-50"
            disabled={pending}
            onClick={generate}
            type="button"
          >
            {pending ? "Generating…" : "Generate calendar URL"}
          </button>
        )}
        {error ? (
          <p className="mt-2 text-[12.5px] text-[#b5472f]" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
