import type { Metadata } from "next";

import { breadcrumbSchema, JsonLd } from "~/app/_components/json-ld";
import { PricingComparison } from "~/app/_components/pricing-comparison";
import { PublicFooter } from "~/app/_components/public-footer";
import { PublicNav } from "~/app/_components/public-nav";
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import "~/app/_components/public-site.css";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Plans that grow with you. Start free for up to 500 contacts and upgrade when you need unlimited contacts, deeper history, or a shared address book.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const session = await auth();
  let currentPlan: string | null = null;
  if (session?.user?.id) {
    const billing = await getUserBillingContext(session.user.id);
    currentPlan = billing.plan;
  }

  return (
    <div className="kx">
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />
      <PublicNav active="pricing" />
      <main>
        <PricingComparison currentPlan={currentPlan} />
      </main>
      <PublicFooter />
    </div>
  );
}
