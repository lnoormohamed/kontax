# P37-02 — Phase 1 rollout: Australia, New Zealand, and Pacific

**Status:** Ready after `P37-01`.
First country-phase rollout using the shared phone-country metadata foundation.

---

## 1. Objective

Fix the exact local-vs-international bugs already seen in QA and prove that the
metadata-table approach works in real merge and duplicate flows.

This phase focuses on:
- domestic trunk prefix handling
- local mobile vs landline canonicalization
- same-number collapse across local and international forms
- primary-vs-kept merge clarity

---

## 2. Countries in scope

- Australia
- New Zealand
- Fiji
- Papua New Guinea
- Solomon Islands
- Vanuatu
- Samoa
- Tonga
- Kiribati
- Tuvalu
- Nauru

---

## 3. Primary implementation targets

Files expected to change:
- [src/lib/phone-country-rules.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/phone-country-rules.ts)
- [src/lib/phone-normalization.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/phone-normalization.ts)
- [src/lib/duplicate-signals.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/duplicate-signals.ts)
- [src/server/contact-merge.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/server/contact-merge.ts)

Possible UI follow-through:
- [src/app/_components/merge-review.tsx](/Users/lnoormohamed/ChatGPT/Kontax/src/app/_components/merge-review.tsx)
- [src/app/_components/merge-suggestion-card.tsx](/Users/lnoormohamed/ChatGPT/Kontax/src/app/_components/merge-suggestion-card.tsx)

---

## 4. Rules to support

### Australia

- trunk prefix `0`
- mobile national prefix `4`
- landline national prefixes `2`, `3`, `7`, `8`
- canonical local `04...` to `+61 4...`
- canonical local `02/03/07/08...` to `+61 ...`
- likely type inference:
  - `4` => `mobile`
  - `2/3/7/8` => `landline`

### New Zealand

- trunk prefix `0`
- mobile local-to-international collapse
- fixed-line local-to-international collapse
- conservative type inference where prefixes are stable

### Pacific countries

Use conservative metadata where available:
- canonical calling code
- expected national lengths
- display preferences
- no aggressive type inference unless reliable

---

## 5. Test cases

Required:
- `0410 000 083` == `+61 410 000 083`
- `02 9000 1234` == `+61 2 9000 1234`
- local NZ mobile == `+64` mobile
- local NZ landline == `+64` landline
- AU mobile and AU landline remain distinct
- same number with spaces / punctuation removed still collapses

Merge-specific:
- quick merge must not show `Both kept` for AU/NZ format variants
- merge review must present one primary number and no duplicate preserved number

---

## 6. Acceptance criteria

This ticket is done when:
- AU and NZ local/international forms collapse consistently
- AU type inference works for mobile vs landline
- seeded Pacific examples store canonical values cleanly
- duplicate suggestions and merge review stop treating same-format variants as separate numbers

