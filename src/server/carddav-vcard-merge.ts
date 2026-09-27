// P49A-03 (A-03): vCard fidelity for the CardDAV *client* push path.
//
// A CardDAV PUT replaces the whole remote card, and Kontax only models part of
// a vCard. Before this module the pushed body was rebuilt purely from Kontax
// fields, so every property Kontax does not model — iCloud's IMPP,
// X-ABRELATEDNAMES, CATEGORIES, X-SOCIALPROFILE, X-ABShowAs, Nextcloud's
// ANNIVERSARY, a LOGO, … — was deleted on the remote by the first Kontax edit.
//
// The merge rule:
// - Kontax-owned properties (the families Kontax reads from a remote card and
//   writes back from its canonical fields — name, EMAIL/TEL/ADR/URL from the
//   typed entries (P49A-10), ORG, TITLE, BDAY, NOTE, …) come ONLY from the
//   Kontax body. The remote's copies are dropped, never duplicated.
// - Every other remote property is kept verbatim (same parameters, same
//   value), including X- properties and Apple `itemN.` groups.
// - A remote group is owned when any of its non-label properties is owned
//   (e.g. `item1.EMAIL` + `item1.X-ABLABEL`): the whole group is dropped and
//   Kontax's own grouped line (with its label) replaces it. A group with no
//   owned property (e.g. `item3.X-ABRELATEDNAMES` + `item3.X-ABLABEL`) is kept
//   whole, renamed only when its name collides with a group Kontax emitted.
//
// Pure string functions — no I/O — so the fixtures in
// tests/node/carddav-push-fidelity.test.ts pin them exactly.

export type VCardLogicalLine = {
  /** The unfolded line exactly as received (group prefix included). */
  raw: string;
  /** Upper-cased group (`ITEM1`), or null when the property is ungrouped. */
  group: string | null;
  /** The group as written (case preserved), for renaming. */
  rawGroup: string | null;
  /** Upper-cased property name without the group (`X-ABLABEL`). */
  name: string;
};

// Properties that only annotate the other members of their group. They never
// make a group "owned" on their own.
const GROUP_ATTRIBUTE_PROPERTIES = new Set(["X-ABLABEL"]);

// Structural lines Kontax always writes itself.
const STRUCTURAL_PROPERTIES = new Set(["BEGIN", "END"]);

/**
 * Properties Kontax owns on every CardDAV push: it parses them from the remote
 * card into its own fields (carddav.ts parseCardDavContactCard) and serialises
 * them back from those fields (contactsToVCard). An empty Kontax field means
 * "cleared in Kontax", so the remote copy is dropped even when Kontax emits
 * nothing for it. REV / PRODID describe the producer and revision of the card
 * — after a Kontax push that is Kontax, so stale remote values are dropped.
 * X-CYRUS-ONLINESERVICE is Fastmail's custom-labelled website, parsed into the
 * website entries (and written back as such for the Fastmail flavour).
 */
export const CARDDAV_KONTAX_OWNED_PROPERTIES: readonly string[] = [
  "VERSION",
  "UID",
  "REV",
  "PRODID",
  "FN",
  "N",
  "NICKNAME",
  "EMAIL",
  "TEL",
  "ADR",
  "URL",
  "X-CYRUS-ONLINESERVICE",
  "ORG",
  "TITLE",
  "BDAY",
  "NOTE",
];

/**
 * The owned property set for one push.
 * - `significantDates`: the capability profile round-trips anniversaries
 *   (iCloud) — X-ABDATE is then Kontax-owned; otherwise the remote's X-ABDATE
 *   lines are not modelled for this provider and are preserved.
 * - `photo`: the push sets or removes the photo explicitly (photo pass);
 *   otherwise the remote PHOTO is preserved verbatim.
 */
export const cardDavOwnedProperties = ({
  significantDates,
  photo,
}: {
  significantDates: boolean;
  photo: boolean;
}): Set<string> => {
  const owned = new Set(CARDDAV_KONTAX_OWNED_PROPERTIES);
  if (significantDates) owned.add("X-ABDATE");
  if (photo) owned.add("PHOTO");
  return owned;
};

const normaliseLineBreaks = (value: string) => value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

/**
 * Split a vCard into unfolded logical lines (RFC 6350 §3.2). Lines with no
 * property name or no `:` separator are dropped (not valid content lines).
 */
export const splitVCardLogicalLines = (vcard: string): VCardLogicalLine[] =>
  normaliseLineBreaks(vcard)
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .flatMap((raw): VCardLogicalLine[] => {
      if (!raw.trim() || !raw.includes(":")) return [];
      const nameEnd = raw.search(/[;:]/);
      const qualified = raw.slice(0, nameEnd).trim();
      const dot = qualified.indexOf(".");
      const rawGroup = dot > 0 ? qualified.slice(0, dot) : null;
      const name = (dot > 0 ? qualified.slice(dot + 1) : qualified).toUpperCase();
      if (!name) return [];
      return [{ raw, group: rawGroup ? rawGroup.toUpperCase() : null, rawGroup, name }];
    });

const utf8Length = (value: string) => Buffer.byteLength(value, "utf8");

/**
 * Fold a content line at 75 octets with a single-space continuation, never
 * splitting a UTF-8 sequence (a surrogate pair stays together).
 */
export const foldVCardContentLine = (line: string): string => {
  if (utf8Length(line) <= 75) return line;
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;
  for (const char of line) {
    const bytes = utf8Length(char);
    if (currentBytes + bytes > limit) {
      chunks.push(current);
      current = char;
      currentBytes = bytes;
      // Continuation lines start with a space, which counts toward the 75.
      limit = 74;
      continue;
    }
    current += char;
    currentBytes += bytes;
  }
  if (current) chunks.push(current);
  return chunks.join("\r\n ");
};

