// P48-08: linear, single-pass parsing helpers for CardDAV request bodies.
//
// `server.mjs` is plain ESM JavaScript (it boots Next itself, so it cannot
// import the TypeScript modules under `src/`), which is why these helpers live
// in a `.mjs` module rather than next to `src/server/dav/xml.ts`. Keeping them
// here — instead of inline in `server.mjs` — makes them unit-testable
// (`tests/node/dav-body-limits.test.ts`).
//
// The previous implementation ran
//   /<[^>]*:?prop\b[^>]*>([\s\S]*?)<\/[^>]*:?prop>/i
// over the whole body. On a body of repeated *unclosed* `<d:prop>` tags that
// regex is quadratic (64 KB → ~216 ms, 281 KB → ~3.4 s) and it runs on the one
// thread that also serves every Next.js page. Everything below is a single
// forward scan: cost is strictly linear in body length.

/** Byte caps applied by `readRequestBody` in `server.mjs`. */
export const DAV_BODY_LIMITS = {
  /** PROPFIND / REPORT — the largest real-world body we have seen is ~8 KB. */
  query: 64 * 1024,
  /** PUT — a vCard with an inline photo fits comfortably. */
  put: 1024 * 1024,
};

/**
 * @typedef {object} DavTag
 * @property {"open" | "close" | "self"} kind
 * @property {string} qname      Raw qualified name, e.g. `d:prop`.
 * @property {string} localName  Namespace prefix stripped, e.g. `prop`.
 * @property {number} tagStart   Index of the `<`.
 * @property {number} contentStart Index just past the `>`.
 */

// Characters that terminate a tag name: space, tab, LF, CR, `/`, `>`.
/** @param {number} code */
const isNameChar = (code) =>
  code !== 32 && code !== 9 && code !== 10 && code !== 13 && code !== 47 && code !== 62;

/** @param {string} qname */
const localNameOf = (qname) => {
  const colon = qname.indexOf(":");
  return colon >= 0 ? qname.slice(colon + 1) : qname;
};

/**
 * Walk every `<...>` tag in `xml` exactly once, in document order. Comments,
 * CDATA sections, processing instructions and `<!...>` declarations are skipped
 * wholesale. The visitor may return `false` to stop the scan early.
 *
 * This is deliberately a tolerant tokenizer, not a validating XML parser: it
 * never expands entities, never recurses, and never backtracks.
 *
 * @param {string} xml
 * @param {(tag: DavTag) => boolean | void} visit
 */
export const forEachTag = (xml, visit) => {
  const length = xml.length;
  let i = 0;

  while (i < length) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) return;

    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      i = end < 0 ? length : end + 3;
      continue;
    }

    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      i = end < 0 ? length : end + 3;
      continue;
    }

    if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2);
      i = end < 0 ? length : end + 2;
      continue;
    }

    if (xml.startsWith("<!", lt)) {
      // DOCTYPE / ENTITY / anything else declarative. `hasDoctypeOrEntity`
      // rejects the body before we ever get here in the request path.
      const end = xml.indexOf(">", lt + 2);
      i = end < 0 ? length : end + 1;
      continue;
    }

    const gt = xml.indexOf(">", lt + 1);
    if (gt < 0) return; // unterminated final tag — nothing more to read

    let cursor = lt + 1;
    const closing = xml.charCodeAt(cursor) === 47; // '/'
    if (closing) cursor += 1;

    let nameEnd = cursor;
    while (nameEnd < gt && isNameChar(xml.charCodeAt(nameEnd))) nameEnd += 1;

    const qname = xml.slice(cursor, nameEnd);

    if (qname.length > 0) {
      const selfClosing = !closing && xml.charCodeAt(gt - 1) === 47; // '/'
      const proceed = visit({
        kind: closing ? "close" : selfClosing ? "self" : "open",
        qname,
        localName: localNameOf(qname),
        tagStart: lt,
        contentStart: gt + 1,
      });

      if (proceed === false) return;
    }

    i = gt + 1;
  }
};

/**
 * True when the body carries a DTD or entity declaration. Kontax never expands
 * entities, so classic XXE is not reachable, but a DTD has no legitimate place
 * in a DAV request and its presence is a reliable attack signal — we answer 400.
 *
 * @param {string} body
 */
