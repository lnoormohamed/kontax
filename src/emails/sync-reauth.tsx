import * as React from "react";

import { EmailButton } from "./_components/email-button";
import {
  EmailFootnote,
  EmailHeading,
  EmailSectionLabel,
  EmailText,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";
import { tokens } from "./_tokens";

interface SyncReauthProps {
  /** Connection label, e.g. "Personal iCloud". */
  accountLabel: string;
  /** Why re-auth is needed, e.g. "Your app password was rejected". */
  reason: string;
  reconnectUrl: string;
}

/** P39-DB01 §4c: credentials broken — reconnect required. Like security
 * alerts, re-auth emails can't be unsubscribed from. */
export default function SyncReauth({ accountLabel, reason, reconnectUrl }: SyncReauthProps) {
  return (
    <EmailLayout
      preview={`Reconnect ${accountLabel} to keep syncing`}
      unsubscribe={false}
    >
      <EmailSectionLabel color={tokens.red}>Action required</EmailSectionLabel>
      <EmailHeading>Reconnect {accountLabel} to keep syncing</EmailHeading>
      <EmailText>
        {reason}, so syncing is on hold. Reconnect to restore it — your
        contacts are safe in the meantime.
      </EmailText>
      <EmailButton href={reconnectUrl} tone="red">
        Reconnect →
      </EmailButton>
      <EmailFootnote>
        For your security, re-auth alerts can&rsquo;t be unsubscribed from.
      </EmailFootnote>
    </EmailLayout>
  );
}

SyncReauth.PreviewProps = {
  accountLabel: "Personal iCloud",
  reason: "Your app password was rejected",
  reconnectUrl: "https://getkontax.com/sync",
} satisfies SyncReauthProps;
