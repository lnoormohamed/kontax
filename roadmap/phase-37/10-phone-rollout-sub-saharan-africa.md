# P37-10 — Phase 9 rollout: Sub-Saharan Africa

**Status:** Ready after `P37-01`.
Large regional phase that should lean on metadata coverage and cautious inference.

---

## 1. Countries in scope

- Nigeria
- Ghana
- Kenya
- Uganda
- Tanzania
- Rwanda
- Ethiopia
- South Africa
- Namibia
- Botswana
- Zimbabwe
- Zambia
- Mozambique
- Angola
- Cameroon
- Côte d’Ivoire
- Senegal
- Mali
- Burkina Faso
- Niger
- Benin
- Togo
- Sierra Leone
- Liberia
- Guinea
- Guinea-Bissau
- Gabon
- Republic of the Congo
- Democratic Republic of the Congo
- Malawi
- Madagascar
- Mauritius
- Seychelles
- Cape Verde
- São Tomé and Príncipe
- Eritrea
- Djibouti
- Somalia
- South Sudan
- Burundi
- Lesotho
- Eswatini
- Comoros
- Equatorial Guinea
- Gambia
- Chad
- Central African Republic

---

## 2. Objective

Extend support across African numbering plans with enough metadata to stop the main
duplicate/merge issues, without pretending to have perfect per-country inference on
day one.

---

## 3. Rules to support

- national lengths by country
- local-to-international canonicalization for high-volume countries first
- mobile/fixed hints only where reliable
- consistent display formatting

Priority representative countries:
- Nigeria
- Kenya
- South Africa
- Ghana
- Tanzania

---

## 4. Test cases

- Nigeria local mobile == `+234` mobile
- South Africa local mobile == `+27` mobile
- South Africa local landline == `+27` landline
- East African representative local forms collapse correctly

---

## 5. Acceptance criteria

This ticket is done when:
- high-volume African examples are validated on staging
- same-number local/international variants do not survive merges as separate numbers

