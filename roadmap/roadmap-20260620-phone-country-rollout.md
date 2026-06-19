# Kontax — Phone Number Metadata & Normalization Rollout (2026-06-20)

Purpose: replace fragile country-by-country phone handling with a structured
rollout that combines:
- a shared phone-country metadata table
- stronger canonicalization rules
- clearer number-type inference (`mobile`, `landline`, `work`, `home`)
- safer duplicate / merge behavior

This plan is intentionally phased so we can ship improvements without waiting for
global perfection, while still covering all countries across 10 phases.

---

## Phase 37 — Ticket index

| Ticket | Title | Priority |
|---|---|---|
| P37-01 | Phone-country metadata foundation (`phone-country-rules.ts`) | P0 |
| P37-02 | Phase 1 rollout — Australia, New Zealand, and Pacific | P0 |
| P37-03 | Phase 2 rollout — NANP | P0 |
| P37-04 | Phase 3 rollout — UK and Ireland | P0 |
| P37-05 | Phase 4 rollout — Western Europe | P1 |
| P37-06 | Phase 5 rollout — Nordics and Baltics | P1 |
| P37-07 | Phase 6 rollout — Southern Europe and Mediterranean Europe | P1 |
| P37-08 | Phase 7 rollout — Central Europe, Eastern Europe, and Balkans | P1 |
| P37-09 | Phase 8 rollout — Middle East and North Africa | P1 |
| P37-10 | Phase 9 rollout — Sub-Saharan Africa | P1 |
| P37-11 | Phase 10 rollout — Asia and Latin America / Caribbean non-NANP | P1 |
| P37-12 | Cross-phase QA harness — seeded examples, duplicate refresh, regression coverage | P0 |

---

## Global implementation model

Every phase should contribute to the same shared architecture:

1. `phone-country-rules.ts`
- country metadata table
- calling code
- trunk prefix
- expected national lengths
- likely mobile prefixes
- likely landline prefixes
- preferred display style
- example mobile / landline numbers

2. `phone-normalization.ts`
- canonical storage target
- local-to-international normalization
- same-number collapse across local / international forms
- likely type inference
- preferred display formatting

3. Merge + duplicate behavior
- same-number detection must use canonicalized values
- quick merge must not show `Both kept` for the same number in two formats
- merge review must distinguish:
  - primary number after merge
  - additional numbers still kept

4. Test coverage
- unit tests for normalization
- unit tests for same-number matching
- merge preview expectations
- seeded staging QA examples

---

## Phase template

Each phase should ship with:
- metadata entries for the listed countries
- canonicalization rules for local + international forms
- trunk prefix stripping where applicable
- number-type hints where reliable
- merge/dedupe regression tests
- staging duplicate refresh and manual QA

Done criteria for every phase:
- local and international forms of the same number collapse to one canonical value
- duplicate cards no longer show `Both kept` for same-number format variants
- merge review correctly marks one value as `Primary after merge`
- clearly different numbers still remain separate
- at least one seeded example per country is verified on staging

---

## Phase 1 — Australia, New Zealand, and Pacific

Ticket: `P37-02`

Goal: fix the exact trunk-prefix problems already seen in QA and establish the
metadata-table pattern.

Countries:
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

Rules to support:
- domestic trunk `0` handling where applicable
- `04...` to `+61 4...` mobile canonicalization
- `02/03/07/08...` AU landline canonicalization
- NZ local mobile vs landline prefix handling
- preserve likely `mobile` / `landline` labels when possible

Test cases:
- `0410 000 083` == `+61 410 000 083`
- AU local landline == AU international landline
- NZ local mobile == NZ international mobile
- same number in spaced / unspaced forms collapses
- different AU mobile and landline remain separate

Done criteria:
- AU merge UI no longer shows `Both kept` for local vs `+61` mobile variants
- AU and NZ examples seeded and manually checked on staging

---

## Phase 2 — NANP

Ticket: `P37-03`

Goal: cover North American Numbering Plan countries under a shared ruleset.

