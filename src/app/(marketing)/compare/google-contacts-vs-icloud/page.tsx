import Link from "next/link";

import { Callout, FactTable, GuideArticle, type GuideSection } from "../../guides/_components/guide-article";
import { THIRD_PARTY_CHECKED_LABEL, getGuidePage } from "../../guides/_content/pages";
import { guideMetadata } from "../../guides/_content/seo";
import { SRC } from "../../guides/_content/sources";

// P50A-06 · Comparison 3: neutral. Kontax appears only in the final section.
// Every row is from the Apple Support / Google Contacts Help pages under Sources.

const page = getGuidePage("/compare/google-contacts-vs-icloud");

export const metadata = guideMetadata(page);

const sections: GuideSection[] = [
  {
    id: "at-a-glance",
    title: "At a glance",
    body: (
      <FactTable
        caption="Google Contacts compared with iCloud Contacts"
        columns={["Google Contacts", "iCloud Contacts"]}
        rows={[
          {
            label: "Built into",
            cells: ["Android, and the web at contacts.google.com.", "iPhone, iPad and Mac."],
          },
          {
            label: "On the other platform",
            cells: [
              "iPhone and Mac: add your Google account in Settings (or the Contacts app on a Mac) and turn on Contacts.",
              "Android: through a CardDAV app such as DAVx⁵, with an app-specific password. Contacts on iCloud.com needs a computer or tablet.",
            ],
          },
          {
            label: "Price",
            cells: ["Included with a Google Account.", "Included with an Apple Account."],
          },
          {
            label: "Limits",
            cells: [
              "25,000 contacts, or 20 MB not counting photos.",
              "50,000 contact cards; 256 KB per card; 224 KB per photo.",
            ],
          },
          {
            label: "Organising",
            cells: ["Labels.", "Lists."],
          },
          {
            label: "Finding duplicates",
            cells: [
              "Merge & fix, within one Google Account.",
              "View Duplicates on iPhone; Card → Look for Duplicates on Mac.",
            ],
          },
          {
            label: "Undo and recovery",
            cells: [
              "Undo changes to any point in the last 30 days; deleted contacts stay in the bin for 30 days.",
              "Restore an earlier archived version of all contacts on iCloud.com; your current version is archived first.",
            ],
          },
          {
            label: "Export",
            cells: ["Google CSV and vCard.", "vCard (iCloud.com, the iPhone Contacts app, or a Mac)."],
          },
          {
            label: "Sharing with others",
            cells: [
              "Work and school (Workspace) accounts can delegate contacts within the same organisation, on a computer.",
              "Send individual cards with Share Contact, AirDrop or NameDrop.",
            ],
          },
        ]}
        note={`Checked against Google Contacts Help and Apple Support in ${THIRD_PARTY_CHECKED_LABEL}.`}
      />
    ),
  },
  {
    id: "choose-google",
    title: "Choose Google Contacts if…",
    body: (
      <ul>
        <li>you, or anyone you share a household or business with, uses an Android phone;</li>
        <li>you often manage contacts in a web browser;</li>
        <li>you want a single undo for everything you changed in the last 30 days;</li>
        <li>your organisation already runs on Google Workspace.</li>
      </ul>
    ),
  },
  {
    id: "choose-icloud",
    title: "Choose iCloud Contacts if…",
    body: (
      <ul>
        <li>every device you use is an iPhone, iPad or Mac;</li>
        <li>you want nothing to set up: it’s on when you sign in with your Apple Account;</li>
        <li>you have a very large address book (iCloud allows up to 50,000 cards, Google 25,000 contacts);</li>
        <li>you like to share contacts in person with AirDrop or NameDrop.</li>
      </ul>
    ),
  },
  {
    id: "using-both",
    title: "Using both on one iPhone",
    body: (
      <>
        <p>
          Plenty of people end up with both: an iPhone signed in to iCloud, plus a Google account from Gmail or
          an old Android phone. That works. Add the Google account under{" "}
          <strong>Settings → Apps → Contacts → Contacts Accounts</strong>, turn on Contacts, and your iPhone shows
          both lists together, linking cards for the same person so they appear once.
        </p>
        <p>
          Two things to set up so it stays tidy. First, choose a <strong>Default Account</strong> in{" "}
          <strong>Settings → Apps → Contacts</strong>, so new contacts always go to the same place. Second,
          remember the two accounts stay separate: a contact saved to Google won’t appear on iCloud.com, and the
          iPhone’s linking only affects what you see.
        </p>
      </>
    ),
  },
  {
    id: "switching",
    title: "Switching from one to the other",
    body: (
      <>
        <p>
          Moving is a one-off vCard export and import, and takes a few minutes on a computer. Export from the
          account you’re leaving, import into the other, merge any duplicates, then change your Default Account.
          Our <Link href="/guides/export-contacts">export guide</Link> has the steps for both, and{" "}
          <Link href="/guides/merge-duplicate-contacts-iphone">merging duplicates on iPhone</Link> covers the
          tidy-up.
        </p>
      </>
    ),
  },
  {
    id: "if-you-need-both",
    title: "If you need both to stay in step",
    body: (
      <>
        <p>
          Neither service syncs with the other, so if you keep contacts in both and want one list that stays
          current, you need a third service between them. Our{" "}
          <Link href="/guides/sync-icloud-and-google-contacts">iCloud and Google sync guide</Link> compares the
          three options honestly, including when you don’t need one.
        </p>
        <Callout tone="kontax" title="Where Kontax fits">
          <p>
            Kontax is one of those services. It connects to Google, iCloud and Fastmail, keeps one address book
            that appears in your iPhone and Mac Contacts over CardDAV, and flags the same person across accounts.
            It’s free for up to 500 contacts and one sync source; connecting both Google and iCloud needs Pro.
            See <Link href="/pricing">plans and pricing</Link>.
          </p>
        </Callout>
      </>
    ),
  },
];

export default function GoogleContactsVsIcloud() {
  return (
    <GuideArticle
      page={page}
      answer={
        <p>
          If you use Android, or a mix of devices, Google Contacts is usually the easier home for your address
          book: it’s built into Android, works in any browser, and syncs to an iPhone once you add your Google
          account. If everything you own is Apple, iCloud Contacts is simpler: it’s already on, and it syncs
          across iPhone, iPad and Mac with no setup. Both are included with the account you already have.
        </p>
      }
      sections={sections}
      sources={[
        SRC.googleLimits,
        SRC.appleIcloudLimits,
        SRC.appleIcloudWeb,
        SRC.appleIphoneAccounts,
        SRC.googleMerge,
        SRC.appleMergeIphone,
        SRC.appleMergeMac,
        SRC.googleUndo,
        SRC.appleIcloudRestore,
        SRC.googleExport,
        SRC.appleIcloudImportExport,
        SRC.appleIphoneExport,
        SRC.googleDelegation,
        SRC.appleNameDrop,
        SRC.davx5Icloud,
      ]}
      related={[
        {
          href: "/compare/kontax-vs-google-contacts",
          title: "Kontax vs Google Contacts",
          body: "Where Google is enough, and what Kontax adds.",
        },
        {
          href: "/compare/kontax-vs-icloud-contacts",
          title: "Kontax vs iCloud Contacts",
          body: "Where iCloud is enough, and what Kontax adds.",
        },
        {
          href: "/guides/sync-icloud-and-google-contacts",
          title: "Sync iCloud and Google contacts",
          body: "Three honest ways to keep both.",
        },
      ]}
    />
  );
}
