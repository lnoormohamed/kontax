"use client";

// P43-01 — Interface preferences card. Extends the shipped Display section
// (same card shell, same Radio, same optimistic save semantics) with two
// device-scoped knobs: "Labels on rows" (desktop) and "Animations &
// transitions" (both). Copy is framed as visual quiet, never speed.

import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";

import { updatePreferencesAction } from "~/app/actions/preferences";
import { applyMotionPreference } from "~/app/_components/motion-preference";
import { LabelChip, LabelDot } from "~/app/_components/label-chip";
import { useIsDesktopHover } from "~/lib/interface-preferences";
import type { UserPreferences } from "~/lib/preferences-shared";

type RowLabels = NonNullable<UserPreferences["rowLabels"]>;
type Motion = NonNullable<UserPreferences["motion"]>;

const ROW_LABEL_TITLES: Record<RowLabels, string> = {
  hover: "On hover",
  always: "Always",
  off: "Off",
};

const MOTION_TITLES: Record<Motion, string> = {
  system: "Match my device",
  on: "On",
  off: "Off",
};

// Sample chips for the live-preview row — palette colours so chips render tinted.
const PREVIEW_LABELS: { name: string; col: string }[] = [
  { name: "Work", col: "#7aa37f" },
  { name: "Family", col: "#6fa3a0" },
  { name: "VIP", col: "#c9a86a" },
];

// ── small pieces ──────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 14,
        height: 14,
        border: "2px solid rgba(92,101,94,.3)",
        borderTopColor: "#5c655e",
        animation: "st-spin 0.7s linear infinite",
      }}
    />
  );
}

function DeviceBadge({ both }: { both?: boolean }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-md px-2 text-[10px] font-bold tracking-[0.04em] ${
        both ? "bg-[#f2f4f0] text-[#5c655e]" : "bg-[#edf0fe] text-[#4158f4]"
      }`}
    >
      {both ? "BOTH" : "DESKTOP"}
    </span>
  );
}

function GroupHeader({ title, both }: { title: string; both?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[13.5px] font-semibold text-[#1d2823]">{title}</span>
      <DeviceBadge both={both} />
    </div>
  );
}

function Radio({
  name,
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 py-2.5 ${
        disabled ? "cursor-default opacity-55" : "cursor-pointer"
      }`}
    >
      <span className="relative mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center">
        <input
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          name={name}
          onChange={disabled ? undefined : onChange}
          type="radio"
        />
        <span className="h-[18px] w-[18px] rounded-full border-[1.8px] border-[#aeb4ac] transition-colors peer-checked:border-[#17352e]" />
        <span className="absolute h-[9px] w-[9px] scale-0 rounded-full bg-[#17352e] transition-transform peer-checked:scale-100" />
      </span>
      <span>
        <span className="block text-[14px] font-medium text-[#1d2823]">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-[#8b938c]">{hint}</span>}
      </span>
    </label>
  );
}

