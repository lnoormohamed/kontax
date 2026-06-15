import "./_components/marketing.css";

import type { Metadata } from "next";
import { MarketingFooter } from "./_components/marketing-footer";
import { MarketingNav } from "./_components/marketing-nav";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/api/og?page=homepage", width: 1200, height: 630, alt: "Kontax" }],
  },
  twitter: { card: "summary_large_image" },
};

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
