// P45-02 open contact export format — shared constants.
// Spec: docs/contact-export-format-spec.md (authoritative), JSON Schema in
// docs/schemas/kontax-contact.v1.schema.json. Vendor prefix per spec §2.

export const VENDOR_PREFIX = "getkontax.com";

export const ext = (name: string) => `${VENDOR_PREFIX}:${name}` as const;

// The Kontax extension-set version (spec §4) — NOT JSContact's `version`.
export const FORMAT_VERSION = "1.0";
export const FORMAT_VERSION_KEY = ext("formatVersion");
export const MAX_SUPPORTED_MAJOR = 1;

export const JSCONTACT_VERSION = "1.0";
export const PROD_ID = "kontax/1.0";

export const ARCHIVE_MANIFEST_NAME = "manifest.json";
export const ARCHIVE_CONTACTS_DIR = "contacts/";
export const ARCHIVE_MEDIA_DIR = "media/";
export const ARCHIVE_VCARDS_NAME = "vcards/contacts.vcf";

// Archive container hardening (P45-03, spec §7).
export const ARCHIVE_MANIFEST_TYPE = ext("Archive"); // "getkontax.com:Archive"
export const ARCHIVE_INTEGRITY_ALGORITHM = "sha256" as const;

// Ordinal `contacts/NNNN.json` filenames are zero-padded to at least this many
// digits, widening automatically for larger books, so lexical entry-name order
// always equals numeric order (spec §7.1). Never narrower than 4 for legibility.
export const ARCHIVE_CONTACT_ORDINAL_MIN_WIDTH = 4;

/** Zero-padded ordinal for `contacts/NNNN.json`, width chosen for the count. */
export const contactOrdinal = (index: number, total: number): string => {
  const width = Math.max(ARCHIVE_CONTACT_ORDINAL_MIN_WIDTH, String(total).length);
  return String(index + 1).padStart(width, "0");
};

export const parseFormatMajor = (formatVersion: unknown): number | null => {
  if (typeof formatVersion !== "string") return null;
  const match = /^(\d+)\.\d+$/.exec(formatVersion.trim());
  if (!match) return null;
  return Number(match[1]);
};