// Inline example row that reflects the chosen "Labels on rows" value.
function LivePreviewRow({ mode }: { mode: RowLabels }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[11px] border border-[#e9ece7] bg-white">
      <div className="flex items-center justify-between bg-[#f2f4f0] px-3.5 py-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8b938c]">
          Live preview
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1c6b48]">
          <span className="h-[7px] w-[7px] rounded-full bg-[#1f8a5b]" />
          updates as you choose
        </span>
      </div>
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#e6ece4] text-[12px] font-semibold text-[#3f6b53]">
          DC
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-[#1d2823]">Daniel Cho</span>
          {mode === "hover" && (
            <span className="inline-flex items-center gap-[7px]">
              {PREVIEW_LABELS.map((l) => (
                <LabelDot key={l.name} col={l.col} size={7} />
              ))}
            </span>
          )}
          {mode === "always" && (
            <span className="inline-flex items-center gap-1.5">
              {PREVIEW_LABELS.map((l) => (
                <LabelChip key={l.name} name={l.name} col={l.col} sz="sm" />
              ))}
            </span>
          )}
          {mode === "off" && (
            <span className="text-[12.5px] text-[#aeb4ac]">No labels on rows</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function InterfacePreferencesSection({
  initialPreferences,
}: {
  initialPreferences: Required<UserPreferences>;
}) {
  const { update } = useSession();
  const [rowLabels, setRowLabels] = useState<RowLabels>(initialPreferences.rowLabels);
  const [motion, setMotion] = useState<Motion>(initialPreferences.motion);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  // On error we snap back and explain, quoting the value we reverted to.
  const [revertNote, setRevertNote] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Labels on rows is desktop-only. Assume interactive until we know this is a
  // touch device (avoids a disabled flash on desktop, the common case).
  const isDesktopHover = useIsDesktopHover();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const labelsDisabled = mounted && !isDesktopHover;

  const saveRowLabels = (value: RowLabels) => {
    if (labelsDisabled || value === rowLabels) return;
    const previous = rowLabels;
    setRowLabels(value); // optimistic — live preview + real rows update
    setRevertNote(null);
    setStatus("saving");
    startTransition(async () => {
      const result = await updatePreferencesAction({ rowLabels: value });
      if (result.ok) {
        await update();
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        setRowLabels(previous);
        setStatus("idle");
        setRevertNote(ROW_LABEL_TITLES[previous]);
      }
    });
  };

  const saveMotion = (value: Motion) => {
    if (value === motion) return;
    const previous = motion;
    setMotion(value);
    applyMotionPreference(value); // whole-app effect, immediately
    setRevertNote(null);
    setStatus("saving");
    startTransition(async () => {
      const result = await updatePreferencesAction({ motion: value });
      if (result.ok) {
        await update();
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        setMotion(previous);
        applyMotionPreference(previous);
        setStatus("idle");
        setRevertNote(MOTION_TITLES[previous]);
      }
    });
  };

  return (
    <section className="rounded-2xl border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] md:p-6">
      <h2 className="text-[15px] font-semibold text-[#1d2823]">Interface</h2>
      <p className="mt-1.5 text-[14px] leading-6 text-[#5c655e]">
        Control how much each contact row shows, and how much moves. These settings only affect your
        account.
      </p>

      <div className="mt-5 space-y-6">
        {/* Labels on rows — desktop only */}
        <div>
          <GroupHeader title="Labels on rows" />
          <p className="mb-1 mt-1 text-[13px] text-[#5c655e]">
            How label chips appear on each row in the contacts list.
          </p>
          <div className="flex flex-col">
            <Radio
              checked={rowLabels === "hover"}
              disabled={labelsDisabled}
              hint="Rows stay lean — labels show as dots, full chips appear when you point at a row."
              label="On hover"
              name="rowLabels"
              onChange={() => saveRowLabels("hover")}
            />
            <Radio
              checked={rowLabels === "always"}
              disabled={labelsDisabled}
              hint="Show the full label chips on every row."
              label="Always"
              name="rowLabels"
              onChange={() => saveRowLabels("always")}
            />
            <Radio
              checked={rowLabels === "off"}
              disabled={labelsDisabled}
              hint="Don't show labels on rows. They're still on each contact's page."
              label="Off"
              name="rowLabels"
              onChange={() => saveRowLabels("off")}
            />
          </div>

          {labelsDisabled ? (
            <div className="mt-2 flex items-center gap-2 text-[12.5px] text-[#8b938c]">
              <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
                <rect height="18" rx="2" width="12" x="6" y="3" />
                <path d="M11 18h2" />
              </svg>
              <span>Applies on desktop — this device has no hover.</span>
            </div>
          ) : (
            <LivePreviewRow mode={rowLabels} />
          )}
        </div>

        {/* Animations & transitions — both */}
        <div className="border-t border-[#f2f4f0] pt-5">
          <GroupHeader title="Animations & transitions" both />
          <p className="mb-1 mt-1 text-[13px] text-[#5c655e]">
            Movement when things open, close, and change.
          </p>
          <div className="flex flex-col">
            <Radio
              checked={motion === "system"}
              hint="Follow your system's reduced-motion setting. Recommended."
              label="Match my device"
              name="motion"
              onChange={() => saveMotion("system")}
            />
            <Radio
              checked={motion === "on"}
              hint="Always animate, even if your device asks for reduced motion."
              label="On"
              name="motion"
              onChange={() => saveMotion("on")}
            />
            <Radio
              checked={motion === "off"}
              hint="Turn off animations and transitions across Kontax."
              label="Off"
              name="motion"
              onChange={() => saveMotion("off")}
            />
          </div>
        </div>

        {/* Cross-link to Display density */}
        <div className="flex items-center gap-2 border-t border-[#f2f4f0] pt-4 text-[12.5px] text-[#5c655e]">
          <svg fill="none" height="15" stroke="#8b938c" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
            <path d="M3 12h18" />
            <path d="M3 6h18" />
            <path d="M3 18h18" />
          </svg>
          <span>
            Looking for row density? That&apos;s <b className="font-semibold text-[#1d2823]">Compact / Cozy</b>{" "}
            under Display preferences above.
          </span>
        </div>

        {/* Save affordance — optimistic, no bulk Save button */}
        <div className="min-h-[22px]">
          {status === "saving" && (
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#5c655e]">
              <Spinner /> Saving…
            </span>
          )}
          {status === "saved" && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#17352e]">
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="16">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          )}
          {revertNote && (
            <div className="flex items-start gap-2.5 rounded-xl border border-[#e8d8b0] bg-[#f6edd9] px-3.5 py-3 text-[13px] leading-[1.45] text-[#8a6a2a]">
              <svg className="mt-0.5 flex-none" fill="none" height="16" stroke="#8a6a1e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
                <path d="M12 3l9 16H3z" />
                <path d="M12 10v4" />
                <path d="M12 17h.01" />
              </svg>
              <div>
                <b className="font-bold text-[#7a5a1a]">Couldn&apos;t save that change.</b> We put it back to
                “{revertNote}”. Check your connection and try again.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
