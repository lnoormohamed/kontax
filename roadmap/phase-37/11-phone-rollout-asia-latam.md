# P37-11 — Phase 10 rollout: Asia and Latin America / Caribbean non-NANP

**Status:** Ready after `P37-01`.
Final broad-coverage phase for the largest remaining regional groups.

---

## 1. Countries and territories in scope

- India
- Pakistan
- Bangladesh
- Sri Lanka
- Nepal
- Bhutan
- Maldives
- Afghanistan
- China
- Hong Kong
- Macau
- Taiwan
- Japan
- South Korea
- North Korea
- Mongolia
- Indonesia
- Malaysia
- Singapore
- Thailand
- Vietnam
- Philippines
- Cambodia
- Laos
- Myanmar
- Brunei
- Timor-Leste
- Mexico
- Guatemala
- El Salvador
- Honduras
- Nicaragua
- Costa Rica
- Panama
- Colombia
- Venezuela
- Ecuador
- Peru
- Bolivia
- Chile
- Argentina
- Uruguay
- Paraguay
- Brazil
- Guyana
- Suriname
- Cuba
- Haiti
- Aruba
- Curaçao
- Bonaire
- French Guiana
- Guadeloupe
- Martinique
- Réunion
- Mayotte
- Saint Pierre and Miquelon

---

## 2. Objective

Finish world coverage for the highest-volume remaining regions and transition the
rollout from feature-building to long-tail maintenance.

---

## 3. Rules to support

- India local mobile to `+91`
- China local mobile to `+86`
- Japan local domestic format to `+81`
- South Korea local domestic format to `+82`
- Brazil and Mexico local-to-international canonicalization
- conservative mobile/fixed hints where documented

---

## 4. Test cases

- India local mobile == `+91` mobile
- China local mobile == `+86` mobile
- Japan domestic mobile == `+81` mobile
- Brazil local mobile == `+55` mobile
- Mexico local domestic form == `+52`

---

## 5. Acceptance criteria

This ticket is done when:
- representative Asia and LATAM examples are validated on staging
- same-number formatting bugs are no longer reproducible in the seeded global QA set

