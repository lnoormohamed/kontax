import "./_components/marketing.css";

import type { Metadata } from "next";
import { MarketingFooter } from "./_components/marketing-footer";
import { MarketingNav } from "./_components/marketing-nav";

export const metadata: Metadata = {
  // Marketing page titles already include "— Kontax"; suppress the root
  // layout's "%s · Kontax" template so we don't get double-suffixed titles.
  title: { template: "%s", default: "Kontax" },
  openGraph: {
    images: [{ url: "/api/og?page=homepage", width: 1200, height: 630, alt: "Kontax" }],
  },
  twitter: { card: "summary_large_image" },
};

// P38-10: no server-side session read here — the nav resolves it
// client-side, so every page in this group can render statically.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mkt-wrap" style={{ background: "#fff", color: "#1d2823", colorScheme: "light" }}>
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
