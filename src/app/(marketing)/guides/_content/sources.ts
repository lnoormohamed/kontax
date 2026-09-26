/**
 * P50A-06 · Third-party help pages the guides' Apple, Google and standards
 * facts were checked against (September 2026). A page lists the ones it
 * relies on under "Sources"; re-check them when LAST_REVIEWED changes.
 */
import type { SourceLink } from "../_components/guide-article";

export const SRC = {
  appleMergeIphone: {
    href: "https://support.apple.com/guide/iphone/merge-or-hide-duplicate-contacts-iph2ab28320d/ios",
    label: "Apple Support: Get rid of duplicate contacts on iPhone",
  },
  appleMergeMac: {
    href: "https://support.apple.com/guide/contacts/merge-contact-cards-adrbk1456/mac",
    label: "Apple Support: Merge contact cards in Contacts on Mac",
  },
  appleIcloudDuplicates: {
    href: "https://support.apple.com/en-us/102299",
    label: "Apple Support: If you see duplicate contacts after setting up iCloud Contacts",
  },
  appleIcloudRestore: {
    href: "https://support.apple.com/guide/icloud/restore-contacts-mm1d9cfdb498/icloud",
    label: "Apple Support: Restore contacts stored in iCloud on iCloud.com",
  },
  appleIcloudImportExport: {
    href: "https://support.apple.com/guide/icloud/import-export-and-print-contacts-mmfba748b2/icloud",
    label: "Apple Support: Import, export or print contacts on iCloud.com",
  },
  appleIcloudWeb: {
    href: "https://support.apple.com/guide/icloud/contacts-on-icloudcom-overview-mmfba7481b/icloud",
    label: "Apple Support: Use Contacts on iCloud.com",
  },
  appleIphoneExport: {
    href: "https://support.apple.com/guide/iphone/export-contacts-iph075ddebf2/ios",
    label: "Apple Support: Export contacts on iPhone",
  },
  appleMacExport: {
    href: "https://support.apple.com/guide/contacts/export-or-archive-contacts-adrbdcfd32e6/mac",
    label: "Apple Support: Export or archive contacts in Contacts on Mac",
  },
  appleIphoneAccounts: {
    href: "https://support.apple.com/guide/iphone/add-or-remove-accounts-iph7edacccf9/ios",
    label: "Apple Support: Add or remove accounts in Contacts on iPhone",
  },
  appleMacAccounts: {
    href: "https://support.apple.com/guide/contacts/add-contacts-from-icloud-google-and-more-adrb7e5aaa2a/mac",
    label: "Apple Support: Add contacts from iCloud, Google and more to Contacts on Mac",
  },
  appleIcloudLimits: {
    href: "https://support.apple.com/en-us/103188",
    label: "Apple Support: Limits for iCloud Contacts, Calendars, Reminders, Bookmarks and Maps",
  },
  appleAppPasswords: {
    href: "https://support.apple.com/en-us/102654",
    label: "Apple Support: Sign in to apps with your Apple Account using app-specific passwords",
  },
  appleFamilySharing: {
    href: "https://support.apple.com/en-us/105062",
    label: "Apple Support: How Family Sharing works",
  },
  appleOwnAccount: {
    href: "https://support.apple.com/en-us/109040",
    label: "Apple Support: Make sure that each family member has their own Apple Account",
  },
  appleShareContact: {
    href: "https://support.apple.com/guide/iphone/add-and-use-contact-information-iph3e0ca2db/ios",
    label: "Apple Support: Add and use contact information on iPhone",
  },
  appleNameDrop: {
    href: "https://support.apple.com/guide/iphone/namedrop-iphone-share-contact-info-iph1b6c664b7/ios",
    label: "Apple Support: Use NameDrop on iPhone to share your contact info",
  },
  appleAirDrop: {
    href: "https://support.apple.com/guide/iphone/use-airdrop-to-send-items-to-nearby-devices-iphcd8b9f0af/ios",
    label: "Apple Support: Use AirDrop on iPhone to send items to nearby Apple devices",
  },
  googleMerge: {
    href: "https://support.google.com/contacts/answer/7078226?hl=en-GB&co=GENIE.Platform%3DDesktop",
    label: "Google Contacts Help: Merge duplicate contacts",
  },
  googleUndo: {
    href: "https://support.google.com/contacts/answer/7280886?hl=en-GB&co=GENIE.Platform%3DDesktop",
    label: "Google Contacts Help: Edit or delete contacts (undo changes, bin)",
  },
  googleExport: {
    href: "https://support.google.com/contacts/answer/7199294?hl=en-GB&co=GENIE.Platform%3DDesktop",
    label: "Google Contacts Help: Export, back up or restore contacts",
  },
  googleImport: {
    href: "https://support.google.com/contacts/answer/15147365?hl=en-GB&co=GENIE.Platform%3DDesktop",
    label: "Google Contacts Help: Import your contacts into Google Contacts",
  },
  googleLimits: {
    href: "https://support.google.com/contacts/answer/148779?hl=en-GB",
    label: "Google Contacts Help: I get a Contacts error (storage limits)",
  },
  googleDelegation: {
    href: "https://support.google.com/contacts/answer/2590392?hl=en-GB",
    label: "Google Contacts Help: Give another user access to your contacts",
  },
  googleCardDav: {
    href: "https://developers.google.com/people/carddav",
    label: "Google for Developers: Manage contacts with the CardDAV protocol",
  },
  rfc6352: {
    href: "https://www.rfc-editor.org/rfc/rfc6352",
    label: "RFC 6352: CardDAV — vCard Extensions to WebDAV (IETF, 2011)",
  },
  rfc9553: {
    href: "https://www.rfc-editor.org/rfc/rfc9553",
    label: "RFC 9553: JSContact (IETF)",
  },
  davx5: {
    href: "https://www.davx5.com/",
    label: "DAVx⁵: CalDAV, CardDAV and WebDAV for Android",
  },
  davx5Icloud: {
    href: "https://www.davx5.com/tested-with/icloud",
    label: "DAVx⁵: Tested with iCloud",
  },
  fastmailServers: {
    href: "https://www.fastmail.help/hc/en-us/articles/1500000278342-Server-names-and-ports",
    label: "Fastmail Help: Server names and ports",
  },
} satisfies Record<string, SourceLink>;
