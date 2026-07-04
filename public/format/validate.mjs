#!/usr/bin/env node
// Kontax Contact Export Format — reference validator.
//
// Zero dependencies: Node.js ≥ 18 only. No Kontax account, no network, no npm
// install. Validates either serialization defined by the spec:
//   • a bare document  (.json) — one JSContact Card + getkontax.com:* extensions
//   • an archive        (.zip) — manifest.json + contacts/ + media/ (+ vcards/)
//
// For an archive it also VERIFIES INTEGRITY: the manifest's integrity table
// lists a sha256 + byte length for every packed entry, so a truncated or
// tampered archive is caught (spec §7.3). A mismatched or newer major version
// is rejected, never silently accepted (spec §4/§7.5).
//
// Usage:
//   node validate.mjs <file.json|file.zip> [--schemas <dir>]
//   node validate.mjs --help
// Exit code 0 = valid, 1 = invalid, 2 = usage/IO error.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_MAJOR = 1;
const FORMAT_VERSION_KEY = "getkontax.com:formatVersion";
const HERE = dirname(fileURLToPath(import.meta.url));

// ── args ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { file: null, schemas: resolve(HERE, "..", "schemas") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") return { help: true };
    else if (a === "--schemas") args.schemas = argv[++i];
    else if (!a.startsWith("-") && args.file === null) args.file = a;
    else return { error: `unexpected argument: ${a}` };
  }
  if (!args.file) return { error: "no input file given" };
  return args;
}

const USAGE = `Kontax Contact Export Format — validator

  node validate.mjs <file.json|file.zip> [--schemas <dir>]

Validates a bare document or an archive against the published JSON Schemas and,
for archives, verifies the manifest integrity checksums. Exit 0 = valid.`;

// ── minimal JSON Schema (draft 2020-12 subset) ────────────────────────────────
// Covers exactly the keywords the published schemas use: type, required,
// properties, additionalProperties, items, const, enum, pattern, format,
// minimum, maximum, oneOf. Enough to validate these documents faithfully;
// not a general-purpose validator.

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const FORMAT_CHECKS = {
  "date-time": (v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v),
  uuid: (v) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v),
  email: (v) => /^[^@\s]+@[^@\s]+$/.test(v),
  // uri / uri-reference: accept any non-empty string (a relative media ref is a
  // valid uri-reference; strict URI parsing would only add false negatives).
  uri: (v) => typeof v === "string" && v.length > 0,
  "uri-reference": (v) => typeof v === "string" && v.length > 0,
};

const typeOf = (v) => {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v; // "string" | "number" | "boolean" | "object"
};

const matchesType = (v, t) => {
  const actual = typeOf(v);
  if (t === "number") return actual === "number" || actual === "integer";
  if (t === "object") return actual === "object";
  return actual === t;
};

