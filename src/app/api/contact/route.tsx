import { type NextRequest, NextResponse } from "next/server";

import { renderEmail } from "~/server/render-email";
import { sendEmail } from "~/server/email";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";
import ContactFormSubmission from "~/emails/contact-form-submission";

// Destination inbox — must be a live alias before this route is used in prod.
const SUPPORT_EMAIL = "support@getkontax.com";

const VALID_SUBJECTS = new Set([
  "general",
  "billing",
  "technical",
  "feature",
  "security",
]);

const SUBJECT_LABELS: Record<string, string> = {
  general: "General enquiry",
  billing: "Billing question",
  technical: "Technical issue",
  feature: "Feature request",
  security: "Security report",
};

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const { allowed } = await checkRateLimit(rateLimiters.contactForm, ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot — silent discard if filled
  if (body.website) {
    return NextResponse.json({ success: true });
  }

  const { name, email, subject, message } = body as Record<string, string>;

  if (
    !name?.trim() ||
    !email?.trim() ||
    !subject ||
    !message?.trim() ||
    message.trim().length < 20 ||
    !VALID_SUBJECTS.has(subject)
  ) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const { html, text } = await renderEmail(
    <ContactFormSubmission
      name={name.trim()}
      email={email.trim()}
      subject={subject}
      message={message.trim()}
    />,
  );

  await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `[Kontax Contact] ${subjectLabel} from ${name.trim()}`,
    html,
    text,
    bypassSuppression: true,
  });

  return NextResponse.json({ success: true });
}
