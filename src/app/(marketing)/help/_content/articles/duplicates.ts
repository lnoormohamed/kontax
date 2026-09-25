import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

export const DUPLICATES: HelpCategoryContent = {
  id: "duplicates",
  title: "Duplicates & merging",
  description: `Find and merge duplicate contacts field by field, clear suggestions in bulk, and undo a merge within ${FACTS.mergeUndoDays} days.`,
  articles: [
    {
      slug: "merge-duplicate-contacts",
      title: "Merge duplicate contacts",
      category: "duplicates",
      audience: "Anyone with the same person saved more than once",
      plans: ALL,
      summary:
        "Open the **Duplicates** tab and merge a suggested pair in one click, or choose **Review →** to pick which value to keep for each field.",
      keywords: ["merge", "duplicates", "combine contacts", "same person twice"],
      steps: [
        { text: "Open [Contacts](/contacts?tab=duplicates) and choose **Duplicates** in the sidebar." },
        {
          text: "On a suggested pair, choose **Merge** to combine them straight away, or **Review →** to decide field by field.",
          details: ["If the pair are different people, choose **Not a duplicate** and Kontax stops suggesting them."],
        },
        {
          text: "On the review page, choose the record to keep, then the main value for each field that differs — the first contact's, the second's, or **Both** where values can be combined.",
        },
        { text: "Choose **Merge into …** to finish." },
      ],
      sections: [
        {
          heading: "Other ways to merge",
          list: [
            "From a contact: open **More** → **Merge with another contact**, find the other person, then choose **Compare & merge →**.",
            "From the list: select two or more contacts and choose **Merge** in the toolbar.",
            "**Manual merge** in the Duplicates toolbar lets you pick any two contacts yourself.",
          ],
        },
      ],
      whatToExpect: [
        "The merged contact keeps the details you chose, and Kontax keeps what it needs to restore both contacts if you undo.",
        `Merging is included on every plan, and you can undo any merge for ${FACTS.mergeUndoDays} days.`,
        "Merged contacts appear under **Merged contacts** on the Duplicates tab.",
      ],
      ifItDoesntWork: [
        "No suggestions showing? Choose **Rescan** in the Duplicates toolbar.",
        "If you merged the wrong people, see [Undo a merge](/help/duplicates/undo-a-merge).",
      ],
      related: ["duplicates/undo-a-merge", "duplicates/review-merge-suggestions-in-bulk", "sync/duplicate-flood-after-first-sync"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "undo-a-merge",
      title: "Undo a merge",
      category: "duplicates",
      audience: "Anyone who merged two contacts by mistake",
      plans: ALL,
      summary: `Find the merge under **Merged contacts** on the Duplicates tab and choose **Undo** — you can do this for ${FACTS.mergeUndoDays} days after merging.`,
      keywords: ["undo merge", "unmerge", "split contact", "separate contacts", "wrong merge"],
      steps: [
        { text: "Open [Contacts](/contacts?tab=duplicates) and choose **Duplicates**." },
        { text: "Scroll to **Merged contacts** and find the merge you want to reverse." },
        { text: "Choose **Undo**, then **Undo merge** to confirm." },
      ],
      whatToExpect: [
        "Both contacts come back as separate records with the details they had before the merge, including labels, dates, notes and favourites.",
        "The pair reappears as a duplicate suggestion, so you can choose **Not a duplicate** if they're different people.",
        `After ${FACTS.mergeUndoDays} days the entry shows **Expired** and can no longer be undone.`,
      ],
      ifItDoesntWork: [
        "The list shows your 20 most recent merges. If an older merge isn't listed, email [support@getkontax.com](mailto:support@getkontax.com).",
      ],
      related: ["duplicates/merge-duplicate-contacts", "duplicates/review-merge-suggestions-in-bulk", "contacts/contact-history-and-activity"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "review-merge-suggestions-in-bulk",
      title: "Clear lots of duplicate suggestions at once",
      category: "duplicates",
      audience: "Anyone facing a long list of duplicate suggestions",
      plans: ALL,
      summary:
        "Merge every high-confidence pair in one step with **Accept all … high-confidence**, then work through the rest pair by pair or group by group.",
      keywords: ["bulk merge", "merge all", "many duplicates", "accept all"],
      steps: [
        { text: "Open [Contacts](/contacts?tab=duplicates) and choose **Duplicates**." },
        {
          text: "Choose **Accept all … high-confidence** and confirm.",
          details: ["Each high-confidence pair is merged, keeping the contact that was added first."],
        },
        { text: "For a group of identical copies, choose **Merge all** on the group card, or **Not duplicates** to dismiss the group." },
        { text: "For the remaining pairs, choose **Merge**, **Review →** or **Not a duplicate**. Use **Load more duplicates** to see further suggestions." },
      ],
      whatToExpect: [
        `Every merge made in bulk can still be undone individually for ${FACTS.mergeUndoDays} days.`,
        "**Rescan** refreshes the suggestions, for example after a large import or sync.",
      ],
      ifItDoesntWork: [
        "If **Accept all** isn't shown, there are no high-confidence suggestions right now — review the remaining pairs one by one.",
      ],
      related: ["duplicates/merge-duplicate-contacts", "duplicates/undo-a-merge", "sync/duplicate-flood-after-first-sync"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "Does Kontax find duplicates automatically?",
      a: "Yes. Kontax suggests contacts that look like the same person — for example matching names, email addresses or phone numbers — on the **Duplicates** tab. Nothing is merged until you choose to merge it.",
      more: "duplicates/merge-duplicate-contacts",
    },
    {
      q: "Does importing a file check for duplicates?",
      a: "The import preview warns you when a row matches an existing contact by email or phone. Rows inside the same file that share an email or phone must be resolved before the import can go ahead. Anything that slips through shows up on the Duplicates tab afterwards.",
      more: "import-export/import-from-google-icloud",
    },
  ],
};
