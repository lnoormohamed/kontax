import Link from "next/link";

import { CtaBand } from "../_components/mkt-ui";
import { GuideIndex } from "../guides/_components/guide-article";
import { SECTION_INDEXES, THIRD_PARTY_CHECKED_LABEL, pagesInSection } from "../guides/_content/pages";
import { guideMetadata } from "../guides/_content/seo";

// P50A-06 · /compare index. Lists every comparison in the registry.

const index = SECTION_INDEXES.compare;

export const metadata = guideMetadata(index);

export default function CompareIndexPage() {
  return (
    <>
      <GuideIndex
        index={index}
        pages={pagesInSection("compare")}
        aside={
          <p>
            Apple and Google details were checked against their own help pages in {THIRD_PARTY_CHECKED_LABEL},
            and each page carries its review date. For step-by-step help, see the{" "}
            <Link href="/guides">guides</Link>, or <Link href="/pricing">compare Kontax plans</Link>.
          </p>
        }
      />
      <CtaBand
        title="Try Kontax alongside what you use now"
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