export const hasDoctypeOrEntity = (body) => {
  if (typeof body !== "string" || body.length === 0) return false;
  const lower = body.toLowerCase();
  return lower.includes("<!doctype") || lower.includes("<!entity");
};

/**
 * Local names of the children of the first `prop` element, namespace-prefix
 * agnostic, de-duplicated and in document order. `null` when the body has no
 * `prop` element (an `allprop`/`propname` request, or an empty body), which the
 * PROPFIND handlers read as "send everything you have".
 *
 * Output shape is identical to the regex implementation it replaces.
 *
 * @param {string} body
 * @returns {string[] | null}
 */
export const extractRequestedPropNames = (body) => {
  if (typeof body !== "string" || body.trim().length === 0) return null;

  /** @type {string[]} */
  const names = [];
  const seen = new Set();
  /** @param {string} name */
  const add = (name) => {
    if (name.length === 0 || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  let depth = 0;
  let propDepth = -1;

  forEachTag(body, (tag) => {
    if (tag.kind === "self") {
      if (propDepth >= 0) add(tag.localName);
      return true;
    }

    if (tag.kind === "open") {
      if (propDepth < 0) {
        if (tag.localName.toLowerCase() === "prop") propDepth = depth;
      } else {
        add(tag.localName);
      }
      depth += 1;
      return true;
    }

    depth -= 1;
    // The first `prop` element just closed — everything we need is collected.
    return !(propDepth >= 0 && depth === propDepth);
  });

  return names.length > 0 ? names : null;
};

// ── Multistatus *responses* (the CardDAV client side) ───────────────────────
//
// P49A-13 (A-29): `src/server/carddav.ts` used to split a server's multistatus
// reply with `/<response\b[\s\S]*?<\/response>/gi` and read each property with
// a lazy `<name…>([\s\S]*?)</name>` regex. On a body of repeated *unclosed*
// `<d:response>` tags every match attempt scans to the end of the body — the
// same quadratic shape P48-08 removed from the request side — and these bodies
// come from arbitrary remote servers, up to 10 MB, on the shared event loop.
// The helpers below reuse `forEachTag`: one forward pass, no backtracking, and
// an element whose close tag never arrives simply produces nothing.

/**
 * Every complete element named `localName` (namespace prefix ignored,
 * case-insensitive), as the exact source text from its `<` to the end of its
 * close tag, in document order. Same-name nesting is depth-tracked; an element
 * left unclosed at the end of the body is dropped.
 *
 * @param {string} xml
 * @param {string} localName
 * @returns {string[]}
 */
export const extractElements = (xml, localName) => {
  if (typeof xml !== "string" || xml.length === 0) return [];
  const wanted = localName.toLowerCase();
  /** @type {string[]} */
  const out = [];
  let start = -1;
  let depth = 0;

  forEachTag(xml, (tag) => {
    if (tag.localName.toLowerCase() !== wanted || tag.kind === "self") return true;
    if (tag.kind === "open") {
      if (depth === 0) start = tag.tagStart;
      depth += 1;
      return true;
    }
    if (depth === 0) return true; // stray close tag
    depth -= 1;
    if (depth === 0) out.push(xml.slice(start, tag.contentStart));
    return true;
  });

  return out;
};

/**
 * The trimmed inner text of the first complete element for each of `names`
 * (namespace prefix ignored, case-insensitive), in one pass that stops as soon
 * as every name is found. A name with no complete, non-self-closing element
 * maps to `null`. Content is returned raw — entities and CDATA are the
 * caller's to decode.
 *
 * @template {string} N
 * @param {string} xml
 * @param {readonly N[]} names
 * @returns {Record<N, string | null>}
 */
export const firstElementContents = (xml, names) => {
  /** @type {Record<string, string | null>} */
  const result = {};
  /** @type {Map<string, { depth: number, start: number }>} */
  const open = new Map();
  const pending = new Set();
  for (const name of names) {
    result[name] = null;
    pending.add(name.toLowerCase());
  }
  /** @type {Map<string, string>} */
  const original = new Map(names.map((name) => [name.toLowerCase(), name]));

  if (typeof xml === "string" && xml.length > 0 && pending.size > 0) {
    forEachTag(xml, (tag) => {
      if (tag.kind === "self") return true;
      const local = tag.localName.toLowerCase();
      if (!pending.has(local)) return true;
      const state = open.get(local);
      if (tag.kind === "open") {
        if (state) state.depth += 1;
        else open.set(local, { depth: 1, start: tag.contentStart });
        return true;
      }
      if (!state) return true; // stray close tag
      state.depth -= 1;
      if (state.depth > 0) return true;
      result[/** @type {string} */ (original.get(local))] = xml.slice(state.start, tag.tagStart).trim();
      open.delete(local);
      pending.delete(local);
      return pending.size > 0;
    });
  }

  return /** @type {Record<N, string | null>} */ (result);
};

// Bounded alternation, no nesting: linear and backtracking-free.
const XML_ENTITY = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos));/g;
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** @param {string} value */
export const decodeXmlText = (value) =>
  value.replace(XML_ENTITY, (match, dec, hex, named) => {
    if (typeof named === "string") {
      return NAMED_ENTITIES[/** @type {keyof typeof NAMED_ENTITIES} */ (named)];
    }
    const code = Number.parseInt(typeof dec === "string" ? dec : hex, typeof dec === "string" ? 10 : 16);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
    try {
      return String.fromCodePoint(code);
    } catch {
      return match;
    }
  });

