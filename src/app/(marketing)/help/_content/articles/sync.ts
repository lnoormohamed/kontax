import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

const SYNC_ACCOUNTS = `Free includes ${FACTS.freeSyncAccounts} sync account; Pro, Family and Teams include ${FACTS.proSyncAccounts}.`;
const DEVICE_PASSWORDS = `Free includes ${FACTS.freeDevicePasswords} device app password; Pro, Family and Teams include ${FACTS.proDevicePasswords}.`;

const OPEN_SYNC = "In Kontax, open [Sync](/sync) and choose **Connect an account** (or **Add account** if you already have one).";
const START_SYNCING =
  "In the **Set up sync** panel, check the direction (Two-way, Import only or Export only) and the other options, then choose **Start syncing**.";

export const SYNC: HelpCategoryContent = {
  id: "sync",
  title: "Sync & devices",
  description:
    "Connect your iPhone, Mac and Android, bring in iCloud, Google, Fastmail and other CardDAV accounts, and fix sync when it stops.",
  articles: [
    {
      slug: "connect-iphone-or-mac",
      title: "Add Kontax to the Contacts app on your iPhone or Mac",
      category: "sync",
      audience: "iPhone, iPad and Mac users",
      plans: ALL,
      summary:
        "Create a device app password in **Settings → Data & sync → Connect a device**, then add Kontax as a CardDAV account on your iPhone or Mac — no app to install.",
      keywords: ["iphone", "ipad", "mac", "macos", "ios", "apple contacts", "carddav account", "device"],
      steps: [
        { text: "In Kontax, open **Settings → Data & sync → Connect a device**. Keep the **Server URL** and **Username** (your account email) to hand." },
        {
          text: "Under **App passwords**, type a **Device name** such as “iPhone”, choose **Generate password** and confirm with your Kontax password.",
          details: ["Copy the app password now — Kontax shows it once."],
        },
        {
          text: "On iPhone or iPad: open the Settings app → **Contacts** → **Accounts** → **Add Account** → **Other** → **Add CardDAV Account**.",
          details: [
            "Server: the Server URL from Kontax.",
            "User Name: your Kontax email.",
            "Password: the app password you just generated.",
            "Description: Kontax. Then tap **Next**.",
          ],
        },
        {
          text: "On a Mac: open System Settings → **Internet Accounts** → **Add Account…** → **Other Accounts…** → **CardDAV account**.",
          details: [
            "Set Account Type to **Advanced**.",
            "Enter your Kontax email, the app password and the Server URL, then click **Sign In**.",
          ],
        },
      ],
      whatToExpect: [
        "Kontax appears as an account in the Contacts app. Changes you make on the device sync to Kontax, and the other way round.",
        "Menu names can differ slightly between iOS and macOS versions; the **Connect a device** page shows the same steps with your details filled in.",
        `Each device uses its own app password, so you can revoke one without affecting the others. ${DEVICE_PASSWORDS}`,
        "If you're in a Family, the shared family book appears as a second address book on the device.",
      ],
      ifItDoesntWork: [
        "If the device can't verify the account or keeps asking for a password, the app password was probably mistyped or revoked — see [Fix app password problems](/help/sync/app-password-problems).",
        "Use your Kontax email and a device app password — not your Kontax sign-in password.",
        "If **Generate password** is greyed out, you've reached your plan's app password limit. Revoke one you no longer use or upgrade.",
      ],
      related: ["sync/connect-android-davx5", "sync/app-password-problems", "sync/what-is-carddav"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "connect-android-davx5",
      title: "Sync Kontax with Android using DAVx⁵",
      category: "sync",
      audience: "Android users",
      plans: ALL,
      summary:
        "Android has no built-in CardDAV support, so install the free DAVx⁵ app and sign it in with your Kontax email and a device app password.",
      keywords: ["android", "davx5", "davx", "samsung", "pixel", "phone"],
      steps: [
        { text: "In Kontax, open **Settings → Data & sync → Connect a device** and note the **Server URL**." },
        { text: "Under **App passwords**, enter a **Device name** such as “Android”, choose **Generate password** and copy the password." },
        { text: "Install DAVx⁵ from the Play Store, open it and tap the **+** button." },
        {
          text: "Choose **Login with URL and user name** and enter:",
          details: ["Base URL: the Server URL from Kontax.", "User name: your Kontax email.", "Password: the app password."],
        },
        { text: "Tap **Login**, select the **Contacts** address book and tap **Synchronize**." },
      ],
      whatToExpect: [
        "Your Kontax contacts appear in the phone's Contacts app under the DAVx⁵ account.",
        `DAVx⁵ uses one of your device app passwords. ${DEVICE_PASSWORDS}`,
      ],
      ifItDoesntWork: [
        "If DAVx⁵ reports an authentication error, generate a new app password in Kontax and update the account in DAVx⁵ — see [Fix app password problems](/help/sync/app-password-problems).",
        "Make sure you selected the **Contacts** address book in DAVx⁵; unselected address books don't sync.",
      ],
      related: ["sync/connect-iphone-or-mac", "sync/app-password-problems", "sync/what-is-carddav"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "connect-icloud-contacts",
      title: "Connect iCloud contacts to Kontax",
      category: "sync",
      audience: "Anyone with contacts in iCloud",
      plans: ALL,
      summary:
        "Create an app-specific password for your Apple Account, then add an iCloud connection on the Sync page with your Apple Account email and that password.",
      keywords: ["icloud", "apple", "apple id", "apple account", "app-specific password", "carddav"],
      steps: [
        {
          text: "Create an app-specific password for your Apple Account at [appleid.apple.com](https://appleid.apple.com).",
          details: ["Apple only offers app-specific passwords when two-factor authentication is on for your Apple Account."],
        },
        { text: OPEN_SYNC },
        {
          text: "Under **CardDAV**, choose the **iCloud** preset. The server URL is filled in as `https://contacts.icloud.com`.",
        },
        {
          text: "Enter a **Label**, your Apple Account email as the **Username** and the app-specific password as the **Password**, then choose **Connect**.",
        },
        { text: START_SYNCING },
      ],
      whatToExpect: [
        "Names, phones, emails, addresses, websites, notes, birthdays, company and job title sync both ways. iCloud also keeps other significant dates such as anniversaries.",
        "Kontax labels and books stay in Kontax.",
        "Once connected, you can choose which iCloud address books to sync in the connection's **Settings → Address books**.",
        `Kontax syncs every 60 minutes by default, and you can choose **Sync now** at any time. ${SYNC_ACCOUNTS}`,
      ],
      ifItDoesntWork: [
        "If you already had these people in Kontax, the first sync can create second copies — see [Why you have lots of duplicates after your first sync](/help/sync/duplicate-flood-after-first-sync).",
        "“Authentication failed” means Apple rejected the password: create a new app-specific password and update it with **Edit credentials**.",
        "Still stuck? Work through [Fix sync that isn't working](/help/sync/fix-sync-not-working).",
      ],
      related: ["sync/connect-iphone-or-mac", "sync/duplicate-flood-after-first-sync", "sync/app-password-problems"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "connect-google-contacts",
      title: "Connect Google Contacts to Kontax",
      category: "sync",
      audience: "Anyone with contacts in a Google account",
      plans: ALL,
      summary:
        "On the Sync page, choose the **Google Contacts** tile, sign in with Google and allow access to your contacts — no app password needed.",
      keywords: ["google", "gmail", "google contacts", "oauth", "android"],
      steps: [
        { text: OPEN_SYNC },
        { text: "Under **Connect with OAuth**, choose **Google Contacts**." },
        { text: "Sign in to the Google account you want to connect and allow Kontax to see and edit your contacts." },
        { text: START_SYNCING },
      ],
      whatToExpect: [
        "Names, phones, emails, addresses, websites, notes, birthdays, company and job title sync both ways. Other significant dates stay in Kontax, as do labels and books.",
        "After the first sync, Kontax looks for duplicates and shows how many it found, with a link to review them.",
        "Connecting Google only syncs contacts; it doesn't change how you sign in to Kontax.",
        `If you have more than one Google account, connect each one separately. ${SYNC_ACCOUNTS}`,
      ],
      ifItDoesntWork: [
        "If Google access is revoked or expires, the connection shows **Re-authorisation required** — see [Reconnect Google when access has expired](/help/sync/google-connection-expired).",
        "Lots of duplicates after the first sync? See [Why you have lots of duplicates after your first sync](/help/sync/duplicate-flood-after-first-sync).",
      ],
      related: ["sync/google-connection-expired", "sync/duplicate-flood-after-first-sync", "sync/fix-sync-not-working"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "connect-fastmail-contacts",
      title: "Connect Fastmail contacts to Kontax",
      category: "sync",
      audience: "Fastmail users",
      plans: ALL,
      summary:
        "Create an app password in Fastmail's settings, then add a Fastmail connection on the Sync page with your Fastmail email and that password.",
      keywords: ["fastmail", "carddav", "app password"],
      steps: [
        { text: "In Fastmail's settings, create an app password that has access to contacts (CardDAV)." },
        { text: OPEN_SYNC },
        { text: "Under **CardDAV**, choose the **Fastmail** preset. The server URL is filled in as `https://carddav.fastmail.com/dav/addressbooks`." },
        { text: "Enter a **Label**, your Fastmail email as the **Username** and the app password as the **Password**, then choose **Connect**." },
        { text: START_SYNCING },
      ],
      whatToExpect: [
        "Names, phones, emails, addresses, websites, notes, birthdays, company and job title sync both ways.",
        "Other significant dates (such as anniversaries) stay in Kontax because Fastmail can't store them, and Kontax labels and books stay in Kontax.",
        "If you keep several Fastmail address books, choose which to sync in the connection's **Settings → Address books** and give each connection a clear label.",
      ],
      ifItDoesntWork: [
        "“Authentication failed” means Fastmail rejected the password — create a new app password and update it with **Edit credentials**.",
        "Work through [Fix sync that isn't working](/help/sync/fix-sync-not-working) for other errors.",
      ],
      related: ["sync/app-password-problems", "sync/fix-sync-not-working", "sync/what-is-carddav"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "connect-carddav-server",
      title: "Connect Nextcloud or another CardDAV server",
      category: "sync",
      audience: "Anyone using Nextcloud or another CardDAV provider",
      plans: ALL,
      summary:
        "Add a CardDAV connection on the Sync page with your server's address-book URL, your username and (if your provider requires one) an app password.",
      keywords: ["nextcloud", "owncloud", "radicale", "baikal", "self-hosted", "carddav server"],
      steps: [
        {
          text: "Find your server's CardDAV address. In Nextcloud Contacts, open the address book's menu and copy its link; other providers usually list it in their contacts-sync help.",
        },
        { text: OPEN_SYNC },
        { text: "Under **CardDAV**, choose **Nextcloud** (and complete the URL) or **Manual** for any other server." },
        { text: "Enter a **Label**, your **Username** and **Password** (an app password if your provider uses them), then choose **Connect**." },
        { text: START_SYNCING },
      ],
      whatToExpect: [
        "Providers Kontax hasn't verified start in **safe compatibility mode**: core fields sync first and anything the provider might not store safely stays in Kontax.",
        "You can change this later in the connection's **Settings → Provider compatibility**.",
      ],
      ifItDoesntWork: [
        "If Kontax can't find an address book, check you used the full address-book URL rather than the server's home page.",
        "See [Fix sync that isn't working](/help/sync/fix-sync-not-working) for what each error means.",
        "Want a provider verified? Email [support@getkontax.com](mailto:support@getkontax.com).",
      ],
      related: ["sync/what-is-carddav", "sync/fix-sync-not-working", "sync/app-password-problems"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "what-is-carddav",
      title: "What is CardDAV, and how does Kontax use it?",
      category: "sync",
      audience: "Anyone new to contact sync",
      plans: ALL,
      summary:
        "CardDAV is the open standard for syncing contacts; Kontax uses it both to appear in your phone's Contacts app and to sync with iCloud, Fastmail and other providers.",
      keywords: ["carddav", "vcard", "open standard", "protocol", "explainer"],
      steps: [],
      sections: [
        {
          heading: "The short version",
          paragraphs: [
            "CardDAV is an open standard for keeping address books in sync between servers and apps. Contacts travel as vCards, the same format used by .vcf files. Because it's a standard, Kontax works with the Contacts apps you already have instead of needing its own app.",
          ],
        },
        {
          heading: "Two ways Kontax uses CardDAV",
          table: {
            head: ["", "Your devices → Kontax", "Kontax → your providers"],
            rows: [
              ["What it does", "Kontax appears as an account in the Contacts app on iPhone, Mac and Android (via DAVx⁵).", "Kontax syncs with iCloud, Fastmail, Nextcloud and other CardDAV servers."],
              ["Where to set it up", "**Settings → Data & sync → Connect a device**", "The [Sync](/sync) page"],
              ["Password", "A Kontax device app password", "An app-specific password from your provider"],
              ["Counts towards", "Device app passwords", "Sync accounts"],
            ],
          },
          paragraphs: [
            "Google uses its own sign-in (OAuth) rather than CardDAV, so connecting Google needs no password at all.",
          ],
        },
        {
          heading: "Why app passwords?",
          paragraphs: [
            "CardDAV apps store a password and use it in the background. An app password is a separate password for one device or connection, so you can revoke it without changing your main password — and it keeps working when you have two-factor authentication on.",
          ],
        },
      ],
      whatToExpect: [
        DEVICE_PASSWORDS,
        SYNC_ACCOUNTS,
        "Kontax labels and books are Kontax features and don't sync to other apps.",
      ],
      ifItDoesntWork: [
        "Most CardDAV problems are password problems — see [Fix app password problems](/help/sync/app-password-problems).",
      ],
      related: ["sync/connect-iphone-or-mac", "sync/connect-icloud-contacts", "sync/app-password-problems"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "fix-sync-not-working",
      title: "Fix sync that isn't working",
      category: "sync",
      audience: "Anyone whose sync has stopped or shows an error",
      plans: ALL,
      summary:
        "Open the connection on the Sync page, read its status and the failed row in **Sync history**, then use the table below to match the error to its fix.",
      keywords: ["sync error", "not syncing", "sync failed", "stopped syncing", "troubleshoot", "error code"],
      steps: [
        { text: "Open [Sync](/sync) and select the connection. The status under its name says what's wrong (for example **Authentication failed** or **Paused for safety**)." },
        { text: "In **Sync history**, select the most recent row marked **Needs review** to see the error." },
        { text: "Find the kind of error in the table below and follow the fix." },
        { text: "Choose **Sync now** (or **Resume** if the connection is paused) and check the new row in **Sync history**." },
      ],
      sections: [
        {
          heading: "What the error means",
          table: {
            head: ["Kind of problem", "What it means", "How to fix it"],
            rows: [
              [
                "Authentication",
                "The provider rejected Kontax: an app password was changed or revoked, or Google access was withdrawn. The connection shows **Authentication failed**.",
                "CardDAV: **Edit credentials** and enter a new app password. Google: **Re-authorise**. See [Fix app password problems](/help/sync/app-password-problems).",
              ],
              [
                "Connectivity",
                "Kontax couldn't reach the server (network error or timeout).",
                "Usually temporary — Kontax retries on its own. If it keeps failing, check the server URL and your provider's status.",
              ],
              [
                "Rate limit or quota",
                "The provider asked Kontax to slow down.",
                "Wait; Kontax retries with increasing gaps. Avoid choosing **Sync now** repeatedly.",
              ],
              [
                "Conflict",
                "The same contact changed in Kontax and at the provider, and the connection is set to ask you.",
                "See [Resolve sync conflicts](/help/sync/resolve-sync-conflicts).",
              ],
              [
                "Provider policy",
                "The provider doesn't support what the connection is set to do, such as the chosen sync direction.",
                "In the connection's settings, change **Direction** (for example to **Import only**) and sync again.",
              ],
              [
                "Protocol or data",
                "Kontax reached the server but couldn't use what came back — no address book found, a wrong URL, or an error from the provider.",
                "Check the server URL and the chosen address books, then **Sync now**. If it persists, email support with the error shown.",
              ],
            ],
          },
        },
        {
          heading: "Other states you might see",
          list: [
            "**Paused for safety** or **Auto-paused** — Kontax stopped on purpose. See [Sync is paused or needs you to sign in again](/help/sync/sync-account-paused-or-needs-reauth).",
            "A partly successful sync that mentions your plan's contact limit — new contacts stopped at the limit and nothing was deleted. See [What happens when you reach the contact limit](/help/import-export/contact-limit-reached).",
            "Some fields not appearing at the provider — some providers can't store every field (for example other significant dates on Google or Fastmail), so Kontax keeps them locally.",
          ],
        },
      ],
      whatToExpect: [
        "Failed syncs are retried automatically with growing gaps (5 minutes, then 15, 60 and so on).",
        `After ${FACTS.autoPauseDefaultFailures} failures in a row (the default; change it in **Retry sensitivity**), Kontax pauses the connection so it doesn't keep hammering the server. Authentication errors don't auto-pause — they wait for new credentials.`,
      ],
      ifItDoesntWork: [
        "Email [support@getkontax.com](mailto:support@getkontax.com) with the connection's provider and the error text from **Sync history**.",
      ],
      related: ["sync/app-password-problems", "sync/sync-account-paused-or-needs-reauth", "sync/resolve-sync-conflicts"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "app-password-problems",
      title: "Fix app password problems",
      category: "sync",
      audience: "Anyone whose device or CardDAV connection keeps asking for a password",
      plans: ALL,
      summary:
        "There are two kinds of app password — a Kontax one for your devices and a provider one for iCloud or Fastmail — and the fix is to create a fresh one of the right kind.",
      keywords: ["app password", "app-specific password", "password rejected", "authentication failed", "account verification failed"],
      steps: [
        { text: "Work out which side is failing: your phone or Mac asking for a password means a **Kontax device app password**; a Sync page connection showing **Authentication failed** means a **provider app password**." },
        {
          text: "Device (iPhone, Mac, Android): in **Settings → Data & sync → Connect a device**, generate a new app password and enter it in the device's Kontax account.",
          details: ["Then choose **Revoke** next to the old one so it can't be used again."],
        },
        {
          text: "Provider (iCloud, Fastmail, Nextcloud): create a new app password at your provider, then open the connection on the [Sync](/sync) page, choose **Edit credentials**, enter it and choose **Save changes**.",
          details: ["If the connection then shows as paused, choose **Resume**, then **Sync now** to check it."],
        },
      ],
      whatToExpect: [
        "Kontax device app passwords are shown once. If you didn't copy it, generate a new one — there's no way to see an old one again.",
        "App passwords can't be renamed; revoke and recreate one if you want a different device name.",
        "Revoking an app password takes effect immediately and can't be undone.",
        DEVICE_PASSWORDS,
      ],
      ifItDoesntWork: [
        "Use your Kontax email as the username on devices, and your provider email (for example your Apple Account email) for provider connections.",
        "Your normal Apple or Fastmail password won't work for CardDAV — it must be an app password.",
        "“You've reached your plan's app password limit” — revoke one you no longer use, or upgrade.",
      ],
      related: ["sync/connect-iphone-or-mac", "sync/fix-sync-not-working", "sync/what-is-carddav"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "duplicate-flood-after-first-sync",
      title: "Why you have lots of duplicates after your first sync",
      category: "sync",
      audience: "Anyone who connected an account that holds people already in Kontax",
      plans: ALL,
      summary:
        "A first sync brings in every contact from the provider as its own record, so people you already had in Kontax arrive twice; merge them from the **Duplicates** tab.",
      keywords: ["duplicates", "double contacts", "copies", "first sync", "merge"],
      steps: [
        { text: "Don't delete anything yet — merging keeps every detail from both copies and can be undone." },
        { text: "Open the **Duplicates** tab in [Contacts](/contacts?tab=duplicates), or choose **Review suggestions →** on the Sync page." },
        {
          text: "Merge the obvious ones in one go with **Accept all … high-confidence**.",
          details: ["Each pair is merged, keeping the contact that was added first."],
        },
        { text: "Work through the rest: **Merge** or **Not a duplicate** on each pair, or **Merge all** on a group of identical copies." },
        { text: "If the tab looks empty or out of date, choose **Rescan**." },
      ],
      whatToExpect: [
        "Kontax matches synced contacts by the provider's own contact ID, not by name, so it never guesses which existing contact a new one belongs to.",
        "After a Google sync Kontax scans for duplicates automatically (for address books up to 3,000 contacts). For other providers, or larger address books, choose **Rescan**.",
        `You can undo any merge for ${FACTS.mergeUndoDays} days — see [Undo a merge](/help/duplicates/undo-a-merge).`,
      ],
      ifItDoesntWork: [
        "Connecting several accounts that hold the same people? Connect one, merge, then connect the next.",
        `On the Free plan, duplicates count towards the ${FACTS.freeContactLimit}-contact limit until you merge them.`,
      ],
      related: ["duplicates/merge-duplicate-contacts", "duplicates/review-merge-suggestions-in-bulk", "duplicates/undo-a-merge"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "resolve-sync-conflicts",
      title: "Resolve sync conflicts",
      category: "sync",
      audience: "Anyone with open conflicts on a connection",
      plans: ALL,
      summary:
        "A conflict is a contact that changed in both places; review each one under **Open conflicts** on the connection and keep the Kontax or the remote version.",
      keywords: ["conflict", "conflicts", "conflict queue", "keep local", "keep remote"],
      steps: [
        { text: "Open [Sync](/sync) and select the connection. Open conflicts are listed under **Open conflicts**." },
        { text: "Choose **Review** on a conflict to compare the **Kontax (local)** and **Remote** values field by field." },
        { text: "Choose **Keep local** to keep the Kontax version, or **Keep remote** to take the provider's version." },
        {
          text: "To stop conflicts piling up, set the connection's **Conflict policy** in its settings.",
          details: [
            "**Remote wins** (the default): the provider's change always applies.",
            "**Kontax wins**: the Kontax change always applies.",
            "**Ask me**: conflicts wait for you and nothing is overwritten.",
          ],
        },
      ],
      whatToExpect: [
        "With **Remote wins** or **Kontax wins**, conflicts are settled automatically and don't wait for you.",
        `If a connection builds up ${FACTS.conflictQueueLimit} open conflicts, Kontax pauses it and shows **Sync paused — conflict queue is full**. Resolve the conflicts, then choose **Resume**.`,
        "Conflict policy only applies to two-way connections.",
      ],
      ifItDoesntWork: [
        "If the same contacts conflict on every sync, check that another app isn't rewriting them at the provider, or switch the connection to **Remote wins** or **Kontax wins**.",
        "See [Sync is paused or needs you to sign in again](/help/sync/sync-account-paused-or-needs-reauth) for the other kinds of pause.",
      ],
      related: ["sync/sync-account-paused-or-needs-reauth", "sync/fix-sync-not-working", "duplicates/merge-duplicate-contacts"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "sync-account-paused-or-needs-reauth",
      title: "Sync is paused or needs you to sign in again",
      category: "sync",
      audience: "Anyone whose connection shows Paused, Auto-paused or Authentication failed",
      plans: ALL,
      summary:
        "Kontax pauses a connection when you ask it to, when it keeps failing, when conflicts pile up or when a sync would delete too much — each has its own fix, then **Resume**.",
      keywords: ["paused", "auto-paused", "paused for safety", "needs reauth", "re-authorise", "resume", "deletion safety"],
      steps: [
        { text: "Open [Sync](/sync) and select the connection to read its status." },
        { text: "Match the status to the table below and fix the cause." },
        { text: "Choose **Resume** (or **Re-authorise** for Google), then **Sync now** to check." },
      ],
      sections: [
        {
          heading: "Why a connection stops",
          table: {
            head: ["Status", "Why", "What to do"],
            rows: [
              ["**Paused**", "You paused it.", "Choose **Resume**."],
              [
                "**Authentication failed** (Re-authentication required)",
                "The app password was rejected, or Google access expired or was revoked.",
                "CardDAV: **Update credentials →** or **Edit credentials**. Google: **Re-authorise Google →**.",
              ],
              [
                "**Auto-paused** (Paused for safety)",
                `The sync failed ${FACTS.autoPauseDefaultFailures} times in a row (the default).`,
                "Fix the error shown in **Sync history** — see [Fix sync that isn't working](/help/sync/fix-sync-not-working) — then **Resume**.",
              ],
              [
                "**Sync paused — conflict queue is full**",
                `${FACTS.conflictQueueLimit} conflicts are waiting for review.`,
                "[Resolve the conflicts](/help/sync/resolve-sync-conflicts), then **Resume**.",
              ],
              [
                "**Paused · needs review**",
                "Deletion safety stopped a sync that would have deleted more contacts than your limit. Nothing was deleted.",
                "Check the **Would have been deleted** list, then choose **Resume without deleting** or **Resume and allow deletions**.",
              ],
            ],
          },
        },
        {
          heading: "Settings that control pausing",
          list: [
            `**Retry sensitivity** — how many failures in a row before auto-pausing: the platform default (${FACTS.autoPauseDefaultFailures}), 1, 3, 5, 10 or never.`,
            "**Deletion safety** — pause if a sync would delete more than a number of contacts at once. It's off until you turn it on.",
          ],
        },
      ],
      whatToExpect: [
        "Authentication problems never auto-pause; the connection waits for new credentials instead.",
        "Kontax tells you when it needs you to reconnect, and — depending on the connection's notification setting — when it auto-pauses or holds back deletions.",
        "While a connection is paused nothing syncs, so your contacts in Kontax stay exactly as they are until you resume.",
      ],
      ifItDoesntWork: [
        "If a connection auto-pauses again straight after resuming, the underlying error hasn't gone — check the newest row in **Sync history**.",
      ],
      related: ["sync/fix-sync-not-working", "sync/resolve-sync-conflicts", "sync/google-connection-expired"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "google-connection-expired",
      title: "Reconnect Google when access has expired",
      category: "sync",
      audience: "Anyone whose Google connection says Re-authorisation required",
      plans: ALL,
      summary:
        "When Google stops accepting Kontax's access, the connection shows **Re-authorisation required**; choose **Re-authorise Google** and sign in to the same Google account.",
      keywords: ["google expired", "reauthorise", "reauthorize", "reconnect google", "revoked"],
      steps: [
        { text: "Open [Sync](/sync) and select the Google connection." },
        { text: "In the **Re-authorisation required** banner, choose **Re-authorise Google →** (or **Re-authorise** at the top of the connection)." },
        { text: "Sign in to the same Google account and allow access to your contacts again." },
      ],
      whatToExpect: [
        "Kontax reuses the existing connection and runs a full sync to catch up. Your contacts in Kontax aren't deleted.",
        "Access usually needs renewing if you removed Kontax from your Google account's security settings or Google withdrew the permission.",
      ],
      ifItDoesntWork: [
        "Signing in to a different Google account creates a separate connection — make sure you pick the account shown on the connection.",
        "If it asks again on every sync, email [support@getkontax.com](mailto:support@getkontax.com).",
      ],
      related: ["sync/connect-google-contacts", "sync/sync-account-paused-or-needs-reauth", "sync/fix-sync-not-working"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "Which contact fields sync?",
      a: "Names, phones, emails, addresses, websites, notes, birthdays, company and job title sync both ways with every provider. Other significant dates (such as anniversaries) sync with iCloud and stay in Kontax for other providers. Kontax labels and books never leave Kontax. You can exclude notes, birthdays, addresses, custom fields or photos per connection under **Field exclusions**.",
    },
    {
      q: "How often does Kontax sync?",
      a: "Every 60 minutes by default. Each connection's **Sync frequency** can be every 30 minutes, every hour, every 6 or 24 hours, or manual only — and every 15 minutes on paid plans. **Sync now** runs a sync straight away.",
    },
    {
      q: "What's the difference between Google sync and CardDAV sync?",
      a: "CardDAV connects to an address-book server with a standard protocol and an app password — that's how iCloud, Fastmail and Nextcloud work. Google uses its own sign-in, so you connect with your Google account and no separate password is needed. Both give two-way sync.",
      more: "sync/what-is-carddav",
    },
    {
      q: "Can I choose which address books a connection syncs?",
      a: "Yes, for CardDAV connections. After connecting, open the connection's **Settings → Address books** and pick the remote address books to sync. Your Kontax books are managed separately in **Settings → Books**.",
    },
    {
      q: "Will a sync delete contacts in Kontax?",
      a: "Turn on **Deletion safety** in a connection's settings and Kontax pauses any sync that would delete more than the number of contacts you set, so you can review the list before anything is removed.",
      more: "sync/sync-account-paused-or-needs-reauth",
    },
    {
      q: "How do I sync with Outlook / Microsoft 365?",
      a: "Open Sync, choose **Add account**, then the **Outlook / Exchange** tile under **Connect with OAuth**. Sign in with your Microsoft account and approve access to your contacts, then choose **Start syncing**.",
      requiresMicrosoftSync: true,
    },
  ],
};
