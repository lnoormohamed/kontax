// P41-DB01 — projection preview derivation (pure, client + server safe).
//
// The "what will this device see?" explainer (Surface 3) is the load-bearing
// surface of the projection feature: given a connection's projection config, it
// renders the sample contact exactly as it lands on that device — included
// fields solid, omitted fields struck through with the reason. This module is
// the single derivation used by every projection surface so the explainer, the
// row summary, and the precedence example never drift.
//
// Honesty invariant (P41-DB01 §3 / §4B): a private field is NEVER projected, on
// any device. The difference between two devices is which *books* they project
// and how field collisions across books resolve — not privacy flipping per
// device. The source mock draws two "John" slices loosely; we derive them
// correctly and consistently instead (a lying explainer defeats its purpose).

export type Precedence = "work" | "personal";

// A field on the sample contact. `books` lists the book slugs whose membership
// carries this field's value; undefined/empty means the field is intrinsic to
// the person (name, company) and rides along in every book ("always"). Fields
// that share a `collisionKey` are competing values for the same logical field
// across books — precedence picks the winner.
export type SampleField = {
  key: string; // display label, e.g. "Work phone"
  value: string;
  books?: string[]; // book slugs, e.g. ["work"]
  private?: boolean;
  collisionKey?: string; // e.g. "phone" — entries sharing this collide across books
  precedenceGroup?: Precedence; // which precedence side this value belongs to
};

export type SampleContact = {
  name: string;
  role?: string;
  fields: SampleField[];
};

export type ProjectionConfig = {
  // Book slugs this connection projects OUT to the device.
  projectionBookSlugs: string[];
  precedence: Precedence;
};

export type OmitReason = "private" | "not-in-book";
export type IncludeReason = "always" | "favoured" | null;

export type DerivedField = {
  key: string;
  value: string;
  included: boolean;
  // For included fields: "favoured" when this value won a cross-book collision,
  // "always" for intrinsic fields, else null. For omitted fields: the reason
  // string shown struck-through ("private" | "not in Work").
  reason: string | null;
  kind: "always" | "favoured" | "in" | OmitReason;
};

export type DerivedSlice = {
  fields: DerivedField[];
  pushedCount: number;
  heldCount: number;
  privateHeldCount: number;
  outsideBookHeldCount: number;
};

const projects = (config: ProjectionConfig, books?: string[]) =>
  !books || books.length === 0 || books.some((b) => config.projectionBookSlugs.includes(b));

// Human book name from a slug for the "not in {book}" reason. The caller can
// pass a slug→name map; falls back to a capitalised slug.
const bookLabel = (slug: string, names?: Record<string, string>) =>
  names?.[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);

/**
 * Derive the exact slice a device receives from the sample contact under the
 * given projection config. Pure — the explainer calls this on every 2A/2B
 * toggle with no round-trip, so the preview re-derives instantly.
 */
export function deriveSlice(
  contact: SampleContact,
  config: ProjectionConfig,
  bookNames?: Record<string, string>,
): DerivedSlice {
  // Resolve collisions first: among entries sharing a collisionKey where BOTH
  // (all) their books are projected, keep only the precedence winner; the losing
  // sibling is dropped from consideration (it's the same logical field, not a
  // separate omission — never shown as "held back").
  const byCollision = new Map<string, SampleField[]>();
  for (const f of contact.fields) {
    if (!f.collisionKey) continue;
    const list = byCollision.get(f.collisionKey) ?? [];
    list.push(f);
    byCollision.set(f.collisionKey, list);
  }
  const suppressed = new Set<SampleField>();
  const favoured = new Set<SampleField>();
  for (const siblings of byCollision.values()) {
    const projectable = siblings.filter((f) => !f.private && projects(config, f.books));
    if (projectable.length < 2) continue; // no live collision
    const winner =
      projectable.find((f) => f.precedenceGroup === config.precedence) ?? projectable[0]!;
    favoured.add(winner);
    for (const f of projectable) if (f !== winner) suppressed.add(f);
  }

  const fields: DerivedField[] = [];
  let pushed = 0;
  let privateHeld = 0;
  let outsideHeld = 0;

  for (const f of contact.fields) {
    if (suppressed.has(f)) continue; // collision loser — not a separate field

    if (f.private) {
      fields.push({ key: f.key, value: f.value, included: false, reason: "private", kind: "private" });
      privateHeld += 1;
      continue;
    }
    if (!f.books || f.books.length === 0) {
      fields.push({ key: f.key, value: f.value, included: true, reason: "always", kind: "always" });
      pushed += 1;
      continue;
    }
    if (projects(config, f.books)) {
      const isFavoured = favoured.has(f);
      fields.push({
        key: f.key,
        value: f.value,
        included: true,
        reason: isFavoured ? "favoured" : null,
        kind: isFavoured ? "favoured" : "in",
      });
      pushed += 1;
      continue;
    }
    // Present in a book this device does not project.
    const firstBook = f.books[0]!;
    fields.push({
      key: f.key,
      value: f.value,
      included: false,
      reason: `not in ${bookLabel(firstBook, bookNames)}`,
      kind: "not-in-book",
    });
    outsideHeld += 1;
  }

  return {
    fields,
    pushedCount: pushed,
    heldCount: privateHeld + outsideHeld,
    privateHeldCount: privateHeld,
    outsideBookHeldCount: outsideHeld,
  };
}

