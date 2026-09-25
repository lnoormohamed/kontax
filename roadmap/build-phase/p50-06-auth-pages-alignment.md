# P50-06 — Auth pages aligned (green, Geist, UK spelling)

**Phase:** 50 · **Priority:** P2 · **Effort:** S · **Depends on:** P50-01

## Objective
Make login, register, forgot/reset password and 2FA look like the same product as the
marketing site (the exploration rated this "small" for Direction A).

## Scope
- Replace the indigo primary buttons with forest green (`--g800`), keep `#4158f4` for focus only.
- Geist via P50-01; Direction A card radius, borders and input styles.
- Copy: "organized" → "organised" and any other US spellings on auth screens.
- Keep all form behaviour, autocomplete attributes and 16px inputs.

## Acceptance
- Visual pass on staging for each auth screen at 1440 and 375.
- No change to auth logic (tests and session-guard check pass).
