import type { Metadata } from "next";

import { PricingComparison } from "~/app/_components/pricing-comparison";
import { PublicFooter } from "~/app/_components/public-footer";
import { PublicNav } from "~/app/_components/public-nav";
import "~/app/_components/public-site.css";

export const metadata: Metadata = {
  title: "Kontax · Pricing",
  description: "Plans that grow with you. Start free for up to 500 contacts and upgrade when you need unlimited contacts, deeper history, or a shared address book.",
};

export default function PricingPage() {
  return (
    <div className="kx">
      <PublicNav active="pricing" />
      <main>
        <PricingComparison />
      </main>
      <PublicFooter />
    </div>
  );
}