/**
 * @typedef {object} DavReportRequest
 * @property {string | null} type  Lower-cased local name of the document element
 *   (`addressbook-multiget`, `sync-collection`, `addressbook-query`, …).
 * @property {string[]} hrefs      `<href>` values outside the `prop` element.
 * @property {string[] | null} propNames
 */

/**
 * Minimal REPORT body parse: the report type, the requested hrefs (used by
 * `addressbook-multiget` to return only the named resources instead of the whole
 * collection) and the requested prop names. One extra linear pass.
 *
 * @param {string} body
 * @returns {DavReportRequest | null}
 */
export const parseReportRequest = (body) => {
  if (typeof body !== "string" || body.trim().length === 0) return null;

  /** @type {string | null} */
  let rootName = null;
  /** @type {string[]} */
  const hrefs = [];

  let depth = 0;
  let propDepth = -1;
  let hrefStart = -1;
  let hrefDepth = -1;

  forEachTag(body, (tag) => {
    if (tag.kind === "self") return true;

    if (tag.kind === "open") {
      if (rootName === null) rootName = tag.localName;
      const local = tag.localName.toLowerCase();

      if (propDepth < 0 && local === "prop") {
        propDepth = depth;
      } else if (propDepth < 0 && hrefStart < 0 && local === "href") {
        hrefStart = tag.contentStart;
        hrefDepth = depth;
      }

      depth += 1;
      return true;
    }

    depth -= 1;

    if (propDepth >= 0 && depth === propDepth) propDepth = -1;

    if (hrefStart >= 0 && depth === hrefDepth) {
      const raw = body.slice(hrefStart, tag.tagStart).trim();
      if (raw.length > 0) hrefs.push(decodeXmlText(raw));
      hrefStart = -1;
    }

    return true;
  });

  return {
    type: rootName === null ? null : String(rootName).toLowerCase(),
    hrefs,
    propNames: extractRequestedPropNames(body),
  };
};

/**
 * Decode one URL path segment, rejecting malformed percent-escapes and NUL
 * bytes. Returns `null` instead of throwing, so callers answer 400 rather than
 * leaking a stack trace through a 500.
 *
 * @param {string} segment
 * @returns {string | null}
 */
export const decodePathSegment = (segment) => {
  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  if (decoded.includes(" ")) return null;
  return decoded;
};

/**
 * Last path segment of an `<href>`, `.vcf` suffix stripped and percent-decoded —
 * i.e. the contact's sync UID. `null` when the href is unusable.
 *
 * @param {string} href
 * @returns {string | null}
 */
export const hrefToSyncUid = (href) => {
  if (typeof href !== "string" || href.length === 0) return null;

  const path = href.split("?")[0]?.split("#")[0] ?? "";
  const segments = path.split("/");
  const last = segments[segments.length - 1];
  if (!last) return null;

  const withoutExtension = last.toLowerCase().endsWith(".vcf") ? last.slice(0, -4) : last;
  if (withoutExtension.length === 0) return null;

  return decodePathSegment(withoutExtension);
};
