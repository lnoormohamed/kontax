import * as React from "react";

import {
  EmailDetailBlock,
  EmailFootnote,
  EmailHeading,
  EmailText,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";

const SUBJECT_LABELS: Record<string, string> = {
  general: "General enquiry",
  billing: "Billing question",
  technical: "Technical issue",
  feature: "Feature request",
  security: "Security report",
};

interface ContactFormSubmissionProps {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function ContactFormSubmission({
  name,
  email,
  subject,
  message,
}: ContactFormSubmissionProps) {
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;

  return (
    <EmailLayout preview={`New contact form submission from ${name}`}>
      <EmailHeading>New contact form submission</EmailHeading>
      <EmailText>
        You have a new message from the Kontax contact form. Reply directly to
        this email to respond to {name}.
      </EmailText>
      <EmailDetailBlock
        rows={[
          ["Name", name],
          ["Email", email],
          ["Subject", subjectLabel],
        ]}
      />
      <EmailText>
        <strong>Message:</strong>
        <br />
        {message}
      </EmailText>
      <EmailFootnote>
        This message was submitted via getkontax.com/contact.
      </EmailFootnote>
    </EmailLayout>
  );
}
