import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { ArrowIcon, CtaBand, PageHead } from "../_components/mkt-ui";
import { webPageSchema } from "../_components/page-schema";
import { ContactForm } from "./_contact-form";
import "./contact.css";

// P50A-07 · support@getkontax.com is the address already used across the
// codebase (src/app/api/contact/route.tsx SUPPORT_EMAIL, terms/page.tsx,
// developers/page.tsx) — reused here rather than invented.
const TITLE = "Contact — Kontax";
const DESCRIPTION = "Get in touch with the Kontax team. We aim to respond within 1 business day.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact",
    description: DESCRIPTION,
    url: "/contact",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=contact", width: 1200, height: 630, alt: "Kontax — Get in touch" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// P50-05 · Direction A layout. The form, /api/contact and its rate limit are
// unchanged — only the presentation moved onto the --mkt-* system.
export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Contact", path: "/contact" },
          ]),
          webPageSchema({ name: TITLE, description: DESCRIPTION, path: "/contact" }),
        ]}
      />
      <PageHead
        label="Contact"
        title="Get in touch"
        lede="We read every message and aim to respond within 1 business day."
      />

      <section className="mkt-band ct-band" aria-label="Contact form">
        <div className="mkt-container ct-grid">
          <div className="mkt-card ct-formcard">
            <ContactForm />
          </div>

          <aside className="ct-aside" aria-label="Other ways to get help">
            <div className="ct-aside__item">
              <h2 className="mkt-h4">Prefer email?</h2>
              <p>
                Write to <a href="mailto:support@getkontax.com">support@getkontax.com</a> directly —
                same 1-business-day response target.
              </p>
            </div>
            <div className="ct-aside__item">
              <h2 className="mkt-h4">Security reports</h2>
              <p>
                For security vulnerabilities, email{" "}
                <a href="mailto:security@getkontax.com">security@getkontax.com</a> directly.
              </p>
            </div>
            <div className="ct-aside__item">
              <h2 className="mkt-h4">Help centre</h2>
              <p>Looking for an answer right now? Step-by-step articles on sync, import, sharing and billing.</p>
              <Link className="mkt-more ct-aside__more" href="/help">
                Browse the help centre
                <ArrowIcon size={15} />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
