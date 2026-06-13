// P26-12 · /help FAQ content (design P26-DB07 §4).
// Section ids double as the deep-link anchors used by help tooltips and empty
// states (#carddav / #import / #security / #sharing / #billing).
//
// Copy is sourced from the locked design brief, with facts reconciled against
// the real product entitlements (plan-data.ts) and flows. Notably the account
// deletion grace period is 30 days (src/app/actions/account.ts), not the 14
// days an early design draft showed.

export type HelpFaqItem = { q: string; a: string };
export type HelpFaqSection = { id: string; title: string; items: HelpFaqItem[] };

export const HELP_FAQ: HelpFaqSection[] = [
  {
    id: "carddav",
    title: "CardDAV & Sync",
    items: [
      {
        q: "What is CardDAV?",
        a: "CardDAV is an open standard for syncing contacts between devices and services. Kontax speaks CardDAV natively, so your address book stays in sync with iPhone, Mac, Android (via DAVx⁵), and any other CardDAV-compatible app — no proprietary lock-in.",
      },
      {
        q: "How do I connect iCloud?",
        a: "On the Sync page, add an account using the server contacts.icloud.com and an app-specific password generated at appleid.apple.com. Your iCloud contacts appear in Kontax within a minute.",
      },
      {
        q: "How do I connect Nextcloud?",
        a: "Add a CardDAV account on the Sync page using your Nextcloud address-book URL (in the Nextcloud Contacts app, open the address book’s ⋯ menu and choose “Copy link”), then enter your Nextcloud username and password.",
      },
    ],
  },
  {
    id: "import",
    title: "Import & Export",
    items: [
      {
        q: "How do I import from Google Contacts?",
        a: "Export your contacts as CSV or vCard from contacts.google.com, then drop the file into Import & Export. Kontax auto-detects the Google column layout, so the field mapping is filled in for you.",
      },
      {
        q: "What CSV formats are supported?",
        a: "Any UTF-8 CSV with a header row. Kontax recognises the Google, Apple, and Outlook export layouts automatically, and you can map columns by hand — and save the mapping as a preset — for anything else.",
      },
    ],
  },
  {
    id: "security",
    title: "Account & Security",
    items: [
      {
        q: "How do I set up two-factor authentication?",
        a: "Open Settings → Security and choose “Add authenticator app”. Scan the QR code with any TOTP app (1Password, Authy, Google Authenticator) and enter the 6-digit code to confirm. Recovery codes are shown once — store them somewhere safe.",
      },
      {
        q: "What happens if I delete my account?",
        a: "Your account, contacts, and sync connections are permanently removed after a 30-day grace period — and you can cancel the deletion any time before then. You can also export everything to CSV or vCard before you delete, so nothing is lost.",
      },
    ],
  },
  {
    id: "sharing",
    title: "Sharing & Permissions",
    items: [
      {
        q: "How do I accept a contact someone shared with me?",
        a: "Pending shares appear under “Shared with me”, and you’ll get a notification when something new arrives. Accept it to add a copy to your own address book, where you can favourite it, add private notes, or edit your copy.",
      },
      {
        q: "What’s the difference between a live share and a static share?",
        a: "A live share stays in sync: when the owner edits the contact, your copy updates too. A static share is a one-time snapshot that never changes after it’s sent. The person sharing chooses which to send — live for an evolving contact, static for a fixed handoff. Sharing is a Pro feature.",
      },
      {
        q: "Can the person who shared a contact see my changes?",
        a: "No. Notes, labels, and favourites you add to a contact shared with you are private to your account. On a live share only the original owner can edit the underlying contact; your private additions are never sent back to them.",
      },
    ],
  },
  {
    id: "billing",
    title: "Plans & Billing",
    items: [
      {
        q: "What’s included in the free plan?",
        a: "Up to 500 contacts, one sync account, one device, and the last three changes shown per contact. Pro removes those limits and adds the full activity log and live & static sharing.",
      },
      {
        q: "How does Family sharing work?",
        a: "Family covers up to six people with one shared address book everyone can see. Each member keeps their own private contacts alongside the shared book, and the owner manages who can edit.",
      },
    ],
  },
];

// Help-link targets used by empty states / tooltips. Maps a logical key to the
// FAQ section anchor on /help.
export const HELP_ANCHORS = {
  carddav: "carddav",
  import: "import",
  security: "security",
  sharing: "sharing",
  billing: "billing",
} as const;
