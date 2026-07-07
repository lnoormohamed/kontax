"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";

import { updatePreferencesAction } from "~/app/actions/preferences";
import { DEFAULT_PREFERENCES, type UserPreferences } from "~/lib/preferences-shared";

// ── helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 15,
        height: 15,
        border: "2px solid rgba(255,255,255,.35)",
        borderTopColor: "#fff",
        animation: "st-spin 0.7s linear infinite",
      }}
    />
  );
}

function Radio({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2.5">
      <span className="relative mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center">
        <input
          checked={checked}
          className="peer sr-only"
          name={name}
          onChange={onChange}
          type="radio"
          value={value}
        />
        <span className="h-[18px] w-[18px] rounded-full border-[1.8px] border-[#aeb4ac] transition-colors peer-checked:border-[#17352e]" />
        <span className="absolute h-[9px] w-[9px] scale-0 rounded-full bg-[#17352e] transition-transform peer-checked:scale-100" />
      </span>
      <span>
        <span className="block text-[14px] font-medium text-[#1d2823]">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] text-[#8b938c]">{hint}</span>}
      </span>
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[13.5px] font-semibold text-[#1d2823]">{children}</p>
  );
}

function formatPreviewDate(fmt: NonNullable<UserPreferences["dateFormat"]>): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const monthNum = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  if (fmt === "DD MMM YYYY") return `${day} ${month} ${year}`;
  if (fmt === "MM/DD/YYYY") return `${monthNum}/${day}/${year}`;
  return `${year}-${monthNum}-${day}`;
}

// ── main component ────────────────────────────────────────────────────────────

