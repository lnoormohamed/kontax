// P26-12 · /help FAQ content (design P26-DB07 §4).
// Section ids double as the deep-link anchors used by help tooltips and empty
// states (#carddav / #import / #security / #sharing / #billing etc.).
//
// P32-02 · Taxonomy expanded to 14 sections covering all shipped features.
// P32-03 · Remaining sections will have full articles added.
//
// Copy is sourced from the locked design brief, with facts reconciled against
// the real product entitlements (plan-data.ts) and flows. Notably the account
// deletion grace period is 30 days (src/app/actions/account.ts), not the 14
// days an early design draft showed.

export type HelpFaqItem = { q: string; a: string };
export type HelpFaqSection = { id: string; title: string; items: HelpFaqItem[] };

export const HELP_FAQ: HelpFaqSection[] = [
  // ── 1. Managing contacts ────────────────────────────────────────────────────
  {
    id: "contacts",
    title: "Managing contacts",
    items: [
      {
        q: "How do I add a contact?",
        a: "Click Create contact in the top-right corner (desktop) or the + button in the bottom navigation bar (mobile). Fill in as many or as few fields as you like — only a name is required. You can always add more details later by opening the contact and clicking Edit.",
      },
      {
        q: "Can I mark a contact as a favorite or emergency contact?",
        a: "Yes. Open the contact and click the star icon to add it to Favorites, or use the ⋯ menu to mark it as an Emergency contact. Favorites appear first when you sort by name, and both have their own filter in the sidebar.",
      },
      {
        q: "How do I archive or delete a contact?",
        a: "Open the contact and click Archive (the contact moves to Archived, out of your main list but not gone). To delete permanently, go to Archived, open the contact, and choose Delete. Deleting is irreversible.",
      },
    ],
  },

  // ── 2. Organising: labels, books & lists ────────────────────────────────────
  {
    id: "organizing",
    title: "Organising: labels, books & lists",
    items: [
      {
        q: "What are labels?",
        a: 'Labels are flexible tags you add to individual contacts — "VIP", "Newsletter", "Investor". A contact can have any number of labels, and labels cut across books. Click a label in the sidebar or on a contact to filter your list to everyone with that label.',
      },
      {
        q: "How do I create and manage labels?",
        a: 'Open a contact, click Add label, and type a name. To rename, recolour, merge, or delete a label across all contacts at once, click Manage next to the Labels section in the sidebar. On mobile, tap the filter glyph in the header and choose Manage from the Labels row.',
      },
      {
        q: "What is a smart list?",
        a: "A smart list is a saved filter — it remembers a combination of search, filter, label, and book settings so you can recall it with one click. When your current view is filtered (e.g. label=VIP), click Save as list in the filter bar to name and save it.",
      },
      {
        q: "What are personal books?",
        a: 'Books let you group contacts into named address books — "Work", "Personal", "Events". Unlike labels, a contact lives in exactly one book. Books are great when you want clear separation, not just tags. Create a book from the Books section in the sidebar.',
      },
    ],
  },

  // ── 3. CardDAV & Sync ───────────────────────────────────────────────────────
  {
    id: "carddav",
    title: "CardDAV & sync",
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
        a: "Add a CardDAV account on the Sync page using your Nextcloud address-book URL (in the Nextcloud Contacts app, open the address book’s ⋯ menu and choose Copy link), then enter your Nextcloud username and password.",
      },
    ],
  },

  // ── 4. Google & Outlook sync ────────────────────────────────────────────────
  {
    id: "sync-oauth",
    title: "Google & Outlook sync",
    items: [
      {
        q: "How do I sync with Google Contacts?",
        a: "Go to Sync and click Connect Google. You’ll be taken through Google’s sign-in and permission screen — grant access to your contacts, and Kontax will do a full import followed by ongoing two-way sync. Changes in either place stay in step.",
      },
      {
        q: "How do I sync with Outlook / Microsoft 365?",
        a: "Go to Sync and click Connect Outlook. Sign in with your Microsoft account and approve the contacts permission. Kontax imports your Outlook contacts and keeps them in sync going forward.",
      },
      {
        q: "What’s the difference between Google/Outlook sync and CardDAV sync?",
        a: "CardDAV sync connects directly to an address book server (iCloud, Nextcloud, Fastmail) using a standard protocol and an app password. Google and Outlook sync use their own OAuth APIs — you sign in with your Google or Microsoft account, no separate password needed. Both give you two-way sync; the difference is just how they connect.",
      },
    ],
  },

  // ── 5. Import & Export ──────────────────────────────────────────────────────
  {
    id: "import",
    title: "Import & export",
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

  // ── 6. Sharing & Permissions ────────────────────────────────────────────────
  {
    id: "sharing",
    title: "Sharing & permissions",
    items: [
      {
        q: "How do I accept a contact someone shared with me?",
        a: "Pending shares appear under Shared with me, and you’ll get a notification when something new arrives. Accept it to add a copy to your own address book, where you can favourite it, add private notes, or edit your copy.",
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

  // ── 7. Notifications & reminders ────────────────────────────────────────────
  {
    id: "notifications",
    title: "Notifications & reminders",
    items: [
      {
        q: "How do birthday reminders work?",
        a: "When a contact has a birthday saved, Kontax sends you a notification a set number of days in advance (7 days by default). You can change the lead time globally in Settings → Notifications, or override it per contact in the contact’s edit form.",
      },
      {
        q: "How do I subscribe to a birthday calendar?",
        a: "Go to Settings → Notifications → Birthday calendar. Copy the iCal URL and add it as a subscribed calendar in Apple Calendar, Google Calendar, or any other app that supports calendar subscriptions. The calendar updates automatically as you add or edit contact birthdays.",
      },
      {
        q: "How do I control which notifications I receive?",
        a: "Go to Settings → Notifications to turn each category on or off. Security alerts and billing notifications can’t be turned off. You can also choose a daily or weekly digest instead of individual notifications.",
      },
    ],
  },

  // ── 8. Your public card ─────────────────────────────────────────────────────
  {
    id: "public-card",
    title: "Your public card",
    items: [
      {
        q: "How do I claim a username?",
        a: "Go to Settings → Profile → Public card. Pick a username (3–30 characters, letters, numbers, hyphens, and underscores). Once claimed, your card is available at kontax.app/@username.",
      },
      {
        q: "What shows on my public card?",
        a: "You control exactly which fields are visible. Go to Settings → Profile → Public card and use the per-field toggles to show or hide name, phone, email, company, and any other fields. You can also hide your card entirely.",
      },
      {
        q: "How do others save my contact from my card?",
        a: "Anyone who visits your card page can download your contact as a vCard, or — if they have Kontax — add you directly to their address book with one tap.",
      },
    ],
  },

  // ── 9. Family & Teams ───────────────────────────────────────────────────────
  {
    id: "family-teams",
    title: "Family & Teams",
    items: [
      {
        q: "How does Family sharing work?",
        a: "Family covers up to six people with one shared address book everyone can see. Each member keeps their own private contacts alongside the shared book, and the owner manages who can edit.",
      },
      {
        q: "How do I invite someone to my Family?",
        a: "Go to Settings → Family. Click Invite member and enter their email. They’ll receive an invitation email and, once they accept, they can see and (if you allow it) edit the shared address book.",
      },
      {
        q: "How is Teams different from Family?",
        a: "Teams (for organisations) supports more members, multiple separate shared address books per team, role-based permissions (admin vs. member), and a full audit log showing who changed what and when. Family is simpler: one shared book, up to six people.",
      },
    ],
  },

  // ── 10. Account & Security ──────────────────────────────────────────────────
  {
    id: "security",
    title: "Account & security",
    items: [
      {
        q: "How do I set up two-factor authentication?",
        a: "Open Settings → Security and choose Add authenticator app. Scan the QR code with any TOTP app (1Password, Authy, Google Authenticator) and enter the 6-digit code to confirm. Recovery codes are shown once — store them somewhere safe.",
      },
      {
        q: "What happens if I delete my account?",
        a: "Your account, contacts, and sync connections are permanently removed after a 30-day grace period — and you can cancel the deletion any time before then. You can also export everything to CSV or vCard before you delete, so nothing is lost.",
      },
    ],
  },

  // ── 11. Plans & Billing ─────────────────────────────────────────────────────
  {
    id: "billing",
    title: "Plans & billing",
    items: [
      {
        q: "What’s included in the free plan?",
        a: "Up to 500 contacts, one sync account, one device, and the last three changes shown per contact. Pro removes those limits and adds the full activity log and live & static sharing.",
      },
      {
        q: "How do I upgrade or manage my subscription?",
        a: "Go to Settings → Plan & billing and click Manage billing. This opens the Stripe customer portal where you can upgrade, switch billing period, update your payment method, or cancel.",
      },
    ],
  },

  // ── 12. Your data & privacy ─────────────────────────────────────────────────
  {
    id: "gdpr",
    title: "Your data & privacy",
    items: [
      {
        q: "How do I download all my data?",
        a: "Go to Settings → Account → Your data and click Request export. Kontax prepares a ZIP file containing your contacts (vCard + CSV), full activity log, billing summary, and account details. You’ll get a download link within a few minutes.",
      },
      {
        q: "What does deleting my account actually remove?",
        a: "After the 30-day grace period, we delete your account, all contacts, sync connections, activity history, billing records, and any contacts shared to other users (live shares become static, then are removed). We don’t retain identifiable data after deletion completes.",
      },
    ],
  },

  // ── 13. Mobile & install ────────────────────────────────────────────────────
  {
    id: "mobile",
    title: "Mobile & install",
    items: [
      {
        q: "How do I install Kontax on my phone?",
        a: "Kontax is a Progressive Web App — no App Store needed. On iPhone: open Kontax in Safari, tap the Share button, then Add to Home Screen. On Android: open Kontax in Chrome, tap the ⋮ menu, then Add to Home screen or Install app. After install, Kontax feels like a native app.",
      },
      {
        q: "Does Kontax work offline?",
        a: "The app shell and your most recently viewed contacts are cached for offline use, so you can browse and look up contacts even without a connection. Changes you make while offline sync automatically when you reconnect.",
      },
    ],
  },

  // ── 14. Activity log ────────────────────────────────────────────────────────
  {
    id: "activity",
    title: "Activity log",
    items: [
      {
        q: "What does the Activity log show?",
        a: "The Activity tab shows a timestamped record of every change made to your contacts — who made it, what changed, and whether it came from a device sync, an import, the web app, or the API. It’s available on Pro and above.",
      },
      {
        q: "How far back does the activity log go?",
        a: "Pro accounts keep 90 days of history per contact. Family accounts keep 365 days. The Free plan shows the last 3 changes per contact. History older than the retention window is pruned automatically.",
      },
    ],
  },
];

// Help-link targets used by empty states / tooltips. Maps a logical key to the
// FAQ section anchor on /help.
export const HELP_ANCHORS = {
  contacts: "contacts",
  organizing: "organizing",
  carddav: "carddav",
  syncOauth: "sync-oauth",
  import: "import",
  sharing: "sharing",
  notifications: "notifications",
  publicCard: "public-card",
  familyTeams: "family-teams",
  security: "security",
  billing: "billing",
  gdpr: "gdpr",
  mobile: "mobile",
  activity: "activity",
} as const;
