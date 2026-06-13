import { type Metadata } from "next";

import { HelpFaq } from "~/app/_components/help-faq";
import { HELP_FAQ } from "~/app/_components/help-faq-data";
import { breadcrumbSchema, faqPageSchema, JsonLd } from "~/app/_components/json-ld";
import { PublicFooter } from "~/app/_components/public-footer";
import { PublicNav } from "~/app/_components/public-nav";
import { auth } from "~/server/auth";
import "~/app/_components/public-site.css";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "Answers to the questions Kontax users ask most — CardDAV & sync, import & export, account security, sharing, and plans & billing.",
  alternates: { canonical: "/help" },
};

// P26-12 · public /help FAQ page.
export default async function HelpPage() {
  const session = await auth();

  return (
    <div className="kx">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Help & FAQ", path: "/help" },
          ]),
          faqPageSchema(HELP_FAQ.flatMap((s) => s.items)),
        ]}
      />
      <PublicNav isAuthenticated={!!session?.user?.id} />
      <main>
        <div className="help-wrap">
          <div className="help-head">
            <p className="eyebrow">Support</p>
            <h1 className="help-h1">Help &amp; FAQ</h1>
            <p className="help-lede">
              Answers to the questions new and long-time Kontax users ask most. Can&rsquo;t find it?
              Reach us at <a className="inline" href="mailto:support@vexon.co">support@vexon.co</a>.
            </p>
          </div>

          <HelpFaq />

          <div className="help-foot">
            <span className="help-foot__k">K</span>
            <span>
              Still stuck? Email{" "}
              <a className="inline" href="mailto:support@vexon.co">support@vexon.co</a>{" "}
              — we reply within a day.
            </span>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
