import type { Metadata } from "next";
import { ContactForm } from "./_contact-form";
import "./contact.css";

export const metadata: Metadata = {
  title: "Contact — Kontax",
  description: "Get in touch with the Kontax team. We read every message and aim to respond within 1 business day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    images: [{ url: "/api/og?page=contact", width: 1200, height: 630, alt: "Kontax — Get in touch" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function ContactPage() {
  return (
    <div className="ct-wrap">
      <h1 className="ct-hero__title">Get in touch</h1>
      <p className="ct-hero__sub">
        We read every message and aim to respond within 1 business day.
      </p>

      <ContactForm />

      <p className="ct-note">
        For security vulnerabilities, email{" "}
        <a href="mailto:security@getkontax.com">security@getkontax.com</a>{" "}
        directly.
      </p>
    </div>
  );
}
