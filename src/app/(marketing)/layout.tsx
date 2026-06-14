import "./_components/marketing.css";

import { MarketingFooter } from "./_components/marketing-footer";
import { MarketingNav } from "./_components/marketing-nav";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mkt-wrap">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
