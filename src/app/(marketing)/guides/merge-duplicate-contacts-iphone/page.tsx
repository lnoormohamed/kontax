import Link from "next/link";

import { Callout, GuideArticle, Steps, type GuideSection } from "../_components/guide-article";
import { getGuidePage } from "../_content/pages";
import { guideMetadata } from "../_content/seo";
import { SRC } from "../_content/sources";

// P50A-06 · Guide 2. Kontax facts: duplicates flagged by shared name, email or
// phone; field-by-field merge; each merge undoable for 30 days on every plan
// (MERGE_UNDO_WINDOW_DAYS, src/server/contact-merge.ts; advancedMergeEnabled
// on FREE in src/server/dav/plan-entitlements.mjs).

const page = getGuidePage("/guides/merge-duplicate-contacts-iphone");

export const metadata = guideMetadata(page);

const sections: GuideSection[] = [
  {
    id: "why-duplicates-appear",
    title: "Why duplicate contacts appear",
    body: (
      <>
        <p>Duplicates are rarely one mistake. The usual causes:</p>
        <ul>
          <li>
            <strong>The same person in more than one account.</strong> iCloud, Google and a work account each
            keep their own card for them.
          </li>
          <li>
            <strong>Importing a file into an account that already had those people.</strong> A vCard or CSV
            import adds cards; it doesn’t check who’s already there.
          </li>
          <li>
            <strong>Setting up a phone or a sync service more than once.</strong> Each first sync can bring the
            whole list in again.
          </li>
          <li>
            <strong>Saving someone twice.</strong> Once from a call with their mobile number, later from an
            email with just their address.
          </li>
        </ul>
        <p>
          The first three matter most, because merging doesn’t fix the cause: if the copies come from two
          accounts, they can come back. The last section covers prevention.
        </p>
      </>
    ),
  },
  {
    id: "merge-on-iphone",
    title: "Merge duplicates on iPhone",
    body: (
      <>
        <p>Recent versions of iOS find duplicates for you. It’s free and built in, so start here.</p>
        <Steps
          items={[
            <>Open the Contacts app.</>,
            <>
              If your iPhone has found duplicates, you’ll see <strong>View Duplicates</strong> below My Card.
              Tap it.
            </>,
            <>
              Tap a contact to review and merge it, or tap <strong>Merge All</strong> to merge every duplicate
              it found.
            </>,
          ]}
        />
        <h3>If a duplicate isn’t found</h3>
        <p>You can join two cards for the same person yourself:</p>
        <Steps
          items={[
            <>Open one of the contacts and tap <strong>Edit</strong>.</>,
            <>
              Tap <strong>Link Contacts</strong>, choose the other card, then tap <strong>Link</strong>.
            </>,
          ]}
        />
        <p>
          Linked cards show as one contact, but they aren’t merged: each stays in its own account, and when you
          edit the unified contact your iPhone copies the change to each account where that information already
          exists.
        </p>
        <h3>On a Mac</h3>
        <p>
          In the Contacts app, choose <strong>Card → Look for Duplicates</strong>, then <strong>Merge</strong>.
          To merge specific cards, select them and choose <strong>Card → Merge Selected Cards</strong>.
        </p>
      </>
    ),
  },
  {
    id: "across-google-and-icloud",
    title: "Duplicates across Google and iCloud",
    body: (
      <>
        <p>
          When one copy of a person lives in iCloud and another in Google, your iPhone can link them on screen,
          but both copies still exist in their own accounts. To actually tidy the accounts, merge inside each
          one:
        </p>
        <ul>
          <li>
            <strong>Google:</strong> on contacts.google.com, open the menu and choose <strong>Merge &amp; fix</strong>
            , then <strong>Merge</strong> or <strong>Merge all</strong>. Google can’t merge contacts saved in
            different Google Accounts.
          </li>
          <li>
            <strong>iCloud:</strong> Apple’s advice for duplicates after setting up iCloud Contacts is to use{" "}
            <strong>Card → Look for Duplicates</strong> on a Mac signed in to iCloud, repeating until none are
            left.
          </li>
        </ul>
        <p>
          That leaves one card per person in each account, which is as far as the built-in tools go. If the same
          person is in both, they’re still in both.
        </p>
        <Callout tone="kontax" title="Where Kontax helps">
          <p>
            Kontax brings your connected accounts into one address book and flags contacts that share a name,
            email address or phone number, whichever account they came from. You choose which fields to keep
            from each card before merging, and the merge is recorded in the contact’s history. Merging is included
            on every plan, Free included. See{" "}
            <Link href="/help/duplicates/merge-duplicate-contacts">merge duplicate contacts in Kontax</Link>.
          </p>
        </Callout>
      </>
    ),
  },
  {
    id: "undo",
    title: "Undoing a merge",
    body: (
      <>
        <p>Merging throws information away, so it’s worth knowing your way back before you tap Merge All.</p>
        <ul>
          <li>
            <strong>iCloud:</strong> on iCloud.com (on a computer or tablet), open{" "}
            <strong>Data Recovery → Restore Contacts</strong> and choose an earlier archived version. This
            replaces all your iCloud contacts with that version; your current version is archived first, so you
            can go back to it.
          </li>
          <li>
            <strong>Google:</strong> Google Contacts lets you separate a contact you merged, and{" "}
            <strong>Settings → Undo changes</strong> takes your whole list back to a point in the last 30 days.
          </li>
          <li>
            <strong>Kontax:</strong> each merge can be undone on its own for 30 days, without rolling back
            anything else. See <Link href="/help/duplicates/undo-a-merge">undo a merge</Link>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "prevent",
    title: "Stop duplicates coming back",
    body: (
      <>
        <ul>
          <li>
            Choose one <strong>Default Account</strong> for new contacts (Settings → Apps → Contacts on iPhone;
            Contacts → Settings → General on a Mac).
          </li>
          <li>Don’t import the same vCard or CSV file into an account twice.</li>
          <li>
            If you only need to see another account on your phone, add it in Settings rather than importing its
            contacts into iCloud.
          </li>
          <li>
            When you connect any new sync service, check its first sync before connecting a second account.
          </li>
        </ul>
        <p>
          In Kontax, the import preview warns about rows that match an existing contact by email or phone
          before anything is added. If you’re moving between providers, our{" "}
          <Link href="/guides/sync-icloud-and-google-contacts">iCloud and Google sync guide</Link> compares the
          options.
        </p>
      </>
    ),
  },
];

export default function MergeDuplicateContactsIphoneGuide() {
  return (
    <GuideArticle
      page={page}
      answer={
        <p>
          Open the Contacts app. If your iPhone has found duplicates, you’ll see View Duplicates below My Card:
          tap it, then merge them one by one or tap Merge All. If a duplicate isn’t found, open one card, tap
          Edit, then Link Contacts to join it to the other. That’s built in and free. You only need more if your
          duplicates keep coming back from another account, or you want to be able to undo one merge later.
        </p>
      }
      sections={sections}
      sources={[
        SRC.appleMergeIphone,
        SRC.appleMergeMac,
        SRC.appleIcloudDuplicates,
        SRC.appleIcloudRestore,
        SRC.googleMerge,
        SRC.googleUndo,
        SRC.appleIphoneAccounts,
        SRC.appleMacAccounts,
      ]}
      related={[
        {
          href: "/guides/sync-icloud-and-google-contacts",
          title: "Sync iCloud and Google contacts",
          body: "Three honest ways to get the two in step.",
        },
        {
          href: "/help/duplicates/undo-a-merge",
          title: "Undo a merge in Kontax",
          body: "Put two contacts back as they were, for up to 30 days.",
        },
        {
          href: "/guides/export-contacts",
          title: "Export your contacts",
          body: "Take a copy before a big clean-up.",
        },
      ]}
    />
  );
}
