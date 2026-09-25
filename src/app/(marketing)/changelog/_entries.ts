// Shared changelog content — consumed by both the /changelog page and the
// /changelog.xml RSS feed (src/app/changelog.xml/route.ts) so the two never
// drift apart. Release-figure mockups (the little product screenshots) are
// presentational only and stay hand-written in page.tsx; everything that is
// actual changelog *content* lives here.
//
// To ship a new release: add an entry to the FRONT of CHANGELOG_ENTRIES below,
// then (if this one has a release figure) add the JSX for it in page.tsx's
// FIGURES map, keyed by the entry's `id`.
//
// P50A-01: this file used to contain four fabricated entries (v3.0-v3.3,
// dated April-May 2026) — before Kontax's first commit (6 June 2026) — and
// mentioned Outlook, which has never been live in production. It has been
// rebuilt from the real, verifiable release history: `git log --reverse
// --format='%ad %s' --date=short origin/main` cross-referenced against the
// phase docs in roadmap/build-phase/. Every entry below is something that
// actually shipped to production on or before commit b71a35f (the last
// commit on main as of this rewrite); the final entry is the pending release
// this ticket ships with. Outlook is never mentioned, since it still isn't
// configured in production.

export type ChangelogCategoryLabel = "Added" | "Improved" | "Fixed" | "Security";

export interface ChangelogCategory {
  label: ChangelogCategoryLabel;
  items: string[];
}

export interface ChangelogEntry {
  /** Stable slug, also used as the RSS item guid and as an anchor id. */
  id: string;
  version: string;
  /** ISO date (yyyy-mm-dd), used for <time dateTime> and RSS pubDate. */
  date: string;
  /** Human-readable date matching `date`, e.g. "28 May 2026". */
  displayDate: string;
  title: string;
  /** Optional lede shown only on headline (figure) releases. */
  summary?: string;
  categories: ChangelogCategory[];
  /** True when this release has a hand-drawn figure mock in page.tsx. */
  hasFigure?: boolean;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  // ── Pending release — ships with this change ──────────────────────────────
  // TODO: update `date` / `displayDate` to the actual release date before/at
  // deploy — 2026-09-26 is a placeholder for "the day this ships".
  {
    id: "v1.22",
    version: "v1.22",
    date: "2026-09-26",
    displayDate: "26 Sep 2026",
    title: "New homepage, plus sync and billing reliability fixes",
    categories: [
      {
        label: "Added",
        items: [
          "A redesigned homepage that shows Kontax in action, with a clearer plan comparison.",
          "A 7-day notice before a Family plan is dissolved after billing lapses, giving members time to act before anything is removed.",
        ],
      },
      {
        label: "Improved",
        items: [
          "Google Contacts sync accuracy and conflict handling.",
          "CardDAV sync is more robust when writing and pushing changes from Kontax.",
          "Billing events from Stripe are processed more reliably, with fixes to Teams seat counts and contact-limit edge cases.",
        ],
      },
      {
        label: "Fixed",
        items: [
          "Several public pages (including About and Contact) that were incorrectly requiring sign-in.",
        ],
      },
    ],
  },

