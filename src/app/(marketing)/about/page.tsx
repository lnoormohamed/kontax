import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, organizationSchema } from "~/app/_components/json-ld";
import { ArrowIcon, CtaBand, PageHead, SectionHead } from "../_components/mkt-ui";
import "./about.css";

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

// P50-05 · Direction A layout over the existing About copy. "Why Kontax
// exists" (§02) is a draft for owner approval: it states only facts the site
// already makes and verifies elsewhere (subscription-funded, no ads or
// tracking, CardDAV/vCard, export any time, no app to install) — no invented
// history, team or numbers.
const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: "Your contacts aren’t the product",
    body: "Kontax is paid for by subscriptions. No ads, no tracking, and your address book is never sold, rented or used to profile anyone in it.",
  },
  {
    title: "Work with what you already use",
    body: "On iPhone and Mac, Kontax appears inside the Contacts app you already have. There’s nothing new to install and nothing to learn.",
  },
  {
    title: "Easy to leave, on purpose",
    body: "Kontax speaks CardDAV and vCard, the standards your other apps use. Export everything whenever you like, in a documented format.",
  },
];
const PROMISES: { title: string; href: string; link: string }[] = [
  { title: "Syncs to your devices", href: "/features", link: "See features" },
  { title: "Stays private", href: "/security", link: "How we protect it" },
  { title: "Always yours to export", href: "/developers#export-format", link: "The export format" },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />

      <PageHead
        label="About"
        title="About Kontax"
        lede={<>Kontax was built because address books haven&rsquo;t kept up with how we live.</>}
      />

      <section className="mkt-band ab-band" aria-labelledby="ab-problem">
        <div className="mkt-container">
          <SectionHead
            n="01"
            label="The problem"
            id="ab-problem"
            title="Our phones hold hundreds of contacts"
            lede={
              <>
                But the tools to manage them are either locked inside a platform&rsquo;s ecosystem
                or frozen in 2005. You can&rsquo;t easily search across sources, organise with
                labels, share a family address book, or let someone add you with a single tap.
              </>
            }
          />
        </div>
      </section>

      <section className="mkt-band mkt-band--stone ab-band" aria-labelledby="ab-why">
        <div className="mkt-container">
          <SectionHead
            n="02"
            label="Why Kontax exists"
            id="ab-why"
            title="Your contacts shouldn’t depend on which phone you bought"
            lede={
              <>
                Most people&rsquo;s contacts are split between a phone, a Google account and an
                email provider, and each one only really looks after its own copy. Kontax exists to
                be the one place they agree, without asking you to switch phones, install another
                app or hand your address book to an advertiser.
              </>
            }
          />
          <ul className="ab-principles">
            {PRINCIPLES.map((p) => (
              <li key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mkt-band ab-band" aria-labelledby="ab-fix">
        <div className="mkt-container">
          <SectionHead
            n="03"
            label="What Kontax does"
            id="ab-fix"
            title="Kontax fixes that."
            lede={
              <>
                It&rsquo;s a contacts manager that puts you in control — your data syncs to your
                devices, stays private, and is always yours to export.
              </>
            }
          />
          <ul className="ab-cards">
            {PROMISES.map((p) => (
              <li key={p.title} className="mkt-card ab-card">
                <h3 className="mkt-h4">{p.title}</h3>
                <Link className="mkt-more ab-card__more" href={p.href}>
                  {p.link}
                  <ArrowIcon size={15} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mkt-band ab-band" aria-labelledby="ab-maker">
        <div className="mkt-container">
          <SectionHead
            n="04"
            label="Who makes it"
            id="ab-maker"
            title={
              <>
                Kontax is made by{" "}
                <a className="ab-maker" href="https://vexon.co" target="_blank" rel="noopener noreferrer">
                  Vexon
                  <span className="mkt-sr-only"> (opens in a new tab)</span>
                </a>
                .
              </>
            }
            lede="A small team building tools that respect your data and your time."
          />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
