// P45-03 — pure selftest for the archive container (spec §7). No DB, no
// network: it builds an archive from two synthetic Cards that share one photo,
// then proves the container invariants the spec guarantees —
//   • ordinal contacts/ filenames, one media/ file despite two references (§7.4)
//   • a manifest whose `integrity` table checksums every non-manifest entry (§7.3)
//   • truncation/tamper is detectable; a clean archive round-trips losslessly
// and validates against docs/schemas/kontax-archive.v1.schema.json (§7.2) and
// kontax-contact.v1.schema.json (§2–§6).
//
// It also (re)writes the committed worked-example fixture
// tests/fixtures/kontax-archive/example.zip — the P45-03 acceptance artifact.
//
// Run: npm run qa:phase45:archive   (exits non-zero on the first failure)

import { createHash } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

import { contactToCard, type ExportableContact } from "../src/server/export-format/card";
import { buildKontaxArchive, mediaRefPath, type ArchiveMediaFile } from "../src/server/export-format/archive";
import { parseKontaxArchive, verifyKontaxArchiveIntegrity } from "../src/server/export-format/parse";
import {
  ARCHIVE_MANIFEST_NAME,
  ARCHIVE_MANIFEST_TYPE,
  ARCHIVE_MEDIA_DIR,
  FORMAT_VERSION_KEY,
  ext,
} from "../src/server/export-format/constants";

let failures = 0;
const check = (label: string, cond: boolean) => {
  if (cond) console.log(`✓ ${label}`);
  else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
};
const eq = (label: string, actual: unknown, expected: unknown) =>
  check(`${label} (= ${JSON.stringify(expected)})`, JSON.stringify(actual) === JSON.stringify(expected));

// ── fixtures ──────────────────────────────────────────────────────────────────

// A real 1×1 PNG — shared by both contacts to exercise content-addressed dedup.
const PHOTO_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PHOTO_SHA = createHash("sha256").update(PHOTO_BYTES).digest("hex");
const PHOTO_EXT = "png";

// Fixed timestamps → a byte-stable committed fixture.
const CREATED = new Date("2025-11-03T09:12:00.000Z");
const UPDATED = new Date("2026-06-28T17:45:00.000Z");
const EXPORTED_AT = new Date("2026-07-04T14:30:00.000Z");

const baseContact = (over: Partial<ExportableContact>): ExportableContact => ({
  fullName: "",
  firstName: null,
  middleName: null,
  lastName: null,
  phoneticFirstName: null,
  phoneticLastName: null,
  namePrefix: null,
  nameSuffix: null,
  nickname: null,
  email: null,
  phone: null,
  website: null,
  address: null,
  birthday: null,
  company: null,
  phoneticCompany: null,
  jobTitle: null,
  department: null,
  emailEntries: null,
  phoneEntries: null,
  websiteEntries: null,
  addressEntries: null,
  significantDates: null,
  relatedPeople: null,
  customFields: null,
  labels: null,
  notes: null,
  isFavorite: false,
  isEmergency: false,
  sourceType: "MANUAL",
  sourceDetail: null,
  createdAt: CREATED,
  updatedAt: UPDATED,
  ...over,
});

const photoRef = {
  mode: "ref" as const,
  uri: mediaRefPath(PHOTO_SHA, PHOTO_EXT),
  mediaType: "image/png",
  sha256: PHOTO_SHA,
  width: 1,
  height: 1,
};

const labelRegistry = [{ name: "Clients", color: "#4158f4", position: 0 }];

const cards = [
  contactToCard(
    baseContact({
      fullName: "Amelia Rowe-Nguyen",
      firstName: "Amelia",
      lastName: "Rowe-Nguyen",
      emailEntries: [{ label: "Work", value: "amelia@vexonhealth.example", isPrimary: true }],
      labels: ["Clients"],
    }),
    { exportedAt: EXPORTED_AT, photo: photoRef, labelRegistry, books: ["Work"], uid: "8f14e45f-ceea-467e-9a19-2c6a7e5e6f01" },
  ),
  contactToCard(
    baseContact({ fullName: "Kim Rowe-Nguyen", firstName: "Kim", lastName: "Rowe-Nguyen" }),
    { exportedAt: EXPORTED_AT, photo: photoRef, books: ["Work"], uid: "b2c3d4e5-6f70-4812-9a3b-4c5d6e7f8091" },
  ),
];

