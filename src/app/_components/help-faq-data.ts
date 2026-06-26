// P26-12 · /help FAQ content (design P26-DB07 §4).
// Section ids double as the deep-link anchors used by help tooltips and empty
// states (#carddav / #import / #security / #sharing / #billing etc.).
//
// P32-02 · Taxonomy expanded to 14 sections covering all shipped features.
// P32-03 · Full articles written for every section (4–9 items each).
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
        q: "How do I search for a contact?",
        a: "Use the search bar at the top of your contact list. Search checks name, email, phone, company, and notes simultaneously as you type — no need to press Enter. To search within a specific book or label, apply that filter first and then search.",
      },
      {
        q: "Can I mark a contact as a favorite or emergency contact?",
        a: "Yes. Open the contact and click the star icon to add it to Favorites, or use the action menu to mark it as an Emergency contact. Emergency contacts are highlighted in the list and have their own filter in the sidebar so you can find them instantly.",
      },
      {
        q: "How do I change the list view density?",
        a: "Click the view toggle in the top-right of your contact list to switch between Compact (more rows visible) and Cozy (comfortable spacing with avatar). Your choice is saved per device.",
      },
      {
        q: "Does Kontax detect duplicate contacts?",
        a: "Yes. Kontax automatically flags contacts that share a name, email, or phone. Open the Duplicates tab in the left sidebar to review detected pairs. You can merge them with one click — keeping all fields from both — or dismiss the suggestion if they are different people.",
      },
      {
        q: "How do I merge two contacts?",
        a: "Open the Duplicates tab and click a pair, or open a contact and choose Merge from the action menu. Review which fields to keep from each side, then click Merge. The merged contact replaces both originals and preserves the full history of both.",
      },
      {
        q: "How do I bulk-select and edit contacts?",
        a: "On desktop, check the checkbox that appears on hover to the left of any contact, or press Space to select the focused row. Once one contact is selected, a toolbar appears with bulk actions: label, move to book, archive, and delete. On mobile, long-press a contact to enter selection mode, then tap others to add them.",
      },
      {
        q: "Are there keyboard shortcuts?",
        a: "Press ? anywhere in the app to open the keyboard shortcut reference. Common shortcuts: N to create a new contact, / to focus search, J/K to move through the list, Enter to open the focused contact, E to edit, Backspace to archive, and Escape to close a panel.",
      },
      {
        q: "How do I archive or delete a contact?",
        a: "Open the contact and click Archive. Archived contacts move to the Archived tab — out of your main list but fully recoverable. To delete permanently, go to the Archived tab, open the contact, and choose Delete. Permanent deletion cannot be undone.",
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
        a: 'Labels are flexible tags you add to individual contacts — examples: VIP, Newsletter, Investor. A contact can have any number of labels, and labels cut across books. Click a label in the sidebar or on a contact chip to filter your list to everyone with that label.',
      },
      {
        q: "How do I create and manage labels?",
        a: 'Open a contact, click Add label, and type a name to create one on the fly — you can also choose a colour from the eight-swatch palette. To rename, recolour, merge, or delete a label across all contacts at once, click Manage next to the Labels heading in the sidebar. On mobile, tap the filter icon in the header and choose Manage from the Labels row.',
      },
      {
        q: "How do I apply labels to multiple contacts at once?",
        a: "Select the contacts you want to label (checkbox on desktop, long-press on mobile), then click Label in the bulk-action toolbar. Choose existing labels or create new ones. The labels are added without removing any labels already on those contacts.",
      },
      {
        q: "Can I filter by label and book at the same time?",
        a: "Yes. Click a label in the sidebar to filter by it, then click a book from the Books section to narrow further. You can also layer Favorites or Emergency on top of either. The filter bar above the contact list shows all active filters so you can remove them individually.",
      },
      {
        q: "What is a smart list?",
        a: "A smart list is a saved filter — it remembers a combination of search, label, book, and status settings so you can recall it with one click. When your current view is filtered the way you want, click Save as list in the filter bar, give it a name, and it appears in the sidebar under Lists.",
      },
      {
        q: "What are personal books?",
        a: 'Books let you group contacts into named address books — Work, Personal, Events. Unlike labels, a contact lives in exactly one book. Books are great when you want clear separation rather than just tags. Create a book from the Books section in the sidebar.',
      },
      {
        q: "How do I move contacts between books?",
        a: "Open a contact, click Edit, and change the Book field. To move multiple contacts, select them and choose Move to book from the bulk-action toolbar. Moving a contact does not change its labels, notes, or sync connections.",
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
        a: "CardDAV is an open standard for syncing contacts between devices and services. Kontax speaks CardDAV natively, so your address book stays in sync with iPhone, Mac, Android, Fastmail, Nextcloud, and any other CardDAV-compatible app — no proprietary lock-in.",
      },
      {
        q: "How do I connect Apple Contacts / iCloud?",
        a: "On iPhone or Mac, go to Settings → Accounts → Add account (iOS) or System Settings → Internet Accounts (Mac) and add a CardDAV account. Use contacts.icloud.com as the server, your Apple ID as the username, and generate an app-specific password at appleid.apple.com to use instead of your regular password. Your iCloud contacts sync with Kontax within a minute.",
      },
      {
        q: "How do I connect Nextcloud?",
        a: "Add a CardDAV account on the Sync page. Use your Nextcloud address-book URL as the server (in Nextcloud Contacts, open the address-book menu and choose Copy link), then enter your Nextcloud username and password. The sync begins immediately.",
      },
      {
        q: "How do I connect Android?",
        a: "Android does not have a built-in CardDAV client. Install DAVx5 (free, open source) from the Play Store, then add your Kontax CardDAV credentials from Settings → Sync → CardDAV credentials in Kontax. DAVx5 keeps your Android Contacts app in sync with Kontax.",
      },
      {
        q: "How do I connect Fastmail or another email provider?",
        a: "Most email providers that include contacts support CardDAV. In Kontax, go to Sync → Add CardDAV account and enter the server address from your provider (usually in their help centre under contacts sync), your email address, and an app-specific password if required.",
      },
      {
        q: "Why are some contacts not syncing?",
        a: "Open the connection in Sync and read the diagnostics block. Kontax shows provider identity, recent healthy sync timing, recent inbound and outbound activity, and whether a field family is local-only for that provider. Common causes are an expired app password, a changed server URL, revoked OAuth access, or a provider that does not store a field family such as additional dates.",
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
        a: "Go to Sync and click Connect Google. You will be taken through the Google sign-in screen — grant access to your contacts, and Kontax does a full import followed by ongoing two-way sync. Changes in either place stay in step automatically.",
      },
      {
        q: "How do I sync with Outlook / Microsoft 365?",
        a: "Go to Sync and click Connect Outlook. Sign in with your Microsoft account and approve the contacts permission. Kontax imports your Outlook People and keeps them in sync going forward.",
      },
      {
        q: "What contact fields does Google/Outlook sync support?",
        a: "Name, phones, emails, addresses, company, job title, birthday, website, and notes are synced both ways. Kontax-specific structures such as labels, books, and product-only metadata stay local. Additional dates beyond birthday may also stay local if the provider does not preserve that field family.",
      },
      {
        q: "What is the difference between Google/Outlook sync and CardDAV sync?",
        a: "CardDAV connects directly to an address book server using a standard protocol and an app password — great for iCloud, Nextcloud, and Fastmail. Google and Outlook sync use their own OAuth sign-in — you log in with your Google or Microsoft account and no separate password is needed. Both give two-way sync; the difference is how they connect.",
      },
      {
        q: "My Google sync says the connection has expired. What do I do?",
        a: "Google OAuth tokens expire after roughly six months of inactivity, or when access is revoked from your Google account settings. Go to Sync, find your Google account, and click Reconnect. You will go through the Google sign-in flow again and sync resumes from where it left off — no data is lost.",
      },
      {
        q: "What happens if I edit the same contact in Kontax and Google at the same time?",
        a: "Kontax uses a last-write-wins strategy for field-level conflicts. If you change a phone number in Kontax and the name in Google at the same time, both changes are merged. If you change the same field in both places, the most recent change wins. You can see the resolution in the contact activity log.",
      },
    ],
  },

  // ── 5. Import & Export ──────────────────────────────────────────────────────
  {
    id: "import",
    title: "Import & export",
    items: [
      {
        q: "What file formats can I import?",
        a: "Kontax imports vCard (.vcf) files — the universal contacts format — and CSV files. Both single-contact and multi-contact vCard files are supported. For CSV, any UTF-8 file with a header row works.",
      },
      {
        q: "How do I import from Google Contacts?",
        a: "Export your contacts as CSV or vCard from contacts.google.com (select all, then Export), then drop the file onto the Import page in Kontax. The Google column layout is detected automatically, so the field mapping is filled in for you.",
      },
      {
        q: "What CSV formats are supported?",
        a: "Any UTF-8 CSV with a header row. Kontax recognises Google, Apple, and Outlook export layouts automatically. For other formats you can map columns by hand on the preview screen and save the mapping as a preset for next time.",
      },
      {
        q: "Does import check for duplicates?",
        a: "Yes. During the import preview step, Kontax highlights rows that match an existing contact by name, email, or phone. You can choose to skip those rows, merge them into the existing contact, or import them as separate contacts.",
      },
      {
        q: "How do I export my contacts?",
        a: "Go to Import & Export → Export. Choose the format (vCard for maximum compatibility, CSV for spreadsheets), optionally filter by book or label, and click Download. The file is generated immediately for smaller address books; larger exports may take a moment.",
      },
      {
        q: "Can I download everything in my account, not just contacts?",
        a: "Yes. The full data export (Settings → Account → Your data → Request export) includes your contacts in both vCard and CSV format, plus your activity log, billing summary, and account details in one ZIP file. See the Your data section of this Help centre for more.",
      },
    ],
  },

  // ── 6. Sharing & Permissions ────────────────────────────────────────────────
  {
    id: "sharing",
    title: "Sharing & permissions",
    items: [
      {
        q: "How do I share a contact with someone?",
        a: "Open the contact and click Share. Choose whether to send a vCard link (works for anyone, no Kontax account needed), a static Kontax share (a one-time snapshot to another Kontax user), or a live Kontax share (a copy that stays in sync when you edit the original). Enter the recipient's email and click Send. Sharing is a Pro feature.",
      },
      {
        q: "How do I accept a contact someone shared with me?",
        a: "Pending shares appear under Shared with me in the sidebar, and you get a notification when something new arrives. Click Accept to add a copy to your own address book, where you can favourite it, add private notes, or edit your copy without affecting the original.",
      },
      {
        q: "What is the difference between a live share and a static share?",
        a: "A live share stays in sync: when the owner edits the contact, your copy updates too. A static share is a one-time snapshot that never changes after it is sent. The person sharing chooses which to send — live for an evolving contact, static for a fixed handoff.",
      },
      {
        q: "Can the person who shared a contact see my changes?",
        a: "No. Notes, labels, and favourites you add to a shared contact are private to your account and never sent back to the owner. On a live share, only the original owner can edit the underlying contact data.",
      },
      {
        q: "How do I revoke a share I sent?",
        a: "Go to Shared by me in the sidebar and click the share you want to revoke, then click Revoke. For a live share, the recipient keeps a static snapshot of the contact at the time of revocation. For a static share, nothing changes on their side since it was already a snapshot.",
      },
      {
        q: "What is a vCard link?",
        a: "A vCard link is a public URL that anyone can open to download your contact as a .vcf file — no Kontax account needed. It is useful for email signatures or website contact pages. You generate vCard links from the share sheet on any contact.",
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
        a: "Kontax can remind you about birthdays and any additional saved dates such as anniversaries, lunar birthdays, or custom labeled dates. Notifications are sent a set number of days in advance (7 days by default). You can change the lead time globally in Settings → Notifications, or override it per contact in the contact detail page. Reminders require push notifications to be enabled in your browser or on your installed PWA.",
      },
      {
        q: "How do I enable push notifications?",
        a: "On first use, Kontax asks permission to send notifications. If you declined, you can re-enable it: on desktop, click the lock or info icon in your browser address bar and change Notifications to Allow. On mobile, go to your device Settings → the Kontax icon → Notifications and turn them on.",
      },
      {
        q: "How do I subscribe to a birthday calendar?",
        a: "Go to Settings → Notifications → Calendar feed and copy the iCal URL. Add it as a subscribed calendar in Apple Calendar, Google Calendar, Outlook, or any app that supports calendar subscriptions. The feed updates automatically as you add or edit birthdays, anniversaries, lunar birthdays, and other saved contact dates.",
      },
      {
        q: "What are security notifications and can I turn them off?",
        a: "Security notifications alert you to important account events: a new sign-in from an unfamiliar device or location, a password change, two-factor authentication changes, and suspicious activity. These cannot be turned off. If you receive one you did not expect, change your password immediately and review your active sessions.",
      },
      {
        q: "What is a digest and how do I set it up?",
        a: "A digest groups multiple notifications — for example, all birthday reminders for the coming week — into a single daily or weekly summary email. Go to Settings → Notifications → Delivery and switch from Immediate to Daily digest or Weekly digest for any notification category.",
      },
      {
        q: "How do I control which notifications I receive?",
        a: "Go to Settings → Notifications to turn each category on or off independently: birthday reminders, shared contact updates, contact activity summaries, and marketing updates. Security and billing notifications cannot be disabled.",
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
        a: "Go to Settings → Profile → Public card. Pick a username between 3 and 30 characters — letters, numbers, hyphens, and underscores. Once claimed, your card is available at getkontax.com/@username.",
      },
      {
        q: "What shows on my public card?",
        a: "You control exactly which fields are visible. Use the per-field toggles in Settings → Profile → Public card to show or hide your name, photo, phone, email, company, website, address, and any other fields. You can also hide your card entirely so the URL returns a 404.",
      },
      {
        q: "How do others save my contact from my card?",
        a: "Anyone who visits your card page can download your contact as a vCard (.vcf file). If they have a Kontax account they can add you directly to their address book with one tap.",
      },
      {
        q: "Where do I find my QR code?",
        a: "Open your public card (click your avatar menu and choose View my card, or visit getkontax.com/@username). Click the QR code button in the card actions. You can download it as a PNG to put on a business card, email signature, or printed material.",
      },
      {
        q: "Can I see how many people have viewed my card?",
        a: "Aggregate view counts are shown in Settings → Profile → Public card. The count reflects unique visits over the last 30 days. Individual visitor identities are not stored or shown.",
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
        a: "A Family subscription covers up to six people under one plan. Everyone in the family gets full Pro access plus a single shared address book that all members can see. Each member also keeps their own private contacts. The family owner controls who can view and who can edit the shared book.",
      },
      {
        q: "How do I invite someone to my Family?",
        a: "Go to Settings → Family → Invite member and enter the person's email address. They receive an invitation email and, once they accept, they are added to the plan. Pending invitations appear in the member list until accepted or cancelled.",
      },
      {
        q: "How do I remove a family member or leave a family?",
        a: "Family owners can remove a member from Settings → Family by clicking the member and choosing Remove. Removed members lose access to the shared book but keep their own private contacts. If you are not the owner and want to leave, go to Settings → Family → Leave family. Your private contacts are unaffected.",
      },
      {
        q: "How is Teams different from Family?",
        a: "Teams is designed for organisations. It supports more members, multiple separate shared address books per team, role-based permissions (owner, admin, editor, viewer), and a full audit log showing who changed what and when. Family is simpler: one shared book, up to six people, no roles beyond edit/view.",
      },
      {
        q: "How do Teams roles work?",
        a: "Owners can manage billing, members, and all address books. Admins can add and remove members and create books but cannot change billing. Editors can add, edit, and delete contacts in any shared book. Viewers can only read. A member can have a different role in each shared book.",
      },
      {
        q: "What does the Teams audit log show?",
        a: "The audit log records every contact change across all shared books: who made it, what changed (field by field), which device or sync source it came from, and when. It is available to owners and admins and is retained for 365 days.",
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
        a: "Open Settings → Security and choose Add authenticator app. Scan the QR code with any TOTP app (1Password, Authy, Google Authenticator) and enter the 6-digit code to confirm. Recovery codes are shown once — store them somewhere safe. You will need one if you lose access to your authenticator.",
      },
      {
        q: "How do I see where I am signed in?",
        a: "Go to Settings → Security → Active sessions. Each entry shows the device type, browser, approximate location, and when it was last active. Click Sign out next to any session you do not recognise. Sign out of all other sessions removes every session except the one you are currently using.",
      },
      {
        q: "How do I reset my password?",
        a: "On the sign-in screen, click Forgot password and enter your email address. You will receive a reset link within a minute. The link is valid for one hour and can only be used once. If the email does not arrive, check your spam folder or try again.",
      },
      {
        q: "How do I change my email address?",
        a: "Go to Settings → Account → Email address and enter your new address. Kontax sends a verification link to the new address — click it to confirm the change. Until you confirm, your original address stays active. This is a sensitive action and requires you to confirm your password.",
      },
      {
        q: "I got a suspicious sign-in alert. What should I do?",
        a: "If the alert was from you, no action is needed. If you do not recognise the sign-in: go to Settings → Security → Active sessions and sign out all sessions, then change your password immediately. If you have not yet set up two-factor authentication, do so now to protect your account.",
      },
      {
        q: "What happens if I delete my account?",
        a: "Your account, contacts, and sync connections are permanently removed after a 30-day grace period — you can cancel the deletion any time before it completes. We recommend exporting your data before you delete (Settings → Account → Your data), so nothing is lost.",
      },
    ],
  },

  // ── 11. Plans & Billing ─────────────────────────────────────────────────────
  {
    id: "billing",
    title: "Plans & billing",
    items: [
      {
        q: "What is included in the free plan?",
        a: "Up to 500 contacts, one sync account, one connected device, and the last three changes shown per contact in the activity tab. The free plan is permanent — not a trial — and you can use Kontax indefinitely on it.",
      },
      {
        q: "What does Pro add?",
        a: "Pro removes all contact, sync, and device limits and gives you: the full activity log (90-day history), live and static contact sharing, smart lists, bulk edit, keyboard shortcuts, the iCal birthday feed, and priority support.",
      },
      {
        q: "Is there a free trial for Pro?",
        a: "Yes. New accounts get a 14-day Pro trial automatically — no credit card needed to start. At the end of the trial your account moves to the free plan unless you subscribe. None of your contacts or data is deleted.",
      },
      {
        q: "How do I upgrade or manage my subscription?",
        a: "Go to Settings → Plan & billing and click Manage billing. This opens the Stripe customer portal where you can upgrade, switch billing period (monthly or annual), update your payment method, or cancel.",
      },
      {
        q: "What happens if my subscription lapses?",
        a: "Your account enters a grace period (3 days) during which you retain full access while Kontax retries the payment. After the grace period, write access is restricted — you can still read and export your contacts but cannot add or edit until billing is resolved. Your data is never deleted.",
      },
      {
        q: "How does Family billing work?",
        a: "The family owner pays one Family subscription that covers up to six members. Each invited member gets a full Pro account at no extra cost to them. If the owner cancels, all members revert to the free plan. Members can always export their own private contacts.",
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
        a: "Go to Settings → Account → Your data and click Request export. Kontax prepares a ZIP file and emails you a download link within a few minutes.",
      },
      {
        q: "What is in the export ZIP?",
        a: "The ZIP contains: contacts.vcf (all your contacts in vCard format), contacts.csv (same data as a spreadsheet), activity-log.csv (every change to every contact for your full history window), billing-summary.pdf (your payment and plan history), and account.json (your profile, settings, and notification preferences).",
      },
      {
        q: "What does deleting my account actually remove?",
        a: "After the 30-day grace period, we delete your account, all contacts, sync connections, activity history, notification preferences, billing records, and any live shares you sent to other users (those become static, then are removed). We do not retain identifiable data after deletion completes.",
      },
      {
        q: "How do I request erasure under GDPR?",
        a: "Deleting your account (Settings → Account → Delete account) triggers the full erasure workflow. The 30-day grace period starts immediately. If you need written confirmation of compliance, contact us at privacy@getkontax.com and we will provide a deletion certificate once the process completes.",
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
        a: "Kontax is a Progressive Web App — no App Store needed. On iPhone: open Kontax in Safari, tap the Share button, then Add to Home Screen. On Android: open Kontax in Chrome, tap the three-dot menu, then Add to Home screen or Install app. After install, Kontax launches like a native app with its own icon.",
      },
      {
        q: "How do I enable push notifications on mobile?",
        a: "After installing Kontax to your home screen, open it and go to Settings → Notifications → Enable push. On iOS 16.4 and later, PWAs support push notifications — tap Allow when prompted. On Android, Chrome handles the permission automatically. If you missed the prompt, go to your device Settings → the Kontax app entry → Notifications.",
      },
      {
        q: "Does Kontax work offline?",
        a: "The app shell and your most recently viewed contacts are cached for offline use, so you can browse and look up contacts without a connection. Changes you make offline are queued and sync automatically when you reconnect. The full search index and activity log are not available offline.",
      },
      {
        q: "Why does Kontax sign me out on mobile?",
        a: "The operating system may suspend background apps to save battery. Kontax uses a background heartbeat to keep your session alive, but if the app is inactive for an extended period the session can expire. Sign back in — your data is all there. If this happens frequently, try keeping the installed Kontax app in your dock so the OS deprioritises it less aggressively.",
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
        a: "The Activity tab on each contact shows a timestamped record of every change: who made it, what field changed (old and new value), and the source — web app, mobile, device sync, import, or API. The full cross-contact activity feed is available from the main Activity page.",
      },
      {
        q: "What do the source badges mean?",
        a: "Each activity entry has a source badge: Web (changed in the Kontax web or mobile app), Sync (came from a CardDAV or Google/Outlook sync), Import (added via a CSV or vCard import), API (changed by a connected integration), or Share (a live share update pushed by the contact owner).",
      },
      {
        q: "How far back does the activity log go?",
        a: "Free accounts see the last 3 changes per contact. Pro accounts keep 90 days of history per contact. Family accounts keep 365 days. Teams accounts keep 365 days with the full audit trail across all members. History older than the retention window is pruned automatically.",
      },
      {
        q: "Can I filter the activity log?",
        a: "Yes. On the main Activity page you can filter by source (web, sync, import, API), by date range, and — on Teams — by which team member made the change. On an individual contact, the activity tab shows all changes for that contact only.",
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
