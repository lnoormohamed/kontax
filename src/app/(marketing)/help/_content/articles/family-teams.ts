import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const FAMILY_TEAMS: HelpCategoryContent = {
  id: "family-teams",
  title: "Family & Teams",
  description:
    "Share an address book with your household or team: set up Family, invite and remove people, Teams roles and audit log, and what happens when you downgrade.",
  articles: [
    {
      slug: "set-up-family-sharing",
      title: "Set up a shared family address book",
      category: "family-teams",
      audience: "Family plan owners",
      plans: ["Family"],
      summary: `On the Family plan, create your family book in **Settings → Sharing → Family** and invite up to ${FACTS.familyMembers - 1} people to share it.`,
      keywords: ["family", "household", "shared book", "family sharing"],
      steps: [
        { text: "Open **Settings → Sharing → Family**." },
        { text: "Give your family a name and choose **Create family book**." },
        { text: "Under **Invite a family member**, enter each person's email and choose **Send invite**." },
        { text: "Choose whether each member **Can edit** the book or has **View only** access." },
      ],
      whatToExpect: [
        `A family has up to ${FACTS.familyMembers} people including you. Pending invitations count towards that until they're accepted or revoked.`,
        "Members see the family book in Contacts under the **Family** view, and it syncs to their phones and computers as a second address book.",
        "Everyone keeps their own private contacts alongside the family book.",
        "Members keep their own plan; the Family plan covers the shared book, not their personal accounts.",
      ],
      ifItDoesntWork: [
        "“Family books are part of the Family plan” means your account isn't on Family yet — see the [pricing page](/pricing).",
        `Invitations expire after ${FACTS.inviteHours} hours; use **Resend** if someone missed theirs.`,
      ],
      related: ["family-teams/invite-remove-family-members", "family-teams/family-vs-teams", "billing/family-billing"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "invite-remove-family-members",
      title: "Invite, remove or leave family members",
      category: "family-teams",
      audience: "Family owners and members",
      plans: ["Family"],
      summary:
        "The owner invites and removes people in **Settings → Sharing → Family**; members can choose **Leave family** and keep a private copy of the family contacts.",
      keywords: ["invite", "remove member", "leave family", "family member"],
      steps: [
        { text: "To invite: in **Settings → Sharing → Family**, enter an email under **Invite a family member** and choose **Send invite**." },
        { text: "The person opens the email link and chooses **Accept & join** (signing in or creating an account first if needed)." },
        { text: "To remove someone (owner only): choose **Remove** next to them and confirm." },
        { text: "To leave (members): choose **Leave family** and confirm." },
      ],
      whatToExpect: [
        "Someone who leaves gets a private copy of the family contacts in a new book in their account.",
        "Someone who is removed loses access to the family book and doesn't get a copy. You can invite them again later.",
        "Pending invitations can be resent or revoked; declined ones can be invited again or dismissed.",
        "The owner can't leave their own family — they can delete the group instead.",
      ],
      ifItDoesntWork: [
        `If the invite link says it's no longer valid, it has expired (after ${FACTS.inviteHours} hours) or been revoked — ask the owner to send a new one.`,
        `“Your family is full” — a family holds ${FACTS.familyMembers} people. Remove someone or revoke a pending invite first.`,
      ],
      related: ["family-teams/set-up-family-sharing", "family-teams/downgrade-consequences", "billing/family-billing"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "family-vs-teams",
      title: "Family or Teams: which plan fits?",
      category: "family-teams",
      audience: "Anyone choosing a plan for more than one person",
      plans: ["Family", "Teams"],
      summary:
        "Family gives a household one shared address book; Teams is for organisations, with several shared books, roles, per-book permissions and an audit log.",
      keywords: ["family", "teams", "compare", "which plan", "organisation"],
      steps: [],
      sections: [
        {
          heading: "Side by side",
          table: {
            head: ["", "Family", "Teams"],
            rows: [
              ["People", `Up to ${FACTS.familyMembers}`, `One per seat (minimum ${FACTS.teamsMinSeats})`],
              ["Shared address books", "One", "As many as you need"],
              ["Access control", "Can edit or View only per member", "Owner, Admin and Member roles, plus Edit, View or None per book"],
              ["Audit log", "—", "Yes, kept indefinitely"],
              ["Activity feed shows", `Last ${FACTS.familyActivityDays} days`, "All activity"],
              ["Developer API", "—", "Included"],
            ],
          },
        },
      ],
      whatToExpect: [
        "Both keep each person's private contacts separate from the shared books.",
        "Prices for both are on the [pricing page](/pricing).",
      ],
      ifItDoesntWork: [
        "Not sure? Email [support@getkontax.com](mailto:support@getkontax.com) and tell us how many people and books you need.",
      ],
      related: ["family-teams/set-up-family-sharing", "family-teams/teams-roles-and-permissions", "billing/family-billing"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "teams-roles-and-permissions",
      title: "Teams roles and book permissions",
      category: "family-teams",
      audience: "Teams owners and admins",
      plans: ["Teams"],
      summary:
        "Teams has three roles — Owner, Admin and Member — and each member's access to each shared book can be Edit, View or None.",
      keywords: ["roles", "permissions", "admin", "owner", "member", "teams"],
      steps: [
        { text: "Open **Settings → Sharing → Teams**." },
        { text: "Invite people as **Member** or **Admin**. Use **Make admin**, **Make member** or **Make owner** to change a role later." },
        { text: "Open **Book permissions** to set each member's access to each book: **Edit**, **View** or **None**." },
      ],
      whatToExpect: [
        "Owners and admins always have full access to every book.",
        "New members get Edit access to books by default.",
        `A team can have as many members as the seats you've bought (minimum ${FACTS.teamsMinSeats}) and any number of shared books. Invitations expire after ${FACTS.inviteHours} hours.`,
        "Members who choose **Leave team** don't keep a copy of the team's contacts.",
      ],
      ifItDoesntWork: [
        "Can't see an invite option? The owner or an admin can invite people; only the owner can make someone an admin.",
      ],
      related: ["family-teams/teams-audit-log", "family-teams/family-vs-teams", "family-teams/downgrade-consequences"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "teams-audit-log",
      title: "Use the Teams audit log",
      category: "family-teams",
      audience: "Teams owners and admins",
      plans: ["Teams"],
      summary:
        "The audit log records every change to your team's shared books — who, what, which book and when — and can be filtered and exported as CSV.",
      keywords: ["audit log", "audit trail", "who changed", "compliance", "teams"],
      steps: [
        { text: "Open **Settings → Sharing → Teams** and choose **Audit log**." },
        { text: "Filter by member, book, type of event or date range." },
        { text: "Choose **Export CSV** to download what you've filtered." },
      ],
      whatToExpect: [
        "It records contacts created, updated, archived, restored, merged, imported and synced, with the fields that changed.",
        "Owners and admins can see it. Entries are kept for as long as the team exists.",
      ],
      ifItDoesntWork: [
        "Members without the Admin role can't open the audit log — ask the owner to make you an admin.",
      ],
      related: ["family-teams/teams-roles-and-permissions", "contacts/contact-history-and-activity", "family-teams/family-vs-teams"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "downgrade-consequences",
      title: "What happens when you downgrade or cancel",
      category: "family-teams",
      audience: "Anyone moving to a smaller plan",
      plans: ALL,
      summary:
        "Downgrading never deletes your contacts: you keep everything, but features above your new plan stop — and Family and Teams groups get a notice or grace period first.",
      keywords: ["downgrade", "cancel", "free", "what happens", "lose", "family notice", "teams grace"],
      steps: [
        { text: "Before you downgrade, export anything you want a copy of — see [Export your contacts](/help/import-export/export-your-contacts)." },
        { text: "Cancel or change your plan from **Settings → Plan & billing** — see [Manage your subscription](/help/billing/manage-subscription)." },
        { text: "Your plan continues until the end of the period you've paid for, then the changes below apply." },
      ],
      sections: [
        {
          heading: "Moving to Free",
          list: [
            `Your contacts stay. If you have more than ${FACTS.freeContactLimit}, you can keep and edit them all, but you can't add new ones until you're under the limit.`,
            `Free includes ${FACTS.freeSyncAccounts} sync account: your oldest one keeps syncing and the others are paused, not deleted.`,
            "Device app passwords you already have keep working; you can't create new ones beyond the Free allowance.",
            "Live shares you've sent or received become static copies.",
            `The Activity feed locks and each contact's history shows its last ${FACTS.freeHistoryShown} changes.`,
            "vCard 4.0 export and the developer API are no longer available. CSV and Kontax Archive export stay.",
          ],
        },
        {
          heading: "Leaving Family",
          list: [
            `Members get ${FACTS.familyNoticeDays} days' notice and keep access to the family book during that time.`,
            "When the notice ends, each member gets a private copy of the family contacts in their own account.",
            "As the owner, you keep the family book and its contacts in your account.",
          ],
        },
        {
          heading: "Leaving Teams",
          list: [
            `The team keeps working for ${FACTS.teamsGraceDays} days after your paid period ends — export any team books you need in that time.`,
            "After that, members keep read access but nobody can edit the team's books.",
            "Members go back to their own plans.",
          ],
        },
      ],
      whatToExpect: [
        "Nothing is deleted by a downgrade. Upgrade again at any time to lift the limits.",
      ],
      ifItDoesntWork: [
        "Questions about a specific downgrade? Email [support@getkontax.com](mailto:support@getkontax.com) before you change plan.",
      ],
      related: ["billing/manage-subscription", "import-export/contact-limit-reached", "getting-started/understand-free-plan-limits"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "Do family members get Pro?",
      a: "No. The Family plan covers the shared family book; each member keeps their own plan for their personal contacts (Free unless they subscribe themselves).",
      more: "billing/family-billing",
    },
  ],
};
