import Link from "next/link";

import { Faq } from "../../_components/mkt-ui";
import { Callout, GuideArticle, Steps, type GuideSection } from "../_components/guide-article";
import { getGuidePage } from "../_content/pages";
import { guideMetadata } from "../_content/seo";
import { SRC } from "../_content/sources";

// P50A-06 · Guide 1. Kontax behaviour checked against the code (2026-09-25):
// Google and CardDAV pushes only send contacts last changed in Kontax
// (web, API, import or a device via Kontax's CardDAV — never a sync import;
// P49A-12 src/server/sync-dirty.ts, google-sync.ts, sync-runner.ts),
// so Kontax does not copy a whole Google list into iCloud; Free = 1 sync source,
// Pro = 5 (src/server/dav/plan-entitlements.mjs).

const page = getGuidePage("/guides/sync-icloud-and-google-contacts");

export const metadata = guideMetadata(page);

const sections: GuideSection[] = [
  {
    id: "why-they-drift",
    title: "Why iCloud and Google contacts drift apart",
    body: (
      <>
        <p>
          iCloud and Google each keep their own address book, and neither syncs with the other. An iPhone or
          Mac can show both at once, but a contact saved to Google stays in Google, and a contact saved to
          iCloud stays in iCloud. New contacts go to whichever account is set as the default on that device.
        </p>
        <p>
          Over a few years that adds up: some people only in one account, some in both with different phone
          numbers, and an Android phone or a work laptop that only ever sees half of the list. Before picking a
          method, decide what you actually need:
        </p>
        <ul>
          <li>
            <strong>A one-off move</strong> — you’re leaving one for the other. Use method 1.
          </li>
          <li>
            <strong>Everything visible on your iPhone or Mac</strong> — you don’t mind two separate accounts.
            Use method 2.
          </li>
          <li>
            <strong>One list that stays current</strong> — you use both and want edits to follow. Method 3.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "one-off-copy",
    title: "Method 1: copy contacts across once with a vCard file",
    body: (
      <>
        <p>
          Free and takes a few minutes on a computer. vCard (<code>.vcf</code>) is the standard contacts file
          that both services read and write.
        </p>
        <h3>Google to iCloud</h3>
        <Steps
          items={[
            <>
              Open <strong>contacts.google.com</strong>, select the contacts you want (or all of them), then
              choose <strong>More actions → Export</strong> and pick <strong>vCard</strong>.
            </>,
            <>
              Go to <strong>icloud.com/contacts</strong> on a computer or tablet (Contacts on iCloud.com isn’t
              available on a phone), select the <strong>Add</strong> button, then <strong>Import Contact</strong>{" "}
              and choose the file.
            </>,
          ]}
        />
        <h3>iCloud to Google</h3>
        <Steps
          items={[
            <>
              On <strong>icloud.com/contacts</strong>, select the contacts (use <strong>Select All Contacts</strong>{" "}
              for everyone), then choose <strong>Share → Export vCard</strong>. Several contacts export as one
              file.
            </>,
            <>
              In Google Contacts, choose <strong>Import</strong>, select the file, then <strong>Import</strong>.
            </>,
          ]}
        />
        <p>
          <strong>Good for:</strong> moving once. <strong>The catch:</strong> it’s a snapshot. Anything you
          change afterwards stays in the account where you changed it, and importing into an account that
          already holds some of the same people creates duplicates. Our{" "}
          <Link href="/guides/export-contacts">export guide</Link> covers every export route in more detail.
        </p>
      </>
    ),
  },
  {
    id: "both-on-iphone",
    title: "Method 2: show both accounts on your iPhone or Mac",
    body: (
      <>
        <p>If what you want is to see everyone on your Apple devices, you may not need to move anything.</p>
        <Steps
          items={[
            <>
              On iPhone, open <strong>Settings → Apps → Contacts → Contacts Accounts → Add Account</strong>,
              choose Google, sign in and turn on <strong>Contacts</strong>.
            </>,
            <>
              Still in <strong>Settings → Apps → Contacts</strong>, set <strong>Default Account</strong> to the
              account where new contacts should go.
            </>,
            <>
              On a Mac, choose <strong>Contacts → Add Account</strong> in the Contacts app and add Google the same
              way. Its default account is under <strong>Contacts → Settings → General</strong>.
            </>,
          ]}
        />
        <p>
          The iPhone links cards for the same person from different accounts so they appear once in All
          Contacts. Linking doesn’t merge the accounts, though: both copies still exist, and nothing is copied
          from Google into iCloud.
        </p>
        <p>
          <strong>Good for:</strong> Apple-only households who just want one view. <strong>The catch:</strong>{" "}
          an Android phone, or iCloud.com in a browser, still sees only its own account.
        </p>
      </>
    ),
  },
  {
    id: "keep-in-step",
    title: "Method 3: keep one address book that syncs with both",
    body: (
      <>
        <p>
          A contacts service that connects to both accounts can keep one address book for you. This is what
          Kontax does. You connect Google (by signing in with Google) and iCloud (with an Apple app-specific
          password), and Kontax brings both into one address book, with each contact tagged with where it came
          from. Then you add Kontax to your iPhone or Mac Contacts as a CardDAV account, so the combined list is
          on your phone without a separate app.
        </p>
        <Steps
          items={[
            <>
              Create a Kontax account and connect Google from the Sync page (see{" "}
              <Link href="/help/sync/connect-google-contacts">connect Google Contacts</Link>).
            </>,
            <>
              Create an app-specific password for your Apple Account at <strong>account.apple.com</strong>{" "}
              (Sign-In and Security → App-Specific Passwords; your account needs two-factor authentication),
              then connect iCloud (see{" "}
              <Link href="/help/sync/connect-icloud-contacts">connect iCloud contacts</Link>).
            </>,
            <>
              Review the duplicates Kontax finds between the two accounts and merge the ones that are the same
              person. See{" "}
              <Link href="/help/sync/duplicate-flood-after-first-sync">duplicates after your first sync</Link>.
            </>,
            <>Add Kontax to your iPhone with a Kontax app password, from Settings → Data → Connect a device.</>,
          ]}
        />
        <Callout tone="kontax" title="What Kontax does, and doesn’t">
          <p>
            Edit a contact in Kontax and the change goes back to the account it came from. Contacts you add or
            edit in Kontax are written to your connected accounts (two-way is the default; any connection can
            be set to import only). Contacts you never touch in Kontax stay where they are: Kontax doesn’t copy
            your whole Google list into iCloud, or the other way round.
          </p>
          <p>
            The Free plan includes one sync source, so connecting both iCloud and Google needs Pro, which
            allows up to five. See <Link href="/pricing">plans and pricing</Link>.
          </p>
        </Callout>
      </>
    ),
  },
  {
    id: "avoid-duplicates",
    title: "Avoiding duplicates, whichever method you choose",
    body: (
      <>
        <ul>
          <li>
            Pick one default account for new contacts on every device, so new people don’t land in a different
            place each time.
          </li>
          <li>Tidy the source before you copy it. Merging 20 duplicates once is easier than twice.</li>
          <li>
            Don’t import the same file twice. If an import goes wrong, iCloud.com can restore an earlier
            archived version of your contacts, and Google Contacts can undo changes from the last 30 days.
          </li>
          <li>
            After copying, merge what’s left: <strong>View Duplicates</strong> in the iPhone Contacts app,{" "}
            <strong>Card → Look for Duplicates</strong> on a Mac, and <strong>Merge &amp; fix</strong> in Google
            Contacts.
          </li>
        </ul>
        <p>
          The step-by-step version is in{" "}
          <Link href="/guides/merge-duplicate-contacts-iphone">how to merge duplicate contacts on iPhone</Link>.
          In Kontax, duplicates are flagged across all your connected accounts, and each merge can be undone for
          30 days.
        </p>
      </>
    ),
  },
  {
    id: "faq",
    title: "Questions",
    body: (
      <Faq
        openFirst={false}
        items={[
          {
            q: "Can iCloud and Google sync contacts with each other directly?",
            a: (
              <p>
                No. Neither offers a setting that keeps the two in step. You can copy contacts across with a
                vCard file, show both accounts on an iPhone or Mac, or use a third service that connects to
                both.
              </p>
            ),
          },
          {
            q: "Do I need Kontax to see Google contacts on my iPhone?",
            a: (
              <p>
                No. Add your Google account in Settings → Apps → Contacts → Contacts Accounts and turn on
                Contacts. Kontax is for when you want one list that you can tidy, share and keep current across
                providers.
              </p>
            ),
          },
          {
            q: "Which account should be my main one?",
            a: (
              <p>
                If anyone in the house uses Android, Google is usually the easier home. If everything you own is
                Apple, iCloud is already set up. Our{" "}
                <Link href="/compare/google-contacts-vs-icloud">Google Contacts vs iCloud comparison</Link> goes
                through the differences.
              </p>
            ),
          },
          {
            q: "Can I try Kontax with just one account first?",
            a: (
              <p>
                Yes. The Free plan holds up to 500 contacts with one sync source and one device over CardDAV, so
                you can connect one account and add Kontax to your iPhone before deciding anything.
              </p>
            ),
          },
        ]}
      />
    ),
  },
];

export default function SyncIcloudAndGoogleContactsGuide() {
  return (
    <GuideArticle
      page={page}
      answer={
        <p>
          Apple and Google don’t sync contacts with each other, so there’s no setting that makes them one list.
          You have three honest options: copy contacts across once with a vCard file (free, a few minutes), show
          both accounts side by side on your iPhone or Mac (free, but they stay separate), or use a service that
          connects to both and keeps one address book, such as Kontax. For a one-off move, the vCard method is
          all you need.
        </p>
      }
      sections={sections}
      sources={[
        SRC.googleExport,
        SRC.googleImport,
        SRC.appleIcloudImportExport,
        SRC.appleIcloudWeb,
        SRC.appleIphoneAccounts,
        SRC.appleMacAccounts,
        SRC.appleMergeIphone,
        SRC.appleAppPasswords,
        SRC.appleIcloudRestore,
        SRC.googleUndo,
      ]}
      related={[
        {
          href: "/guides/merge-duplicate-contacts-iphone",
          title: "Merge duplicate contacts on iPhone",
          body: "The built-in merge, the copies it misses, and how to undo.",
        },
        {
          href: "/compare/google-contacts-vs-icloud",
          title: "Google Contacts vs iCloud Contacts",
          body: "Which one suits your devices, compared neutrally.",
        },
        {
          href: "/guides/what-is-carddav",
          title: "What is CardDAV?",
          body: "The open standard that puts Kontax in your iPhone Contacts app.",
        },
      ]}
    />
  );
}
