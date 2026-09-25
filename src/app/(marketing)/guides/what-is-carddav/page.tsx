import Link from "next/link";

import { Callout, GuideArticle, Steps, type GuideSection } from "../_components/guide-article";
import { getGuidePage } from "../_content/pages";
import { guideMetadata } from "../_content/seo";
import { SRC } from "../_content/sources";

// P50A-06 · Guide 5. Kontax CardDAV facts: server URL + email username + a
// per-device app password from Settings → Data → Connect a device
// (src/app/settings/data/devices/page.tsx); 1 app password on Free, 5 on paid
// plans (appPasswordsLimit, src/server/dav/plan-entitlements.mjs); family and
// team books are served over CardDAV too (server.mjs).

const page = getGuidePage("/guides/what-is-carddav");

export const metadata = guideMetadata(page);

const sections: GuideSection[] = [
  {
    id: "what-it-is",
    title: "CardDAV in plain English",
    body: (
      <>
        <p>
          Think of a CardDAV address book as a folder on a server, with one file per contact. Your phone, laptop
          and any other app you connect each keep a copy. When something changes, they ask the server what’s
          different since they last checked and fetch only that, so a small change doesn’t mean downloading
          your whole list again. Edits travel both ways: change a number on your phone and it goes back to the
          server, then out to your other devices.
        </p>
        <p>
          Technically, CardDAV is an extension of WebDAV (itself an extension of the web’s HTTP), defined by the
          IETF in RFC 6352 in 2011. It’s an open standard, so any server and any app can implement it without
          permission or a licence.
        </p>
        <h3>CardDAV and vCard</h3>
        <p>
          The two are often mentioned together. <strong>vCard</strong> is the file format: a <code>.vcf</code>{" "}
          file describing a contact’s name, numbers, addresses and so on. <strong>CardDAV</strong> is how those
          vCards are stored on a server and kept in sync. Exporting contacts gives you vCard files; connecting
          an account uses CardDAV.
        </p>
      </>
    ),
  },
  {
    id: "who-supports-it",
    title: "Who supports CardDAV",
    body: (
      <ul>
        <li>
          <strong>Apple:</strong> the Contacts app on iPhone, iPad and Mac can add any CardDAV account, and
          other apps can reach iCloud Contacts with an app-specific password.
        </li>
        <li>
          <strong>Google:</strong> offers a CardDAV interface to Google Contacts, but it requires Google’s own
          sign-in (OAuth) rather than a password, so it’s mostly used by apps rather than typed into a phone.
        </li>
        <li>
          <strong>Fastmail:</strong> offers CardDAV with an app password on its plans that include it (not
          Basic).
        </li>
        <li>
          <strong>Self-hosted servers</strong> such as Nextcloud, and many email and hosting providers.
        </li>
        <li>
          <strong>Android:</strong> phones don’t generally include CardDAV support out of the box, but a free,
          open-source app, DAVx⁵, adds it and puts the contacts in your normal Contacts app.
        </li>
      </ul>
    ),
  },
  {
    id: "set-up",
    title: "Adding a CardDAV account on iPhone, Mac and Android",
    body: (
      <>
        <h3>iPhone or iPad</h3>
        <Steps
          items={[
            <>
              Open <strong>Settings → Apps → Contacts → Contacts Accounts → Add Account</strong>.
            </>,
            <>
              Tap <strong>Add Other Account</strong>, then <strong>Add CardDAV Account</strong>.
            </>,
            <>Enter the server address, your username and the app password from your provider.</>,
          ]}
        />
        <h3>Mac</h3>
        <Steps
          items={[
            <>
              In the Contacts app, choose <strong>Contacts → Add Account</strong>, then{" "}
              <strong>Other Contacts Account</strong>.
            </>,
            <>Enter the same details, choosing CardDAV if you’re asked for an account type.</>,
          ]}
        />
        <h3>Android</h3>
        <Steps
          items={[
            <>Install DAVx⁵ and add an account with the server address, username and app password.</>,
            <>
              Choose which address books to sync. Your contacts appear in the Contacts app you already use;
              DAVx⁵ doesn’t store them itself.
            </>,
          ]}
        />
        <p>
          The server address comes from your provider’s help pages or settings. If a set-up fails, the usual
          culprit is the password: see{" "}
          <Link href="/help/sync/app-password-problems">app password problems</Link>.
        </p>
      </>
    ),
  },
  {
    id: "app-passwords",
    title: "Why CardDAV uses app passwords",
    body: (
      <>
        <p>
          An app password is a separate password for one device or app, used instead of your main account
          password. It means your main password never sits in a phone’s settings, it keeps working with
          two-factor authentication turned on, and if you lose a device you can revoke that one password without
          signing out everywhere else.
        </p>
        <ul>
          <li>
            <strong>Apple:</strong> create one at account.apple.com under Sign-In and Security → App-Specific
            Passwords. Your Apple Account needs two-factor authentication, you can have up to 25 active at once,
            and changing your main Apple Account password revokes them all.
          </li>
          <li>
            <strong>Kontax:</strong> each device gets its own app password, created in Settings → Data → Connect
            a device. Free includes one device; paid plans include five. Revoke any of them at any time.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "kontax-carddav",
    title: "Kontax as a CardDAV address book",
    body: (
      <>
        <p>
          Kontax works in two directions over CardDAV. It connects to iCloud, Fastmail and other CardDAV servers
          as a client to sync their contacts; and it is a CardDAV server itself, so your Kontax address book
          appears in the iPhone and Mac Contacts apps, or on Android through DAVx⁵, with no Kontax app to
          install.
        </p>
        <Steps
          items={[
            <>
              In Kontax, open <strong>Settings → Data → Connect a device</strong>. Copy the server URL and your
              username, and create an app password for this device.
            </>,
            <>Add a CardDAV account on your device, as above, with those details.</>,
            <>
              Your Kontax contacts appear as another account in Contacts. Changes you make on the phone sync back
              to Kontax, and the other way round. On Family and Teams plans, shared address books appear too.
            </>,
          ]}
        />
        <Callout title="What CardDAV doesn’t carry">
          <p>
            CardDAV moves the contact card itself: names, numbers, emails, addresses, dates, notes and photos.
            How an app shows groups or labels varies from app to app, so organising features such as Kontax
            labels are best managed in Kontax.
          </p>
        </Callout>
        <p>
          For the full walkthrough, see{" "}
          <Link href="/help/sync/what-is-carddav">CardDAV in the Kontax help centre</Link>, or connect a provider
          with <Link href="/help/sync/connect-fastmail-contacts">connect Fastmail contacts</Link> and{" "}
          <Link href="/help/sync/connect-android-davx5">connect Android with DAVx⁵</Link>.
        </p>
      </>
    ),
  },
];

export default function WhatIsCardDavGuide() {
  return (
    <GuideArticle
      page={page}
      answer={
        <p>
          CardDAV is an open standard for storing contacts on a server and keeping them in sync with your
          devices. It was published by the IETF in 2011 as RFC 6352, and it stores each contact as a vCard.
          iPhone, iPad and Mac support it out of the box, many email and contacts services offer it, and on
          Android a free app such as DAVx⁵ adds it. It’s how a service like Kontax can appear inside your iPhone
          Contacts app without an app of its own.
        </p>
      }
      sections={sections}
      sources={[
        SRC.rfc6352,
        SRC.appleIphoneAccounts,
        SRC.appleMacAccounts,
        SRC.appleAppPasswords,
        SRC.googleCardDav,
        SRC.fastmailServers,
        SRC.davx5,
      ]}
      related={[
        {
          href: "/guides/sync-icloud-and-google-contacts",
          title: "Sync iCloud and Google contacts",
          body: "What CardDAV makes possible when your contacts are split.",
        },
        {
          href: "/guides/export-contacts",
          title: "Export your contacts",
          body: "vCard files, CSV and the Kontax format.",
        },
        {
          href: "/compare/kontax-vs-icloud-contacts",
          title: "Kontax vs iCloud Contacts",
          body: "When iCloud is enough, and what Kontax adds.",
        },
      ]}
    />
  );
}
