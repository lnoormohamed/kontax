import Link from "next/link";

import { parseInline } from "../_content/text";

/** Renders help-content inline markup ([label](href), **bold**, `code`) as React nodes. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, i) => {
        if (token.kind === "bold") return <strong key={i}>{token.value}</strong>;
        if (token.kind === "code") return <code key={i}>{token.value}</code>;
        if (token.kind === "link") {
          return token.href.startsWith("/") ? (
            <Link key={i} href={token.href}>
              {token.value}
            </Link>
          ) : (
            <a key={i} href={token.href}>
              {token.value}
            </a>
          );
        }
        return <span key={i}>{token.value}</span>;
      })}
    </>
  );
}
