import { BillingBannerSlot } from "~/app/_components/billing-banner-slot";
import { ConnectionBanner } from "~/app/_components/connection-banner";
import { EmailVerificationBanner } from "~/app/_components/email-verification-banner";
import { SecurityAlertBannerSlot } from "~/app/_components/security-alert-banner-slot";

// P46-DB06 A3 — the ONE ordered app banner stack, mounted identically on every
// screen: email-verification ▸ billing ▸ security ▸ connection. (Impersonation
// renders above all of these from the root layout.) Screens must mount this
// component rather than assembling their own copy of the stack — /contacts and
// /sync used to duplicate it and drift.
export function AppBannerStack({
  userId,
  email,
  emailVerified,
  readOnly,
  readOnlyVariant,
}: {
  userId?: string;
  email?: string;
  /** Skips the verification nudge when true (or when there is no user). */
  emailVerified?: boolean;
  readOnly: boolean;
  /** P42-DB01: which account-state copy the connection banner shows. */
  readOnlyVariant?: "grace" | "locked";
}) {
  return (
    <>
      {userId && !emailVerified ? <EmailVerificationBanner email={email ?? ""} /> : null}
      {userId ? <BillingBannerSlot userId={userId} /> : null}
      {userId ? <SecurityAlertBannerSlot userId={userId} /> : null}
      <ConnectionBanner readOnly={readOnly} readOnlyVariant={readOnlyVariant} />
    </>
  );
}
