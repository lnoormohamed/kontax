# Admin Search, Saved Views, and Queue Pivots

## Purpose

Use `/admin/search` as the main jump surface when support starts from partial
context instead of a known user record.

## What search now covers

- user emails, names, and ids
- support case ids and titles
- sync connection ids, provider refs, and remote account identifiers
- broadcast titles and ids
- feature flag keys and names
- audit targets and major entity refs

## Saved views

The admin search page exposes lightweight, URL-based presets so operators can
reopen common queues without rebuilding filters:

- `Unassigned support cases`
- `Sync re-auth queue`
- `Billing exceptions`
- `Recent destructive actions`
- `Generic-safe CardDAV watchlist`

These are safe to bookmark or share internally because they are just admin URLs
with query params.

## Operator workflow

1. Start with global search when you only have a case id, email fragment,
   connection id, provider host, or flag key.
2. Use the result group that matches the operational entity you want to work in.
3. Reopen common queue states from the saved-view cards instead of manually
   rebuilding the same filters.
4. Use overview/dashboard links as pivots; they now land on filtered views
   rather than broad index pages.
