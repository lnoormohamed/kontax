import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const ORGANISING: HelpCategoryContent = {
  id: "organising",
  title: "Labels, books & lists",
  description: "Organise contacts with labels and books, save filters as smart lists, and move contacts between books.",
  articles: [
    {
      slug: "labels-vs-books",
      title: "Labels or books: which should you use?",
      category: "organising",
      audience: "Anyone organising their contacts",
      plans: ALL,
      summary:
        "Labels are tags you can add freely across all your contacts; books are address books that group contacts and can sync to your devices as separate address books.",
      keywords: ["labels", "books", "tags", "groups", "address books", "organise"],
      steps: [],
      sections: [
        {
          heading: "The difference",
          table: {
            head: ["", "Labels", "Books"],
            rows: [
              ["What they are", "Tags such as VIP, Newsletter or Investor", "Address books such as Personal and Work"],
              ["How many per contact", "Any number", "Every contact has one home book and can be added to others"],
              ["Best for", "Cross-cutting groups and quick filters", "Clear separation, and choosing what a device or connection sees"],
              ["Where to manage", "The **Labels** section in the sidebar", "**Settings → Books**"],
            ],
          },
        },
      ],
      whatToExpect: [
        "New accounts start with two books, Personal and Work.",
        "Labels and books are Kontax features; they don't sync to other contacts apps.",
      ],
      ifItDoesntWork: [
        "Not sure? Start with labels — they're quicker to change later.",
      ],
      related: ["organising/create-manage-labels", "organising/move-contacts-between-books", "organising/smart-lists"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "create-manage-labels",
      title: "Create and manage labels",
      category: "organising",
      audience: "Everyone",
      plans: ALL,
      summary:
        "Add a label from a contact (typing a new name creates it), and rename, recolour, merge or delete labels from the **Labels** section of the sidebar.",
      keywords: ["labels", "tags", "rename label", "colour", "merge labels"],
      steps: [
        { text: "On a contact, use **Add label** and pick an existing label or type a new name to create one." },
        { text: "To label many contacts at once, select them and choose **Labels** in the toolbar." },
        { text: "To manage a label everywhere, open its menu in the sidebar's **Labels** section and choose **Rename**, change its colour, **Merge into…** or **Delete**." },
        { text: "Click a label in the sidebar to see everyone who has it." },
      ],
      whatToExpect: [
        "There are eight label colours.",
        "Renaming, merging or deleting a label applies to every contact that has it.",
      ],
      ifItDoesntWork: [
        "Deleting a label removes it from contacts but doesn't delete the contacts themselves.",
      ],
      related: ["organising/labels-vs-books", "contacts/bulk-edit-contacts", "organising/smart-lists"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "smart-lists",
      title: "Save a filter as a smart list",
      category: "organising",
      audience: "Anyone who reuses the same filters",
      plans: ALL,
      summary:
        "Filter your contacts the way you want, choose **Save as list** in the filter bar, and the smart list appears in your sidebar.",
      keywords: ["smart list", "saved search", "saved filter", "list"],
      steps: [
        { text: "Filter your contacts — search, labels, books, favourites and so on." },
        { text: "Choose **Save as list** in the filter bar, name it and choose **Save list**." },
        { text: "Open it from the sidebar at any time, or press **1**–**9** for your first nine lists." },
      ],
      whatToExpect: [
        "A smart list re-runs its filter each time, so new matching contacts appear automatically.",
      ],
      ifItDoesntWork: [
        "If a list shows nothing, check that the labels, books and search it uses still match your contacts, then save the filter again.",
      ],
      related: ["contacts/search-contacts", "organising/create-manage-labels", "contacts/keyboard-shortcuts"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "move-contacts-between-books",
      title: "Move contacts between books",
      category: "organising",
      audience: "Anyone using more than one book",
      plans: ALL,
      summary:
        "Use the **Books** block on a contact to add it to a book or change its home book, or select several contacts and choose **Move to book**.",
      keywords: ["move", "book", "address book", "home book"],
      steps: [
        {
          text: "On a contact, find the **Books** block:",
          details: ["**Add to book** puts the contact in another book as well.", "**Make home book** changes which book it lives in.", "**Remove from …** takes it out of a book."],
        },
        { text: "For several contacts, select them and choose **Move to book** in the toolbar." },
      ],
      whatToExpect: [
        "**Move to book** changes the home book and keeps any other books the contacts are in.",
        "Moving a contact doesn't change its labels, notes or history.",
        "Create and rename books in **Settings → Books**.",
      ],
      ifItDoesntWork: [
        "A contact always keeps one book, so you can't remove it from its last one — move it to another book first.",
      ],
      related: ["organising/labels-vs-books", "contacts/bulk-edit-contacts", "sync/connect-iphone-or-mac"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "Can I filter by label and book at the same time?",
      a: "Yes. Choose a label and a book in the sidebar, and add favourites or other filters on top. The filter bar above your list shows every active filter so you can remove them one by one.",
    },
  ],
};
