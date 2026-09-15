"use server";

import { revertEmailChange, type RevertEmailChangeResult } from "~/server/email-change-revert";

/**
 * P48 review (L3): the revert used to happen on GET when the page rendered,
 * so a mail-link scanner (Safe Links, Gmail prefetch) could cancel a legitimate
 * email change and sign the owner out everywhere. The page now renders a
 * confirm button and the state change happens here, on an explicit POST.
 */
export async function confirmRevertEmailChange(
  _previous: RevertEmailChangeResult | null,
  formData: FormData,
): Promise<RevertEmailChangeResult> {
  const token = formData.get("token");
  return revertEmailChange(typeof token === "string" ? token : "");
}
