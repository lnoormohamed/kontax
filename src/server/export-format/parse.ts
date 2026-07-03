// P45: import-side recognition + parsing of the open export format.
// Recognition is content-based (spec §7.4): a bare document is a Card with the
// getkontax.com:formatVersion property; an archive is a zip whose manifest.json
// carries the same key. Never the file extension — a renamed .zip still lands.

import AdmZip from "adm-zip";

import {
  ARCHIVE_CONTACTS_DIR,
  ARCHIVE_MANIFEST_NAME,
  ext,
  FORMAT_VERSION_KEY,
  MAX_SUPPORTED_MAJOR,
  parseFormatMajor,
} from "./constants";
import type { KontaxCard } from "./card";

// ── recognition ─────────────────────────────────────────────────────────────

export type KontaxRecognition =
  | {
      kind: "archive";
      formatVersion: string;
      contactCount: number;
      photoCount: number;
    }
  | {
      kind: "document";
      formatVersion: string;
      customFieldCount: number;
      hasPhoto: boolean;
      displayName: string | null;
    }
  | { kind: "unsupported-version"; formatVersion: string; major: number; container: "archive" | "document" }
  | { kind: "unrecognized" };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isZip = (buffer: Buffer) =>
  buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b;

const recognizeDocumentValue = (value: unknown): KontaxRecognition => {
  if (!isRecord(value)) return { kind: "unrecognized" };
  const formatVersion = value[FORMAT_VERSION_KEY];
  if (value["@type"] !== "Card" || typeof formatVersion !== "string") {
    return { kind: "unrecognized" };
  }
  const major = parseFormatMajor(formatVersion);
  if (major === null) return { kind: "unrecognized" };
  if (major > MAX_SUPPORTED_MAJOR) {
    return { kind: "unsupported-version", formatVersion, major, container: "document" };
  }
  const customFields = value[ext("customFields")];
  const name = isRecord(value.name) ? value.name : null;
  return {
    kind: "document",
    formatVersion,
    customFieldCount: Array.isArray(customFields) ? customFields.length : 0,
    hasPhoto: isRecord(value.media) && Object.keys(value.media).length > 0,
    displayName: name && typeof name.full === "string" ? name.full : null,
  };
};

export function recognizeKontaxFile(buffer: Buffer): KontaxRecognition {
  if (isZip(buffer)) {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return { kind: "unrecognized" };
    }
    const manifestEntry = zip.getEntry(ARCHIVE_MANIFEST_NAME);
    if (!manifestEntry) return { kind: "unrecognized" };
    const manifest = tryParseJson(manifestEntry.getData().toString("utf8"));
    if (!isRecord(manifest)) return { kind: "unrecognized" };
    const formatVersion = manifest[FORMAT_VERSION_KEY];
    if (typeof formatVersion !== "string") return { kind: "unrecognized" };
    const major = parseFormatMajor(formatVersion);
    if (major === null) return { kind: "unrecognized" };
    if (major > MAX_SUPPORTED_MAJOR) {
      return { kind: "unsupported-version", formatVersion, major, container: "archive" };
    }
    const counts = isRecord(manifest.counts) ? manifest.counts : {};
    const entryContactCount = zip
      .getEntries()
      .filter((e) => e.entryName.startsWith(ARCHIVE_CONTACTS_DIR) && e.entryName.endsWith(".json")).length;
    return {
      kind: "archive",
      formatVersion,
      contactCount:
        typeof counts.contacts === "number" ? counts.contacts : entryContactCount,
      photoCount: typeof counts.photos === "number" ? counts.photos : 0,
    };
  }

  const text = buffer.toString("utf8");
  return recognizeDocumentValue(tryParseJson(text));
}

// ── card → importable contact ───────────────────────────────────────────────

export type ImportedCardContact = {
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  phoneticFirstName: string | null;
  phoneticLastName: string | null;
  namePrefix: string | null;
  nameSuffix: string | null;
  nickname: string | null;
  company: string | null;
  phoneticCompany: string | null;
  department: string | null;
  jobTitle: string | null;
  emailEntries: Array<{ label: string; value: string; isPrimary?: boolean }>;
  phoneEntries: Array<{ label: string; value: string; isPrimary?: boolean; e164?: string; countryCode?: string }>;
  websiteEntries: Array<{ label: string; value: string; isPrimary?: boolean }>;
  addressEntries: Array<{
    label: string; formatted: string; street: string; city: string; state: string;
    postcode: string; country: string;
  }>;
  significantDates: Array<{ label: string; value: string; isPrimary?: boolean }>;
  relatedPeople: Array<{ label: string; value: string }>;
  customFields: Array<{ label: string; value: string }>;
  labels: string[];
  labelRegistry: Array<{ name: string; color: string; position?: number }>;
  books: string[];
  notes: string | null;
  isFavorite: boolean;
  isEmergency: boolean;
  birthday: string | null;
  /** Photo bytes: inline data: URI (bare document) or resolved from media/ (archive). */
  photo: { bytes: Buffer; mediaType: string } | null;
};

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const mapValues = (value: unknown): Array<Record<string, unknown>> =>
  isRecord(value) ? Object.values(value).filter(isRecord) : [];

