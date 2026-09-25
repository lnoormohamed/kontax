// P50A-05 · Inline markup for help content: [label](href) links, **bold** and `code`.
// Pure helpers shared by the renderer (help-rich.tsx), search and JSON-LD.

export type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; value: string; href: string };

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

export function parseInline(source: string): InlineToken[] {
  const out: InlineToken[] = [];
  let last = 0;
  for (const m of source.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", value: source.slice(last, at) });
    if (m[1] !== undefined && m[2] !== undefined) {
      out.push({ kind: "link", value: m[1], href: m[2] });
    } else if (m[3] !== undefined) {
      out.push({ kind: "bold", value: m[3] });
    } else if (m[4] !== undefined) {
      out.push({ kind: "code", value: m[4] });
    }
    last = at + m[0].length;
  }
  if (last < source.length) out.push({ kind: "text", value: source.slice(last) });
  return out;
}

/** Plain text (markup removed) for search indexes, meta descriptions and JSON-LD. */
export function toPlainText(source: string): string {
  return parseInline(source)
    .map((t) => t.value)
    .join("");
}

/** Every link target in a string (used by the link-integrity test). */
export function linkTargets(source: string): string[] {
  return parseInline(source).flatMap((t) => (t.kind === "link" ? [t.href] : []));
}
