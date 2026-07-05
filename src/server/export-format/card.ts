// P45-02: contact → JSContact Card document (RFC 9553 + getkontax.com:* extensions).
// Spec: docs/contact-export-format-spec.md §2–§5. This module is pure — no DB,
// no network; callers supply the resolved photo, label registry, and book names.

import { randomUUID } from "crypto";

import type { Contact } from "../../../generated/prisma";
import {
  ext,
  FORMAT_VERSION,
  JSCONTACT_VERSION,
  PROD_ID,
} from "./constants";

export type KontaxCard = Record<string, unknown>;

export type CardPhoto =
  | { mode: "dataUrl"; bytes: Buffer; mediaType: string; sha256: string; width?: number; height?: number }
  | { mode: "ref"; uri: string; mediaType: string; sha256: string; width?: number; height?: number };

export type CardLabelRegistryEntry = { name: string; color: string; position?: number };

export type ContactToCardOptions = {
  exportedAt: Date;
  photo?: CardPhoto | null;
  /** Registry entries for the labels present on this contact (name + color). */
  labelRegistry?: CardLabelRegistryEntry[];
  /** Book names this contact belongs to (array-shaped for the Phase 40 model). */
  books?: string[];
  /** Override the minted uid (archives mint once per contact for media cross-refs). */
  uid?: string;
};

type SimpleEntry = { label: string; value: string; isPrimary?: boolean };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

/** Effective entry list: entries column, falling back to the scalar (spec §3.4 / P45-01 §1.3). */
const effectiveEntries = (
  entries: unknown,
  scalar: string | null | undefined,
  scalarLabel: string,
): SimpleEntry[] => {
  const parsed = Array.isArray(entries)
    ? entries.flatMap((item): SimpleEntry[] => {
        if (!isRecord(item)) return [];
        const value = str(item.value);
        if (!value) return [];
        return [
          {
            ...item,
            label: typeof item.label === "string" ? item.label : "",
            value,
            isPrimary: item.isPrimary === true,
          } as SimpleEntry,
        ];
      })
    : [];
  if (parsed.length > 0) return parsed;
  const fallback = str(scalar);
  return fallback ? [{ label: scalarLabel, value: fallback, isPrimary: true }] : [];
};

// ── contexts / labels ────────────────────────────────────────────────────────
const WORK_LABELS = new Set(["work", "office", "business", "company"]);
const HOME_LABELS = new Set(["home", "personal", "private"]);

const contextsForLabel = (label: string): Record<string, true> | undefined => {
  const n = label.trim().toLowerCase();
  if (WORK_LABELS.has(n)) return { work: true };
  if (HOME_LABELS.has(n)) return { private: true };
  return undefined;
};

const isWellKnownLabel = (label: string) => {
  const n = label.trim().toLowerCase();
  return n === "" || WORK_LABELS.has(n) || HOME_LABELS.has(n) || n === "other";
};

// ── phonetics (spec §3.2.1) ─────────────────────────────────────────────────
const detectPhoneticScript = (value: string): string | null => {
  if (/\p{Script=Han}/u.test(value)) return "Hani";
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)) return "Kana";
  if (/\p{Script=Hangul}/u.test(value)) return "Hang";
  return null;
};

// ── dates ───────────────────────────────────────────────────────────────────
type PartialDate = { "@type": "PartialDate"; year?: number; month?: number; day?: number };

