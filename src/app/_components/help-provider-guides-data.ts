export type HelpProviderGuide = {
  id: string;
  name: string;
  summary: string;
  connect: string[];
  syncs: string[];
  limitations: string[];
  recoveries: string[];
  contactSupport: string[];
};

export const HELP_PROVIDER_GUIDES: HelpProviderGuide[] = [
  {
    id: "provider-icloud",
    name: "iCloud",
    summary:
      "Best when you want Apple Contacts parity, including birthdays and additional significant dates.",
    connect: [
      "Use contacts.icloud.com as the CardDAV server URL.",
      "Sign in with your Apple ID email and an app-specific password from appleid.apple.com.",
      "Choose the correct address book during setup if your iCloud account has more than one.",
    ],
    syncs: [
      "Names, phones, emails, addresses, websites, notes, birthday, and additional dates sync.",
      "Kontax-only structures such as books and product-specific flags stay local to Kontax.",
    ],
    limitations: [
      "iCloud may display custom labels differently from Kontax wording, but the values are preserved.",
      "Apple-specific contact edit screens can collapse multiline addresses into provider-native formatting.",
    ],
    recoveries: [
      "If sync stops, generate a fresh app-specific password and update the connection in Kontax.",
      "If a contact appears stale, run Sync now from the connection detail and review the history table.",
    ],
    contactSupport: [
      "Contact support if dates or addresses appear to lose structure after repeated resyncs.",
    ],
  },
  {
    id: "provider-fastmail",
    name: "Fastmail",
    summary:
      "Strong CardDAV support for core contact fields, with safe handling for provider-limited date families.",
    connect: [
      "Use Fastmail's CardDAV server URL and an app password from Fastmail settings.",
      "Label the connection clearly if you keep multiple Fastmail address books.",
    ],
    syncs: [
      "Names, phones, emails, addresses, websites, notes, and birthday sync both ways.",
      "Kontax keeps additional dates such as anniversaries and lunar birthdays locally when Fastmail cannot store them.",
    ],
    limitations: [
      "Fastmail may flatten some custom labels into provider-native buckets like Other or Website.",
      "Additional dates beyond birthday may remain visible only in Kontax.",
    ],
    recoveries: [
      "Re-enter the app password if Fastmail reports an auth error.",
      "Use the provider guide link from the sync page when a field stays local-only.",
    ],
    contactSupport: [
      "Contact support if a core field like phone, email, or address stops round-tripping.",
    ],
  },
  {
    id: "provider-google",
    name: "Google Contacts",
    summary:
      "OAuth-based contact sync for Google accounts, with clear separation between sync access and Kontax sign-in.",
    connect: [
      "Start from Sync and choose Connect Google.",
      "Approve the Google Contacts permission when the OAuth screen opens.",
      "If you have more than one Google account, connect each one separately so the history stays clear.",
    ],
    syncs: [
      "Names, phones, emails, addresses, websites, notes, and birthday sync both ways.",
      "Kontax keeps additional dates locally if Google does not preserve that family.",
    ],
    limitations: [
      "Revoking the OAuth grant in Google pauses sync until you reconnect.",
      "Google account access here syncs contacts only; it does not currently change how you sign in to Kontax.",
    ],
    recoveries: [
      "Use Re-authorise when the connection expires or permissions are reduced.",
      "Check the diagnostics block to confirm whether recent remote changes were actually imported.",
    ],
    contactSupport: [
      "Contact support if Google repeatedly reconnects but still shows no new imports or exports.",
    ],
  },
  {
    id: "provider-microsoft",
    name: "Microsoft Outlook",
    summary:
      "OAuth-based Outlook / Microsoft 365 contact sync with the same diagnostics model as Google.",
    connect: [
      "Start from Sync and choose Connect Outlook.",
      "Approve Microsoft Graph contact access during the sign-in flow.",
    ],
    syncs: [
      "Names, phones, emails, addresses, websites, notes, and birthday sync both ways.",
      "Kontax keeps unsupported date families locally when Outlook cannot store them.",
    ],
    limitations: [
      "If admin consent or tenant policy changes, the connection may need re-authorisation.",
      "OAuth sync access does not currently act as a Kontax sign-in method.",
    ],
    recoveries: [
      "Use Re-authorise from the sync detail if the token expires or permissions change.",
      "Review the sync history to see whether the last healthy run actually moved any data.",
    ],
    contactSupport: [
      "Contact support if Microsoft-side policy keeps forcing reconnect loops.",
    ],
  },
  {
    id: "provider-carddav",
    name: "Generic CardDAV",
    summary:
      "For unverified providers, Kontax starts in safe compatibility mode and syncs the core contact surface first.",
    connect: [
      "Enter the provider's CardDAV server URL, username, and app password if required.",
      "Use a descriptive connection label so you can tell similar servers apart later.",
    ],
    syncs: [
      "Core fields like names, phones, emails, addresses, websites, notes, and birthday sync first.",
      "Kontax keeps unsupported or unverified date families local until the provider behavior is verified.",
    ],
    limitations: [
      "Unknown providers may expose custom fields differently or not preserve every label family.",
      "Safe mode is intentionally conservative to avoid silent data loss.",
    ],
    recoveries: [
      "If the diagnostics block shows local-only fields, that is expected until the provider is verified.",
      "If auth fails, update the connection with the server's current app password or token.",
    ],
    contactSupport: [
      "Contact support when you want a generic CardDAV provider promoted to a verified profile.",
    ],
  },
];
