import * as React from "react";

import { EmailButton } from "./_components/email-button";
import {
  EmailBulletList,
  EmailDetailBlock,
  EmailFootnote,
  EmailHeading,
  EmailSectionLabel,
  EmailText,
  EmailTextLink,
  EmailWarningBlock,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";
import { tokens } from "./_tokens";

type BillingEventProps =
  | {
      type: "payment-failed";
      planName: string;
      graceDays: number;
      graceDate: string;
      updateUrl: string;
    }
  | {
      type: "trial-ending";
      planName: string;
      daysLeft: number;
      endDate: string;
      updateUrl: string;
    }
  | { type: "plan-upgraded"; planName: string }
  | {
      type: "plan-downgraded";
      toPlan: string;
      changes: string[];
      settingsUrl: string;
    }
  | { type: "account-deletion"; scheduledDeleteDate: string; cancelUrl: string }
  | { type: "account-suspended"; reason: string; supportUrl: string };

/**
 * Billing & account-lifecycle emails (P20-08): payment failure, trial ending,
 * plan upgrade / downgrade, scheduled account deletion, and account suspension.
 * One template, keyed off `type`.
 */
export default function BillingEvent(props: BillingEventProps) {
  if (props.type === "payment-failed") {
    return (
      <EmailLayout preview="Action required: payment failed">
        <EmailHeading>Payment failed</EmailHeading>
        <EmailText>
          We couldn&rsquo;t process the payment for your {props.planName} plan.
          Your billing needs attention.
        </EmailText>
        <EmailWarningBlock>
          Update your payment method within {props.graceDays} days to keep{" "}
          {props.planName}. After that, your account moves to Free.
        </EmailWarningBlock>
        <EmailButton href={props.updateUrl}>
          Update payment method →
        </EmailButton>
        <EmailFootnote>
          If not updated by {props.graceDate}, your account moves to Free. Your
          contacts are never deleted.
        </EmailFootnote>
      </EmailLayout>
    );
  }

  if (props.type === "trial-ending") {
    return (
      <EmailLayout preview={`Your trial ends in ${props.daysLeft} days`}>
        <EmailHeading>Your trial ends in {props.daysLeft} days</EmailHeading>
        <EmailText>
          Add a payment method to continue with {props.planName} after your
          trial ends.
        </EmailText>
        <EmailButton href={props.updateUrl}>Add payment method →</EmailButton>
        <EmailFootnote>
          If no payment method is added, your account moves to Free on{" "}
          {props.endDate}. No contacts are deleted.
        </EmailFootnote>
      </EmailLayout>
    );
  }

  if (props.type === "plan-upgraded") {
    return (
      <EmailLayout preview={`You're now on ${props.planName}`}>
        <EmailSectionLabel color={tokens.green}>
          Plan upgraded
        </EmailSectionLabel>
        <EmailHeading>Welcome to {props.planName}</EmailHeading>
        <EmailText>
          Your plan is now active. You&rsquo;ve unlocked unlimited contacts,
          live sharing, and priority sync.
        </EmailText>
        <EmailFootnote>
          Manage your plan anytime in Settings → Billing.
        </EmailFootnote>
      </EmailLayout>
    );
  }

  if (props.type === "plan-downgraded") {
    return (
      <EmailLayout preview={`Your Kontax plan changed to ${props.toPlan}`}>
        <EmailHeading>Your plan changed to {props.toPlan}</EmailHeading>
        <EmailText>
          Your Kontax Pro plan has ended and your account is now on the{" "}
          {props.toPlan} plan. Here&rsquo;s what changed:
        </EmailText>
        <EmailBulletList items={props.changes} />
        <EmailTextLink href={props.settingsUrl}>View settings →</EmailTextLink>
      </EmailLayout>
    );
  }

  if (props.type === "account-deletion") {
    return (
      <EmailLayout preview="Your Kontax account is scheduled for deletion">
        <EmailHeading>Account deletion scheduled</EmailHeading>
        <EmailText>
          Your Kontax account is scheduled to be permanently deleted on{" "}
          {props.scheduledDeleteDate}. All your contacts and data will be
          removed.
        </EmailText>
        <EmailWarningBlock>
          Changed your mind? Sign back in before then to cancel the deletion and
          keep your account.
        </EmailWarningBlock>
        <EmailButton href={props.cancelUrl}>Cancel deletion →</EmailButton>
      </EmailLayout>
    );
  }

  // account-suspended
  return (
    <EmailLayout preview="Your Kontax account has been suspended">
      <EmailSectionLabel color={tokens.red}>
        Account suspended
      </EmailSectionLabel>
      <EmailHeading>Your account has been suspended</EmailHeading>
      <EmailText>
        Your Kontax account has been suspended. You won&rsquo;t be able to sign
        in while the suspension is active.
      </EmailText>
      <EmailDetailBlock rows={[["Reason", props.reason]]} />
      <EmailText>
        If you believe this is a mistake, contact Kontax support.
      </EmailText>
      <EmailButton href={props.supportUrl}>Contact support →</EmailButton>
    </EmailLayout>
  );
}

BillingEvent.PreviewProps = {
  type: "payment-failed",
  planName: "Kontax Pro",
  graceDays: 7,
  graceDate: "Jun 18, 2026",
  updateUrl: "https://kontax.app/settings/billing",
} satisfies BillingEventProps;
