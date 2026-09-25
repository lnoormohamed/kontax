"use client";

import { useCallback, useState } from "react";

import { createBillingPortalSession } from "~/app/actions/billing";
import { ConfirmPasswordModal } from "~/app/_components/confirm-password-modal";

/**
 * P48-02 — the one client-side entry point to the Stripe customer portal.
 *
 * `createBillingPortalSession` now verifies the user's password server-side, so
 * every surface that opens the portal needs a way to collect one. Rather than
 * repeat the modal wiring in six components, each caller renders `modal` and
 * calls `launch()`:
 *
 *   const portal = useBillingPortal();
 *   ...
 *   {portal.modal}
 *   <button onClick={() => void portal.launch()} />
 *
 * `launch()` reports what happened so the caller knows whether to show its own
 * error: "prompting" means the password modal is up and the flow continues
 * there, so it is NOT a failure.
 */
export type PortalLaunch =
  /** A portal URL came back; the browser is navigating to it. */
  | "navigating"
  /** The password modal is now open; the flow resumes when it is submitted. */
  | "prompting"
  /** Something else went wrong — the caller shows its own error. */
  | "failed";

export function useBillingPortal() {
  const [prompting, setPrompting] = useState(false);

  const launch = useCallback(async (): Promise<PortalLaunch> => {
    const result = await createBillingPortalSession();
    if ("url" in result) {
      window.location.href = result.url;
      return "navigating";
    }
    if (result.error === "STEP_UP_REQUIRED") {
      setPrompting(true);
      return "prompting";
    }
    return "failed";
  }, []);

  // Submitted from inside the modal — returns the message to display, or
  // nothing when the portal opened.
  const confirm = useCallback(async (currentPassword: string): Promise<string | void> => {
    const result = await createBillingPortalSession({ currentPassword });
    if ("url" in result) {
      window.location.href = result.url;
      return;
    }
    if (result.error === "WRONG_PASSWORD") return "Incorrect password. Please try again.";
    if (result.error === "RATE_LIMIT_EXCEEDED")
      return "Too many attempts. Please wait a moment and try again.";
    if (result.error === "STEP_UP_REQUIRED") return "Please enter your password.";
    if (result.error === "NO_BILLING_ACCOUNT")
      return "There's no paid subscription to manage on this account.";
    return "Something went wrong opening billing. Please try again.";
  }, []);

  const modal = prompting ? (
    <ConfirmPasswordModal
      confirmLabel="Open billing portal"
      description="Enter your password to manage your subscription and payment details."
      onClose={() => setPrompting(false)}
      onConfirmed={confirm}
      serverVerifies
      title="Confirm your identity"
    />
  ) : null;

  return { launch, modal };
}