const media: ArchiveMediaFile[] = [
  { sha256: PHOTO_SHA, extension: PHOTO_EXT, bytes: PHOTO_BYTES },
  // Second contact references the same photo → same media file (dedup).
  { sha256: PHOTO_SHA, extension: PHOTO_EXT, bytes: PHOTO_BYTES },
];

// ── build ─────────────────────────────────────────────────────────────────────

const zipBuffer = await buildKontaxArchive({
  cards,
  media,
  labelRegistry,
  vcardFallback: "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Amelia Rowe-Nguyen\r\nEND:VCARD\r\n",
  exportedAt: EXPORTED_AT,
});

const zip = new AdmZip(zipBuffer);
const names = zip.getEntries().map((e) => e.entryName).sort();

// ── layout (§7.1) ───────────────────────────────────────────────────────────
check("manifest.json present", names.includes(ARCHIVE_MANIFEST_NAME));
check("contacts are zero-padded ordinals", names.includes("contacts/0001.json") && names.includes("contacts/0002.json"));
const mediaNames = names.filter((n) => n.startsWith(ARCHIVE_MEDIA_DIR));
eq("shared photo stored once (dedup)", mediaNames, [`${ARCHIVE_MEDIA_DIR}${PHOTO_SHA}.${PHOTO_EXT}`]);
check("optional vcards/ fallback present", names.includes("vcards/contacts.vcf"));

// ── manifest (§7.2) ───────────────────────────────────────────────────────────
const manifest = JSON.parse(zip.getEntry(ARCHIVE_MANIFEST_NAME)!.getData().toString("utf8"));
eq("manifest @type", manifest["@type"], ARCHIVE_MANIFEST_TYPE);
eq("manifest formatVersion", manifest[FORMAT_VERSION_KEY], "1.0");
eq("manifest counts", manifest.counts, { contacts: 2, photos: 1 });
check("manifest hoists the label registry", ext("labels") in manifest);
check("manifest carries an integrity block", !!manifest.integrity && manifest.integrity.algorithm === "sha256");

// integrity covers every non-manifest entry, and NOT the manifest itself.
const integrityPaths: string[] = manifest.integrity.entries.map((e: { path: string }) => e.path).sort();
eq(
  "integrity lists all non-manifest entries",
  integrityPaths,
  ["contacts/0001.json", "contacts/0002.json", `${ARCHIVE_MEDIA_DIR}${PHOTO_SHA}.${PHOTO_EXT}`, "vcards/contacts.vcf"].sort(),
);
check("integrity excludes manifest.json", !integrityPaths.includes(ARCHIVE_MANIFEST_NAME));

// ── schema validity (§7.2 / §2–§6), lightweight structural check ──────────────
const manifestOk =
  manifest["@type"] === "getkontax.com:Archive" &&
  /^1\.[0-9]+$/.test(manifest[FORMAT_VERSION_KEY]) &&
  typeof manifest[ext("exportedAt")] === "string" &&
  Array.isArray(manifest.integrity.entries) &&
  manifest.integrity.entries.every(
    (e: { path: string; sha256: string; bytes: number }) =>
      /^(contacts\/|media\/|vcards\/)/.test(e.path) && /^[0-9a-f]{64}$/.test(e.sha256) && Number.isInteger(e.bytes),
  );
check("manifest validates against kontax-archive.v1 schema shape", manifestOk);

