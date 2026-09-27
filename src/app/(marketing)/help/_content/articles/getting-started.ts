import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const GETTING_STARTED: HelpCategoryContent = {
  id: "getting-started",
  title: "Getting started",
  description:
    "Add your first contacts, put Kontax on your phone's home screen and understand what the Free plan includes.",
  articles: [
    {
      slug: "add-first-contact",
      title: "Add your first contact",
      category: "getting-started",
      audience: "New Kontax users",
      plans: ALL,
      summary:
        "Choose **Create contact** (or the **+** button on mobile), enter a name and choose **Save contact** — or bring everyone in at once by syncing or importing.",
      keywords: ["new contact", "add contact", "create contact", "first steps", "onboarding"],
      steps: [
        { text: "In [Contacts](/contacts), choose **Create contact** at the top of the page. On a phone, tap the **+** button." },
        { text: "Enter a first or last name (or a company name for an organisation). Everything else is optional." },
        { text: "Add any phones, emails, addresses or dates you have, then choose **Save contact**." },
      ],
      sections: [
        {
          heading: "Adding lots of contacts at once",
          list: [
            "Already have contacts in iCloud or Google? [Connect iCloud](/help/sync/connect-icloud-contacts) or [connect Google](/help/sync/connect-google-contacts) and they arrive automatically.",
            "Have a CSV file? See [Import contacts](/help/import-export/import-from-google-icloud).",
            "Want Kontax on your iPhone or Mac? See [Add Kontax to the Contacts app](/help/sync/connect-iphone-or-mac).",
          ],
        },
      ],
      whatToExpect: [
        "You can add more details at any time — open the contact and choose **Edit**.",
        `The Free plan holds up to ${FACTS.freeContactLimit} contacts.`,
      ],
      ifItDoesntWork: [
        "If saving fails with a plan limit message, see [What happens when you reach the contact limit](/help/import-export/contact-limit-reached).",
      ],
      related: ["contacts/add-edit-contacts", "sync/connect-iphone-or-mac", "import-export/import-from-google-icloud"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "install-as-app-iphone-android",
      title: "Put Kontax on your phone's home screen",
      category: "getting-started",
      audience: "Anyone using Kontax on a phone",
      plans: ALL,
      summary:
        "Kontax is a web app: add it to your home screen from Safari on iPhone or from Chrome on Android and it opens like an app, straight to your contacts.",
      keywords: ["install", "pwa", "home screen", "app", "iphone", "android", "mobile"],
      steps: [
        { text: "Open Kontax in your phone's browser and sign in." },
        { text: "On Android (Chrome): when Kontax offers **Add Kontax to your Home Screen**, tap **Install**. You can also use Chrome's menu → **Add to Home screen**." },
        { text: "On iPhone (Safari): tap the Share button, then **Add to Home Screen**. Kontax shows these steps too." },
      ],
      whatToExpect: [
        "Kontax opens full-screen from its own icon, starting at your contacts.",
        "It needs an internet connection — offline, it shows a “You're offline” page rather than your contacts.",
        "To see your Kontax contacts inside the phone's own Contacts app (and offline there), sync over CardDAV instead — see [Add Kontax to the Contacts app on your iPhone or Mac](/help/sync/connect-iphone-or-mac) or [Android with DAVx⁵](/help/sync/connect-android-davx5).",
      ],
      ifItDoesntWork: [
        "Dismissed the install prompt? It comes back after 30 days, or use the browser's menu in the meantime.",
        "On iPhone, **Add to Home Screen** is only available from Safari's Share menu.",
      ],
      related: ["sync/connect-iphone-or-mac", "sync/connect-android-davx5", "getting-started/add-first-contact"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "understand-free-plan-limits",
      title: "What the Free plan includes",
      category: "getting-started",
      audience: "Anyone on the Free plan, or deciding whether to upgrade",
      plans: ["Free"],
      summary: `Free is a permanent plan, not a trial: up to ${FACTS.freeContactLimit} contacts, ${FACTS.freeSyncAccounts} sync account, ${FACTS.freeDevicePasswords} device, duplicate merging and CSV or Kontax Archive export.`,
      keywords: ["free plan", "limits", "what's included", "upgrade", "pro"],
      steps: [],
      sections: [
        {
          heading: "Free at a glance",
          table: {
            head: ["", "Free", "Pro"],
            rows: [
              ["Contacts", FACTS.freeContactLimit, "Unlimited"],
              ["Sync accounts (iCloud, Google, Fastmail…)", String(FACTS.freeSyncAccounts), String(FACTS.proSyncAccounts)],
              ["Devices (iPhone, Mac, Android)", String(FACTS.freeDevicePasswords), String(FACTS.proDevicePasswords)],
              ["File imports", `${FACTS.freeMonthlyImports} a month`, "Unlimited"],
              ["Export", "CSV, Kontax Archive; vCard file in your full data download", "CSV, Kontax Archive, vCard 4.0"],
              ["Duplicate merge with undo", `Included (${FACTS.mergeUndoDays}-day undo)`, "Included"],
              ["Per-contact history", `Last ${FACTS.freeHistoryShown} changes`, "All changes"],
              ["Activity feed across all contacts", "—", `Shows the last ${FACTS.proActivityDays} days`],
              ["Share a contact with another Kontax user", "—", "Static and live"],
              ["vCard share links", `Expire after ${FACTS.freeVcardLinkDays} days`, "No expiry, revocable"],
              ["Developer API", "—", "Included"],
            ],
          },
        },
      ],
      whatToExpect: [
        "Free has no time limit and needs no card.",
        "Hitting a limit never deletes anything — see [What happens when you reach the contact limit](/help/import-export/contact-limit-reached).",
        "Compare every plan, including Family and Teams, on the [pricing page](/pricing).",
      ],
      ifItDoesntWork: [
        "To upgrade, open **Settings → Plan & billing** — see [Manage your subscription](/help/billing/manage-subscription).",
      ],
      related: ["billing/free-vs-pro-plan", "import-export/contact-limit-reached", "family-teams/downgrade-consequences"],
      lastReviewed: REVIEWED,
    },
  ],
  alsoSee: ["account-security/set-up-two-factor-authentication", "sync/connect-iphone-or-mac"],
  shortAnswers: [
    {
      q: "Do I need to install an app?",
      a: "No. On iPhone and Mac, Kontax appears inside the Contacts app you already use, over CardDAV. Everywhere else, use Kontax in your browser — or add it to your home screen.",
      more: "sync/connect-iphone-or-mac",
    },
    {
      q: "Does Kontax work offline?",
      a: "The Kontax web app needs a connection. If you sync Kontax to your phone's Contacts app over CardDAV, those contacts are on the device and available offline; changes sync when you're back online.",
      more: "sync/connect-iphone-or-mac",
    },
    {
      q: "Why do I have to sign in again on my phone?",
      a: "Your session can end — for example after you reset your password or sign out other devices. Sign in again; your contacts are stored in your account, not on the phone, so nothing is lost.",
      more: "account-security/review-active-sessions",
    },
  ],
};
