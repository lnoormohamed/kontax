// P41-DB01 — projection copy deck (single source of truth).
//
// Every projection string, checked against the §3 honesty table. Voice: calm,
// factual, no exclamation marks — the P42 register. Terms shared with P40:
// book, private, favour. Reused across the rail, the settings panel, the
// explainer, and onboarding so the wording never drifts.

export const PROJECTION_COPY = {
  // ── Scope (Surface 2A) — the two controls kept deliberately distinct ────────
  allowlistLabel: "Books to sync",
  allowlistSub: "Which of this account's remote address books Kontax may touch.",
  projectionLabel: "What this connection projects",
  projectionSub: "Of the contacts Kontax holds, which get pushed out to this device — chosen by book membership.",
  // The verbatim reason the two controls don't merge.
  disambiguation:
    "The allowlist is about reach — what Kontax may read or write on the remote. Projection is about direction of outflow — which of your books this device is trusted to receive. A book can be eligible to sync yet not projected here, or projected without being an inbound target.",

  // ── Precedence (Surface 2B) ─────────────────────────────────────────────────
  precedenceLabel: "When a contact is in more than one book",
  precedenceSub: "Some people live in both Personal and Work. Choose which book's version of a shared field this device receives.",
  favourWork: "Favour Work",
  favourPersonal: "Favour Personal",

  // ── Private fields (Surface 2B / §4B) ───────────────────────────────────────
  privateStatementTitle: "Private fields are never pushed to this device.",
  privateStatementBody:
    "This isn't a setting — it's how Kontax works. Fields you've marked private stay on your own devices and are never sent to a synced account.",
  // The shared privacy-boundary sentence (§4B). Written once here; cited wherever
  // "private" appears — the 2B statement, the explainer footer, and P40's
  // private-field hint all reference this exact string. No drift.
  privacyBoundary:
    "Private fields stay on your own devices. Kontax never sends them to a synced account — but once a field is shared, we can't control what that other service does with it.",

  // ── Explainer (Surface 3) ───────────────────────────────────────────────────
  explainerTitle: "What will this device see?",
  emptyBookTitle: "Nothing to project yet",
  emptyBookBody: (book: string) =>
    `This device will receive contacts as soon as you add them to ${book}.`,
  fullyPrivateFoot: "Only the name lands. We say so — never imply a broken sync.",
  collisionChip: (winnerBook: string) => `${winnerBook} value won · favour ${winnerBook}`,

  // ── iOS auto-link caveat (Surface 4A) ───────────────────────────────────────
  autolinkTitle: "Two iCloud accounts on one iPhone may merge on the device",
  autolinkBody:
    "iOS can automatically link two contact cards it thinks are the same person — even across separate accounts. If that happens, your Work and Personal slices of a contact can appear combined on that iPhone. Kontax can't prevent this; it's an iOS setting.",

  // ── Row states (Surface 7) ──────────────────────────────────────────────────
  v1OnlySummary: "Import only · lands in All contacts. Set a destination book to project.",
  misconfigured: (bookName: string) =>
    `Its destination book "${bookName}" was deleted. Pick a new book to resume projecting.`,

  // ── V2 · behind projectionRouting (Surface 5) ───────────────────────────────
  v2RoutingInferred:
    "Routing is inferred from which field changed and its book precedence — the CardDAV protocol doesn't tell us which book an edit came from.",
  v2Unattributed:
    "This edit changed a field that lives in more than one of John's books, and the diff couldn't tell which one it belongs to. Rather than guess, Kontax queued it for you to place.",
} as const;