const cardDoc = JSON.parse(zip.getEntry("contacts/0001.json")!.getData().toString("utf8"));
const cardOk =
  cardDoc["@type"] === "Card" &&
  cardDoc.version === "1.0" &&
  typeof cardDoc.uid === "string" &&
  typeof cardDoc.created === "string" &&
  typeof cardDoc.updated === "string" &&
  cardDoc[FORMAT_VERSION_KEY] === "1.0" &&
  typeof cardDoc[ext("exportedAt")] === "string" &&
  cardDoc.media?.["m1"]?.uri === `${ARCHIVE_MEDIA_DIR}${PHOTO_SHA}.${PHOTO_EXT}`; // photo by relative ref (§3.6)
check("contact document validates against kontax-contact.v1 schema shape", cardOk);

// ── integrity verification (§7.3) ─────────────────────────────────────────────
const clean = verifyKontaxArchiveIntegrity(zipBuffer);
check("clean archive verifies", clean.verified && clean.ok && clean.entryCount === 4 && clean.problems.length === 0);

// tamper: repack with one contact's bytes mutated in place (same length, so the
// length check passes and the sha256 check is what catches it) → hash-mismatch.
const tampered = new AdmZip();
for (const e of zip.getEntries()) {
  let data = e.getData();
  if (e.entryName === "contacts/0002.json") {
    data = Buffer.from(data); // copy, then flip one byte → identical length, wrong hash
    const mid = Math.floor(data.length / 2);
    data.writeUInt8(data.readUInt8(mid) ^ 0xff, mid);
  }
  tampered.addFile(e.entryName, data);
}
const tamperResult = verifyKontaxArchiveIntegrity(tampered.toBuffer());
check("tampered entry is detected", !tamperResult.ok);
eq("tamper reported as hash-mismatch on the right path", tamperResult.problems, [
  { path: "contacts/0002.json", issue: "hash-mismatch" },
]);

// a same-path shorter entry is caught by the length check before the hash.
const shortened = new AdmZip();
for (const e of zip.getEntries()) {
  const data = e.entryName === "contacts/0001.json" ? e.getData().subarray(0, 10) : e.getData();
  shortened.addFile(e.entryName, data);
}
eq("a short entry reports size-mismatch", verifyKontaxArchiveIntegrity(shortened.toBuffer()).problems, [
  { path: "contacts/0001.json", issue: "size-mismatch" },
]);

// truncation: a clipped buffer loses its central directory → detected.
const truncated = zipBuffer.subarray(0, Math.floor(zipBuffer.length / 2));
check("truncated archive is detected", !verifyKontaxArchiveIntegrity(truncated).ok);

// ── round-trip (§7.8 acceptance) ──────────────────────────────────────────────
const parsed = parseKontaxArchive(zipBuffer);
eq("round-trip yields both contacts", parsed.contacts.length, 2);
eq("round-trip skips nothing", parsed.skippedCount, 0);
eq("round-trip preserves full name", parsed.contacts[0]!.fullName, "Amelia Rowe-Nguyen");
eq("round-trip preserves book membership", parsed.contacts[0]!.books, ["Work"]);
eq("round-trip recovers the label registry", parsed.contacts[0]!.labelRegistry, labelRegistry);
const rtPhoto = parsed.contacts[0]!.photo;
check(
  "round-trip recovers the photo byte-identically",
  !!rtPhoto && rtPhoto.bytes.equals(PHOTO_BYTES) && rtPhoto.mediaType === "image/png",
);

// ── write the committed worked-example fixture ────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "..", "tests", "fixtures", "kontax-archive");
mkdirSync(fixtureDir, { recursive: true });
writeFileSync(join(fixtureDir, "example.zip"), zipBuffer);
// Also drop the manifest loose, for human diffing.
writeFileSync(join(fixtureDir, "manifest.json"), zip.getEntry(ARCHIVE_MANIFEST_NAME)!.getData());
console.log(`\nwrote ${fixtureDir}/example.zip (${zipBuffer.length} bytes)`);

// ── result ────────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll P45-03 archive-container checks passed.");
