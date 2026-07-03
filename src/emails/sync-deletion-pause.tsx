import * as React from "react";

import { EmailButton } from "./_components/email-button";
import {
  EmailDetailBlock,
  EmailFootnote,
  EmailHeading,
  EmailSectionLabel,
  EmailText,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";
import { tokens } from "./_tokens";

interface SyncDeletionPauseProps {
  /** Connection label, e.g. "Personal iCloud". */
  accountLabel: string;
  wouldDelete: number;
  limit: number;
  /** Pre-formatted timestamp string, e.g. "Jul 3, 2026 · 08:00 GMT". */
  when: string;
  reviewUrl: string;
}

/** P39-DB01 §4b: a sync halted by the deletion-safety threshold. */
export default function SyncDeletionPause({
  accountLabel,
  wouldDelete,
  limit,
  when,
  reviewUrl,
}: SyncDeletionPauseProps) {
  return (
    <EmailLayout preview="A sync was paused to protect your contacts">
      <EmailSectionLabel color={tokens.amber}>Sync paused</EmailSectionLabel>
      <EmailHeading>A sync was paused to protect your contacts</EmailHeading>
      <EmailText>
        Your <strong>{accountLabel}</strong> connection tried to delete more
        contacts than your safety limit allows, so Kontax paused it before
        anything was removed. No contacts were deleted.
      </EmailText>
      <EmailDetailBlock
        rows={[
          ["Connection", accountLabel],
          ["Would have deleted", `${wouldDelete} contacts`],
          ["Your limit", `${limit} contacts`],
          ["When", when],
        ]}
      />
      <EmailText>
        Review what would have been removed and choose whether to allow the
        deletions or resume without them.
      </EmailText>
      <EmailButton href={reviewUrl}>Review the paused sync →</EmailButton>
      <EmailFootnote>
        You&rsquo;re receiving this because failure alerts are on for this
        connection. Manage alerts in Sync settings.
      </EmailFootnote>
    </EmailLayout>
  );
}

SyncDeletionPause.PreviewProps = {
  accountLabel: "Personal iCloud",
  wouldDelete: 42,
  limit: 10,
  when: "Jul 3, 2026 · 08:00 GMT",
  reviewUrl: "https://getkontax.com/sync",
} satisfies SyncDeletionPauseProps;
