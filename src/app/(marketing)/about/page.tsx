import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, organizationSchema } from "~/app/_components/json-ld";
import "../_components/doc.css";

export const metadata: Metadata = {
  title: "About — Kontax",
  description:
    "Kontax was built because address books haven't kept up with how we live. Made by Vexon.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Kontax",
    description:
      "Kontax was built because address books haven't kept up with how we live. Made by Vexon.",
    url: "/about",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=about", width: 1200, height: 630, alt: "About Kontax" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About — Kontax",
    description:
      "Kontax was built because address books haven't kept up with how we live. Made by Vexon.",
  },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <div className="doc-wrap doc-wrap--center">
      <h1 className="doc-title">About Kontax</h1>

      <div className="doc-body" style={{ textAlign: "left", marginTop: "32px" }}>
        <p>
          Kontax was built because address books haven&rsquo;t kept up with how
          we live.
        </p>
        <p>
          Our phones hold hundreds of contacts, but the tools to manage them are
          either locked inside a platform&rsquo;s ecosystem or frozen in 2005.
          You can&rsquo;t easily search across sources, organise with labels,
          share a family address book, or let someone add you with a single tap.
        </p>
        <p>
          Kontax fixes that. It&rsquo;s a contacts manager that puts you in
          control — your data syncs to your devices, stays private, and is
          always yours to export.
        </p>
      </div>

      <div className="doc-divider">
        Kontax is made by{" "}
        <a
          href="https://vexon.co"
          target="_blank"
          rel="noopener noreferrer"
        >
          Vexon
        </a>{" "}
        — a small team building tools that respect your data and your time.
      </div>

      <div className="doc-cta">
        <Link className="doc-cta__btn" href="/pricing">
          See plans and pricing →
        </Link>
      </div>
    </div>
    </>
  );
}
