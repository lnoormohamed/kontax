import { auth } from "~/server/auth";
import { EndImpersonationButton } from "./impersonation-banner-client";

// P21-07: pinned full-width banner shown above the normal app while an admin is
// impersonating a user. Rendered in the root layout so it appears everywhere.
// Returns null for everyone except an active impersonation session.
export async function ImpersonationBanner() {
  const session = await auth();
  if (!session?.impersonatedBy) return null;
  const email = session.user?.email ?? "user";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        background: "#1e3a5f",
        color: "#fff",
        fontSize: 13.5,
        fontFamily: "var(--font-sans, system-ui), sans-serif",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
        <span>
          Viewing as <strong style={{ fontWeight: 600 }}>{email}</strong>{" "}
          <span style={{ color: "rgba(255,255,255,0.65)" }}>(read-only)</span>
        </span>
      </span>
      <EndImpersonationButton />
    </div>
  );
}
