import Link from "next/link";

import {
  Callout,
  FactTable,
  GuideArticle,
  Steps,
  type GuideSection,
} from "../../guides/_components/guide-article";
import { THIRD_PARTY_CHECKED_LABEL, getGuidePage } from "../../guides/_content/pages";
import { guideMetadata } from "../../guides/_content/seo";
import { SRC } from "../../guides/_content/sources";

// P50A-06 · Comparison 2. Same Kontax sources as kontax-vs-icloud-contacts;
// Google facts from the Google Contacts Help pages listed under Sources.

const page = getGuidePage("/compare/kontax-vs-google-contacts");

export const metadata = guideMetadata(page);

const sections: GuideSection[] = [
  {
    id: "at-a-glance",
    title: "At a glance",
    body: (
      <FactTable
        caption="Kontax compared with Google Contacts"
        columns={["Google Contacts", "Kontax"]}
        rows={[
          {
            label: "Where it works",
            cells: [
              "Built into Android; contacts.google.com in any browser; on iPhone and Mac once you add your Google account.",
              "In a browser on any device, and inside iPhone and Mac Contacts over CardDAV.",
            ],
          },
          {
            label: "Price",
            cells: [
              "Included with a Google Account.",
              <>
                Free up to 500 contacts; paid plans for more (see <Link href="/pricing">pricing</Link>).
              </>,
            ],
          },
          {
            label: "Contact limit",
            cells: [
              "25,000 contacts, or 20 MB not counting photos.",
              "500 on Free; unlimited on Pro, Family and Teams.",
            ],
          },
          {
            label: "Other providers",
            cells: [
              "Imports CSV and vCard files; doesn’t sync with iCloud.",
              "Two-way sync with Google, iCloud, Fastmail and other CardDAV servers: 1 source on Free, up to 5 on Pro.",
            ],
          },
          {
            label: "Duplicates",
            cells: [
              "Merge & fix suggests and merges duplicates, within one Google Account.",
              "Flags matches across every connected account; field-by-field merge on every plan.",
            ],
          },
          {
            label: "Undo",
            cells: [
              "Undo changes to any point in the last 30 days; deleted contacts stay in the bin for 30 days.",
              "Undo any single merge for 30 days; per-contact change history.",
            ],
          },
          {
            label: "Sharing",
            cells: [
              "Work and school (Google Workspace) accounts can delegate contacts to people in the same organisation, on a computer.",
              "Share a contact by link; a shared address book on Family (up to 6 people) and Teams (up to 25).",
            ],
          },
          {
            label: "Export",
            cells: [
              "Google CSV and vCard.",
              "CSV and the documented Kontax Archive on every plan; vCard on Pro and above.",
            ],
          },
        ]}
        note={`Google details checked against Google Contacts Help in ${THIRD_PARTY_CHECKED_LABEL}. Kontax details as of the review date above.`}
      />
    ),
  },
  {
    id: "where-google-is-enough",
    title: "Where Google Contacts is all you need",
    body: (
      <>
        <p>
          Google Contacts is a strong address book. It’s built into Android, works in any browser, syncs to an
          iPhone once you add your Google account, suggests duplicates to merge, and can undo every change from
          the last 30 days in one go. You probably don’t need Kontax if:
        </p>
        <ul>
          <li>all your contacts are in one Google account, and that’s where your phone saves new ones;</li>
          <li>you don’t also keep contacts in iCloud or Fastmail;</li>
          <li>
            your organisation uses Google Workspace and contact delegation or its directory covers your sharing;
          </li>
          <li>you’re happy with a whole-list undo rather than undoing individual merges.</li>
        </ul>
        <p>
          Using Google Contacts on an iPhone? You don’t need anything extra: add your Google account in Settings
          and turn on Contacts. Our <Link href="/compare/google-contacts-vs-icloud">Google vs iCloud comparison</Link>{" "}
          covers that set-up.
        </p>
      </>
    ),
  },
  {
    id: "what-kontax-adds",
    title: "What Kontax adds",
    body: (
      <>
        <ul>
          <li>
            <strong>Google and iCloud (and Fastmail) in one list.</strong> Google Contacts can’t merge contacts
            across Google Accounts, and doesn’t sync with iCloud. Kontax connects several providers and flags
            the same person wherever they appear.
          </li>
          <li>
            <strong>A shared address book for a household.</strong> Google’s contact delegation is for Workspace
            accounts in one organisation. Kontax Family gives up to six people, on personal accounts, one shared
            book that appears in each person’s iPhone Contacts.
          </li>
          <li>
            <strong>Undo one merge, not the whole list.</strong> Each merge can be undone on its own for 30
            days.
          </li>
          <li>
            <strong>History for each contact.</strong> See what changed and which account it came from (Free
            shows the last three changes; paid plans show the full history).
          </li>
          <li>
            <strong>An open export format</strong> that keeps labels, notes, custom fields and photos. See{" "}
            <Link href="/help/import-export/kontax-export-format">the Kontax export format</Link>.
          </li>
        </ul>
        <p>
          Kontax shows no ads and uses no tracking. Your Google sign-in token is stored encrypted at rest
          (AES-256-GCM), and you can disconnect Google from the Sync page at any time.
        </p>
      </>
    ),
  },
  {
    id: "moving-over",
    title: "Moving your Google contacts to Kontax",
    body: (
      <Steps
        items={[
          <>
            <strong>To keep Google in sync:</strong> in Kontax, open Sync and choose Connect Google. You sign in
            on Google’s own page and grant access to your contacts; nothing is removed from Google. See{" "}
            <Link href="/help/sync/connect-google-contacts">connect Google Contacts</Link>.
          </>,
          <>
            <strong>To copy once:</strong> on contacts.google.com, select your contacts, choose More actions →
            Export → Google CSV, and import the file into Kontax, which recognises Google’s CSV layout (Free
            allows three imports a month). See{" "}
            <Link href="/help/import-export/import-from-google-icloud">import from Google or iCloud</Link>.
          </>,
          <>
            Review the duplicates Kontax finds, then add Kontax to your phone or Mac from Settings → Data →
            Connect a device.
          </>,
        ]}
      />
    ),
  },
  {
    id: "leaving",
    title: "If you leave Kontax",
    body: (
      <>
        <p>
          Export first: CSV or the Kontax Archive on any plan, or vCard on Pro and above. Google Contacts
          imports both CSV and vCard. Contacts that Kontax synced to Google stay in Google. Disconnect Google
          from the Sync page, then delete your Kontax account in Settings; deletion completes after a 30-day
          grace period you can cancel.
        </p>
        <Callout title="Before you delete">
          <p>
            Check the export opens where you’re going next. See{" "}
            <Link href="/help/import-export/export-your-contacts">export your contacts</Link> and{" "}
            <Link href="/help/account-security/delete-your-account">delete your account</Link>.
          </p>
        </Callout>
      </>
    ),
  },
];

export default function KontaxVsGoogleContacts() {
  return (
    <GuideArticle
      page={page}
      answer={
        <p>
          Use Google Contacts if your contacts live in one Google account, especially on Android: it’s built in,
          free, and can undo every change from the last 30 days. Use Kontax if your contacts are split across
          Google and iCloud or Fastmail, you want a shared address book for your family on personal accounts, or
          you want to undo individual merges, see each contact’s history and export to an open format.
        </p>
      }
      sections={sections}
      sources={[
        SRC.googleLimits,
        SRC.googleMerge,
        SRC.googleUndo,
        SRC.googleExport,
        SRC.googleImport,
        SRC.googleDelegation,
        SRC.appleIphoneAccounts,
      ]}
      related={[
        {
          href: "/compare/kontax-vs-icloud-contacts",
          title: "Kontax vs iCloud Contacts",
          body: "The same comparison for Apple’s address book.",
        },
        {
          href: "/guides/sync-icloud-and-google-contacts",
          title: "Sync iCloud and Google contacts",
          body: "Three honest methods, with and without Kontax.",
        },
        {
          href: "/guides/export-contacts",
          title: "Export your contacts",
          body: "From Google, iPhone, iCloud.com and Mac.",
        },
      ]}
    />
  );
}