export function DisplayPreferencesSection({
  initialPreferences,
}: {
  initialPreferences: Required<UserPreferences>;
}) {
  const { update } = useSession();
  const [prefs, setPrefs] = useState<Required<UserPreferences>>(initialPreferences);
  const [savedState, setSavedState] = useState<"idle" | "saved" | "reset">("idle");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const setPref = <K extends keyof UserPreferences>(key: K, value: Required<UserPreferences>[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setSavedState("idle");
    setError("");
  };

  const save = (patch: Partial<UserPreferences>, successState: "saved" | "reset" = "saved") => {
    setError("");
    setSavedState("idle");
    startTransition(async () => {
      const result = await updatePreferencesAction(patch);
      if (result.ok) {
        if (successState === "reset") setPrefs(DEFAULT_PREFERENCES);
        setSavedState(successState);
        await update();
        setTimeout(() => setSavedState("idle"), 2500);
      } else {
        setError("Failed to save preferences. Try again.");
      }
    });
  };

  const handleSave = () => save(prefs);
  const handleReset = () => save(DEFAULT_PREFERENCES, "reset");

  return (
    <section className="rounded-2xl border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] md:p-6">
      <h2 className="text-[15px] font-semibold text-[#1d2823]">Display preferences</h2>
      <p className="mt-1.5 text-[14px] leading-6 text-[#5c655e]">
        Customise how Kontax looks and behaves. These settings only affect your account.
      </p>

      <form
        className="mt-5 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        {/* P34B-03 — Default contact sort */}
        <div>
          <FieldLabel>Default contact sort</FieldLabel>
          <p className="mb-2 text-[13px] text-[#5c655e]">
            How the contacts list is ordered when you first open it.
          </p>
          <div className="flex flex-col">
            <Radio
              checked={prefs.defaultSort === "name"}
              hint="Alphabetical order from A to Z."
              label="Name A–Z"
              name="defaultSort"
              onChange={() => setPref("defaultSort", "name")}
              value="name"
            />
            <Radio
              checked={prefs.defaultSort === "updated"}
              hint="Most recently modified contact appears first."
              label="Last modified"
              name="defaultSort"
              onChange={() => setPref("defaultSort", "updated")}
              value="updated"
            />
          </div>
        </div>

        {/* P34B-04 / P47 — Default view mode, per device density */}
        <div className="border-t border-[#f2f4f0] pt-5">
          <FieldLabel>Default view mode</FieldLabel>
          <p className="mb-3 text-[13px] text-[#5c655e]">
            Contact list density. Desktop and mobile can differ — on desktop
            &ldquo;compact&rdquo; is a columns grid; on mobile it&rsquo;s a
            single-line row.
          </p>

          {/* Desktop */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-14 shrink-0 text-[13px] text-[#8b938c]">Desktop</span>
            <div
              className="inline-flex overflow-hidden rounded-xl border border-[#d8ddd6] bg-[#f6f7f4] p-0.5"
              role="group"
            >
              {(["compact", "cozy"] as const).map((mode) => (
                <button
                  aria-pressed={prefs.defaultViewMode === mode}
                  className={`rounded-[10px] px-5 py-2 text-[13.5px] font-medium capitalize transition ${
                    prefs.defaultViewMode === mode
                      ? "bg-white text-[#1d2823] shadow-sm"
                      : "text-[#5c655e] hover:text-[#1d2823]"
                  }`}
                  key={mode}
                  onClick={() => setPref("defaultViewMode", mode)}
                  type="button"
                >
                  {mode === "compact" ? "Compact" : "Cozy"}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile */}
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <span className="w-14 shrink-0 text-[13px] text-[#8b938c]">Mobile</span>
            <div
              className="inline-flex overflow-hidden rounded-xl border border-[#d8ddd6] bg-[#f6f7f4] p-0.5"
              role="group"
            >
              {(["compact", "cozy"] as const).map((mode) => (
                <button
                  aria-pressed={prefs.mobileViewMode === mode}
                  className={`rounded-[10px] px-5 py-2 text-[13.5px] font-medium capitalize transition ${
                    prefs.mobileViewMode === mode
                      ? "bg-white text-[#1d2823] shadow-sm"
                      : "text-[#5c655e] hover:text-[#1d2823]"
                  }`}
                  key={mode}
                  onClick={() => setPref("mobileViewMode", mode)}
                  type="button"
                >
                  {mode === "compact" ? "Compact" : "Cozy"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* P34B-05 — Date display format */}
        {/* DISPLAY ONLY — never pass this format to sync, import, or export code.
            vCard BDAY and CardDAV always use ISO 8601 (RFC 6350). */}
        <div className="border-t border-[#f2f4f0] pt-5">
          <FieldLabel>Date display format</FieldLabel>
          <p className="mb-2 text-[13px] text-[#5c655e]">
            How calendar dates are shown in the app. Never affects sync or export.
          </p>
          <select
            className="h-9 rounded-lg border border-[#d8ddd6] bg-white px-2.5 text-[16px] text-[#1d2823] outline-none focus:border-[#4158f4] md:text-[13px]"
            onChange={(e) =>
              setPref("dateFormat", e.target.value as Required<UserPreferences>["dateFormat"])
            }
            value={prefs.dateFormat}
          >
            <option value="DD MMM YYYY">14 Jun 2026 (Day Month Year)</option>
            <option value="MM/DD/YYYY">06/14/2026 (Month/Day/Year)</option>
            <option value="YYYY-MM-DD">2026-06-14 (ISO)</option>
          </select>
          <p className="mt-2 text-[12.5px] text-[#8b938c]">
            Preview: {formatPreviewDate(prefs.dateFormat)}
          </p>
        </div>

        {/* P34B-06 — Name display order */}
        <div className="border-t border-[#f2f4f0] pt-5">
          <FieldLabel>Contact name display</FieldLabel>
          <p className="mb-2 text-[13px] text-[#5c655e]">
            Applies when a contact has both a first and last name.
          </p>
          <div className="flex flex-col">
            <Radio
              checked={prefs.nameDisplayOrder === "first-last"}
              hint="e.g. John Smith"
              label="First Last"
              name="nameDisplayOrder"
              onChange={() => setPref("nameDisplayOrder", "first-last")}
              value="first-last"
            />
            <Radio
              checked={prefs.nameDisplayOrder === "last-first"}
              hint="e.g. Smith, John"
              label="Last, First"
              name="nameDisplayOrder"
              onChange={() => setPref("nameDisplayOrder", "last-first")}
              value="last-first"
            />
          </div>
        </div>

        {/* P34B-07 — Week starts on */}
        <div className="border-t border-[#f2f4f0] pt-5">
          <FieldLabel>Week starts on</FieldLabel>
          <p className="mb-2 text-[13px] text-[#5c655e]">
            First day of the week in calendar date pickers.
          </p>
          <div className="flex flex-col">
            <Radio
              checked={prefs.weekStartsOn === 1}
              label="Monday"
              name="weekStartsOn"
              onChange={() => setPref("weekStartsOn", 1)}
              value="1"
            />
            <Radio
              checked={prefs.weekStartsOn === 0}
              label="Sunday"
              name="weekStartsOn"
              onChange={() => setPref("weekStartsOn", 0)}
              value="0"
            />
          </div>
        </div>

        {/* Save / Reset */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[#e9ece7] pt-5">
          <button
            className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
            disabled={isPending}
            type="submit"
          >
            {isPending ? <><Spinner /> Saving…</> : "Save preferences"}
          </button>

          <button
            className="text-[13.5px] font-medium text-[#8b938c] transition hover:text-[#5c655e] disabled:opacity-50"
            disabled={isPending}
            onClick={handleReset}
            type="button"
          >
            Reset to defaults
          </button>

          {error && <p className="text-[12.5px] text-[#9a3a23]">{error}</p>}

          {savedState === "saved" && !error && (
            <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#17352e]">
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="16">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Preferences saved
            </span>
          )}

          {savedState === "reset" && !error && (
            <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#17352e]">
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="16">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Preferences reset to defaults
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
