import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const ACCOUNT_SECURITY: HelpCategoryContent = {
  id: "account-security",
  title: "Account & security",
  description:
    "Two-factor authentication, recovery codes, sessions, passwords, security alerts, your data and deleting your account.",
  articles: [
    {
      slug: "set-up-two-factor-authentication",
      title: "Set up two-factor authentication",
      category: "account-security",
      audience: "Anyone who wants a second step at sign-in",
      plans: ALL,
      summary:
        "Turn on two-factor authentication in **Settings → Security** with any authenticator app, then save the recovery codes Kontax shows you once.",
      keywords: ["2fa", "totp", "authenticator", "mfa", "security"],
      steps: [
        { text: "Make sure your email address is verified — Kontax asks you to verify it before you can turn on two-factor authentication." },
        { text: "Open **Settings → Security** and, under **Two-factor authentication**, choose **Set up authenticator app**. Kontax asks for your password first." },
        {
          text: "Scan the QR code with an authenticator app such as 1Password, Authy or Google Authenticator, then choose **Continue**.",
          details: ["Can't scan? Choose **Can't scan? Enter this code manually** and type the code into your app instead."],
        },
        { text: "Enter the 6-digit code your app shows and choose **Verify and enable**." },
        {
          text: `Save your ${FACTS.recoveryCodes} recovery codes with **Copy all codes** or **Download as .txt**, then choose **I've saved my codes**.`,
          details: ["Keep them somewhere other than your phone, such as a password manager."],
        },
      ],
      whatToExpect: [
        "From now on, signing in asks for your password and then a 6-digit code from your authenticator app.",
        `Each of the ${FACTS.recoveryCodes} recovery codes works once. **Settings → Security** shows how many you have left.`,
        "Kontax only supports authenticator apps (TOTP) — there is no SMS or passkey option.",
        "The setup screen expires after 10 minutes; if it does, start again from **Set up authenticator app**.",
      ],
      ifItDoesntWork: [
        "If the code is rejected, check that your phone's clock is set automatically — authenticator codes depend on the correct time.",
        "If the button asks you to verify your email first, use the verification link Kontax emailed you, then try again.",
        "Lost your phone? Use a recovery code — see [If you're locked out of two-factor authentication](/help/account-security/2fa-lockout-recovery-codes).",
      ],
      related: [
        "account-security/2fa-lockout-recovery-codes",
        "account-security/review-active-sessions",
        "account-security/suspicious-sign-in-alert",
      ],
      lastReviewed: REVIEWED,
    },
    {
      slug: "2fa-lockout-recovery-codes",
      title: "If you're locked out of two-factor authentication",
      category: "account-security",
      audience: "Anyone who has lost their authenticator app",
      plans: ALL,
      summary:
        "Sign in with one of your recovery codes instead of an authenticator code — each code works once, and they are the only self-service way back in.",
      keywords: ["recovery code", "lost phone", "2fa", "locked out", "backup code"],
      steps: [
        { text: "Sign in with your email and password as usual." },
        { text: "On the two-factor screen, choose **Use a recovery code instead**." },
        { text: "Enter one of your recovery codes (they look like `ABCD-EFGH-JKLM-NPQR`; older codes are 10 characters) and choose **Verify recovery code**." },
        {
          text: "Once you're in, get a fresh set of codes: in **Settings → Security**, choose **View or regenerate**, enter your password and another unused recovery code (or an authenticator code), then choose **Regenerate recovery codes**. The old codes stop working.",
          details: [
            "To move two-factor authentication to a new phone you have to turn it off first with **Disable 2FA**, which needs your password and a current authenticator code — so do it from the old app while you still have it.",
            "Then follow [Set up two-factor authentication](/help/account-security/set-up-two-factor-authentication) again on the new phone.",
          ],
        },
      ],
      whatToExpect: [
        "A recovery code is used up as soon as it signs you in. Cross it off wherever you keep them.",
        `You get ${FACTS.recoveryCodes} codes when you turn on two-factor authentication or regenerate them. **Settings → Security** shows how many remain.`,
        "After 5 wrong attempts Kontax pauses sign-in attempts for 15 minutes.",
      ],
      ifItDoesntWork: [
        "“Recovery code not found or already used” means that code has been used or was mistyped. Dashes, spaces and upper or lower case don't matter — try another one.",
        "If you see “Too many attempts”, wait 15 minutes and try again.",
        "If you have neither your authenticator app nor any recovery codes, email [support@getkontax.com](mailto:support@getkontax.com) from the address on your account. There is no self-service reset, so keep your codes safe.",
      ],
      related: [
        "account-security/set-up-two-factor-authentication",
        "account-security/reset-your-password",
        "account-security/review-active-sessions",
      ],
      lastReviewed: REVIEWED,
    },
    {
      slug: "review-active-sessions",
      title: "See where you're signed in and sign out other devices",
      category: "account-security",
      audience: "Anyone checking their account's sign-ins",
      plans: ALL,
      summary:
        "**Settings → Security → Active sessions** lists every signed-in device; you can sign one out or sign out of all other devices at once.",
      keywords: ["sessions", "devices", "sign out", "log out"],
      steps: [
        { text: "Open **Settings → Security** and find **Active sessions**." },
        { text: "Check each entry: the device, its IP address and when it was last active. Your own is marked **Current session**." },
        { text: "Choose **Sign out** next to any session you don't recognise." },
        { text: "To sign out everywhere except here, choose **Sign out of all other devices** and confirm." },
      ],
      whatToExpect: [
        "Signed-out devices go back to the sign-in screen the next time they load a page.",
        "Resetting your password or confirming a new email address also signs out every session.",
      ],
      ifItDoesntWork: [
        "If a session you signed out keeps coming back, change your password and turn on [two-factor authentication](/help/account-security/set-up-two-factor-authentication).",
        "Phones and computers syncing over CardDAV use device app passwords, not sessions — revoke those in **Settings → Data & sync → Connect a device**.",
      ],
      related: [
        "account-security/suspicious-sign-in-alert",
        "account-security/reset-your-password",
        "sync/app-password-problems",
      ],
      lastReviewed: REVIEWED,
    },
    {
      slug: "reset-your-password",
      title: "Reset your password",
      category: "account-security",
      audience: "Anyone who can't remember their password",
      plans: ALL,
      summary: `Choose **Forgot password?** on the sign-in screen and use the emailed link within ${FACTS.passwordResetMinutes} minutes to set a new password.`,
      keywords: ["forgot password", "reset", "can't sign in"],
      steps: [
        { text: "On the sign-in screen, choose **Forgot password?**." },
        { text: "Enter your account email and choose **Send reset link**." },
        { text: `Open the email and follow the link within ${FACTS.passwordResetMinutes} minutes.` },
        { text: "Enter your new password and choose **Reset password**." },
      ],
      whatToExpect: [
        "Each link works once. Asking for a new link cancels any earlier unused one.",
        "Resetting your password signs you out on every device and revokes your API tokens. Two-factor authentication stays on.",
        "Device app passwords used by your iPhone, Mac or Android are separate and keep working.",
      ],
      ifItDoesntWork: [
        "No email? Check spam, and make sure you used the address on your account. Requests are rate-limited, so wait a few minutes before asking again.",
        `If the link has expired (after ${FACTS.passwordResetMinutes} minutes), request a new one.`,
      ],
      related: [
        "account-security/review-active-sessions",
        "account-security/2fa-lockout-recovery-codes",
        "account-security/suspicious-sign-in-alert",
      ],
      lastReviewed: REVIEWED,
    },
    {
      slug: "suspicious-sign-in-alert",
      title: "What to do about a security alert email",
      category: "account-security",
      audience: "Anyone who received a Kontax security alert",
      plans: ALL,
      summary:
        "If you don't recognise the activity in a security alert, sign out other sessions, change your password and turn on two-factor authentication.",
      keywords: ["security alert", "new sign-in", "unusual activity", "hacked"],
      steps: [
        { text: "Read the alert. If the activity was you, you don't need to do anything." },
        { text: "If it wasn't, open **Settings → Security → Active sessions** and choose **Sign out of all other devices**." },
        { text: "Change your password with **Change password** in **Settings → Security** (or sign out and use **Forgot password?**)." },
        { text: "Turn on [two-factor authentication](/help/account-security/set-up-two-factor-authentication) if it isn't already on." },
      ],
      sections: [
        {
          heading: "When Kontax sends security alerts",
          list: [
            "A sign-in from a device and an IP address that have never been used on your account before (not on your very first sign-in).",
            "More than 5 failed sign-in attempts within an hour.",
            "10 or more contacts archived or deleted in one bulk action.",
          ],
        },
      ],
      whatToExpect: [
        "Alerts arrive by email with the subject “Security alert — unusual activity on your Kontax account”.",
        "Security alerts can't be turned off in **Settings → Notifications**.",
      ],
      ifItDoesntWork: [
        "If you can't sign in because your password was changed, use **Forgot password?** on the sign-in screen.",
        "If contacts were deleted, check the **Archived** tab and your [import history](/help/import-export/import-from-google-icloud) before assuming they're gone, then email [support@getkontax.com](mailto:support@getkontax.com).",
      ],
      related: [
        "account-security/review-active-sessions",
        "account-security/reset-your-password",
        "account-security/set-up-two-factor-authentication",
      ],
      lastReviewed: REVIEWED,
    },
    {
      slug: "delete-your-account",
      title: "Delete your Kontax account",
      category: "account-security",
      audience: "Anyone closing their account",
      plans: ALL,
      summary: `Delete your account from **Settings → Security → Danger zone**; it is removed after a ${FACTS.deletionGraceDays}-day grace period that you can cancel by signing back in.`,
      keywords: ["delete account", "close account", "cancel account", "erasure"],
      steps: [
        { text: "Export anything you want to keep first — see [Export your contacts](/help/import-export/export-your-contacts) and [Download a full copy of your account data](/help/import-export/download-full-account-export)." },
        { text: "Delete your Family group, or transfer or delete your team, first — Kontax won't close an account that still owns one." },
        { text: "If you pay for a plan and don't want another renewal during the grace period, cancel it in **Settings → Plan & billing**." },
        { text: "Open **Settings → Security**, scroll to **Danger zone** and choose **Delete my account**." },
        { text: "Type your email address to confirm, choose **Delete my account**, then enter your password and choose **Continue**." },
      ],
      whatToExpect: [
        `Your account is scheduled for deletion ${FACTS.deletionGraceDays} days later and you are signed out everywhere.`,
        "During the grace period you can still sign in to export your data, but you can't make changes, and phones and computers stop syncing over CardDAV.",
        "Some things happen straight away and aren't undone if you cancel: your profile photo is removed, live shares you sent become static copies, and live shares nobody has accepted yet are withdrawn.",
        "At the end of the grace period any subscription is cancelled and your account, contacts and sync connections are deleted. You'll get an email confirming it.",
      ],
      ifItDoesntWork: [
        "Changed your mind? Sign in before the grace period ends and choose **Cancel deletion — keep my account**.",
        "If you see “You must transfer or delete your Family/Teams group before closing your account”, deal with the group in **Settings → Sharing** first.",
      ],
      related: [
        "account-security/gdpr-data-export-and-erasure",
        "import-export/download-full-account-export",
        "billing/manage-subscription",
      ],
      lastReviewed: REVIEWED,
    },
    {
      slug: "gdpr-data-export-and-erasure",
      title: "Get a copy of your data or have it erased (GDPR)",
      category: "account-security",
      audience: "Anyone exercising their data rights",
      plans: ALL,
      summary: `Download everything Kontax holds about you from **Settings → Data & sync → Download your data**, and erase it by deleting your account, which completes after ${FACTS.deletionGraceDays} days.`,
      keywords: ["gdpr", "data request", "subject access", "erasure", "privacy"],
      steps: [
        { text: "For a copy of your data, follow [Download a full copy of your account data](/help/import-export/download-full-account-export)." },
        { text: "For erasure, follow [Delete your Kontax account](/help/account-security/delete-your-account)." },
        { text: "For anything else — a question about how your data is handled, or written confirmation once erasure completes — email [privacy@getkontax.com](mailto:privacy@getkontax.com)." },
      ],
      whatToExpect: [
        "The data export is a ZIP file with your contacts (vCard and CSV), your activity, a billing summary and your account details.",
        `Erasure starts a ${FACTS.deletionGraceDays}-day grace period, then your account and its contacts, sync connections and history are deleted.`,
        "Our [privacy policy](/privacy) explains what we store and why.",
      ],
      ifItDoesntWork: [
        "If the export link has expired, request a new export from the same page.",
        "If you can't sign in to request either, email [privacy@getkontax.com](mailto:privacy@getkontax.com) from the address on your account.",
      ],
      related: [
        "import-export/download-full-account-export",
        "account-security/delete-your-account",
        "import-export/kontax-export-format",
      ],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "How do I change my email address?",
      a: "Open **Settings → Account**, choose **Change email**, enter the new address and your password, then choose **Send verification email**. The change happens when you click the link sent to the new address (it lasts 24 hours), and confirming it signs you out everywhere. Your old address gets an alert with a 24-hour link to undo the change.",
    },
    {
      q: "Can I turn off security emails?",
      a: "No. Security and billing emails are always sent, so you hear about sign-ins and payment problems even if you turn everything else off in **Settings → Notifications**.",
      more: "account-security/suspicious-sign-in-alert",
    },
    {
      q: "How do I turn off two-factor authentication?",
      a: "In **Settings → Security**, choose **Disable 2FA** and enter your password and a current authenticator code. Your recovery codes are deleted at the same time.",
      more: "account-security/set-up-two-factor-authentication",
    },
  ],
};
