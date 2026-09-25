// P50A-05 · Help-centre URLs used by in-app "Learn more" links. Kept as plain
// strings (no content import) so client components can use them without
// bundling the help content; tests/node/help-centre.test.ts pins that each one
// resolves to a real article.

export const HELP_LINKS = {
  whatIsCardDav: "/help/sync/what-is-carddav",
  connectIphoneOrMac: "/help/sync/connect-iphone-or-mac",
  connectIcloud: "/help/sync/connect-icloud-contacts",
  connectGoogle: "/help/sync/connect-google-contacts",
  connectFastmail: "/help/sync/connect-fastmail-contacts",
  connectCardDavServer: "/help/sync/connect-carddav-server",
  fixSyncNotWorking: "/help/sync/fix-sync-not-working",
  appPasswordProblems: "/help/sync/app-password-problems",
  syncPausedOrNeedsReauth: "/help/sync/sync-account-paused-or-needs-reauth",
  resolveSyncConflicts: "/help/sync/resolve-sync-conflicts",
  duplicateFloodAfterFirstSync: "/help/sync/duplicate-flood-after-first-sync",
  contactLimitReached: "/help/import-export/contact-limit-reached",
  twoFactorRecoveryCodes: "/help/account-security/2fa-lockout-recovery-codes",
  downgradeConsequences: "/help/family-teams/downgrade-consequences",
  shareAContact: "/help/sharing/share-a-contact",
} as const;