const labelFromContexts = (obj: Record<string, unknown>): string => {
  const explicit = asString(obj.label) ?? asString(obj[ext("label")]);
  if (explicit) return explicit;
  const contexts = isRecord(obj.contexts) ? obj.contexts : {};
  if (contexts.work === true) return "Work";
  if (contexts.private === true) return "Home";
  return "";
};

const partialDateToString = (date: unknown): string | null => {
  if (typeof date === "string") return date.slice(0, 10);
  if (!isRecord(date)) return null;
  const pad = (n: unknown) => String(n).padStart(2, "0");
  const { year, month, day } = date;
  if (typeof month !== "number" || typeof day !== "number") {
    if (typeof year === "number" && typeof month === "number") return `${year}-${pad(month)}`;
    return null;
  }
  return typeof year === "number" ? `${year}-${pad(month)}-${pad(day)}` : `--${pad(month)}-${pad(day)}`;
};

const dateLabelForKind = (kind: unknown, vendorLabel: string | null): string => {
  if (vendorLabel) return vendorLabel;
  if (kind === "birth") return "Birthday";
  if (kind === "wedding") return "Anniversary";
  if (typeof kind === "string" && kind.includes(":")) {
    const slug = kind.split(":").pop() ?? "Date";
    return slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
  return "Date";
};

const parseDataUrl = (uri: string): { bytes: Buffer; mediaType: string } | null => {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(uri);
  if (!match) return null;
  try {
    return { bytes: Buffer.from(match[2]!, "base64"), mediaType: match[1]! };
  } catch {
    return null;
  }
};

export function cardToImportedContact(
  card: KontaxCard,
  resolveMediaRef?: (uri: string) => { bytes: Buffer; mediaType: string } | null,
): ImportedCardContact | null {
  if (!isRecord(card) || card["@type"] !== "Card") return null;

  // name
  const name = isRecord(card.name) ? card.name : {};
  const components = Array.isArray(name.components)
    ? (name.components as unknown[]).filter(isRecord)
    : [];
  const componentValue = (kind: string) =>
    asString(components.find((c) => c.kind === kind)?.value);
  const componentPhonetic = (kind: string) => {
    const c = components.find((c) => c.kind === kind);
    if (!c) return null;
    return asString(c.phonetic) ?? asString(c[ext("phoneticRaw")]);
  };

  const firstName = componentValue("given");
  const lastName = componentValue("surname");
  const nicknames = mapValues(card.nicknames);
  const organizations = mapValues(card.organizations);
  const titles = mapValues(card.titles);
  const org = organizations[0] ?? null;

  const emails = mapValues(card.emails).flatMap((e) => {
    const value = asString(e.address);
    return value
      ? [{ label: labelFromContexts(e), value, isPrimary: e.pref === 1 }]
      : [];
  });

  const phones = mapValues(card.phones).flatMap((p) => {
    const raw = asString(p.number);
    if (!raw) return [];
    const features = isRecord(p.features) ? p.features : {};
    const featureLabel = features.mobile === true ? "Mobile" : features.fax === true ? "Fax" : "";
    const entry: ImportedCardContact["phoneEntries"][number] = {
      label: labelFromContexts(p) || featureLabel,
      value: raw.replace(/;ext=\d+$/, (m) => ` ext. ${m.slice(5)}`),
      isPrimary: p.pref === 1,
    };
    const e164 = asString(p[ext("e164")]);
    if (e164) entry.e164 = e164;
    const countryCode = asString(p[ext("countryCode")]);
    if (countryCode) entry.countryCode = countryCode;
    return [entry];
  });

  const websites = mapValues(card.links).flatMap((l) => {
    const value = asString(l.uri);
    return value
      ? [{ label: asString(l.label) ?? "", value, isPrimary: l.pref === 1 }]
      : [];
  });

  const addresses = mapValues(card.addresses).flatMap((a) => {
    const comps = Array.isArray(a.components)
      ? (a.components as unknown[]).filter(isRecord)
      : [];
    const byKind = (kind: string) =>
      asString(comps.find((c) => c.kind === kind)?.value) ?? "";
    const address = {
      label: labelFromContexts(a),
      street: byKind("name") || byKind("number"),
      city: byKind("locality"),
      state: byKind("region"),
      postcode: byKind("postcode"),
      country: byKind("country"),
    };
    const formatted = [
      address.street,
      [address.city, address.state].filter(Boolean).join(", "),
      address.postcode,
      address.country,
    ]
      .filter(Boolean)
      .join(", ");
    return formatted ? [{ ...address, formatted }] : [];
  });

  const significantDates = mapValues(card.anniversaries).flatMap((a) => {
    const value = partialDateToString(a.date);
    if (!value) return [];
    const label = dateLabelForKind(a.kind, asString(a[ext("label")]));
    return [{ label, value, isPrimary: a[ext("isPrimary")] === true }];
  });
  const unparsedDates = Array.isArray(card[ext("unparsedDates")])
    ? (card[ext("unparsedDates")] as unknown[]).flatMap((row) => {
        if (!isRecord(row)) return [];
        const value = asString(row.value);
        return value ? [{ label: asString(row.label) ?? "Date", value }] : [];
      })
    : [];

  const relatedPeople = mapValues(card[ext("relatedPeople")]).flatMap((r) => {
    const value = asString(r.value);
    return value ? [{ label: asString(r.label) ?? "", value }] : [];
  });

  const labels = isRecord(card.keywords)
    ? Object.entries(card.keywords)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    : [];
  const labelRegistry = mapValues(card[ext("labels")]).flatMap((l) => {
    const name = asString(l.name);
    const color = asString(l.color);
    return name && color
      ? [{ name, color, ...(typeof l.position === "number" ? { position: l.position } : {}) }]
      : [];
  });

  const books = Array.isArray(card[ext("books")])
    ? (card[ext("books")] as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  const customFields = Array.isArray(card[ext("customFields")])
    ? (card[ext("customFields")] as unknown[]).flatMap((row) => {
        if (!isRecord(row)) return [];
        const label = asString(row.label);
        const value = typeof row.value === "string" ? row.value : null;
        return label && value !== null ? [{ label, value }] : [];
      })
    : [];

  // photo
  let photo: ImportedCardContact["photo"] = null;
  const mediaEntries = mapValues(card.media).filter((m) => m.kind === "photo");
  const mediaEntry = mediaEntries[0];
  if (mediaEntry) {
    const uri = asString(mediaEntry.uri);
    if (uri) {
      photo = uri.startsWith("data:")
        ? parseDataUrl(uri)
        : (resolveMediaRef?.(uri) ?? null);
      if (photo && !photo.mediaType) {
        photo.mediaType = asString(mediaEntry.mediaType) ?? "image/jpeg";
      }
    }
  }

  const birthdayEntry = significantDates.find((d) => d.label === "Birthday");

  const fullName =
    asString(name.full) ??
    [firstName, lastName].filter(Boolean).join(" ").trim() ??
    null;
  const resolvedFullName =
    fullName && fullName.length > 0
      ? fullName
      : (emails[0]?.value ?? phones[0]?.value ?? asString(org?.name));
  if (!resolvedFullName) return null;

  return {
    fullName: resolvedFullName,
    firstName,
    middleName: componentValue("given2"),
    lastName,
    phoneticFirstName: componentPhonetic("given"),
    phoneticLastName: componentPhonetic("surname"),
    namePrefix: componentValue("title"),
    nameSuffix: componentValue("credential"),
    nickname: asString(nicknames[0]?.name),
    company: asString(org?.name),
    phoneticCompany: asString(org?.[ext("phoneticCompany")]),
    department: Array.isArray(org?.units) ? (asString((org.units as unknown[])[0]) ?? null) : null,
    jobTitle: asString(titles[0]?.name),
    emailEntries: emails,
    phoneEntries: phones,
    websiteEntries: websites,
    addressEntries: addresses,
    significantDates: [...significantDates, ...unparsedDates],
    relatedPeople,
    customFields,
    labels,
    labelRegistry,
    books,
    notes: asString(card.notes),
    isFavorite: card[ext("favorite")] === true,
    isEmergency: card[ext("emergency")] === true,
    birthday: birthdayEntry?.value ?? null,
    photo,
  };
}

// ── archive extraction ──────────────────────────────────────────────────────

export type ParsedKontaxArchive = {
  contacts: ImportedCardContact[];
  skippedCount: number;
};

export function parseKontaxArchive(buffer: Buffer): ParsedKontaxArchive {
  const zip = new AdmZip(buffer);
  const resolveMediaRef = (uri: string) => {
    const entry = zip.getEntry(uri.replace(/^\.\//, ""));
    if (!entry) return null;
    const bytes = entry.getData();
    const extMatch = /\.([a-z0-9]+)$/i.exec(uri)?.[1]?.toLowerCase();
    const mediaType =
      extMatch === "png" ? "image/png"
      : extMatch === "webp" ? "image/webp"
      : extMatch === "gif" ? "image/gif"
      : "image/jpeg";
    return { bytes, mediaType };
  };

  const contactEntries = zip
    .getEntries()
    .filter((e) => e.entryName.startsWith(ARCHIVE_CONTACTS_DIR) && e.entryName.endsWith(".json"))
    .sort((a, b) => a.entryName.localeCompare(b.entryName));

  const contacts: ImportedCardContact[] = [];
  let skippedCount = 0;
  for (const entry of contactEntries) {
    const card = tryParseJson(entry.getData().toString("utf8"));
    const contact = isRecord(card) ? cardToImportedContact(card, resolveMediaRef) : null;
    if (contact) contacts.push(contact);
    else skippedCount += 1;
  }
  return { contacts, skippedCount };
}

export function parseKontaxDocument(buffer: Buffer): ImportedCardContact | null {
  const card = tryParseJson(buffer.toString("utf8"));
  return isRecord(card) ? cardToImportedContact(card) : null;
}
