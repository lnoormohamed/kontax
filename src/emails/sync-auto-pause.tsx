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

interface SyncAutoPauseProps {
  /** Connection label, e.g. "Work Fastmail". */
  accountLabel: string;
  failureCount: number;
  /** Last error code / short description, e.g. "503 Service Unavailable". */
  lastError: string;
  openUrl: string;
}

/** P39-DB01 §4c: auto-paused after repeated failures (retry sensitivity). */
export default function SyncAutoPause({
  accountLabel,
  failureCount,
  lastError,
  openUrl,
}: SyncAutoPauseProps) {
  return (
    <EmailLayout preview="We paused a sync after repeated failures">
      <EmailSectionLabel color={tokens.amber}>Sync auto-paused</EmailSectionLabel>
      <EmailHeading>We paused a sync after repeated failures</EmailHeading>
      <EmailText>
        <strong>{accountLabel}</strong> failed {failureCount} times in a row,
        so Kontax stopped retrying. Last error:{" "}
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "12.5px" }}>
          {lastError}
        </span>
        .
      </EmailText>
      <EmailText>
        Your contacts are safe — nothing changed while the connection is
        paused. Fix the issue, then resume from the sync page.
      </EmailText>
      <EmailButton href={openUrl}>Open the connection →</EmailButton>
      <EmailFootnote>
        You&rsquo;re receiving this because failure alerts are on for this
        connection. Manage alerts in Sync settings.
      </EmailFootnote>
    </EmailLayout>
  );
}

SyncAutoPause.PreviewProps = {
  accountLabel: "Work Fastmail",
  failureCount: 5,
  lastError: "503 Service Unavailable",
  openUrl: "https://getkontax.com/sync",
} satisfies SyncAutoPauseProps;
