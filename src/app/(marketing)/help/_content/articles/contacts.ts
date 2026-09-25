import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const CONTACTS: HelpCategoryContent = {
  id: "contacts",
  title: "Managing contacts",
  description:
    "Add, edit, search, favourite, bulk-edit, archive and delete contacts, keyboard shortcuts, and each contact's history.",
  articles: [
    {
      slug: "add-edit-contacts",
      title: "Add and edit contacts",
      category: "contacts",
      audience: "Everyone",
      plans: ALL,
      summary:
        "Choose **Create contact** to add someone, and open a contact and choose **Edit** to change their details.",
      keywords: ["add", "edit", "create", "new contact", "change details"],
      steps: [
        { text: "To add someone, choose **Create contact** (or **+** on a phone), enter at least a first or last name, and choose **Save contact**." },
        { text: "To edit, open the contact and choose **Edit**, change what you need, then choose **Save** (or **Cancel** to discard)." },
        { text: "Use the contact's tabs for more: **Sharing** to share it and **History** to see what changed." },
      ],
      whatToExpect: [
        "Contacts you add or edit in Kontax reach your devices and two-way connected accounts on their next sync.",
        "Every change is recorded in the contact's history.",
      ],
      ifItDoesntWork: [
        "If a field won't save, check your connection and try again. On a read-only shared contact (a live share), shared fields can't be edited — see [Live and static sharing](/help/sharing/live-vs-static-sharing).",
      ],
      related: ["getting-started/add-first-contact", "contacts/search-contacts", "contacts/contact-history-and-activity"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "search-contacts",
      title: "Search your contacts",
      category: "contacts",
      audience: "Everyone",
      plans: ALL,
      summary:
        "Type in the search box (or press **/**) and Kontax searches names, companies, emails, phones, addresses, notes and custom fields as you type.",
      keywords: ["search", "find", "look up", "filter"],
      steps: [
        { text: "Click the search box at the top of your contacts, or press **/**." },
        { text: "Type part of a name, company, email, phone number, address or note. Results update as you type." },
        { text: "To narrow results, pick a book, label or smart list first, then search within it." },
      ],
      whatToExpect: [
        "Search also matches nicknames, job titles, extra emails, phones and addresses, and custom fields.",
      ],
      ifItDoesntWork: [
        "No results? Check that a filter isn't still applied, and look in the **Archived** tab — archived contacts aren't in your main list.",
      ],
      related: ["organising/smart-lists", "contacts/keyboard-shortcuts", "organising/labels-vs-books"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "favourites-and-emergency-contacts",
      title: "Mark favourites and emergency contacts",
      category: "contacts",
      audience: "Everyone",
      plans: ALL,
      summary:
        "On a contact, use the star to make it a favourite and **Mark as emergency contact** to pin it for urgent access.",
      keywords: ["favourite", "favorite", "star", "emergency", "ice"],
      steps: [
        { text: "Open the contact." },
        { text: "Choose the star (**Favourite**) to add it to your favourites." },
        { text: "Choose **Mark as emergency contact** to add it to your emergency contacts." },
      ],
      whatToExpect: [
        "Favourites and emergency contacts each have their own view in the sidebar.",
        "In the list, you can also press **F** to favourite the focused contact.",
      ],
      ifItDoesntWork: [
        "Choose the same control again to remove a contact from favourites or emergency contacts.",
      ],
      related: ["contacts/keyboard-shortcuts", "contacts/bulk-edit-contacts", "contacts/search-contacts"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "bulk-edit-contacts",
      title: "Edit many contacts at once",
      category: "contacts",
      audience: "Everyone",
      plans: ALL,
      summary:
        "Select contacts in the list and use the toolbar to add labels, move them to a book, set a company, merge, archive, export or delete them together.",
      keywords: ["bulk", "select", "multiple", "batch", "mass edit"],
      steps: [
        { text: "In your contact list, tick the checkbox next to each contact you want." },
        {
          text: "Choose an action in the toolbar that appears:",
          details: [
            "**Labels**, **Move to book**, **Set company**, **Merge** or **Archive**.",
            "The **⋯** menu has more: favourite all, **Export as CSV**, **Export as Kontax Archive**, print and **Delete permanently**.",
          ],
        },
      ],
      whatToExpect: [
        "Adding labels in bulk keeps the labels those contacts already have.",
        "In the **Archived** view, the toolbar offers **Restore** instead of **Archive**.",
      ],
      ifItDoesntWork: [
        "**Delete permanently** can't be undone. Archive instead if you might want the contacts back.",
      ],
      related: ["organising/create-manage-labels", "organising/move-contacts-between-books", "contacts/archive-delete-contacts"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "keyboard-shortcuts",
      title: "Keyboard shortcuts",
      category: "contacts",
      audience: "Anyone using Kontax on a computer",
      plans: ALL,
      summary: "Press **?** in your contact list to see every shortcut; the common ones are listed below.",
      keywords: ["keyboard", "shortcuts", "hotkeys", "keys"],
      steps: [],
      sections: [
        {
          heading: "Contact list shortcuts",
          table: {
            head: ["Key", "What it does"],
            rows: [
              ["?", "Show or hide the shortcut list"],
              ["/", "Search"],
              ["C", "Create a contact"],
              ["J / K", "Move down / up the list"],
              ["Enter or E", "Open the focused contact"],
              ["F", "Favourite the focused contact"],
              ["Backspace", "Archive the focused contact"],
              ["Esc", "Clear the focus"],
              ["1–9", "Open your first nine smart lists"],
            ],
          },
        },
      ],
      whatToExpect: ["Shortcuts don't fire while you're typing in a field."],
      ifItDoesntWork: ["Click an empty part of the list first so a text field doesn't have focus."],
      related: ["contacts/search-contacts", "organising/smart-lists", "contacts/favourites-and-emergency-contacts"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "archive-delete-contacts",
      title: "Archive or delete a contact",
      category: "contacts",
      audience: "Everyone",
      plans: ALL,
      summary:
        "**Archive** hides a contact but keeps it recoverable in the **Archived** tab; **Delete permanently** removes it for good.",
      keywords: ["archive", "delete", "remove", "restore", "trash"],
      steps: [
        { text: "Open the contact and choose **Archive**. It moves to the **Archived** tab." },
        { text: "To bring it back, open it from **Archived** and choose **Restore**." },
        { text: "To remove it for good, choose **More** → **Delete permanently** and confirm." },
      ],
      whatToExpect: [
        "Permanent deletion can't be undone.",
        `On the Free plan, archived contacts still count towards the ${FACTS.freeContactLimit}-contact limit; deleting them permanently frees the space.`,
      ],
      ifItDoesntWork: [
        "Archived contacts don't appear in your main list or search results — check the **Archived** tab.",
      ],
      related: ["contacts/bulk-edit-contacts", "import-export/contact-limit-reached", "duplicates/merge-duplicate-contacts"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "contact-history-and-activity",
      title: "See what changed on a contact",
      category: "contacts",
      audience: "Anyone tracing an edit, sync or import",
      plans: ALL,
      summary:
        "Each contact's **History** tab shows what changed, when and where it came from; paid plans also get an **Activity** feed across all contacts.",
      keywords: ["history", "activity", "audit", "changes", "who changed"],
      steps: [
        { text: "Open the contact and choose the **History** tab to see its changes." },
        { text: "For every contact at once, open the **Activity** tab in Contacts (Pro, Family and Teams)." },
        { text: "Filter the Activity feed by type (edits, sync, imports, merges, shares) or by who made the change." },
      ],
      sections: [
        {
          heading: "How far back history goes",
          table: {
            head: ["Plan", "Per-contact history", "Activity feed"],
            rows: [
              ["Free", `Last ${FACTS.freeHistoryShown} changes shown`, "—"],
              ["Pro", `${FACTS.proActivityDays} days`, `${FACTS.proActivityDays} days`],
              ["Family", `${FACTS.familyActivityDays} days`, `${FACTS.familyActivityDays} days`],
              ["Teams", "Unlimited", "Unlimited"],
            ],
          },
        },
      ],
      whatToExpect: [
        "Entries say where a change came from — for example added manually, imported, synced from an account, shared by someone, or added via the API.",
      ],
      ifItDoesntWork: [
        "On Free, the **Activity** tab shows that it's a Pro feature, and each contact's history shows its most recent changes.",
      ],
      related: ["duplicates/undo-a-merge", "family-teams/teams-audit-log", "billing/free-vs-pro-plan"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "How do I change how dense the list looks?",
      a: "Use the **Compact** / **Cozy** switch above your contact list: Compact fits more rows, Cozy adds space and avatars.",
    },
    {
      q: "Which plans include the activity log?",
      a: `Pro keeps ${FACTS.proActivityDays} days, Family ${FACTS.familyActivityDays} days and Teams keeps everything. On Free, each contact's history shows its last ${FACTS.freeHistoryShown} changes.`,
      more: "contacts/contact-history-and-activity",
    },
  ],
};
