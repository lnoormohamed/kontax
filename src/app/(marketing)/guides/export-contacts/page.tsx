import Link from "next/link";

import { Callout, FactTable, GuideArticle, Steps, type GuideSection } from "../_components/guide-article";
import { getGuidePage } from "../_content/pages";
import { guideMetadata } from "../_content/seo";
import { SRC } from "../_content/sources";

// P50A-06 · Guide 6. Kontax export facts: CSV and the Kontax Archive on every
// plan, vCard 4.0 on Pro+ (src/app/_components/export-card.tsx,
// assertCanUsePremiumExport in src/server/billing.ts); archive = JSContact
// (RFC 9553) documents + manifest + media (src/app/developers/page.tsx);
// Free has a monthly import allowance (monthlyImportLimit; semantics not yet
// decided by the owner, so no number is quoted).

const page = getGuidePage("/guides/export-contacts");

export const metadata = guideMetadata(page);

const sections: GuideSection[] = [
  {
    id: "which-format",
    title: "vCard or CSV: which format to choose",
    body: (
      <>
        <FactTable
          caption="Contact export formats compared"
          columns={["vCard (.vcf)", "CSV (.csv)"]}
          rows={[
            {
              label: "Best for",
              cells: ["Moving contacts into another address book.", "Opening in a spreadsheet, or mail-merge."],
            },
            {
              label: "Read by",
              cells: [
                "iPhone, Mac, iCloud.com, Google Contacts and most contacts apps.",
                "Spreadsheets, Google Contacts and many CRMs; column names differ between services.",
              ],
            },
            {
              label: "Photos",
              cells: ["Can be included.", "Not included."],
            },
          ]}
        />
        <p>
          If you’re not sure, choose vCard: one file holds all the contacts you selected, and nearly every
          address book can import it. Google recommends its own <strong>Google CSV</strong> format for backing
          up Google contacts.
        </p>
      </>
    ),
  },
  {
    id: "iphone",
    title: "Export contacts from iPhone",
    body: (
      <>
        <Steps
          items={[
            <>Open the Contacts app.</>,
            <>
              Touch and hold a list (or tap <strong>Add List</strong> to make one with just the people you
              want), then tap <strong>Export</strong>.
            </>,
            <>Choose the fields to include, then send or save the file, for example with Mail or Messages.</>,
          ]}
        />
        <p>
          To send a single contact, open it and tap <strong>Share Contact</strong>. If your contacts are in
          iCloud, exporting from iCloud.com on a computer is often easier for large lists.
        </p>
      </>
    ),
  },
  {
    id: "google",
    title: "Export from Google Contacts",
    body: (
      <Steps
        items={[
          <>
            On a computer, go to <strong>contacts.google.com</strong>.
          </>,
          <>Select one contact, several, or all of them.</>,
          <>
            Choose <strong>More actions → Export</strong>, pick <strong>Google CSV</strong> or{" "}
            <strong>vCard</strong>, then <strong>Export</strong>.
          </>,
        ]}
      />
    ),
  },
  {
    id: "icloud",
    title: "Export from iCloud.com",
    body: (
      <>
        <Steps
          items={[
            <>
              Go to <strong>icloud.com/contacts</strong> on a computer or tablet and sign in. (Contacts on
              iCloud.com isn’t available on a phone.)
            </>,
            <>
              Select a contact; hold Command (Mac) or Control (Windows) to select several; or choose{" "}
              <strong>Select All Contacts</strong> from the actions menu.
            </>,
            <>
              Choose <strong>Share → Export vCard</strong>. Several contacts are saved as one vCard file.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "mac",
    title: "Export from Contacts on a Mac",
    body: (
      <>
        <p>
          Select the contacts, then choose <strong>File → Export → Export vCard</strong>. For a full backup of
          the Mac Contacts app, <strong>File → Export → Contacts Archive</strong> saves an <code>.abbu</code>{" "}
          file, which only the Mac Contacts app can open. To leave out photos or notes from vCards, open{" "}
          <strong>Contacts → Settings → vCard</strong>.
        </p>
      </>
    ),
  },
  {
    id: "export-vs-backup",
    title: "An export is a snapshot, not a backup plan",
    body: (
      <>
        <p>
          An exported file is frozen at the moment you made it. That’s perfect for moving house, and fine as a
          one-off safety copy before a big clean-up. For mistakes after the fact, the services have their own
          safety nets: iCloud.com can restore an earlier archived version of your contacts, and Google Contacts
          can undo changes from the last 30 days and keeps deleted contacts in the bin for 30 days.
        </p>
        <p>
          Before merging duplicates in bulk, take an export first. Our{" "}
          <Link href="/guides/merge-duplicate-contacts-iphone">duplicate merging guide</Link> covers what each
          service lets you undo.
        </p>
      </>
    ),
  },
  {
    id: "kontax-format",
    title: "Exporting from Kontax, and the Kontax format",
    body: (
      <>
        <p>Kontax exports on every plan, whenever you like, without asking anyone:</p>
        <ul>
          <li>
            <strong>CSV</strong> for spreadsheets, on every plan.
          </li>
          <li>
            <strong>The Kontax Archive</strong>, on every plan: a <code>.zip</code> with one JSON document per
            contact, based on the IETF’s JSContact standard (RFC 9553), plus photos. It keeps what vCard and CSV
            drop, such as labels and custom fields, and the format is documented publicly with schemas and a
            validator.
          </li>
          <li>
            <strong>vCard 4.0</strong>, on Pro and above.
          </li>
        </ul>
        <p>
          The format reference is in the <Link href="/developers/export-format">developer documentation</Link>,
          and the everyday steps are in <Link href="/help/import-export/export-your-contacts">export your contacts</Link>
          . For everything in your account, not just contacts, see{" "}
          <Link href="/help/import-export/download-full-account-export">download a full account export</Link>.
        </p>
        <Callout tone="kontax" title="Importing into Kontax">
          <p>
            Kontax imports CSV files (it recognises Google’s CSV layout) and Kontax Archives, and highlights
            people you already have before anything is added. It doesn’t import vCard files; to bring in iCloud
            contacts, connect iCloud instead. Free has a monthly import allowance (see{" "}
            <Link href="/pricing">pricing</Link>). See{" "}
            <Link href="/help/import-export/import-from-google-icloud">import from Google or iCloud</Link>.
          </p>
        </Callout>
      </>
    ),
  },
  {
    id: "import-elsewhere",
    title: "Importing the file somewhere else",
    body: (
      <ul>
        <li>
          <strong>iCloud.com:</strong> select the Add button, choose <strong>Import Contact</strong>, then pick
          the vCard file.
        </li>
        <li>
          <strong>Google Contacts:</strong> choose <strong>Import</strong>, select a CSV or vCard file, then{" "}
          <strong>Import</strong>. Google suggests splitting CSV files of more than 3,000 contacts.
        </li>
        <li>
          <strong>Anywhere else:</strong> look for “Import” and choose vCard if it’s offered.
        </li>
      </ul>
    ),
  },
];

export default function ExportContactsGuide() {
  return (
    <GuideArticle
      page={page}
      answer={
        <p>
          Every major contacts service can export vCard (<code>.vcf</code>), the standard file other address
          books import. On iPhone, touch and hold a list in Contacts and tap Export. In Google Contacts, select
          your contacts, then More actions → Export. On iCloud.com, select them, then Share → Export vCard. On a
          Mac, choose File → Export → Export vCard. For a spreadsheet, Google also exports CSV.
        </p>
      }
      sections={sections}
      sources={[
        SRC.appleIphoneExport,
        SRC.appleShareContact,
        SRC.googleExport,
        SRC.googleImport,
        SRC.appleIcloudImportExport,
        SRC.appleIcloudWeb,
        SRC.appleMacExport,
        SRC.appleIcloudRestore,
        SRC.googleUndo,
        SRC.rfc9553,
      ]}
      related={[
        {
          href: "/guides/sync-icloud-and-google-contacts",
          title: "Sync iCloud and Google contacts",
          body: "When a one-off export isn’t enough.",
        },
        {
          href: "/help/import-export/kontax-export-format",
          title: "The Kontax export format",
          body: "What’s inside a Kontax Archive, in plain English.",
        },
        {
          href: "/guides/what-is-carddav",
          title: "What is CardDAV?",
          body: "vCard is the file; CardDAV is how it syncs.",
        },
      ]}
    />
  );
}
