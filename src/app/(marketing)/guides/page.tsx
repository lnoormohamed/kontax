import Link from "next/link";

import { CtaBand } from "../_components/mkt-ui";
import { GuideIndex } from "./_components/guide-article";
import { SECTION_INDEXES, pagesInSection } from "./_content/pages";
import { guideMetadata } from "./_content/seo";

// P50A-06 · /guides index. Lists every guide in the registry.

const index = SECTION_INDEXES.guides;

export const metadata = guideMetadata(index);

export default function GuidesIndexPage() {
  return (
    <>
      <GuideIndex
        index={index}
        pages={pagesInSection("guides")}
        aside={
          <p>
            Deciding between services? See the <Link href="/compare">honest comparisons</Link>. Looking for how
            to do something in Kontax itself? The <Link href="/help">help centre</Link> has step-by-step
            articles.
          </p>
        }
      />
      <CtaBand
        title="One address book for iCloud, Google and Fastmail"
        sub="Free for up to 500 contacts, one sync source and one device over CardDAV. No card needed."
      >
        <Link href="/register" className="mkt-btn mkt-btn--pri">
          Create a free account
        </Link>
        <Link href="/features" className="mkt-btn mkt-btn--sec">
          See the features
        </Link>
      </CtaBand>
    </>
  );
}
