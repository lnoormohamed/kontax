import Link from "next/link";

import { signOutAction } from "~/app/actions/auth";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { SETTINGS_NAV } from "~/lib/settings-nav";

// P46-12 / DB07 §5b — the mobile settings index: the shared SETTINGS_NAV
// config rendered as a card list. Account identity card stays pinned on top;
// a sign-out shortcut row sits at the bottom (sign-out's *home* is Security —
// this is the common mobile shortcut, per the converged design).

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

function IndexRow({
  icon,
  label,
  sub,
  href,
  gated,
  last,
}: {
  icon: string;
  label: string;
  sub: string;
  href: string;
  gated?: boolean;
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
        opacity: gated ? 0.72 : 1,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "#f2f4f0",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <WorkspaceIcon name={icon} size={17} className="text-[#5c655e]" strokeWidth={1.7} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "#1d2823" }}>{label}</span>
          {gated ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "#4158f4",
                background: "#edf0fe",
                borderRadius: 4,
                padding: "1px 6px",
                letterSpacing: "0.04em",
              }}
            >
              PRO
            </span>
          ) : null}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 12.5,
            color: "#8b938c",
            marginTop: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </span>
      </span>
      <WorkspaceIcon name="chevronRight" size={17} className="shrink-0 text-[#d8ddd6]" strokeWidth={1.7} />
    </Link>
  );
}

export function MobileSettingsNav({
  name,
  email,
  plan,
}: {
  name: string;
  email: string;
  plan: string;
}) {
  const getInitials = (s: string) =>
    s.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="lg:hidden" style={{ paddingBottom: 8 }}>
      {/* Account identity card — pinned on top of the index (DB07 §5b) */}
      <GroupCard>
        <Link
          href="/settings/account"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            padding: "14px 16px",
            textDecoration: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
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
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2823", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </div>
            <div style={{ fontSize: 13, color: "#8b938c", marginTop: 1 }}>
              {email} · {plan}
            </div>
          </div>
          <WorkspaceIcon name="chevronRight" size={18} className="shrink-0 text-[#d8ddd6]" strokeWidth={1.7} />
        </Link>
      </GroupCard>

      {/* The eight groups — one config, same set as the desktop sidebar */}
      <GroupCard>
        {SETTINGS_NAV.map((entry, i) => (
          <IndexRow
            key={entry.id}
            icon={entry.icon}
            label={entry.label}
            sub={entry.sub}
            href={entry.route}
            gated={entry.gate === "pro"}
            last={i === SETTINGS_NAV.length - 1}
          />
        ))}
      </GroupCard>

      {/* Sign-out shortcut — home is Security; this is the index shortcut row */}
      <GroupCard>
        <form action={signOutAction}>
          <button
            type="submit"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              width: "100%",
              padding: "13px 16px",
              border: "none",
              background: "#fff",
              cursor: "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "rgba(181,71,47,0.10)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <WorkspaceIcon name="close" size={15} className="text-[#b5472f]" strokeWidth={1.9} />
            </span>
            <span style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: 500, color: "#b5472f" }}>
              Sign out
            </span>
          </button>
        </form>
      </GroupCard>

      <div style={{ textAlign: "center", fontSize: 12, color: "#aeb4ac", padding: "4px 0 16px" }}>
        Kontax · getkontax.com
      </div>
    </div>
  );
}
