import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const PAID = ["Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const SHARING: HelpCategoryContent = {
  id: "sharing",
  title: "Sharing contacts",
  description:
    "Share a contact as a link or with another Kontax user, understand live and static shares, revoke a share, and set up your public card and QR code.",
  articles: [
    {
      slug: "share-a-contact",
      title: "Share a contact",
      category: "sharing",
      audience: "Anyone passing a contact on",
      plans: ALL,
      summary:
        "Open the contact's **Sharing** tab to download a .vcf, copy a vCard link or show a QR code — and, on paid plans, send a copy or a live share to another Kontax user.",
      keywords: ["share", "send contact", "vcard link", "qr", "send copy", "share live"],
      steps: [
        { text: "Open the contact and choose the **Sharing** tab." },
        {
          text: "For anyone, with or without Kontax: choose **Download .vcf**, **Copy vCard link** or **Show QR code**.",
          details: [`On Free, vCard links expire after ${FACTS.freeVcardLinkDays} days. On paid plans they don't expire and you can revoke them.`],
        },
        {
          text: "For another Kontax user (Pro, Family and Teams): enter their email and choose **Send copy** for a one-off snapshot, or **Share live** for a copy that updates when you edit.",
        },
      ],
      whatToExpect: [
        "Your notes on the contact are never shared.",
        "If the person you share live with is on Free, they receive a static copy instead.",
        "Shares you've sent are listed on the contact's **Sharing** tab with their status.",
      ],
      ifItDoesntWork: [
        "On Free, sending to another Kontax user shows “Sharing with another Kontax user is a Pro feature” — use a vCard link instead, or upgrade.",
        "The recipient must accept the share before it appears in their contacts — see [Accept a contact someone shared with you](/help/sharing/accept-a-shared-contact).",
      ],
      related: ["sharing/live-vs-static-sharing", "sharing/revoke-a-share", "sharing/accept-a-shared-contact"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "accept-a-shared-contact",
      title: "Accept a contact someone shared with you",
      category: "sharing",
      audience: "Anyone who received a shared contact",
      plans: ALL,
      summary: "Open **Settings → Sharing → Shared with me** and choose **Accept** (or **Decline**) on the pending share.",
      keywords: ["accept share", "shared with me", "received contact"],
      steps: [
        { text: "Open **Settings → Sharing → Shared with me**." },
        { text: "Choose **Accept** to add the contact to your address book, or **Decline** to turn it down." },
      ],
      whatToExpect: [
        "An accepted contact becomes your own copy. Your own notes on it stay private and are never sent back.",
        "On a live share, the shared fields are read-only and update when the owner edits them; labels come from the owner's copy.",
        "You can choose **Unlink (keep a static copy)** on a live share at any time to keep a frozen copy you can edit.",
      ],
      ifItDoesntWork: [
        "Nothing listed? Ask the sender to check they used the email address on your Kontax account.",
      ],
      related: ["sharing/live-vs-static-sharing", "sharing/share-a-contact", "sharing/revoke-a-share"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "live-vs-static-sharing",
      title: "Live and static sharing explained",
      category: "sharing",
      audience: "Anyone deciding how to share",
      plans: PAID,
      summary:
        "A static share (**Send copy**) is a one-off snapshot; a live share (**Share live**) keeps the recipient's copy updated whenever you edit the contact.",
      keywords: ["live share", "static share", "snapshot", "linked copy"],
      steps: [],
      sections: [
        {
          heading: "Side by side",
          table: {
            head: ["", "Static (Send copy)", "Live (Share live)"],
            rows: [
              ["After sending", "Never changes", "Updates when the owner edits"],
              ["Recipient can edit", "Yes — it's their copy", "Only their own notes; shared fields are read-only"],
              ["If revoked", "Recipient keeps the copy", "Recipient keeps a frozen static copy"],
              ["Plans", "Pro, Family, Teams", "Pro, Family, Teams (a Free recipient gets a static copy)"],
            ],
          },
        },
      ],
      whatToExpect: [
        "Use live for someone whose details change (a colleague, a shared supplier); static for a one-time handover.",
        "Your notes are never shared either way.",
      ],
      ifItDoesntWork: [
        "Recipients can turn a live share into an editable copy themselves with **Unlink (keep a static copy)**.",
      ],
      related: ["sharing/share-a-contact", "sharing/revoke-a-share", "sharing/accept-a-shared-contact"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "revoke-a-share",
      title: "Stop sharing a contact",
      category: "sharing",
      audience: "Anyone who shared a contact",
      plans: ALL,
      summary: "On the contact's **Sharing** tab, choose **Revoke** next to the share (or **Revoke link** for a vCard link).",
      keywords: ["revoke", "stop sharing", "unshare", "remove share"],
      steps: [
        { text: "Open the contact and choose the **Sharing** tab." },
        { text: "Choose **Revoke** next to the person, or **Revoke link** to turn off a vCard link." },
      ],
      whatToExpect: [
        "A revoked live share stops updating; the recipient keeps a frozen copy of the contact as it was.",
        "A static copy has already been handed over, so the recipient keeps it.",
        "A revoked vCard link stops working for anyone who has it.",
      ],
      ifItDoesntWork: [
        "The share will show as **Revoked** in the list once it's done.",
      ],
      related: ["sharing/share-a-contact", "sharing/live-vs-static-sharing", "sharing/public-contact-card-and-qr-code"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "public-contact-card-and-qr-code",
      title: "Set up your public contact card and QR code",
      category: "sharing",
      audience: "Anyone who wants a shareable card of their own details",
      plans: ALL,
      summary:
        "Claim a username, choose which details show in **Settings → Account → Public card**, and share your card's link or QR code.",
      keywords: ["public card", "username", "qr code", "business card", "profile"],
      steps: [
        {
          text: "In **Settings → Account**, claim a username.",
          details: ["3–30 characters: lowercase letters, numbers, hyphens and underscores, starting and ending with a letter or number."],
        },
        {
          text: "Open **Settings → Account → Public card** and choose which details to show.",
          details: ["Your name and photo always show. Email, phone, company, job title, website, LinkedIn and Twitter / X can each be turned on or off."],
        },
        { text: "Share the link `getkontax.com/u/` followed by your username, or choose **Show QR code** and download the PNG." },
      ],
      whatToExpect: [
        "Visitors can save your details as a contact; Kontax users can add you straight to their address book.",
        "The card page shows view counts (total, last 7 days and last 30 days). Your own visits and known bots aren't counted, and individual visitors aren't shown.",
        "You can change your username once every 30 days.",
      ],
      ifItDoesntWork: [
        "Want it offline? Choose **Hide my card** and the link stops working until you show it again.",
      ],
      related: ["sharing/share-a-contact", "account-security/review-active-sessions", "sharing/revoke-a-share"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "Can the person who shared a contact see my changes?",
      a: "No. Notes you add to a shared contact stay in your account and are never sent back to the owner.",
      more: "sharing/accept-a-shared-contact",
    },
    {
      q: "What is a vCard link?",
      a: `A web link anyone can open to download a contact as a .vcf file — no Kontax account needed. Create one from a contact's **Sharing** tab. On Free, links expire after ${FACTS.freeVcardLinkDays} days.`,
      more: "sharing/share-a-contact",
    },
  ],
};
