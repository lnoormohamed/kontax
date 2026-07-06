import { SettingsPageHead } from "~/app/_components/settings-ui";
import { redirectToLogin } from "~/server/auth/require-page-auth";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getCardAnalytics } from "~/server/public-card/analytics";
import { type PublicCardFieldConfig, resolveCardFields } from "~/server/public-card/types";
import { CardSettingsClient } from "./card-settings-client";
import { CardShareTools } from "./card-share-tools";
import { UsernameSection } from "../username-section";

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

function formatLatestActivity(value: Date | null) {
  if (!value) return "No recorded views yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function CardSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings/account/card");

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
        sub="Your public handle and which fields are visible at getkontax.com/u/…"
      />

      {/* P46-14 / DB07: the username IS the card handle — it lives here now
          (moved from Account, which keeps a link row). */}
      <section className="mb-4 rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] md:p-6">
        <UsernameSection initialUsername={user.username ?? null} />
      </section>

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
            <StatTile value={analytics.views7d} label="Views (7 d)" />
            <div style={{ width: 1, background: "#e9ece7", flexShrink: 0 }} />
            <StatTile value={analytics.views30d} label="Views (30 d)" />
            <div style={{ width: 1, background: "#e9ece7", flexShrink: 0 }} />
            <StatTile value={analytics.ctaClicks} label="Add to Kontax" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-[#e9ece7] bg-[#fbfcf9] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">
                Views over time
              </p>
              <div className="mt-3 flex h-[120px] items-end gap-1.5">
                {analytics.dailyViews30d.map((point) => {
                  const max = Math.max(...analytics.dailyViews30d.map((item) => item.count), 1);
                  const barHeight = `${Math.max((point.count / max) * 100, point.count > 0 ? 10 : 4)}%`;
                  return (
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" key={point.date}>
                      <div
                        className="w-full rounded-full bg-[#4158f4]"
                        style={{ height: barHeight, opacity: point.count > 0 ? 1 : 0.16 }}
                        title={`${point.date}: ${point.count} view${point.count === 1 ? "" : "s"}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-[#8b938c]">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-[#e9ece7] bg-[#fbfcf9] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">
                  Engagement
                </p>
                <p className="mt-3 text-[14px] font-semibold text-[#1d2823]">
                  {analytics.topCta
                    ? `${analytics.topCta.label} is the top tracked action`
                    : "No tracked CTA clicks yet"}
                </p>
                <p className="mt-1 text-[13px] text-[#5c655e]">
                  Latest activity: {formatLatestActivity(analytics.latestActivityAt)}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e9ece7] bg-[#fbfcf9] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">
                  Top sources
                </p>
                {analytics.topSources.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {analytics.topSources.map((source) => (
                      <div className="flex items-center justify-between gap-3 text-[13px]" key={source.label}>
                        <span className="min-w-0 truncate text-[#5c655e]">{source.label}</span>
                        <span className="font-semibold text-[#1d2823]">
                          {source.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] text-[#8b938c]">No recent source data yet.</p>
                )}
              </div>
            </div>
          </div>

          <p style={{ fontSize: 11, color: "#8b938c", marginTop: 10 }}>
            View history is kept for 90 days. Bot traffic is excluded. Today the only tracked CTA is Add to Kontax, so the analytics stay honest about what they can and cannot measure.
          </p>
        </section>
      )}
    </>
  );
}
