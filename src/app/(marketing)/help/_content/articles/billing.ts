import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const PAID = ["Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const BILLING: HelpCategoryContent = {
  id: "billing",
  title: "Plans & billing",
  description: "What each plan adds, upgrading and cancelling, failed payments, and how Family billing works.",
  articles: [
    {
      slug: "free-vs-pro-plan",
      title: "Free or Pro: what's the difference?",
      category: "billing",
      audience: "Anyone deciding whether to upgrade",
      plans: ["Free", "Pro"],
      summary: `Free covers up to ${FACTS.freeContactLimit} contacts with ${FACTS.freeSyncAccounts} sync account and ${FACTS.freeDevicePasswords} device; Pro removes the contact limit and adds more connections, vCard export, the Activity feed, contact sharing and the API.`,
      keywords: ["pro", "free", "upgrade", "compare plans", "what does pro add"],
      steps: [],
      sections: [
        {
          heading: "What Pro adds",
          list: [
            "Unlimited contacts and no monthly import cap.",
            `Up to ${FACTS.proSyncAccounts} sync accounts and ${FACTS.proDevicePasswords} device app passwords.`,
            "vCard 4.0 export alongside CSV and the Kontax Archive.",
            `The Activity feed, showing the last ${FACTS.proActivityDays} days.`,
            "Every change in each contact's history (Free shows the most recent few).",
            "Sharing contacts with other Kontax users, as static copies or live shares.",
            "vCard share links that don't expire.",
            "The developer API.",
            "The option to sync every 15 minutes.",
          ],
        },
      ],
      whatToExpect: [
        "Duplicate merging (with undo), labels, books, smart lists, bulk editing, keyboard shortcuts, reminders and the calendar feed are on every plan, including Free.",
        "Prices and the full comparison are on the [pricing page](/pricing).",
      ],
      ifItDoesntWork: [
        "To upgrade, open **Settings → Plan & billing** — see [Manage your subscription](/help/billing/manage-subscription).",
      ],
      related: ["getting-started/understand-free-plan-limits", "billing/manage-subscription", "family-teams/family-vs-teams"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "manage-subscription",
      title: "Upgrade, change or cancel your plan",
      category: "billing",
      audience: "Anyone paying for Kontax, or about to",
      plans: PAID,
      summary:
        "Everything billing-related lives in **Settings → Plan & billing**; **Manage billing** opens the secure Stripe billing portal for payment details and cancelling.",
      keywords: ["subscription", "upgrade", "cancel", "payment method", "invoice", "stripe", "billing"],
      steps: [
        { text: "Open **Settings → Plan & billing**." },
        { text: "To upgrade, choose **Upgrade** on the plan you want and complete checkout." },
        { text: "To update your card or see invoices, choose **Manage billing** and confirm your password to open the Stripe billing portal." },
        { text: "To cancel, choose **Cancel plan**, read what changes, then continue to the billing portal to confirm." },
      ],
      whatToExpect: [
        "After cancelling, the page shows the date your plan ends; until then everything keeps working, and afterwards you move to the Free plan.",
        "Changed your mind before that date? Choose **Keep my plan**.",
        "Payments are handled by Stripe; Kontax doesn't store your card details.",
      ],
      ifItDoesntWork: [
        "If you're a Family member or on a team, billing is managed by the plan's owner (on Teams, also anyone the owner has given billing access), so you may not see **Manage billing**.",
        "See [What happens when you downgrade or cancel](/help/family-teams/downgrade-consequences) before cancelling a Family or Teams plan.",
      ],
      related: ["family-teams/downgrade-consequences", "billing/failed-payment-grace-period", "billing/free-vs-pro-plan"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "failed-payment-grace-period",
      title: "If a payment fails",
      category: "billing",
      audience: "Anyone whose card payment didn't go through",
      plans: PAID,
      summary: `If a renewal payment fails, everything keeps working except file imports while you update your payment method. Kontax shows a banner, emails you, and asks you to update it within ${FACTS.paymentGraceDays} days.`,
      keywords: ["payment failed", "card declined", "grace period", "billing problem", "past due"],
      steps: [
        { text: "Look for the banner “Payment failed. Update your payment method to keep your plan.” or the email “Action required: your Kontax payment failed”." },
        { text: "Choose **Update payment method** and enter a working card in the Stripe billing portal." },
      ],
      whatToExpect: [
        "Everything keeps working except file imports while the payment is sorted out.",
        "If the payment still can't be taken, the subscription ends and your account moves to the Free plan. Your contacts are never deleted.",
        "Family members see a notice that the plan owner needs to update their payment method.",
      ],
      ifItDoesntWork: [
        "If your bank declined the payment, check with them, then update the card again.",
        "If you've moved to Free, you can upgrade again at any time from **Settings → Plan & billing**.",
      ],
      related: ["billing/manage-subscription", "family-teams/downgrade-consequences", "billing/family-billing"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "family-billing",
      title: "How Family billing works",
      category: "billing",
      audience: "Family owners and members",
      plans: ["Family"],
      summary: `The family owner pays for one Family plan covering the shared book for up to ${FACTS.familyMembers} people; members don't pay and keep their own plan for their personal contacts.`,
      keywords: ["family billing", "family plan", "who pays", "family members"],
      steps: [],
      sections: [
        {
          heading: "Who pays for what",
          list: [
            "The owner subscribes to Family and manages billing in **Settings → Plan & billing**.",
            `The owner gets Pro's personal limits (without the developer API, and with the Activity feed showing the last ${FACTS.familyActivityDays} days) plus the shared family book.`,
            "Members join for free. Their personal contacts stay on their own plan — Free unless they subscribe themselves.",
          ],
        },
        {
          heading: "If the owner cancels or a payment fails for good",
          list: [
            `Members get ${FACTS.familyNoticeDays} days' notice, then each member gets a private copy of the family contacts and the owner keeps the book's contacts.`,
          ],
        },
      ],
      whatToExpect: [
        "Members can always export their own contacts.",
      ],
      ifItDoesntWork: [
        "Members who see a billing notice should ask the family owner to update the payment method.",
      ],
      related: ["family-teams/set-up-family-sharing", "family-teams/downgrade-consequences", "billing/manage-subscription"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "Is there a free trial?",
      a: "Kontax doesn't start a trial when you sign up, and Free needs no card. The first time you subscribe to Pro you get a 14-day free trial. It starts at checkout, where you add a card, and you can cancel before it ends.",
      more: "getting-started/understand-free-plan-limits",
    },
    {
      q: "Is the Free plan a trial?",
      a: "No. Free has no time limit. You can use it indefinitely and upgrade only if you need more.",
      more: "getting-started/understand-free-plan-limits",
    },
  ],
};