Countries and territories:
- United States
- Canada
- Bahamas
- Barbados
- Antigua and Barbuda
- Dominica
- Dominican Republic
- Grenada
- Jamaica
- Saint Kitts and Nevis
- Saint Lucia
- Saint Vincent and the Grenadines
- Trinidad and Tobago
- Belize
- Bermuda
- Cayman Islands
- Turks and Caicos Islands
- British Virgin Islands
- US Virgin Islands
- Puerto Rico
- Anguilla
- Montserrat
- Sint Maarten
- Guam
- Northern Mariana Islands
- American Samoa

Rules to support:
- `+1` canonicalization
- 10-digit local forms to NANP canonical form
- 11-digit `1xxxxxxxxxx` handling
- shared display formatting for NANP
- likely non-geographic conflict handling kept conservative

Test cases:
- `(415) 555-2671` == `+1 415 555 2671`
- `14155552671` == `+1 415 555 2671`
- two different NANP numbers do not collide on last-10 heuristics

Done criteria:
- US/CA duplicates use canonical NANP behavior end-to-end
- no last-10-only fallback is used as merge truth for NANP

---

## Phase 3 — UK and Ireland

Ticket: `P37-04`

Goal: cover the most common UK/Ireland local-vs-international mismatches.

Countries and territories:
- United Kingdom
- Ireland
- Isle of Man
- Jersey
- Guernsey

Rules to support:
- `0` trunk handling for local forms
- `07...` UK mobile to `+44 7...`
- UK landline prefixes normalized to `+44`
- Ireland local-to-international canonicalization
- display style for UK/Ireland mobile and landline formats

Test cases:
- `07700 900111` == `+44 7700 900111`
- `01323 410051` == corresponding `+44` landline
- local Irish mobile == `+353` mobile

Done criteria:
- UK screenshots that previously showed separate numbers collapse correctly
- seeded UK and IE merge cases validated on staging

---

## Phase 4 — Western Europe

Ticket: `P37-05`

Goal: cover the biggest Western European business markets.

Countries:
- Germany
- France
- Netherlands
- Belgium
- Luxembourg
- Switzerland
- Austria
- Monaco
- Liechtenstein

Rules to support:
- local trunk behavior by country
- country-specific national lengths
- mobile vs landline prefix hints where safe
- display preferences for DE/FR/NL/BE style formatting

Test cases:
- German local mobile == `+49` mobile
- French local `06/07` == `+33 6/7`
- Dutch local mobile == `+31` mobile
- landline and mobile do not collapse incorrectly

Done criteria:
- DE/FR screenshots and seeded examples behave consistently in merge review

---

## Phase 5 — Nordics and Baltics

Ticket: `P37-06`

Goal: extend European coverage with simpler but varied numbering plans.

Countries:
- Denmark
- Sweden
- Norway
- Finland
- Iceland
- Estonia
- Latvia
- Lithuania

Rules to support:
- country-specific national lengths
- display formats per country
- conservative type inference where mobile/landline prefixes are known

Test cases:
- local Nordic mobile == international mobile
- Baltic national formats round-trip cleanly
- distinct numbers do not collapse due to loose digit matching

Done criteria:
- at least one verified mobile and one verified landline example per country group

---

## Phase 6 — Southern Europe and Mediterranean Europe

Ticket: `P37-07`

Goal: complete the major Southern European markets and formatting quirks.

Countries:
- Spain
- Portugal
- Italy
- Malta
- San Marino
- Vatican City
- Greece
- Cyprus
- Andorra

Rules to support:
- Spain local mobile and landline canonicalization
- Portugal local mobile and landline canonicalization
- Italy display and trunk-specific edge cases handled carefully
- Greece / Cyprus mobile and fixed-line prefix metadata

Test cases:
- Spanish local mobile == `+34` mobile
- Italian local form normalizes consistently
- two visually similar Southern European numbers stay distinct

Done criteria:
- Southern Europe examples stop surfacing false `Both kept`

---

## Phase 7 — Central Europe, Eastern Europe, and Balkans

Ticket: `P37-08`

Goal: broad regional coverage for imports and business contacts.

