import { render } from "@react-email/components";
import type { ReactElement } from "react";

/**
 * Render a React Email component to the `{ html, text }` pair that
 * {@link import("~/server/email").sendEmail} expects (P20-03). The plain-text
 * variant is the required fallback for clients that don't render HTML.
 */
export async function renderEmail(
  component: ReactElement,
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(component),
    render(component, { plainText: true }),
  ]);
  return { html, text };
}
