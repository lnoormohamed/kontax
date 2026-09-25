import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const NOTIFICATIONS: HelpCategoryContent = {
  id: "notifications",
  title: "Reminders & notifications",
  description: "Birthday and anniversary reminders, the calendar feed, email digests and choosing which notifications you get.",
  articles: [
    {
      slug: "set-up-birthday-reminders",
      title: "Get reminders for birthdays and other dates",
      category: "notifications",
      audience: "Everyone",
      plans: ALL,
      summary:
        "Kontax reminds you ahead of your contacts' birthdays and saved dates; choose how far ahead in **Settings → Notifications**, and override it per contact.",
      keywords: ["birthday", "reminder", "anniversary", "dates", "notification"],
      steps: [
        { text: "Add a birthday or another date (such as an anniversary) to a contact." },
        {
          text: "Open **Settings → Notifications** and, next to **Remind me**, choose how far ahead: 1 day, 3 days, 1 week, 2 weeks or 1 month before.",
        },
        { text: "Choose whether reminders arrive in the app, by email, or both." },
        { text: "To change the timing for one person, open the contact and set **Remind me before dates on this contact** (or **Use default**)." },
      ],
      whatToExpect: [
        "The default is 1 week before.",
        "Reminders arrive in the app by default; email reminders are off until you turn them on.",
        "Each date is reminded once a year.",
      ],
      ifItDoesntWork: [
        "No reminder? Check the contact has the date saved, and that the reminder category is switched on in **Settings → Notifications**.",
        "Prefer your calendar? See [Add contact birthdays to your calendar](/help/notifications/subscribe-to-birthday-calendar).",
      ],
      related: ["notifications/subscribe-to-birthday-calendar", "contacts/add-edit-contacts", "account-security/suspicious-sign-in-alert"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "subscribe-to-birthday-calendar",
      title: "Add contact birthdays to your calendar",
      category: "notifications",
      audience: "Anyone who lives in their calendar app",
      plans: ALL,
      summary:
        "Generate a private calendar link in **Settings → Notifications → Calendar feed** and subscribe to it in Google Calendar, Apple Calendar or any app that supports calendar subscriptions.",
      keywords: ["calendar", "ical", "ics", "subscribe", "birthday calendar", "feed"],
      steps: [
        { text: "Open **Settings → Notifications** and find **Calendar feed**." },
        { text: "Choose **Generate calendar URL** and copy the link." },
        { text: "In your calendar app, add a subscribed calendar (sometimes called “From URL”) and paste the link." },
      ],
      whatToExpect: [
        "The feed includes birthdays, anniversaries and other saved dates, and updates as you edit contacts.",
        "Every date repeats on the same calendar date each year. A date labelled “Lunar birthday” is not converted from the lunar calendar, so it appears on the date you saved.",
        "How often it refreshes is up to your calendar app.",
        "The calendar feed is available on every plan.",
      ],
      ifItDoesntWork: [
        "The link contains a private token — anyone with it can see your contacts' dates, so don't share it.",
      ],
      related: ["notifications/set-up-birthday-reminders", "contacts/add-edit-contacts", "import-export/export-your-contacts"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "Which notifications can I turn off?",
      a: "In **Settings → Notifications** you can switch contact sharing, sync status, reminders and product updates on or off, in the app and by email. Security and billing emails are always sent.",
    },
    {
      q: "What is the email digest?",
      a: "Instead of individual emails, you can get one summary: choose **Daily digest** or **Weekly digest** (or **No digest**) under **Email digest** in **Settings → Notifications**.",
    },
    {
      q: "Does Kontax send push notifications?",
      a: "Not at the moment. Notifications appear inside Kontax and, if you choose, by email.",
    },
  ],
};
