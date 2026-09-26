import Link from "next/link";

import { HOMEPAGE_FAQ } from "~/app/_components/help-faq-data";
import { SectionHead } from "../mkt-ui";
import { Icon } from "./icons";

// P49-04 · §9 FAQ. Reads HOMEPAGE_FAQ, the same array the page's FAQPage
// JSON-LD is built from (single source of truth). Native <details>/<summary>,
// no client JS; summary rows are at least 44px tall.

export function HomeFaq() {
  return (
    <section className="mkt-band mkt-band--stone" id="faq">
      <div className="mkt-container">
        <SectionHead n="07" layout="center" label="Questions" title="Questions, answered" />
        <div className="mkt-faq">
          {HOMEPAGE_FAQ.map((item, i) => (
            <details key={item.q} open={i === 0}>
              <summary>
                {item.q}
                <Icon name="plus" size={20} />
              </summary>
              <div className="mkt-faq__a">
                {item.a}
                {item.link ? (
                  <>
                    {" "}
                    <Link href={item.link.href}>{item.link.label}</Link>.
                  </>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
