import { SettingsPageHead } from "~/app/_components/settings-ui";
import { redirectToLogin } from "~/server/auth/require-page-auth";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getCardAnalytics } from "~/server/public-card/analytics";
import { type PublicCardFieldConfig, resolveCardFields } from "~/server/public-card/types";
import { CardSettingsClient } from "./card-settings-client";
import { CardShareTools } from "./card-share-tools";

export const metadata = { title: "Public card" };

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "12px 8px" }}>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#1d2823", letterSpacing: "-0.02em" }}>
        {value.toLocaleString()}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8b938c" }}>{label}</p>
    </div>
  );
}

export default async function CardSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings/profile/card");

  const [user, analytics] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { username: true, publicCardFields: true, name: true },
    }),
    getCardAnalytics(session.user.id).catch(() => null),
  ]);

  const fields = resolveCardFields(user.publicCardFields as PublicCardFieldConfig | null);

  // Derive display name and profile details for email signature / share tools
  const displayName = user.name ?? session.user.name ?? "Your name";

  return (
    <>
      <SettingsPageHead
        title="Public card"
        sub="Choose which fields are visible when someone views your card at kontax.app/u/…"
      />

      {/* Visibility controls */}
      <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] md:p-6">
        <CardSettingsClient username={user.username ?? null} initialFields={fields} />
      </section>

      {/* Share tools — only shown when username exists */}
      {user.username && !fields.hidden && (
        <section className="mt-4 rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] md:p-6">
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#8b938c",
              margin: "0 0 12px",
            }}
          >
            Share your card
          </p>
          <CardShareTools
            username={user.username}
            displayName={displayName}
          />
        </section>
      )}

      {/* Analytics — shown when username exists */}
      {user.username && analytics && (
        <section className="mt-4 rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] md:p-6">
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#8b938c",
              margin: "0 0 4px",
            }}
          >
            Card analytics
          </p>
          <div
            style={{
              display: "flex",
              gap: 0,
              marginTop: 8,
              borderRadius: 12,
              border: "1px solid #e9ece7",
              overflow: "hidden",
            }}
          >
            <StatTile value={analytics.totalViews} label="Total views" />
            <div style={{ width: 1, background: "#e9ece7", flexShrink: 0 }} />
            <StatTile value={analytics.views30d} label="Views (30 d)" />
            <div style={{ width: 1, background: "#e9ece7", flexShrink: 0 }} />
            <StatTile value={analytics.ctaClicks} label="Add to Kontax" />
          </div>
          <p style={{ fontSize: 11, color: "#8b938c", marginTop: 10 }}>
            View history is kept for 90 days. Bot traffic is excluded.
          </p>
        </section>
      )}
    </>
  );
}