const serialiseLines = (lines: string[]) => lines.map(foldVCardContentLine).join("\r\n");

const withoutStructural = (lines: VCardLogicalLine[]) =>
  lines.filter((line) => !STRUCTURAL_PROPERTIES.has(line.name));

const renameGroup = (line: VCardLogicalLine, nextGroup: string): string =>
  `${nextGroup}${line.raw.slice(line.rawGroup!.length)}`;

/**
 * The remote properties a push must carry through unchanged, as raw logical
 * lines (group prefixes already renamed away from `takenGroups`).
 */
export const selectPreservedRemoteLines = (
  remoteVCard: string,
  owned: ReadonlySet<string>,
  takenGroups: ReadonlySet<string> = new Set(),
): string[] => {
  const lines = withoutStructural(splitVCardLogicalLines(remoteVCard));

  const ownedGroups = new Set<string>();
  for (const line of lines) {
    if (line.group && !GROUP_ATTRIBUTE_PROPERTIES.has(line.name) && owned.has(line.name)) {
      ownedGroups.add(line.group);
    }
  }

  const kept = lines.filter((line) =>
    line.group ? !ownedGroups.has(line.group) : !owned.has(line.name),
  );

  // Rename kept groups that collide with a group Kontax emitted (Kontax numbers
  // its own `itemN.` groups from 1, as Apple does).
  const used = new Set([...takenGroups].map((group) => group.toUpperCase()));
  for (const line of kept) if (line.group) used.add(line.group);
  const renames = new Map<string, string>();
  let counter = 1;
  const freshGroup = () => {
    while (used.has(`ITEM${counter}`)) counter += 1;
    const group = `item${counter}`;
    used.add(group.toUpperCase());
    return group;
  };
  const takenUpper = new Set([...takenGroups].map((group) => group.toUpperCase()));
  for (const line of kept) {
    if (line.group && takenUpper.has(line.group) && !renames.has(line.group)) {
      renames.set(line.group, freshGroup());
    }
  }

  return kept.map((line) =>
    line.group && renames.has(line.group) ? renameGroup(line, renames.get(line.group)!) : line.raw,
  );
};

/**
 * Merge a Kontax-built card with the remote card it replaces: every line of the
 * Kontax body, then every preserved remote line, then END:VCARD. With no remote
 * card the Kontax body is returned unchanged.
 */
export const mergeRemoteVCardForPush = ({
  kontaxVCard,
  remoteVCard,
  owned,
}: {
  kontaxVCard: string;
  remoteVCard: string | null | undefined;
  owned: ReadonlySet<string>;
}): string => {
  if (!remoteVCard) return kontaxVCard;

  const kontaxLines = splitVCardLogicalLines(kontaxVCard);
  // Anything the Kontax body itself emits is owned too (e.g. SORT-STRING when
  // phonetic names are pushed), so the remote copy can never be duplicated.
  const effectiveOwned = new Set(owned);
  const kontaxGroups = new Set<string>();
  for (const line of kontaxLines) {
    if (!GROUP_ATTRIBUTE_PROPERTIES.has(line.name) && !STRUCTURAL_PROPERTIES.has(line.name)) {
      effectiveOwned.add(line.name);
    }
    if (line.group) kontaxGroups.add(line.group);
  }

  const preserved = selectPreservedRemoteLines(remoteVCard, effectiveOwned, kontaxGroups);
  const body = kontaxLines.filter((line) => line.name !== "END").map((line) => line.raw);
  return serialiseLines([...body, ...preserved, "END:VCARD"]);
};

const isVCard4 = (lines: VCardLogicalLine[]) =>
  lines.some((line) => line.name === "VERSION" && /:\s*4\.0\s*$/.test(line.raw));

/**
 * The photo pass (P44-04) changes only the photo: take the latest known remote
 * card verbatim and swap its PHOTO (null removes it). Fields are never
 * re-projected from Kontax here, so a photo push can't undo a remote edit that
 * was applied, deferred or left in conflict during the same run.
 */
export const replaceVCardPhoto = (vcard: string, photoBase64: string | null): string => {
  const lines = splitVCardLogicalLines(vcard);
  const photoGroups = new Set(
    lines.filter((line) => line.name === "PHOTO" && line.group).map((line) => line.group!),
  );
  const kept = lines.filter(
    (line) =>
      line.name !== "PHOTO" &&
      line.name !== "END" &&
      !(line.group && photoGroups.has(line.group)),
  );
  const photoLine = photoBase64
    ? isVCard4(lines)
      ? `PHOTO:data:image/jpeg;base64,${photoBase64}`
      : `PHOTO;ENCODING=b;TYPE=JPEG:${photoBase64}`
    : null;
  return serialiseLines([
    ...kept.map((line) => line.raw),
    ...(photoLine ? [photoLine] : []),
    "END:VCARD",
  ]);
};

/** The REV of a card as a sortable timestamp (ms), or null when absent/invalid. */
export const readVCardRevision = (vcard: string): number | null => {
  const rev = splitVCardLogicalLines(vcard).find((line) => line.name === "REV");
  if (!rev) return null;
  const value = rev.raw.slice(rev.raw.indexOf(":") + 1).trim();
  const compact = /^(\d{4})-?(\d{2})-?(\d{2})(?:T(\d{2}):?(\d{2}):?(\d{2})(?:[.,]\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(value);
  if (!compact) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const [, y, mo, d, h = "00", mi = "00", s = "00", zone] = compact;
  const offset = !zone || zone.toUpperCase() === "Z" ? "Z" : zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const parsed = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`);
  return Number.isNaN(parsed) ? null : parsed;
};
