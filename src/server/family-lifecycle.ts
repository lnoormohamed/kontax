import type { SubscriptionPlan } from "../../generated/prisma";
import { sendFamilyNoticeEmail } from "~/server/billing-emails";
import { createNotification } from "~/server/notifications";

// P49A-05: the Family plan's end-of-life (lifecycle-policies.md §1a / §3a).
//
//   owner schedules cancellation ─▶ "ending-scheduled" notice to members
//   owner resumes before the end ─▶ "ending-cancelled"
//   plan lapses                   ─▶ Group.familyDissolveAt = now + 7 days,
//                                    "lapsed" notice; members keep access,
//                                    new invites / joins are blocked
//   owner re-subscribes in time   ─▶ familyDissolveAt cleared, "continues"
//   familyDissolveAt passes       ─▶ each member gets a private copy of the
//                                    shared book and is removed, "dissolved"
//
// The state machine lives in stripe-handlers.ts (it needs the owner's
// effective plan); this module holds the window length, the member-facing
// copy (in-app and email say the same thing) and the invite/join guards.

export const FAMILY_DISSOLVE_NOTICE_MS = 7 * 24 * 60 * 60 * 1000;

const EXPORT_PATH = "/settings/data/export";
const CONTACTS_PATH = "/contacts";

export type FamilyNoticeKind =
  | "ending-scheduled"
  | "ending-cancelled"
  | "lapsed"
  | "continues"
  | "dissolved";

export const formatFamilyDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);

type NoticeCopy = { title: string; body: string; ctaLabel: string; ctaPath: string };

export function familyNoticeCopy(
  kind: FamilyNoticeKind,
  groupName: string,
  date: Date | null,
): NoticeCopy {
  const on = date ? `on ${formatFamilyDate(date)}` : "at the end of the billing period";
  switch (kind) {
    case "ending-scheduled":
      return {
        title: "Your family plan is ending",
        body: `The ${groupName} family plan ends ${on}. Export the shared contacts before then.`,
        ctaLabel: "Export contacts",
        ctaPath: EXPORT_PATH,
      };
    case "ending-cancelled":
      return {
        title: "Your family plan will continue",
        body: `The ${groupName} family plan is no longer ending. Nothing changes for you.`,
        ctaLabel: "Open contacts",
        ctaPath: CONTACTS_PATH,
      };
    case "lapsed":
      return {
        title: "Your family plan has ended",
        body: `The ${groupName} family plan has ended. The shared address book stays available until ${
          date ? formatFamilyDate(date) : "next week"
        }; after that each member gets their own copy.`,
        ctaLabel: "Export contacts",
        ctaPath: EXPORT_PATH,
      };
    case "continues":
      return {
        title: "Your family group continues",
        body: `The ${groupName} family plan is active again. The shared address book stays as it is.`,
        ctaLabel: "Open contacts",
        ctaPath: CONTACTS_PATH,
      };
    case "dissolved":
      return {
        title: "Your family group has ended",
        body: `The ${groupName} family plan is no longer active. A copy of the shared contacts has been added to your library. Your personal contacts are unaffected.`,
        ctaLabel: "Open contacts",
        ctaPath: CONTACTS_PATH,
      };
  }
}

/**
 * In-app notification + email to one member. Both are attempted; the first
 * failure is rethrown so runAfterCommit logs it.
 */
export async function notifyFamilyMember(params: {
  userId: string;
  kind: FamilyNoticeKind;
  groupName: string;
  date: Date | null;
}): Promise<void> {
  const copy = familyNoticeCopy(params.kind, params.groupName, params.date);
  const results = await Promise.allSettled([
    createNotification({
      userId: params.userId,
      category: "BILLING",
      title: copy.title,
      body: copy.body,
      actionUrl: copy.ctaPath,
      expiresAt: params.kind === "lapsed" ? params.date : null,
    }),
    sendFamilyNoticeEmail({
      userId: params.userId,
      subject: copy.title,
      heading: copy.title,
      body: copy.body,
      ctaLabel: copy.ctaLabel,
      ctaPath: copy.ctaPath,
    }),
  ]);
  const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed) throw failed.reason;
}

const FAMILY_OR_ABOVE: SubscriptionPlan[] = ["FAMILY", "TEAMS"];

/**
 * Why the owner may not invite (or re-send an invite) right now, or null.
 * During the notice period the group is winding down: members keep access but
 * nobody new joins a group that dissolves within the week.
 */
export function familyInviteBlockedReason(
  group: { familyDissolveAt: Date | null },
  ownerPlan: SubscriptionPlan,
): string | null {
  if (group.familyDissolveAt) {
    return `Your Family plan has ended, so new members can't be invited. The family group closes on ${formatFamilyDate(group.familyDissolveAt)} unless you re-subscribe.`;
  }
  if (!FAMILY_OR_ABOVE.includes(ownerPlan)) {
    return "A Family plan is required to invite family members.";
  }
  return null;
}

/** Why a pending invite can't be accepted right now, or null. */
export function familyJoinBlockedReason(group: { familyDissolveAt: Date | null }): string | null {
  return group.familyDissolveAt
    ? "This family plan has ended, so the group isn't taking new members."
    : null;
}
