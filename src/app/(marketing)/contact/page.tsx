import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "~/app/_components/json-ld";
import { webPageSchema } from "../_components/page-schema";
import { ContactForm } from "./_contact-form";
import "./contact.css";

// P50A-07 · support@getkontax.com is the address already used across the
// codebase (src/app/api/contact/route.tsx SUPPORT_EMAIL, terms/page.tsx,
// developers/page.tsx, help/page.tsx) — reused here rather than invented.

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
      <div className="ct-wrap">
        <h1 className="ct-hero__title">Get in touch</h1>
        <p className="ct-hero__sub">
          We read every message and aim to respond within 1 business day.
        </p>

        <ContactForm />

        <p className="ct-note">
          Prefer email? Write to{" "}
          <a href="mailto:support@getkontax.com">support@getkontax.com</a> directly — same
          1-business-day response target. Looking for an answer right now? Check{" "}
          <Link href="/help">Help</Link> first.
        </p>

        <p className="ct-note">
          For security vulnerabilities, email{" "}
          <a href="mailto:security@getkontax.com">security@getkontax.com</a>{" "}
          directly.
        </p>
      </div>
    </>
  );
}
