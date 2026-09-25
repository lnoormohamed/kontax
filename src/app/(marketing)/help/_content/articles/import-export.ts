import { FACTS } from "../facts";
import type { HelpCategoryContent } from "../types";

const ALL = ["Free", "Pro", "Family", "Teams"] as const;
const REVIEWED = "2026-09-25";

const OPEN_IMPORT_EXPORT = "Open [Import & export](/import-export) (also in **Settings → Data & sync**).";

export const IMPORT_EXPORT: HelpCategoryContent = {
  id: "import-export",
  title: "Import & export",
  description:
    "Bring contacts in from a CSV or Kontax file, export them as CSV, vCard or the open Kontax format, download all your data, and understand the contact limit.",
  articles: [
    {
      slug: "import-from-google-icloud",
      title: "Import contacts from Google, iCloud or a CSV file",
      category: "import-export",
      audience: "Anyone moving contacts into Kontax",
      plans: ALL,
      summary:
        "Import a CSV file (for example Google's export) or a Kontax file on the Import & export page: choose the file, check the column mapping, preview, then import.",
      keywords: ["import", "csv", "upload", "google csv", "icloud", "migrate", "move contacts"],
      steps: [
        {
          text: "Get a file to import.",
          details: [
            "Google: export your contacts from Google Contacts in the **Google CSV** format.",
            "iCloud: iCloud exports vCard (.vcf) files, which Kontax doesn't import as a file. [Connect iCloud](/help/sync/connect-icloud-contacts) instead — set the direction to **Import only** if you just want a one-way copy.",
            "Kontax: a Kontax Archive (.zip) or contact (.json) from another Kontax account imports as it is.",
          ],
        },
        { text: OPEN_IMPORT_EXPORT },
        { text: "On the **Import** tab, choose the file (CSV, Kontax Archive .zip or contact .json), pick the **Source format** that matches where the CSV came from, and choose **Continue →**." },
        {
          text: "Check how each column maps to a Kontax field.",
          details: ["If you've imported this layout before, choose **Apply saved mapping**."],
        },
        { text: "Read the preview — it shows how many contacts were found, how many have warnings and how many will be skipped — then choose **Import … contacts →**." },
        { text: "Optionally choose **Save preset** so the same layout maps itself next time." },
      ],
      whatToExpect: [
        "Rows that match an existing contact by email or phone are flagged in the preview so you can spot duplicates.",
        "Rows in the same file that share an email or phone must be fixed before the import can go ahead.",
        "Files can be up to 10 MB and 50,000 rows.",
        "Every import appears in **Import history**. Choose **Undo** there to archive everything that import added.",
        "Free has a monthly import allowance; Pro, Family and Teams have none. Syncing a connected account doesn't count as importing.",
      ],
      ifItDoesntWork: [
        "“Import blocked” lists what to fix — usually duplicate rows inside the file.",
        "If some contacts weren't imported because of your plan's contact limit, see [What happens when you reach the contact limit](/help/import-export/contact-limit-reached).",
        "Columns in the wrong place? Go back a step and change the mapping, or see the [CSV format reference](/help/import-export/csv-format-reference).",
      ],
      related: ["import-export/csv-format-reference", "sync/connect-icloud-contacts", "duplicates/merge-duplicate-contacts"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "csv-format-reference",
      title: "CSV format reference for imports and exports",
      category: "import-export",
      audience: "Anyone preparing or editing a CSV file",
      plans: ALL,
      summary:
        "Kontax reads UTF-8 CSV files with a header row and recognises common column names; exported CSVs use the fixed columns listed below.",
      keywords: ["csv", "columns", "headers", "spreadsheet", "excel", "utf-8", "format"],
      steps: [],
      sections: [
        {
          heading: "Preparing a file to import",
          list: [
            "Save as CSV with UTF-8 encoding and a header row.",
            "Column names aren't case-sensitive. You can map any column by hand on the mapping step.",
            "For more than one email or phone, use extra columns (for example “Email 2”) — Kontax collects them all.",
            "A single cell holding several values can be split with a delimiter on the mapping step.",
          ],
        },
        {
          heading: "Column names Kontax recognises",
          table: {
            head: ["Field", "Examples of recognised headers"],
            rows: [
              ["Name", "Name, Full Name, Display Name, First Name, Given Name, Last Name, Surname"],
              ["Email", "Email, E-mail, Email 1, Home Email, Work Email"],
              ["Phone", "Phone, Mobile, Telephone, Home Phone, Work Phone"],
              ["Company", "Company, Organization"],
              ["Job title", "Job Title, Title"],
              ["Website", "Website, URL"],
              ["Birthday", "Birthday, DOB"],
              ["Address", "Address"],
              ["Notes", "Notes, Memo"],
            ],
          },
        },
        {
          heading: "Columns in a Kontax CSV export",
          paragraphs: [
            "Full Name, First Name, Last Name, Pinyin First Name, Pinyin Last Name, Nickname, Email, Additional Emails, Phone, Additional Phones, Company, Pinyin Company, Job Title, Website, Birthday, Address, Additional Addresses, Notes.",
            "Where a contact has several emails, phones or addresses, the extras go in the “Additional …” columns separated by “ | ”. Choose **Choose fields** when exporting to include only the columns you need.",
          ],
        },
      ],
      whatToExpect: [
        "CSV is a flat format: labels, books, photos and custom fields don't round-trip. For a complete copy use the [Kontax format](/help/import-export/kontax-export-format).",
      ],
      ifItDoesntWork: [
        "Accented letters look wrong? Re-save the file as UTF-8.",
        "The “Additional …” columns from a Kontax export aren't recognised automatically on re-import — map them by hand, or import a Kontax Archive instead.",
      ],
      related: ["import-export/import-from-google-icloud", "import-export/export-your-contacts", "import-export/kontax-export-format"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "export-your-contacts",
      title: "Export your contacts",
      category: "import-export",
      audience: "Anyone taking a copy of their contacts",
      plans: ALL,
      summary:
        "On the Import & export page, choose **Export**, pick CSV, the Kontax Archive or (on paid plans) vCard 4.0, and choose **Export and download**.",
      keywords: ["export", "download", "backup", "vcf", "vcard", "csv", "leave"],
      steps: [
        { text: OPEN_IMPORT_EXPORT },
        {
          text: "On the **Export** tab, choose a format:",
          details: [
            "**Kontax Archive (.zip)** — every plan. The complete, documented [Kontax format](/help/import-export/kontax-export-format), optionally with photos.",
            "**CSV** — every plan. For spreadsheets; export all fields or **Choose fields**.",
            "**vCard 4.0** — Pro, Family and Teams. For other contacts apps.",
          ],
        },
        { text: "Turn on **Include archived contacts** if you want those too." },
        { text: "Choose **Export and download**." },
      ],
      whatToExpect: [
        "To export only some contacts, select them in your contact list and choose **Export as CSV** or **Export as Kontax Archive** from the toolbar menu.",
        "Exports include your contacts only; for everything in your account, request a full data export.",
        "Exporting never changes or removes anything in Kontax.",
      ],
      ifItDoesntWork: [
        "If the vCard 4.0 option is greyed out and marked **PRO**, you're on Free — choose CSV or the Kontax Archive instead.",
        "For everything in your account — not just contacts — see [Download a full copy of your account data](/help/import-export/download-full-account-export).",
      ],
      related: ["import-export/kontax-export-format", "import-export/download-full-account-export", "import-export/csv-format-reference"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "kontax-export-format",
      title: "What's in a Kontax Archive export",
      category: "import-export",
      audience: "Anyone who wants a complete, portable copy of their contacts",
      plans: ALL,
      summary:
        "A Kontax Archive is a .zip of documented JSON files — one per contact, based on the JSContact standard (RFC 9553) — that any tool can read and Kontax can import back.",
      keywords: ["kontax format", "archive", "jscontact", "json", "zip", "portable", "schema"],
      steps: [],
      sections: [
        {
          heading: "What's inside the .zip",
          table: {
            head: ["Path", "What it holds"],
            rows: [
              ["`manifest.json`", "Format version, export date, contact counts, integrity checksums, and your labels and books."],
              ["`contacts/0001.json` …", "One JSContact “Card” per contact: name, emails, phones, addresses, dates, plus Kontax labels, custom fields and favourites."],
              ["`media/…`", "Contact photos, when you choose **Include photos**."],
            ],
          },
        },
        {
          heading: "An open, documented format",
          paragraphs: [
            "The format is published with its specification, JSON schemas, example files and a validator on the [developer page](/developers#export-format) — see the [specification](/format/spec.md). Kontax-specific fields use a clearly namespaced extension, so standard JSContact readers can ignore them.",
          ],
        },
      ],
      whatToExpect: [
        "Kontax Archive export is available on every plan.",
        "You can import an archive (or a single contact .json) into Kontax on the Import & export page.",
        "The download link for an archive export lasts 7 days.",
      ],
      ifItDoesntWork: [
        "Need a file for a contacts app that doesn't read JSON? Use CSV, or vCard 4.0 on a paid plan — see [Export your contacts](/help/import-export/export-your-contacts).",
      ],
      related: ["import-export/export-your-contacts", "import-export/download-full-account-export", "developers/generate-an-api-token"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "download-full-account-export",
      title: "Download a full copy of your account data",
      category: "import-export",
      audience: "Anyone who wants everything Kontax holds about them",
      plans: ALL,
      summary:
        "Request a data export from **Settings → Data & sync → Download your data**; Kontax prepares a ZIP in the background and it's ready to download for 48 hours.",
      keywords: ["data export", "download my data", "gdpr", "zip", "everything"],
      steps: [
        { text: "Open **Settings → Data & sync → Download your data**." },
        { text: "Choose **Request data export** and confirm with your password." },
        { text: "When the page shows **Your export is ready** (Kontax also emails you), download the ZIP." },
      ],
      sections: [
        {
          heading: "What's in the ZIP",
          table: {
            head: ["File", "Contents"],
            rows: [
              ["`contacts.vcf`", "Your contacts as vCards."],
              ["`contacts.csv`", "The same contacts as a spreadsheet."],
              ["`activity.json`", "Your activity history."],
              ["`billing-summary.txt`", "Your plan and billing summary."],
              ["`account.json`", "Your profile and account settings."],
            ],
          },
        },
      ],
      whatToExpect: [
        "The export is available on every plan.",
        "The download link lasts 48 hours. After that, request a new export.",
        "If an export is already being prepared, requesting again returns the same one.",
      ],
      ifItDoesntWork: [
        "If the email link doesn't take you to the download, go to **Settings → Data & sync → Download your data** directly.",
        "For a copy you can import back into Kontax, use a [Kontax Archive](/help/import-export/kontax-export-format) instead.",
      ],
      related: ["account-security/gdpr-data-export-and-erasure", "import-export/export-your-contacts", "account-security/delete-your-account"],
      lastReviewed: REVIEWED,
    },
    {
      slug: "contact-limit-reached",
      title: "What happens when you reach the contact limit",
      category: "import-export",
      audience: "Free plan users near or at the limit",
      plans: ["Free"],
      summary: `Free holds up to ${FACTS.freeContactLimit} contacts; at the limit Kontax stops creating new contacts, but nothing is ever deleted and your existing contacts stay editable.`,
      keywords: ["contact limit", "500", "limit reached", "plan limit", "full", "upgrade"],
      steps: [
        { text: "Check your count — Kontax shows a banner in Contacts when you have 20 or fewer contacts left." },
        {
          text: "Make room by removing contacts you don't need.",
          details: [
            "Archived contacts still count. To free the space, delete them permanently (**More** → **Delete permanently**, or the bulk menu).",
            "Merging duplicates also frees space — see [Merge duplicate contacts](/help/duplicates/merge-duplicate-contacts).",
          ],
        },
        { text: "Or upgrade to Pro, Family or Teams for unlimited contacts in **Settings → Plan & billing**." },
      ],
      sections: [
        {
          heading: "What happens at the limit",
          table: {
            head: ["Where", "What happens"],
            rows: [
              ["Adding a contact in Kontax", `You see “Free plan limit reached. You can store up to ${FACTS.freeContactLimit} contacts on this plan.” and the contact isn't created.`],
              ["Importing a file", "Contacts are imported up to the limit and the rest are listed as not imported. Nothing already in Kontax changes."],
              ["Syncing a connected account", "New contacts stop at the limit and the sync finishes as partly successful. Nothing is deleted, and existing contacts keep syncing."],
              ["Your iPhone, Mac or Android", "Saving a brand-new contact to the Kontax account on the device fails; edits to existing contacts still sync."],
              ["The API", "Creating a contact returns an error saying the limit has been reached."],
            ],
          },
        },
      ],
      whatToExpect: [
        "Kontax never deletes contacts to get you under the limit, and you can keep editing, searching and exporting everything you have.",
        "Once you're under the limit (or on a paid plan), the next sync brings in the contacts it skipped. For a file, import the skipped rows again.",
      ],
      ifItDoesntWork: [
        "If your count seems too high, check the **Archived** tab — archived contacts count towards the limit.",
        "Lots of new duplicates after connecting an account? See [Why you have lots of duplicates after your first sync](/help/sync/duplicate-flood-after-first-sync).",
      ],
      related: ["getting-started/understand-free-plan-limits", "duplicates/merge-duplicate-contacts", "billing/free-vs-pro-plan"],
      lastReviewed: REVIEWED,
    },
  ],
  shortAnswers: [
    {
      q: "What file formats can I import?",
      a: "CSV files (with a header row, UTF-8) and Kontax files — a Kontax Archive (.zip) or a single Kontax contact (.json). vCard (.vcf) files can't be imported as files yet; connect the account they came from instead.",
      more: "import-export/import-from-google-icloud",
    },
    {
      q: "Is there a limit on imports?",
      a: "Free has a monthly import allowance, shown on the Import & export page. Pro, Family and Teams can import as often as they like. Syncing a connected account isn't counted as an import.",
      more: "getting-started/understand-free-plan-limits",
    },
    {
      q: "Can I undo an import?",
      a: "Yes. In **Import history** on the Import & export page, choose **Undo** next to the import (or **Undo import** straight after it finishes). The contacts it added are archived, so you can still restore any of them from the **Archived** tab.",
    },
    {
      q: "Is vCard export available on Free?",
      a: "No — the vCard 4.0 export option is part of Pro, Family and Teams. On Free you can export CSV or a Kontax Archive at any time.",
      more: "import-export/export-your-contacts",
    },
  ],
};
