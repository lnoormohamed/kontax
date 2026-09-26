// P50A-05 · Old single-page /help anchors → new help-centre URLs.
//
// /help used to be one long page whose section ids (and the provider-guide
// card ids) were deep-linked from the app, emails and tooltips. The hub
// redirects /help#<anchor> to the mapped page client-side (fragments never
// reach the server). tests/node/help-centre.test.ts pins that every anchor
// still resolves.

import type { HelpRef } from "./types";

export const LEGACY_HELP_ANCHORS: Readonly<Record<string, HelpRef>> = {
  // FAQ sections (HELP_ANCHORS in the old help-faq-data.ts)
  contacts: "contacts/add-edit-contacts",
  organizing: "organising/labels-vs-books",
  carddav: "sync/what-is-carddav",
  "sync-oauth": "sync/connect-google-contacts",
  import: "import-export/import-from-google-icloud",
  sharing: "sharing/share-a-contact",
  notifications: "notifications/set-up-birthday-reminders",
  "public-card": "sharing/public-contact-card-and-qr-code",
  "family-teams": "family-teams/set-up-family-sharing",
  security: "account-security/set-up-two-factor-authentication",
  billing: "billing/free-vs-pro-plan",
  gdpr: "account-security/gdpr-data-export-and-erasure",
  mobile: "getting-started/install-as-app-iphone-android",
  activity: "contacts/contact-history-and-activity",
  // Provider guide cards
  "provider-guides": "sync",
  "provider-icloud": "sync/connect-icloud-contacts",
  "provider-fastmail": "sync/connect-fastmail-contacts",
  "provider-google": "sync/connect-google-contacts",
  // Outlook is not a public article while Microsoft sync is off; send old
  // links to the troubleshooting guide, which covers every connection.
  "provider-microsoft": "sync/fix-sync-not-working",
  "provider-carddav": "sync/connect-carddav-server",
};
