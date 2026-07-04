# P46-05 — Contact detail tabs: Back returns to the list

Status: Not started · Priority: P1 · Depends: —
Phase: [Phase 46](phase-46-alphabet-scrubber.md)

> User report: the contact detail **tabs** (Details / Sharing / History) are
> treated like pages — hitting Back steps through tabs instead of returning to
> the contact list. Goal: from any tab, **one Back press returns to the
> contact list** (at prior scroll), never to a sibling tab.

## Findings (verified 2026-07-04) — read before assuming the fix

The tabs **already use `<Link replace>`** in both surfaces, so "just add
`replace`" is *not* the fix — the bug is subtler:

- Desktop tabs: `src/app/contacts/[id]/page.tsx:1145-1168` —
  `<Link href={`/contacts/${id}?tab=${key}`} replace>`.
- Mobile tabs: `src/app/_components/mobile-contact-detail.tsx:545-585` — same,
  with `prefetch={false} replace`.
- Mobile Back is already smart: `handleBack` (`mobile-contact-detail.tsx:180-184`)
  calls `router.back()` when `cameFromContactList(contactId)`, else falls back
  to `backHref="/contacts"`.
- Other `?tab=` navigations (header "Share", quick-action share, mobile
  more-menu share at `page.tsx:830,1066` / `mobile-contact-detail.tsx:512`)
  also use `replace`.

So history *should* already collapse tabs. The task is to find why it doesn't
in practice.

## Scope

### Diagnose
- Reproduce on desktop and mobile; instrument `history.length` while switching
  tabs and confirm whether entries actually accumulate, or whether the
  perceived "cycling" is something else (scroll reset, default-tab re-render,
  an intermediate redirect from `/contacts/[id]` → `?tab=details`).
- Audit for any **push** into a `?tab=` URL that bypasses `replace` (a stray
  `<Link>` without `replace`, a `router.push`, or a server redirect that
  inserts an entry). The initial list→detail navigation is the *one* entry
  Back should consume — verify nothing between it and the current tab adds
  more.

### Fix (choose per diagnosis)
- If a stray push is found: convert it to `replace`.
- If `<Link replace>` still accumulates entries here (App Router edge with
  changing search params), switch tab state to a mechanism that **never
  touches the history stack** — e.g. `window.history.replaceState` on tab
  change, or local component state with the tab kept out of the URL. Preserve
  deep-linkability to a tab only if it can be done without a Back-consuming
  entry (otherwise drop `?tab=` deep links — returning to the list cleanly is
  the priority).
- Keep the mobile `handleBack` list-return + scroll-restoration behaviour.

## Acceptance
- From Details, Sharing, or History (having switched between them several
  times), a single browser/OS Back press returns to the **contact list**, at
  its prior scroll position — never to a sibling tab. Verified desktop
  (browser Back) and mobile (OS Back / swipe-back), iOS Safari + Android
  Chrome.
- Deep-linking directly to `/contacts/[id]?tab=sharing` (if retained) still
  opens that tab, and Back from it goes to wherever the user came from (list,
  or the referring page), not through the other tabs.
- No regression to the mobile "came from list" scroll-restoration path.
