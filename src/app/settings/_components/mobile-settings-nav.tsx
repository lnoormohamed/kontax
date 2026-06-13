import Link from "next/link";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

function NavRow({
  icon,
  label,
  detail,
  detailColor,
  href,
  danger,
  last,
}: {
  icon: string;
  label: string;
  detail?: string;
  detailColor?: string;
  href: string;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "13px 16px",
        borderBottom: last ? "none" : "1px solid #f2f4f0",
        textDecoration: "none",
        background: "#fff",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: danger ? "rgba(181,71,47,0.10)" : "#f2f4f0",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <WorkspaceIcon
          name={icon}
          size={17}
          className={danger ? "text-[#b5472f]" : "text-[#5c655e]"}
          strokeWidth={1.7}
        />
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: 500,
          color: danger ? "#b5472f" : "#1d2823",
          textAlign: "left",
        }}
      >
        {label}
      </span>
      {detail && (
        <span style={{ fontSize: 13, color: detailColor ?? "#8b938c", marginRight: 4 }}>{detail}</span>
      )}
      <WorkspaceIcon name="chevronRight" size={17} className="shrink-0 text-[#d8ddd6]" strokeWidth={1.7} />
    </Link>
  );
}

function GroupCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "0 0 16px",
        border: "1px solid #d8ddd6",
        borderRadius: 14,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// ── group entry detail ────────────────────────────────────────────────────────
// The "Family & teams" row is always shown (per P24B-DB15 §00). The trailing
// detail and colour reflect the user's current state so the entry carries the
// variance without needing a sub-screen.
type GroupEntryState =
  | { kind: "nogroup" }
  | { kind: "needsAttention" }
  | { kind: "family"; memberCount: number; limit: number }
  | { kind: "teams"; teamName: string; memberCount: number };

function groupEntryDetail(g: GroupEntryState): { text: string; color: string } {
  switch (g.kind) {
    case "nogroup":       return { text: "Set up",          color: "#17352e" };
    case "needsAttention":return { text: "Needs attention", color: "#bf8526" };
    case "family":        return { text: `${g.memberCount} member${g.memberCount === 1 ? "" : "s"}`, color: "#8b938c" };
    case "teams":         return { text: `${g.teamName} · ${g.memberCount}`,                         color: "#8b938c" };
  }
}

export function MobileSettingsNav({
  name,
  email,
  plan,
  syncActive,
  groupEntry,
}: {
  name: string;
  email: string;
  plan: string;
  syncActive: number;
  groupEntry: GroupEntryState;
}) {
  const getInitials = (s: string) =>
    s.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const groupHref =
    groupEntry.kind === "nogroup"
      ? "/settings#plan-billing"
      : groupEntry.kind === "teams"
      ? "/settings/teams"
      : "/settings/family";

  const { text: groupDetailText, color: groupDetailColor } = groupEntryDetail(groupEntry);

  return (
    <div className="md:hidden" style={{ paddingBottom: 8 }}>
      {/* Account card */}
      <GroupCard>
        <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 16px" }}>
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#17352e",
              color: "#dff0e7",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {getInitials(name)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2823", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </div>
            <div style={{ fontSize: 13, color: "#8b938c", marginTop: 1 }}>
              {email} · {plan}
            </div>
          </div>
        </div>
      </GroupCard>

      {/* Navigation sections */}
      <GroupCard>
        <NavRow icon="sync" label="Sync connections" detail={syncActive > 0 ? `${syncActive} active` : undefined} href="/sync" />
        <NavRow
          icon="users"
          label="Family & teams"
          detail={groupDetailText}
          href={groupHref}
          detailColor={groupDetailColor}
        />
        <NavRow icon="upload" label="Import & export" href="/import-export" />
        <NavRow icon="upload" label="Import presets" href="/settings/import-presets" />
        <NavRow icon="download" label="Export presets" href="/settings/export-presets" last />
      </GroupCard>

      <GroupCard>
        <NavRow icon="person" label="Profile" href="/settings/profile" />
        <NavRow icon="bell" label="Notifications" href="/settings/notifications" />
        <NavRow icon="phone" label="Devices & app passwords" href="/settings/devices" />
        <NavRow icon="emergency" label="Security" href="/settings/security" />
        <NavRow icon="briefcase" label="Plan & billing" href="/settings#plan-billing" last />
      </GroupCard>

      <div style={{ textAlign: "center", fontSize: 12, color: "#aeb4ac", padding: "4px 0 16px" }}>
        Kontax · kontax.app
      </div>
    </div>
  );
}
