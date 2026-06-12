import type React from "react";

/** Shared presentational pieces for the settings section pages (locked tokens). */

export function SettingsPageHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Settings</p>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-0.01em] text-[#1d2823]">{title}</h1>
        {sub ? <p className="mt-1.5 max-w-[560px] text-[14px] leading-6 text-[#5c655e]">{sub}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function SettingsCard({
  children,
  className,
  lazy,
}: {
  children: React.ReactNode;
  className?: string;
  lazy?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${className ?? ""}`}
      style={lazy ? { contentVisibility: "auto", containIntrinsicSize: "0 auto" } : undefined}
    >
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 mb-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#17352e]">
      {children}
    </div>
  );
}

/** Section header with inline hairline divider — matches st-account.jsx StSecLabel */
export function StSecLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[14px] px-0.5 pb-0.5 pt-[14px]">
      <span className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.08em] text-[#8b938c]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[#d8ddd6]" />
    </div>
  );
}

export function UsageStat({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const unlimited = limit === null;
  const pct = limit === null || limit === 0 ? 0 : Math.min(Math.round((used / limit) * 100), 100);
  const over = limit !== null && used >= limit;
  const near = limit !== null && used >= limit * 0.8;
  const barColor = over ? "#b5472f" : near ? "#bf8526" : "#17352e";
  return (
    <div className="rounded-xl border border-[#d8ddd6] bg-[#f6f7f4] p-4">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-[#3a4540]">{label}</span>
        <span className="text-[#5c655e] tabular-nums">
          {used} / {limit ?? "Unlimited"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e9ece7]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: unlimited ? "100%" : `${pct}%`, background: unlimited ? "#d8ddd6" : barColor }}
        />
      </div>
    </div>
  );
}

const LIFECYCLE_TONES: Record<string, string> = {
  active: "border-[#bcdac9] bg-[#e7efe9] text-[#17352e]",
  grace: "border-[#e6d3a3] bg-[#f6edd9] text-[#7c5511]",
  danger: "border-[#dcae9f] bg-[#f3e1da] text-[#9a3a23]",
};

export function lifecycleToneClass(label: string) {
  const l = label.toLowerCase();
  if (l.includes("active") || l.includes("trial")) return LIFECYCLE_TONES.active;
  if (l.includes("grace")) return LIFECYCLE_TONES.grace;
  return LIFECYCLE_TONES.danger;
}

export function LifecycleBadge({ label }: { label: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${lifecycleToneClass(label)}`}
    >
      {label}
    </span>
  );
}