const parsePartialDate = (raw: string): PartialDate | string | null => {
  const value = raw.trim();
  if (!value) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return { "@type": "PartialDate", year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  m = /^--(\d{2})-?(\d{2})$/.exec(value);
  if (m) return { "@type": "PartialDate", month: Number(m[1]), day: Number(m[2]) };
  m = /^(\d{4})-(\d{2})$/.exec(value);
  if (m) return { "@type": "PartialDate", year: Number(m[1]), month: Number(m[2]) };
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value; // full timestamp
  return null;
};

const dateKindForLabel = (label: string): string => {
  const n = label.trim().toLowerCase();
  if (n === "birthday" || n === "birth" || n === "born") return "birth";
  if (n === "anniversary" || n === "wedding" || n === "wedding anniversary") return "wedding";
  const slug = n.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "date";
  return ext(slug);
};

// ── phone features ──────────────────────────────────────────────────────────
const PHONE_FEATURES: Record<string, string> = {
  mobile: "mobile",
  cell: "mobile",
  fixedline: "voice",
  landline: "voice",
  voice: "voice",
  fax: "fax",
  pager: "pager",
};

// ── main builder ────────────────────────────────────────────────────────────
export type ExportableContact = Pick<
  Contact,
  | "fullName" | "firstName" | "middleName" | "lastName"
  | "phoneticFirstName" | "phoneticLastName"
  | "namePrefix" | "nameSuffix" | "nickname"
  | "email" | "phone" | "website" | "address" | "birthday"
  | "company" | "phoneticCompany" | "jobTitle" | "department"
  | "emailEntries" | "phoneEntries" | "websiteEntries" | "addressEntries"
  | "significantDates" | "relatedPeople" | "customFields"
  | "labels" | "notes" | "isFavorite" | "isEmergency"
  | "sourceType" | "sourceDetail" | "createdAt" | "updatedAt"
>;

export const contactToCard = (
  contact: ExportableContact,
  options: ContactToCardOptions,
): KontaxCard => {
  const card: KontaxCard = {
    "@type": "Card",
    version: JSCONTACT_VERSION,
    uid: options.uid ?? randomUUID(),
    created: contact.createdAt.toISOString(),
    updated: contact.updatedAt.toISOString(),
    prodId: PROD_ID,
    [ext("formatVersion")]: FORMAT_VERSION,
    [ext("exportedAt")]: options.exportedAt.toISOString(),
  };

  // ── name & identity (spec §3.2) ──
  const components: Array<Record<string, unknown>> = [];
  const pushComponent = (kind: string, value: string | null, phonetic?: string | null) => {
    if (!value) return;
    const component: Record<string, unknown> = { kind, value };
    if (phonetic) {
      const script = detectPhoneticScript(phonetic);
      if (script) component.phonetic = phonetic;
      else component[ext("phoneticRaw")] = phonetic;
    }
    components.push(component);
  };
  pushComponent("title", str(contact.namePrefix));
  pushComponent("given", str(contact.firstName), str(contact.phoneticFirstName));
  pushComponent("given2", str(contact.middleName));
  pushComponent("surname", str(contact.lastName), str(contact.phoneticLastName));
  pushComponent("credential", str(contact.nameSuffix));

  const name: Record<string, unknown> = {};
  if (str(contact.fullName)) name.full = contact.fullName.trim();
  if (components.length > 0) name.components = components;
  const phoneticScripts = [contact.phoneticFirstName, contact.phoneticLastName]
    .map((v) => (str(v) ? detectPhoneticScript(v!.trim()) : null))
    .filter(Boolean);
  if (phoneticScripts.length > 0) name.phoneticScript = phoneticScripts[0];
  if (Object.keys(name).length > 0) card.name = name;

  if (str(contact.nickname)) {
    card.nicknames = { k1: { name: contact.nickname!.trim() } };
  }

  // ── organization (spec §3.3) ──
  if (str(contact.company) || str(contact.department) || str(contact.phoneticCompany)) {
    const org: Record<string, unknown> = {};
    if (str(contact.company)) org.name = contact.company!.trim();
    if (str(contact.department)) org.units = [contact.department!.trim()];
    if (str(contact.phoneticCompany)) org[ext("phoneticCompany")] = contact.phoneticCompany!.trim();
    card.organizations = { o1: org };
  }
  if (str(contact.jobTitle)) {
    const title: Record<string, unknown> = { name: contact.jobTitle!.trim() };
    if (card.organizations) title.organizationId = "o1";
    card.titles = { t1: title };
  }

  // ── emails ──
  const emails = effectiveEntries(contact.emailEntries, contact.email, "");
  if (emails.length > 0) {
    card.emails = Object.fromEntries(
      emails.map((entry, i) => {
        const email: Record<string, unknown> = { address: entry.value };
        const contexts = contextsForLabel(entry.label);
        if (contexts) email.contexts = contexts;
        else if (str(entry.label) && !isWellKnownLabel(entry.label)) email.label = entry.label.trim();
        if (entry.isPrimary) email.pref = 1;
        return [`e${i + 1}`, email];
      }),
    );
  }

  // ── phones (F5: free-text number + vendor e164) ──
  const phones = effectiveEntries(contact.phoneEntries, contact.phone, "");
  if (phones.length > 0) {
    card.phones = Object.fromEntries(
      phones.map((raw, i) => {
        const entry = raw as SimpleEntry & {
          e164?: unknown; countryCode?: unknown; extension?: unknown; numberType?: unknown;
        };
        const extension = str(entry.extension);
        const phone: Record<string, unknown> = {
          number: extension ? `${entry.value};ext=${extension}` : entry.value,
        };
        const contexts = contextsForLabel(entry.label);
        if (contexts) phone.contexts = contexts;
        const feature = typeof entry.numberType === "string" ? PHONE_FEATURES[entry.numberType] : undefined;
        if (feature) phone.features = { [feature]: true };
        if (str(entry.label) && !isWellKnownLabel(entry.label) && !(typeof entry.label === "string" && PHONE_FEATURES[entry.label.trim().toLowerCase()])) {
          phone.label = entry.label.trim();
        }
        if (entry.isPrimary) phone.pref = 1;
        if (str(entry.e164)) phone[ext("e164")] = (entry.e164 as string).trim();
        if (str(entry.countryCode)) phone[ext("countryCode")] = (entry.countryCode as string).trim();
        return [`p${i + 1}`, phone];
      }),
    );
  }

  // ── websites → links ──
  const websites = effectiveEntries(contact.websiteEntries, contact.website, "");
  if (websites.length > 0) {
    card.links = Object.fromEntries(
      websites.map((entry, i) => {
        const link: Record<string, unknown> = { uri: entry.value };
        if (str(entry.label)) link.label = entry.label.trim();
        if (entry.isPrimary) link.pref = 1;
        return [`w${i + 1}`, link];
      }),
    );
  }

  // ── addresses (F3: custom label rides a vendor property) ──
  const addressRows = Array.isArray(contact.addressEntries)
    ? (contact.addressEntries as unknown[]).filter(isRecord)
    : [];
  const addresses = addressRows
    .map((row, i) => {
      const comps: Array<{ kind: string; value: string }> = [];
      const push = (kind: string, ...candidates: unknown[]) => {
        for (const c of candidates) {
          const v = str(c);
          if (v) {
            comps.push({ kind, value: v });
            return;
          }
        }
      };
      push("name", row.street, row.streetLine1);
      push("locality", row.city, row.cityOrTown);
      push("region", row.state, row.stateOrProvince);
      push("postcode", row.postcode);
      push("country", row.country, row.countryOrRegion);
      if (comps.length === 0) {
        const formatted = str(row.formatted);
        if (formatted) comps.push({ kind: "name", value: formatted });
      }
      if (comps.length === 0) return null;
      const address: Record<string, unknown> = { components: comps };
      const label = typeof row.label === "string" ? row.label : "";
      const contexts = contextsForLabel(label);
      if (contexts) address.contexts = contexts;
      else if (str(label) && !isWellKnownLabel(label)) address[ext("label")] = label.trim();
      if (row.isPrimary === true || (i === 0 && addressRows.length === 1)) address.pref = 1;
      return address;
    })
    .filter((v): v is Record<string, unknown> => v !== null);
  if (addresses.length === 0 && str(contact.address)) {
    addresses.push({
      components: [{ kind: "name", value: contact.address!.trim() }],
      pref: 1,
    });
  }
  if (addresses.length > 0) {
    card.addresses = Object.fromEntries(addresses.map((a, i) => [`a${i + 1}`, a]));
  }

  // ── significant dates → anniversaries ──
  const dateRows = Array.isArray(contact.significantDates)
    ? (contact.significantDates as unknown[]).filter(isRecord)
    : [];
  const anniversaries: Array<Record<string, unknown>> = [];
  const unparsedDates: Array<{ label: string; value: string }> = [];
  const seenBirthday = { value: false };
  for (const row of dateRows) {
    const label = typeof row.label === "string" ? row.label : "";
    const rawValue = str(row.value) ?? str(row.date);
    if (!rawValue) continue;
    const date = parsePartialDate(rawValue);
    if (!date) {
      unparsedDates.push({ label, value: rawValue });
      continue;
    }
    const kind = dateKindForLabel(label);
    if (kind === "birth") seenBirthday.value = true;
    const anniversary: Record<string, unknown> = { kind, date };
    if (kind.startsWith(`${ext("")}`) || kind.includes(":")) anniversary[ext("label")] = label.trim();
    if (row.isPrimary === true) anniversary[ext("isPrimary")] = true;
    anniversaries.push(anniversary);
  }
  if (!seenBirthday.value && str(contact.birthday)) {
    const date = parsePartialDate(contact.birthday!);
    if (date) anniversaries.unshift({ kind: "birth", date });
    else unparsedDates.push({ label: "Birthday", value: contact.birthday!.trim() });
  }
  if (anniversaries.length > 0) {
    card.anniversaries = Object.fromEntries(anniversaries.map((a, i) => [`d${i + 1}`, a]));
  }
  if (unparsedDates.length > 0) {
    // Lossless escape hatch for date strings PartialDate can't carry.
    card[ext("unparsedDates")] = unparsedDates;
  }

  // ── related people (F4: standalone vendor property) ──
  const related = Array.isArray(contact.relatedPeople)
    ? (contact.relatedPeople as unknown[]).flatMap((row) => {
        if (!isRecord(row)) return [];
        const value = str(row.value);
        if (!value) return [];
        return [{ label: typeof row.label === "string" ? row.label.trim() : "", value }];
      })
    : [];
  if (related.length > 0) {
    card[ext("relatedPeople")] = Object.fromEntries(
      related.map((r, i) => [`r${i + 1}`, r]),
    );
  }

  // ── labels & registry ──
  const labelNames = Array.isArray(contact.labels)
    ? (contact.labels as unknown[]).filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  if (labelNames.length > 0) {
    card.keywords = Object.fromEntries(labelNames.map((n) => [n, true]));
  }
  const registry = (options.labelRegistry ?? []).filter((l) => labelNames.includes(l.name));
  if (registry.length > 0) {
    card[ext("labels")] = Object.fromEntries(
      registry.map((l, i) => [
        `l${i + 1}`,
        {
          name: l.name,
          color: l.color,
          ...(typeof l.position === "number" ? { position: l.position } : {}),
        },
      ]),
    );
  }

  // ── books ──
  if (options.books && options.books.length > 0) {
    card[ext("books")] = options.books;
  }

  // ── custom fields (spec §5: ordered array, strings in v1) ──
  const customFields = Array.isArray(contact.customFields)
    ? (contact.customFields as unknown[]).flatMap((row) => {
        if (!isRecord(row)) return [];
        const label = str(row.label);
        const value = typeof row.value === "string" ? row.value : null;
        return label && value !== null ? [{ label, value }] : [];
      })
    : [];
  if (customFields.length > 0) {
    card[ext("customFields")] = customFields;
  }

  // ── notes, flags ──
  if (str(contact.notes)) card.notes = contact.notes!.trim();
  if (contact.isFavorite) card[ext("favorite")] = true;
  if (contact.isEmergency) card[ext("emergency")] = true;

  // ── photo (F1: data: URI in bare documents, relative ref in archives) ──
  if (options.photo) {
    const media: Record<string, unknown> = {
      kind: "photo",
      mediaType: options.photo.mediaType,
      [ext("sha256")]: options.photo.sha256,
    };
    if (options.photo.mode === "dataUrl") {
      media.uri = `data:${options.photo.mediaType};base64,${options.photo.bytes.toString("base64")}`;
    } else {
      media.uri = options.photo.uri;
    }
    if (options.photo.width) media[ext("width")] = options.photo.width;
    if (options.photo.height) media[ext("height")] = options.photo.height;
    card.media = { m1: media };
  }

  // ── provenance ──
  card[ext("source")] = {
    origin: contact.sourceType,
    ...(str(contact.sourceDetail) ? { originDetail: contact.sourceDetail!.trim() } : {}),
  };

  return card;
};