/**
 * The plain-language footer tally, e.g. "3 fields pushed, 4 held back — 3
 * private, 1 outside the Work book." Never frames a held-back field as broken.
 */
export function describeSliceTally(slice: DerivedSlice, bookName?: string): string {
  const parts: string[] = [];
  if (slice.privateHeldCount > 0) parts.push(`${slice.privateHeldCount} private`);
  if (slice.outsideBookHeldCount > 0)
    parts.push(`${slice.outsideBookHeldCount} outside${bookName ? ` the ${bookName} book` : " the book"}`);
  const held =
    slice.heldCount === 0
      ? "nothing held back"
      : `${slice.heldCount} held back${parts.length ? ` — ${parts.join(", ")}` : ""}`;
  return `${slice.pushedCount} field${slice.pushedCount === 1 ? "" : "s"} pushed, ${held}.`;
}

/**
 * The one-line row projection summary, e.g.
 * "Pushes: Work · favours work fields · never private".
 * `bookNames` are already-resolved display names of the projected books.
 */
export function summarizeProjection(params: {
  bookNames: string[];
  precedence: Precedence | null;
  // true when the connection lands inbound-only with no destination book yet.
  v1Only?: boolean;
  exportOnly?: boolean;
}): string {
  if (params.v1Only) {
    return "Import only · lands in All contacts. Set a destination book to project.";
  }
  const books = params.bookNames.length ? params.bookNames.join(", ") : "—";
  const segments = [`Pushes: ${books}`];
  if (params.precedence && params.bookNames.length > 1) {
    segments.push(`favours ${params.precedence} fields`);
  }
  if (params.exportOnly) segments.push("export only");
  else segments.push("never private");
  return segments.join(" · ");
}

/**
 * Resolve a single logical field across books under a precedence — used by the
 * 2B precedence example line ("John's phone → +1 415 555 0100 (work)").
 * Returns the winning value and the value not chosen, if any.
 */
export function resolveCollision(
  contact: SampleContact,
  collisionKey: string,
  precedence: Precedence,
): { winner: SampleField; loser: SampleField | null } | null {
  const siblings = contact.fields.filter((f) => f.collisionKey === collisionKey && !f.private);
  if (siblings.length === 0) return null;
  const winner = siblings.find((f) => f.precedenceGroup === precedence) ?? siblings[0]!;
  const loser = siblings.find((f) => f !== winner) ?? null;
  return { winner, loser };
}

// ── The source §4.3 two-iCloud "John" worked example ─────────────────────────
// Self-consistent across devices: home address + birthday are private (held on
// every device); the Work/Personal contrast is pure book membership; the phone
// collides across books so precedence has something to resolve.
export const JOHN_SAMPLE: SampleContact = {
  name: "John Appleseed",
  role: "Founder · Appleseed & Co",
  fields: [
    { key: "Company", value: "Appleseed & Co" }, // always
    { key: "Work email", value: "john@appleseed.co", books: ["work"] },
    {
      key: "Work phone",
      value: "+1 415 555 0100",
      books: ["work"],
      collisionKey: "phone",
      precedenceGroup: "work",
    },
    { key: "Personal email", value: "john@me.com", books: ["personal"] },
    {
      key: "Mobile",
      value: "+1 415 555 0781",
      books: ["personal"],
      collisionKey: "phone",
      precedenceGroup: "personal",
    },
    { key: "Home address", value: "2 Infinite Loop", books: ["personal"], private: true },
    { key: "Birthday", value: "April 1", books: ["personal", "work"], private: true },
  ],
};
