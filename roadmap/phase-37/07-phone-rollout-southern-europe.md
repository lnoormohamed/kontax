# P37-07 — Phase 6 rollout: Southern Europe and Mediterranean Europe

**Status:** Ready after `P37-01`.
Completes the higher-priority Southern European group before broader eastern coverage.

---

## 1. Countries in scope

- Spain
- Portugal
- Italy
- Malta
- San Marino
- Vatican City
- Greece
- Cyprus
- Andorra

---

## 2. Objective

Support Southern European local and international phone formats with reliable merge
canonicalization and improved display behavior.

---

## 3. Rules to support

- Spain local mobile and fixed-line canonicalization
- Portugal local mobile and fixed-line canonicalization
- Italy numbering metadata and display preferences
- Greece and Cyprus mobile/fixed prefix hints where safe
- conservative fallback for microstates

---

## 4. Test cases

- Spanish local mobile == `+34` mobile
- Portuguese local mobile == `+351` mobile
- Italian local national form normalizes consistently
- clearly distinct mobile and landline numbers remain separate

---

## 5. Acceptance criteria

This ticket is done when:
- Southern Europe seeded examples normalize correctly
- merge review and quick merge no longer show false `Both kept` for local/international variants

