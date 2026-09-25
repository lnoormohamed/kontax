import Link from "next/link";

import { HOMEPAGE_FAQ } from "~/app/_components/help-faq-data";
import { Faq, SectionHead } from "../mkt-ui";

// P49-04 / P50-03 · §07 FAQ. Reads HOMEPAGE_FAQ, the same array the page's
// FAQPage JSON-LD is built from (single source of truth). Native
// <details>/<summary> via the shared <Faq>, no client JS.

const ITEMS = HOMEPAGE_FAQ.map((item) => ({
  q: item.q,
  a: (
    <p>
      {item.a}
      {item.link ? (
        <>
          {" "}
          <Link href={item.link.href}>{item.link.label}</Link>.
        </>
      ) : null}
    </p>
  ),
}));

export function HomeFaq() {
  return (
    <section className="mkt-band mkt-band--stone" id="faq">
      <div className="mkt-container">
        <SectionHead index="07" label="Questions" title="Questions, answered" />
        <Faq items={ITEMS} />
      </div>
    </section>
  );
}
