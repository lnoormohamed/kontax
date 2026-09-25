import Link from "next/link";

import { Callout, FactTable, GuideArticle, Steps, type GuideSection } from "../_components/guide-article";
import { getGuidePage } from "../_content/pages";
import { guideMetadata } from "../_content/seo";
import { SRC } from "../_content/sources";

// P50A-06 · Guide 8. Kontax facts: Family = one shared book, up to 6 members
// (memberSlotsLimit, sharedAddressBooksLimit in plan-entitlements.mjs), per-member
// edit/view (canEdit, src/server/family-access.ts), served to devices over
// CardDAV (family collection in server.mjs); contact sharing: vCard links expire
// after 7 days on Free, live and static shares on Pro+ (plan-data.ts).

const page = getGuidePage("/guides/share-contacts-with-family-iphone");

export const metadata = guideMetadata(page);

const sections: GuideSection[] = [
  {
    id: "send-one-contact",
    title: "Send one contact: Share Contact and AirDrop",
    body: (
      <>
        <p>The quickest way to give a family member someone’s details:</p>
        <Steps
          items={[
            <>Open the contact in the Contacts app.</>,
            <>
              Tap <strong>Share Contact</strong> and choose how to send it: Messages, Mail or AirDrop to a
              nearby Apple device.
            </>,
            <>They tap the card they receive and save it to their own contacts.</>,
          ]}
        />
        <p>
          It’s a copy. If the plumber changes their number, everyone who saved the card has to update it
          themselves.
        </p>
      </>
    ),
  },
  {
    id: "namedrop",
    title: "Swap your own details: NameDrop",
    body: (
      <>
        <p>
          To exchange your own contact details with someone in the same room, hold your iPhones close together.
          NameDrop shows your contact card and lets you choose which details to share. It’s on by default; you
          can turn it off in <strong>Settings → General → AirDrop</strong> by turning off{" "}
          <strong>Bring Devices Together</strong>.
        </p>
        <p>NameDrop shares your own card only, so it’s for new family members, not for the family list.</p>
      </>
    ),
  },
  {
    id: "family-sharing",
    title: "What about Apple’s Family Sharing?",
    body: (
      <>
        <p>
          Family Sharing lets up to six people share things such as iCloud+ storage, subscriptions, purchases,
          and locations in Find My. A shared address book isn’t on that list, so turning on Family Sharing
          doesn’t give your family a common set of contacts.
        </p>
        <p>
          Sharing one Apple Account between family members isn’t the answer either. Apple recommends that each
          person has their own Apple Account, because on a shared one your data gets mixed together: messages
          and voicemails can reach the wrong person, and purchases belong to whoever owns the account.
        </p>
      </>
    ),
  },
  {
    id: "shared-account",
    title: "The workaround: a separate shared contacts account",
    body: (
      <>
        <p>
          Some families create a separate account used only for shared contacts, such as a spare Google
          account, and add it to each iPhone under{" "}
          <strong>Settings → Apps → Contacts → Contacts Accounts</strong> with only Contacts turned on. Everyone
          then sees and edits the same list.
        </p>
        <p>It works, and it’s free. The trade-offs are worth knowing:</p>
        <ul>
          <li>everyone has the same password, so you can’t remove one person without changing it for all;</li>
          <li>anyone can edit or delete anything, and there’s no record of who did what;</li>
          <li>new contacts can land there by accident if it becomes someone’s default account.</li>
        </ul>
      </>
    ),
  },
  {
    id: "kontax-family",
    title: "A shared family address book with Kontax",
    body: (
      <>
        <p>
          Kontax Family gives up to six people one shared address book, with each person signing in with their
          own Kontax account and keeping their own contacts private. The shared book appears in each person’s
          iPhone Contacts over CardDAV, so it’s there when they search or call.
        </p>
        <Steps
          items={[
            <>
              On the Family plan, invite members by email from Settings → Sharing → Family. See{" "}
              <Link href="/help/family-teams/set-up-family-sharing">set up family sharing</Link>.
            </>,
            <>Choose, for each member, whether they can edit the shared book or only view it.</>,
            <>
              Each person adds Kontax to their iPhone as a CardDAV account with their own app password, from
              Settings → Data → Connect a device.
            </>,
          ]}
        />
        <Callout tone="kontax" title="Sharing single contacts in Kontax">
          <p>
            Every plan can share a contact by link; on Free the link expires after 7 days. Pro and above add
            live sharing, where the person you share with sees your later changes. See{" "}
            <Link href="/help/sharing/live-vs-static-sharing">live and static sharing</Link>.
          </p>
        </Callout>
        <p>
          Running a small business rather than a household? Compare the plans in{" "}
          <Link href="/help/family-teams/family-vs-teams">Family vs Teams</Link>, or see{" "}
          <Link href="/pricing">pricing</Link>.
        </p>
      </>
    ),
  },
  {
    id: "which-to-choose",
    title: "Which method to choose",
    body: (
      <FactTable
        caption="Ways to share contacts with family on iPhone"
        columns={["Good for", "Stays up to date?"]}
        rows={[
          { label: "Share Contact / AirDrop", cells: ["Passing on one or two numbers.", "No: it’s a copy."] },
          { label: "NameDrop", cells: ["Swapping your own details in person.", "No: it’s a copy."] },
          {
            label: "Shared contacts account",
            cells: ["A free shared list, if everyone is trusted with one password.", "Yes, for everyone."],
          },
          {
            label: "Kontax Family",
            cells: ["A shared list with separate logins and edit or view rights.", "Yes, for everyone."],
          },
        ]}
      />
    ),
  },
];

export default function ShareContactsWithFamilyGuide() {
  return (
    <GuideArticle
      page={page}
      answer={
        <p>
          To send someone a single contact, open it, tap Share Contact and choose Messages, Mail or AirDrop. To
          swap your own details in person, hold two iPhones close together to use NameDrop. Apple’s Family
          Sharing doesn’t include a shared address book, so for a list the whole family can use and edit (the
          plumber, the school, the grandparents) you need a separate shared account or a shared family address
          book such as Kontax Family.
        </p>
      }
      sections={sections}
      sources={[
        SRC.appleShareContact,
        SRC.appleAirDrop,
        SRC.appleNameDrop,
        SRC.appleFamilySharing,
        SRC.appleOwnAccount,
        SRC.appleIphoneAccounts,
      ]}
      related={[
        {
          href: "/help/family-teams/set-up-family-sharing",
          title: "Set up family sharing in Kontax",
          body: "Invite members and choose who can edit.",
        },
        {
          href: "/compare/kontax-vs-icloud-contacts",
          title: "Kontax vs iCloud Contacts",
          body: "When iCloud is enough, and what Kontax adds.",
        },
        {
          href: "/guides/merge-duplicate-contacts-iphone",
          title: "Merge duplicate contacts on iPhone",
          body: "Tidy up after everyone’s shared the same numbers.",
        },
      ]}
    />
  );
}
