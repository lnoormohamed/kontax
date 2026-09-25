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

// P50A-06 · Comparison 1. Kontax facts from src/server/dav/plan-entitlements.mjs
// and src/app/_components/plan-data.ts (limits, export formats, history), the
// P50-DB01 fact list (AES-256-GCM sync credentials, 30-day deletion grace) and
// src/app/_components/export-card.tsx (Kontax Archive + CSV on every plan,
// vCard on Pro). iCloud facts: Apple Support pages listed under Sources.

const page = getGuidePage("/compare/kontax-vs-icloud-contacts");

export const metadata = guideMetadata(page);

const sections: GuideSection[] = [
  {
    id: "at-a-glance",
    title: "At a glance",
    body: (
      <FactTable
        caption="Kontax compared with iCloud Contacts"
        columns={["iCloud Contacts", "Kontax"]}
        rows={[
          {
            label: "Where it works",
            cells: [
              "Built into iPhone, iPad and Mac. iCloud.com on a computer or tablet.",
              "In a browser on any device, and inside iPhone and Mac Contacts over CardDAV.",
            ],
          },
          {
            label: "Price",
            cells: [
              "Included with an Apple Account.",
              <>
                Free up to 500 contacts; paid plans for more (see <Link href="/pricing">pricing</Link>).
              </>,
            ],
          },
          {
            label: "Contact limit",
            cells: ["50,000 contact cards.", "500 on Free; unlimited on Pro, Family and Teams."],
          },
          {
            label: "Other providers",
            cells: [
              "Apple devices can show Google and other accounts alongside iCloud, but iCloud doesn’t sync with them.",
              "Two-way sync with Google, iCloud, Fastmail and other CardDAV servers: 1 source on Free, up to 5 on Pro.",
            ],
          },
          {
            label: "Duplicates",
            cells: [
              "View Duplicates on iPhone; Look for Duplicates on Mac.",
              "Flags matches across every connected account; field-by-field merge on every plan.",
            ],
          },
          {
            label: "Undo",
            cells: [
              "Restore an earlier archived version of all your contacts on iCloud.com.",
              "Undo any single merge for 30 days; per-contact change history.",
            ],
          },
          {
            label: "Sharing",
            cells: [
              "Send a card with Share Contact, AirDrop or NameDrop.",
              "Share a contact by link; a shared address book on Family (up to 6 people) and Teams (per seat).",
            ],
          },
          {
            label: "Export",
            cells: [
              "vCard, from iCloud.com, the iPhone Contacts app or a Mac.",
              "CSV and the documented Kontax Archive on every plan; vCard on Pro and above.",
            ],
          },
        ]}
        note={`iCloud details checked against Apple Support in ${THIRD_PARTY_CHECKED_LABEL}. Kontax details as of the review date above.`}
      />
    ),
  },
  {
    id: "where-icloud-is-enough",
    title: "Where iCloud is all you need",
    body: (
      <>
        <p>
          iCloud Contacts is good at what it’s for. It’s already on, it syncs across your iPhone, iPad and Mac
          without any setup, it holds up to 50,000 contacts, and recent versions of iOS find and merge
          duplicates for you. You probably don’t need Kontax if:
        </p>
        <ul>
          <li>everything you and your household use is Apple, and you don’t use Google or Fastmail contacts;</li>
          <li>you share contacts one at a time, by sending a card or using NameDrop;</li>
          <li>the built-in merge keeps your list tidy enough;</li>
          <li>you’d rather not have another account to look after.</li>
        </ul>
        <p>
          If that’s you, the most useful thing to know is how to take a copy: see{" "}
          <Link href="/guides/export-contacts">how to export your contacts</Link>.
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
            <strong>More than one provider in one list.</strong> Connect iCloud alongside Google or Fastmail and
            manage one address book. See{" "}
            <Link href="/guides/sync-icloud-and-google-contacts">syncing iCloud and Google contacts</Link> for
            exactly what is and isn’t copied between them.
          </li>
          <li>
            <strong>A shared family address book.</strong> Apple’s Family Sharing covers things like iCloud+
            storage, subscriptions, purchases and locations, but not a shared contacts list. Kontax Family gives
            up to six people one shared book, with each person’s own contacts kept private.
          </li>
          <li>
            <strong>Merges you can take back.</strong> Undo a single merge for 30 days, rather than restoring
            your whole address book to an earlier version.
          </li>
          <li>
            <strong>History for each contact.</strong> See what changed and where the change came from (Free
            shows the last three changes; paid plans show the full history).
          </li>
          <li>
            <strong>An open export format.</strong> The Kontax Archive keeps labels, notes, custom fields and
            photos, and is documented publicly. See{" "}
            <Link href="/help/import-export/kontax-export-format">the Kontax export format</Link>.
          </li>
        </ul>
        <p>
          Kontax doesn’t replace iCloud on your iPhone. It appears as another account in the Contacts app, next
          to iCloud, over CardDAV. Your sign-in can use two-factor authentication, each device gets its own app
          password you can revoke, and the credentials Kontax uses to reach iCloud are encrypted at rest
          (AES-256-GCM). There are no ads or tracking.
        </p>
      </>
    ),
  },
  {
    id: "moving-over",
    title: "Moving your iCloud contacts to Kontax",
    body: (
      <>
        <p>
          Connecting iCloud is the way in. Kontax imports CSV files and Kontax Archives but not vCard files, and
          iCloud.com exports vCard only, so there’s no file-based route from iCloud today.
        </p>
        <Steps
          items={[
            <>
              Create an app-specific password at account.apple.com (Sign-In and Security → App-Specific
              Passwords), then connect iCloud from the Sync page in Kontax. Your contacts stay in iCloud too. See{" "}
              <Link href="/help/sync/connect-icloud-contacts">connect iCloud contacts</Link>.
            </>,
            <>
              Review the duplicates Kontax finds. See{" "}
              <Link href="/help/sync/duplicate-flood-after-first-sync">duplicates after your first sync</Link>.
            </>,
            <>
              Add Kontax to your iPhone or Mac as a CardDAV account with a Kontax app password (Settings → Data →
              Connect a device).
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "leaving",
    title: "If you leave Kontax",
    body: (
      <>
        <p>
          Export everything first: CSV or the Kontax Archive on any plan, or vCard on Pro and above. Contacts
          that Kontax synced to iCloud stay in iCloud. Remove the Kontax account from your iPhone’s Contacts
          accounts, then delete your Kontax account in Settings; deletion completes after a 30-day grace period
          you can cancel.
        </p>
        <Callout title="Before you delete">
          <p>
            Download your export and check it opens where you’re going next. See{" "}
            <Link href="/help/import-export/export-your-contacts">export your contacts</Link> and{" "}
            <Link href="/help/account-security/delete-your-account">delete your account</Link>.
          </p>
        </Callout>
      </>
    ),
  },
];

export default function KontaxVsIcloudContacts() {
  return (
    <GuideArticle
      page={page}
      answer={
        <p>
          Use iCloud Contacts if everything you use is Apple: it’s built in, included with your Apple Account,
          and syncs across iPhone, iPad and Mac without setup. Use Kontax if your contacts also live in Google or
          Fastmail, you want a shared address book for your family, or you want undoable merges, per-contact
          history and an open export format. Kontax doesn’t replace iCloud on your iPhone; it sits alongside it
          in the Contacts app.
        </p>
      }
      sections={sections}
      sources={[
        SRC.appleIcloudLimits,
        SRC.appleIcloudWeb,
        SRC.appleMergeIphone,
        SRC.appleMergeMac,
        SRC.appleIcloudRestore,
        SRC.appleIcloudImportExport,
        SRC.appleFamilySharing,
        SRC.appleNameDrop,
        SRC.appleAppPasswords,
      ]}
      related={[
        {
          href: "/compare/kontax-vs-google-contacts",
          title: "Kontax vs Google Contacts",
          body: "The same comparison for Google’s address book.",
        },
        {
          href: "/compare/google-contacts-vs-icloud",
          title: "Google Contacts vs iCloud Contacts",
          body: "A neutral head-to-head, if you’re choosing between the two.",
        },
        {
          href: "/guides/share-contacts-with-family-iphone",
          title: "Share contacts with family on iPhone",
          body: "Every way to do it, built in or not.",
        },
      ]}
    />
  );
}