Countries:
- Poland
- Czechia
- Slovakia
- Hungary
- Slovenia
- Croatia
- Bosnia and Herzegovina
- Serbia
- Montenegro
- Kosovo
- North Macedonia
- Albania
- Romania
- Bulgaria
- Moldova
- Ukraine
- Belarus
- Russia

Rules to support:
- national length coverage by country
- display formatting per country
- conservative mobile/landline inference only where prefixes are stable

Test cases:
- local forms collapse into canonical international values
- same-number duplicates merge cleanly
- neighboring-country numbers do not collide

Done criteria:
- representative seeded examples checked for at least 6 countries in the phase

---

## Phase 8 — Middle East and North Africa

Ticket: `P37-09`

Goal: support common enterprise and family-contact regions with strong local-format variance.

Countries:
- Turkey
- Israel
- Palestine
- Jordan
- Lebanon
- Syria
- Iraq
- Iran
- Saudi Arabia
- United Arab Emirates
- Qatar
- Bahrain
- Kuwait
- Oman
- Yemen
- Egypt
- Libya
- Tunisia
- Algeria
- Morocco
- Western Sahara
- Mauritania

Rules to support:
- local trunk behavior
- mobile-prefix vs fixed-line hints
- country-specific display grouping
- careful handling of ambiguous local-only forms

Test cases:
- UAE local mobile == `+971` mobile
- Egypt local mobile == `+20` mobile
- Saudi local mobile == `+966` mobile

Done criteria:
- no obvious local/international duplicate drift in seeded MENA cases

---

## Phase 9 — Sub-Saharan Africa

Ticket: `P37-10`

Goal: extend coverage across African numbering plans with a metadata-first approach.

Countries:
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

Rules to support:
- national length metadata per country
- local trunk behavior where relevant
- safe mobile/landline hints for the most stable countries first
- display-only fallback for countries with weak prefix certainty

Test cases:
- Nigeria local mobile == `+234` mobile
- South Africa local mobile and landline normalize correctly
- East African local forms collapse correctly

Done criteria:
- at least the high-volume African countries have proven same-number collapse

---

## Phase 10 — Asia and Latin America / Caribbean non-NANP

Ticket: `P37-11`

Goal: finish world coverage with the largest remaining regional groups.

Countries and territories:
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

Rules to support:
- India local mobile == `+91`
- China local mobile == `+86`
- Japan/Korea domestic-to-international conversion
- Brazil/Mexico display and canonicalization handling
- LATAM mobile vs landline hints where stable

Test cases:
- India local mobile == `+91` mobile
- China mobile local == `+86` mobile
- Brazil local mobile == `+55` mobile
- Mexico local national form == `+52`

Done criteria:
- major Asia and LATAM markets verified
- roadmap can move from phased rollout into maintenance mode

---

## Cross-phase technical tasks

Tickets:
- `P37-01` — shared metadata and normalization foundation
- `P37-12` — recurring QA, seeded datasets, duplicate refresh, and regression coverage

These tasks repeat in every phase and should be tracked explicitly:

| Task | Description |
|---|---|
| Metadata | Add country entries to `phone-country-rules.ts` |
| Canonicalization | Normalize local and international forms to one canonical value |
| Type inference | Infer likely `mobile` / `landline` / `work` where safe |
| Display | Format display values consistently for UI |
| Dedupe | Use canonical values for merge and duplicate detection |
| Review UI | Ensure primary-vs-kept states are clear |
| Seed QA | Add seeded examples for phase countries |
| Refresh | Rebuild duplicate suggestions after seed refresh |

---

## Suggested implementation milestones

Milestone 1:
- Phases 1 to 3
- closes current AU/UK/US-class issues
- enough to stabilize most active QA cases

Milestone 2:
- Phases 4 to 6
- broad Europe coverage

Milestone 3:
- Phases 7 to 10
- full global coverage

---

## Success criteria for the whole initiative

We can call the phone-format issue effectively solved when:
- same numbers no longer survive merges as separate values just because of format
- duplicate suggestions consistently recognize local vs international forms
- merge review clearly distinguishes primary numbers from additional kept numbers
- country-aware labels are reliable enough for UI hints
- seeded staging QA demonstrates stable behavior across all 10 rollout phases
