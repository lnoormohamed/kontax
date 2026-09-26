import Link from "next/link";
import type { Metadata } from "next";
import { ArrowIcon, CtaBand, PageHead } from "../_components/mkt-ui";
import { ContactForm } from "./_contact-form";
import "./contact.css";

export const metadata: Metadata = {
  title: "Contact — Kontax",
  description: "Get in touch with the Kontax team. We aim to respond within 1 business day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact",
    description: "Get in touch with the Kontax team. We aim to respond within 1 business day.",
    url: "/contact",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=contact", width: 1200, height: 630, alt: "Kontax — Get in touch" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact — Kontax",
    description: "Get in touch with the Kontax team. We aim to respond within 1 business day.",
  },
};

// P50-05 · Direction A layout. The form, /api/contact and its rate limit are
// unchanged — only the presentation moved onto the --mkt-* system.
export default function ContactPage() {
  return (
    <>
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
              <h2 className="mkt-h4">Security reports</h2>
              <p>
                For security vulnerabilities, email{" "}
                <a href="mailto:security@getkontax.com">security@getkontax.com</a> directly.
              </p>
            </div>
            <div className="ct-aside__item">
              <h2 className="mkt-h4">Help &amp; FAQ</h2>
              <p>Answers to the questions new and long-time Kontax users ask most.</p>
              <Link className="mkt-more ct-aside__more" href="/help">
                Browse Help &amp; FAQ
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