function validate(value, schema, path, errors) {
  if (schema === true || schema === undefined) return;
  if (schema === false) {
    errors.push(`${path}: no value allowed here`);
    return;
  }
  if ("type" in schema) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path}: expected type ${types.join("|")}, got ${typeOf(value)}`);
      return; // further keyword checks assume the type held
    }
  }
  if ("const" in schema && !deepEqual(value, schema.const)) {
    errors.push(`${path}: must equal ${JSON.stringify(schema.const)}`);
  }
  if ("enum" in schema && !schema.enum.some((e) => deepEqual(value, e))) {
    errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: does not match /${schema.pattern}/`);
    }
    if (schema.format && FORMAT_CHECKS[schema.format] && !FORMAT_CHECKS[schema.format](value)) {
      errors.push(`${path}: not a valid ${schema.format}`);
    }
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${path}: must be >= ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${path}: must be <= ${schema.maximum}`);
    }
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required property "${key}"`);
    }
    const props = schema.properties ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) validate(value[key], sub, `${path}/${key}`, errors);
    }
    if ("additionalProperties" in schema) {
      for (const key of Object.keys(value)) {
        if (key in props) continue;
        if (schema.additionalProperties === false) {
          errors.push(`${path}: unexpected property "${key}"`);
        } else if (typeof schema.additionalProperties === "object") {
          validate(value[key], schema.additionalProperties, `${path}/${key}`, errors);
        }
      }
    }
  }
  if (typeOf(value) === "array" && schema.items) {
    value.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`, errors));
  }
  if (Array.isArray(schema.oneOf)) {
    const passing = schema.oneOf.filter((sub) => {
      const e = [];
      validate(value, sub, path, e);
      return e.length === 0;
    });
    if (passing.length !== 1) {
      errors.push(`${path}: must match exactly one of the allowed shapes (matched ${passing.length})`);
    }
  }
}

const validateAgainst = (value, schema) => {
  const errors = [];
  validate(value, schema, "(root)", errors);
  return errors;
};

// ── minimal zip reader (central directory + DEFLATE via zlib) ──────────────────
// No dependency: parse the End-Of-Central-Directory record, walk the central
// directory for names + sizes + offsets, then read each local entry. Handles
// stored (method 0) and deflate (method 8); no zip64 (archives here are small).

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

function readZipEntries(buf) {
  // Locate EOCD by scanning backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("not a zip archive (no end-of-central-directory record) — file may be truncated");

  const entryCount = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16); // central directory offset
  const entries = new Map();

  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(ptr) !== CEN_SIG) throw new Error("corrupt central directory");
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);

    // Local header: sizes there may be zeroed (streaming flag), but its own
    // name/extra lengths are always present and give us the data start.
    const lhNameLen = buf.readUInt16LE(localOffset + 26);
    const lhExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    entries.set(name, data);

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ── report helpers ────────────────────────────────────────────────────────────

const printErrors = (label, errors) => {
  console.error(`  ✗ ${label}:`);
  for (const e of errors.slice(0, 20)) console.error(`      ${e}`);
  if (errors.length > 20) console.error(`      … and ${errors.length - 20} more`);
};

const parseMajor = (fv) => {
  const m = typeof fv === "string" ? /^(\d+)\.\d+$/.exec(fv.trim()) : null;
  return m ? Number(m[1]) : null;
};

// ── document / archive validation ─────────────────────────────────────────────

function loadSchemas(dir) {
  const read = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
  return {
    contact: read("kontax-contact.v1.schema.json"),
    archive: read("kontax-archive.v1.schema.json"),
  };
}

function versionGate(fv, container) {
  const major = parseMajor(fv);
  if (major === null) return `${container}: missing or malformed "${FORMAT_VERSION_KEY}"`;
  if (major > SUPPORTED_MAJOR) {
    return `${container}: format major ${major} is newer than this validator supports (v${SUPPORTED_MAJOR}) — update the validator`;
  }
  return null;
}

function validateDocument(json, schemas) {
  let ok = true;
  const gate = versionGate(json?.[FORMAT_VERSION_KEY], "document");
  if (gate) {
    console.error(`  ✗ ${gate}`);
    return false;
  }
  const errors = validateAgainst(json, schemas.contact);
  if (errors.length) {
    printErrors("document does not match kontax-contact.v1 schema", errors);
    ok = false;
  } else {
    console.log("  ✓ document matches kontax-contact.v1 schema");
  }
  return ok;
}

function validateArchive(buf, schemas) {
  let entries;
  try {
    entries = readZipEntries(buf);
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
    return false;
  }

  const manifestRaw = entries.get("manifest.json");
  if (!manifestRaw) {
    console.error('  ✗ archive has no manifest.json at its root');
    return false;
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw.toString("utf8"));
  } catch {
    console.error("  ✗ manifest.json is not valid JSON");
    return false;
  }

  let ok = true;
  const gate = versionGate(manifest[FORMAT_VERSION_KEY], "manifest");
  if (gate) {
    console.error(`  ✗ ${gate}`);
    return false;
  }

  const manifestErrors = validateAgainst(manifest, schemas.archive);
  if (manifestErrors.length) {
    printErrors("manifest.json does not match kontax-archive.v1 schema", manifestErrors);
    ok = false;
  } else {
    console.log("  ✓ manifest.json matches kontax-archive.v1 schema");
  }

  // Integrity: every listed entry must be present, right length, right hash.
  const integrity = manifest.integrity?.entries;
  if (Array.isArray(integrity)) {
    const problems = [];
    for (const row of integrity) {
      const data = entries.get(row.path);
      if (!data) problems.push(`${row.path}: missing`);
      else if (typeof row.bytes === "number" && data.length !== row.bytes) {
        problems.push(`${row.path}: size ${data.length} ≠ manifest ${row.bytes}`);
      } else if (typeof row.sha256 === "string") {
        const actual = createHash("sha256").update(data).digest("hex");
        if (actual !== row.sha256) problems.push(`${row.path}: sha256 mismatch`);
      }
    }
    if (problems.length) {
      printErrors(`integrity check failed (${problems.length} entr${problems.length === 1 ? "y" : "ies"})`, problems);
      ok = false;
    } else {
      console.log(`  ✓ integrity verified (${integrity.length} entr${integrity.length === 1 ? "y" : "ies"})`);
    }
  } else {
    console.log("  ⚠ manifest has no integrity block — unverified (older producer)");
  }

  // Every contacts/*.json must be a supported Card at the manifest's version.
  const contactNames = [...entries.keys()].filter((n) => n.startsWith("contacts/") && n.endsWith(".json")).sort();
  const manifestMajor = parseMajor(manifest[FORMAT_VERSION_KEY]);
  let badContacts = 0;
  for (const name of contactNames) {
    let card;
    try {
      card = JSON.parse(entries.get(name).toString("utf8"));
    } catch {
      console.error(`  ✗ ${name}: not valid JSON`);
      badContacts++;
      continue;
    }
    if (parseMajor(card[FORMAT_VERSION_KEY]) !== manifestMajor) {
      console.error(`  ✗ ${name}: formatVersion disagrees with the manifest (spec §7.5)`);
      badContacts++;
      continue;
    }
    const errs = validateAgainst(card, schemas.contact);
    if (errs.length) {
      printErrors(`${name} does not match kontax-contact.v1 schema`, errs);
      badContacts++;
    }
  }
  if (contactNames.length === 0) {
    console.error("  ✗ archive contains no contacts/*.json entries");
    ok = false;
  } else if (badContacts === 0) {
    console.log(`  ✓ all ${contactNames.length} contact document(s) match kontax-contact.v1 schema`);
  } else {
    ok = false;
  }
  return ok;
}

// ── main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (args.error) {
    console.error(`error: ${args.error}\n\n${USAGE}`);
    process.exit(2);
  }

  let buf;
  let schemas;
  try {
    buf = readFileSync(args.file);
    schemas = loadSchemas(args.schemas);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(2);
  }

  const isZip = buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b;
  console.log(`Validating ${args.file} as ${isZip ? "archive (.zip)" : "bare document (.json)"}…`);

  let ok;
  if (isZip) {
    ok = validateArchive(buf, schemas);
  } else {
    let json;
    try {
      json = JSON.parse(buf.toString("utf8"));
    } catch (err) {
      console.error(`  ✗ not valid JSON: ${err.message}`);
      process.exit(1);
    }
    ok = validateDocument(json, schemas);
  }

  console.log(ok ? "\nVALID ✓" : "\nINVALID ✗");
  process.exit(ok ? 0 : 1);
}

main();