  // ── Real, shipped history (2026-06-06 – 2026-09-15) ────────────────────────
  {
    id: "v1.21",
    version: "v1.21",
    date: "2026-09-15",
    displayDate: "15 Sep 2026",
    title: "Security hardening",
    categories: [
      {
        label: "Security",
        items: [
          "Two-factor authentication is now strictly enforced and can no longer be bypassed.",
          "Sync connections can no longer be pointed at internal or private network addresses.",
          "Fixed several cross-account data-access bugs (including in merge suggestions and sync jobs).",
          "Calendar, share and invite links are now stored as secure hashes rather than plain tokens.",
          "Stronger rate limiting to protect against abuse.",
        ],
      },
    ],
  },
  {
    id: "v1.20",
    version: "v1.20",
    date: "2026-07-06",
    displayDate: "6 Jul 2026",
    title: "Contacts list and photo polish",
    categories: [
      {
        label: "Added",
        items: ["An A–Z scrubber to jump straight to a letter in a long contacts list."],
      },
      {
        label: "Improved",
        items: [
          "Settings reorganised — billing gets its own page, sharing and groups restructured.",
          "Duplicate detection now matches names written in different scripts.",
        ],
      },
      {
        label: "Fixed",
        items: [
          "Contact photos not displaying correctly in some cases; added a proper upload flow.",
          "Contact detail tabs no longer break the browser Back button.",
        ],
      },
    ],
  },
  {
    id: "v1.19",
    version: "v1.19",
    date: "2026-07-05",
    displayDate: "5 Jul 2026",
    title: "Kontax goes live",
    summary: "Kontax is live at getkontax.com, with real subscription billing.",
    categories: [
      {
        label: "Added",
        items: ["Kontax is now live in production, with real subscription billing."],
      },
    ],
  },
  {
    id: "v1.18",
    version: "v1.18",
    date: "2026-07-04",
    displayDate: "4 Jul 2026",
    title: "Photo sync, multiple address books, open export format",
    categories: [
      {
        label: "Added",
        items: [
          "Contact photos now sync two-way with Google and CardDAV connections.",
          "A contact can belong to more than one address book at once, with private fields kept private to you.",
          "A new open, lossless export format that preserves photos, custom fields and labels.",
          "An Interface settings section to toggle label chips and reduce motion.",
        ],
      },
      {
        label: "Fixed",
        items: [
          "Losing your connection no longer takes over the screen — a small banner appears instead and you stay where you were.",
        ],
      },
    ],
  },
  {
    id: "v1.17",
    version: "v1.17",
    date: "2026-07-03",
    displayDate: "3 Jul 2026",
    title: "Sync safety controls",
    categories: [
      {
        label: "Added",
        items: [
          "Sync pauses and alerts you if a connection would suddenly delete an unusually large number of contacts.",
          "Set sync hours so a connection only runs during a time window you choose.",
          "Exclude specific fields (notes, birthday, address, custom fields) from sync per connection.",
        ],
      },
    ],
  },
  {
    id: "v1.16",
    version: "v1.16",
    date: "2026-07-02",
    displayDate: "2 Jul 2026",
    title: "Faster contacts list and a security fix",
    categories: [
      {
        label: "Improved",
        items: [
          "Contacts list loads and scrolls noticeably faster, with instant favouriting and archiving.",
          "Search stays fast and accurate as your address book grows.",
        ],
      },
      {
        label: "Security",
        items: [
          "Fixed a stored cross-site-scripting issue affecting public contact-card pages.",
          "Hardened the account-notification email webhook against forged requests.",
        ],
      },
    ],
  },
  {
    id: "v1.15",
    version: "v1.15",
    date: "2026-06-26",
    displayDate: "26 Jun 2026",
    title: "Sign-in accounts, more reminders, contact health",
    categories: [
      {
        label: "Added",
        items: [
          "View and manage connected sign-in accounts from Security settings.",
          "Reminders for dates beyond birthdays — anniversaries and other custom dates.",
          "A contact-health view flagging incomplete or low-quality contacts.",
          "View counts and click analytics for your public contact card.",
          "Multiple personal and shared address books, with per-book permissions.",
        ],
      },
    ],
  },
  {
    id: "v1.14",
    version: "v1.14",
    date: "2026-06-24",
    displayDate: "24 Jun 2026",
    title: "Safer syncing across multiple providers",
    categories: [
      {
        label: "Added",
        items: [
          "Choose whether to reconnect an existing sync connection or start fresh when Kontax detects a match, with a history of retired connections.",
          "Clear in-app explanations when a field can't sync to a particular provider.",
        ],
      },
      {
        label: "Improved",
        items: [
          "Unrecognised CardDAV providers now get a safe, conservative sync mode with friendly naming.",
        ],
      },
      {
        label: "Fixed",
        items: [
          "Syncing the same contact across multiple providers no longer lets a less-capable provider erase fields it doesn't support.",
        ],
      },
    ],
  },
  {
    id: "v1.13",
    version: "v1.13",
    date: "2026-06-20",
    displayDate: "20 Jun 2026",
    title: "Better phone number recognition worldwide",
    categories: [
      {
        label: "Improved",
        items: [
          "Phone number formatting, validation and duplicate matching now recognise numbers from many more countries and regions.",
        ],
      },
    ],
  },
  {
    id: "v1.12",
    version: "v1.12",
    date: "2026-06-19",
    displayDate: "19 Jun 2026",
    title: "Smarter sync connection setup",
    categories: [
      {
        label: "Improved",
        items: [
          "New sync connections hold their first sync for you to approve, rather than syncing immediately.",
          "Reconnecting a previously removed sync account restores its old settings instead of starting over.",
        ],
      },
    ],
  },
  {
    id: "v1.11",
    version: "v1.11",
    date: "2026-06-18",
    displayDate: "18 Jun 2026",
    title: "Multiple Google accounts, a dedicated API address",
    categories: [
      {
        label: "Added",
        items: [
          "Connect more than one Google account for contact sync.",
          "The developer API now lives at its own address, api.getkontax.com.",
        ],
      },
    ],
  },
  {
    id: "v1.10",
    version: "v1.10",
    date: "2026-06-16",
    displayDate: "16 Jun 2026",
    title: "Teams billing improvements",
    categories: [
      {
        label: "Improved",
        items: [
          "Teams billing is now tied to the organisation rather than one person, so it survives an owner leaving; owners can transfer billing ownership.",
        ],
      },
    ],
  },
  {
    id: "v1.9",
    version: "v1.9",
    date: "2026-06-15",
    displayDate: "15 Jun 2026",
    title: "New marketing site",
    categories: [
      {
        label: "Added",
        items: [
          "New public pages — Features, Pricing, Security, Changelog, About, Contact, Privacy and Terms.",
        ],
      },
    ],
  },
  {
    id: "v1.8",
    version: "v1.8",
    date: "2026-06-14",
    displayDate: "14 Jun 2026",
    title: "Smart lists, public contact card, developer API",
    categories: [
      {
        label: "Added",
        items: [
          "Smart lists — save any filter to reuse from the sidebar.",
          "Bulk-edit multiple contacts at once, and keyboard shortcuts for common actions.",
          "Labels you can filter by, rename, recolour, merge and delete.",
          "A personal public contact card (getkontax.com/u/yourname) with one-tap add.",
          "Request a full export of your data (GDPR) as a downloadable ZIP.",
          "A developer REST API with personal access tokens.",
        ],
      },
      {
        label: "Improved",
        items: ["Search now covers notes, addresses, job title and custom fields."],
      },
      {
        label: "Fixed",
        items: [
          "Everyday browsing no longer triggers unexpected sign-outs; sensitive actions now re-confirm your password instead.",
        ],
      },
    ],
  },
  {
    id: "v1.7",
    version: "v1.7",
    date: "2026-06-13",
    displayDate: "13 Jun 2026",
    title: "Installable mobile app, smarter imports, Google sync",
    categories: [
      {
        label: "Added",
        items: [
          "Install Kontax to your phone's home screen, with offline viewing of your contact list.",
          "Per-connection sync settings — choose which books sync, the direction, and how conflicts are resolved.",
          "Automatic column detection when importing CSV files, with reusable mapping presets.",
          "Connect and sync your Google Contacts.",
          "A new public homepage, redesigned sign-in and registration pages, and an in-app help centre.",
        ],
      },
    ],
  },
  {
    id: "v1.6",
    version: "v1.6",
    date: "2026-06-12",
    displayDate: "12 Jun 2026",
    title: "Real billing, email delivery and security alerts",
    categories: [
      {
        label: "Added",
        items: [
          "Upgrade, downgrade and cancel plans through Stripe, with a self-service billing portal.",
          "A grace-period notice if a payment fails, before any downgrade.",
          "Real delivery of verification, password-reset and other account emails.",
          "Suspicious-activity alerts (new device, failed sign-ins) with a one-click \"wasn't me\" that locks the account.",
          "Birthday and anniversary reminders, plus a personal calendar feed you can subscribe to.",
          "An in-app notification bell with per-category preferences.",
        ],
      },
    ],
  },
  {
    id: "v1.5",
    version: "v1.5",
    date: "2026-06-11",
    displayDate: "11 Jun 2026",
    title: "Two-factor authentication and account security",
    categories: [
      {
        label: "Added",
        items: [
          "Profile editing with photo upload.",
          "Two-factor authentication (TOTP) with recovery codes.",
          "An active-sessions panel to see and sign out other devices.",
          "Password and email change, with re-verification on email change.",
          "Account deletion with a 30-day recovery window.",
        ],
      },
    ],
  },
  {
    id: "v1.4",
    version: "v1.4",
    date: "2026-06-10",
    displayDate: "10 Jun 2026",
    title: "Family and Teams plans, contact sharing",
    categories: [
      {
        label: "Added",
        items: [
          "Four plans — Free, Pro, Family and Teams — each with a clearer feature set.",
          "Share a contact by public link, or keep it live-synced Kontax-to-Kontax (Pro and above).",
          "Family plan: one shared address book the whole family can view and edit.",
          "Teams plan: multiple shared address books with role-based permissions.",
        ],
      },
      {
        label: "Improved",
        items: [
          "Redesigned contact detail and create/edit pages.",
          "Sharing, family and emergency-contact status now shown as badges at a glance.",
        ],
      },
    ],
  },
  {
    id: "v1.3",
    version: "v1.3",
    date: "2026-06-09",
    displayDate: "9 Jun 2026",
    title: "Contacts list rebuild and device connection settings",
    categories: [
      {
        label: "Improved",
        items: ["Rebuilt contacts list with a books/labels sidebar and column-based rows."],
      },
      {
        label: "Added",
        items: [
          "A settings page listing your connected sync devices and app passwords.",
          "An emergency-contact flag shown as a badge on the contact row.",
        ],
      },
    ],
  },
  {
    id: "v1.2",
    version: "v1.2",
    date: "2026-06-08",
    displayDate: "8 Jun 2026",
    title: "Kontax as a native contacts account, phonetic search",
    categories: [
      {
        label: "Added",
        items: [
          "Connect Kontax itself as a contacts account on iPhone, Android and Mac — no separate app needed.",
          "App passwords for secure device connections.",
          "Phonetic (pinyin) autofill and search for Chinese names.",
        ],
      },
      {
        label: "Improved",
        items: ["Mobile-friendly contact list with icon-based row actions and inline birthdays."],
      },
    ],
  },
  {
    id: "v1.1",
    version: "v1.1",
    date: "2026-06-07",
    displayDate: "7 Jun 2026",
    title: "Contacts dashboard rebuild and CardDAV sync",
    categories: [
      {
        label: "Added",
        items: [
          "Connect a CardDAV account (e.g. iCloud) for two-way contact sync, with conflict review.",
          "Richer contact fields — multiple emails, phone numbers and addresses per contact.",
        ],
      },
      {
        label: "Improved",
        items: ["Contacts dashboard redesigned as a list-first workspace, with a Favourites view."],
      },
    ],
  },
  {
    id: "v1.0",
    version: "v1.0",
    date: "2026-06-06",
    displayDate: "6 Jun 2026",
    title: "Kontax launches",
    summary:
      "Kontax launches: a private, standards-based address book with secure contacts, import and export, and automatic duplicate merging.",
    categories: [
      {
        label: "Added",
        items: [
          "Sign up and manage your address book securely.",
          "Add, edit and archive contacts.",
          "Import and export contacts as CSV, with a preview before anything is committed.",
          "Automatic duplicate detection with a merge review.",
        ],
      },
    ],
  },
];
