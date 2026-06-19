# P37-04 — Phase 3 rollout: UK and Ireland

**Status:** Ready after `P37-01`.
Priority phase because UK-style local formats are already present in seeded QA data.

---

## 1. Objective

Normalize the most common UK and Ireland local-vs-international cases so duplicate
review and merge no longer treat them as separate numbers.

---

## 2. Countries and territories in scope

- United Kingdom
- Ireland
- Isle of Man
- Jersey
- Guernsey

---

## 3. Rules to support

### United Kingdom

- trunk prefix `0`
- mobile local `07...` to `+44 7...`
- landline local `01...` / `02...` to `+44 ...`
- display formatting for local and international forms
- likely type inference:
  - `7` => `mobile`
  - `1/2` => `landline`

### Ireland

- trunk prefix `0`
- local mobile to `+353`
- local landline to `+353`
- conservative type inference only where reliable

---

## 4. Technical scope

Files expected to change:
- [src/lib/phone-country-rules.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/phone-country-rules.ts)
- [src/lib/phone-normalization.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/phone-normalization.ts)
- [src/server/contact-merge.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/server/contact-merge.ts)

---

## 5. Test cases

Required:
- `07700 900111` == `+44 7700 900111`
- `01323 410051` == corresponding `+44` landline
- local Irish mobile == `+353` mobile
- local Irish landline == `+353` landline
- mobile and landline remain distinct

Merge-specific:
- UK duplicate cards stop showing `Both kept` for local vs international variants
- merge review clearly shows a single kept number when values are equivalent

---

## 6. Acceptance criteria

This ticket is done when:
- UK and Ireland local/international forms collapse correctly
- type hints for UK mobile vs landline are available in metadata
- seeded UK merge cases are confirmed on staging

