import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema, organizationSchema } from "~/app/_components/json-ld";
import { webPageSchema } from "../_components/page-schema";
import { ArrowIcon, CtaBand, PageHead, SectionHead } from "../_components/mkt-ui";
import "./about.css";

const TITLE = "About — Kontax";
const DESCRIPTION =
  "Kontax was built because address books haven't kept up with how we live. Made by Vexon, based in the UK.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Kontax",
    description: DESCRIPTION,
    url: "/about",
    siteName: "Kontax",
    type: "website",
    images: [{ url: "/api/og?page=about", width: 1200, height: 630, alt: "About Kontax" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Owner approved 2026-09-26 (family-phonebook "Why Kontax exists" story).
//
// Fact-check (feat/p50-merged, 2026-09-26): the company is "Vexon" as the
// terms and privacy policy name it (not "Vexon Group"); the terms are governed
// by the laws of England and Wales. No team size, founding date, user numbers
// or funding are stated because none are documented. Family = one shared book
// for up to 6 members (memberSlotsLimit), edit/view per member.
//
// P50-05 · Direction A layout over the existing About copy. "Why Kontax
// exists" (§02) tells the family-phonebook story the owner asked for. Claims
// are limited to verified behaviour: a shared Family book for up to six
// people, edit/view roles, phone numbers and birthdays synced both ways over
// CardDAV into the Contacts app. It does NOT promise birthday reminders for
// shared books (reminders only cover a member's own contacts today).
const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: "Change it once, right everywhere",
    body: "When someone gets a new number, one person updates it and every phone in the family has it, inside the Contacts app they already use.",
  },
  {
    title: "Birthdays next to the numbers",
    body: "Each person’s birthday is kept with their contact details, so it’s on everyone’s phone too, not just in one person’s memory.",
  },
  {
    title: "Everyone can help, you decide who edits",
    body: "Up to six people share one Family book. Give each member edit or view-only access.",
  },
];

const PROMISES: { title: string; href: string; link: string }[] = [
  { title: "Syncs to your devices", href: "/features", link: "See features" },
  { title: "Stays private", href: "/security", link: "How we protect it" },
  { title: "Always yours to export", href: "/developers/export-format", link: "The export format" },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          webPageSchema({ name: TITLE, description: DESCRIPTION, path: "/about" }),
        ]}
      />

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
                labels, share a family address book, or hand someone your details with one link.
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
            title="Every family has one person who keeps everyone’s numbers"
            lede={
              <>
                They know Grandad&rsquo;s landline, which cousin changed networks and whose
                birthday is next week, and when they&rsquo;re not around, nobody else does. Kontax
                exists so that list lives in one shared family phonebook instead: everyone&rsquo;s
                numbers and birthdays, kept up to date by whoever hears first, on every phone in
                the family.
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
            lede="Based in the UK: our terms are governed by the laws of England and Wales, and the privacy policy explains how we handle your data under UK data protection law."
          />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
