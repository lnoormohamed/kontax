# P37-01 — Phone-country metadata foundation

**Status:** Ready for implementation planning.
Builds the shared base layer for all later phone-country rollout phases.

This ticket is the foundation for `P37-02` through `P37-11`.

---

## 1. Why this exists

Kontax currently has a shared phone-normalization layer, but it still relies too much
on hand-written heuristics and generic digit matching. That causes several classes of
bugs:

1. The same number is sometimes preserved twice because local and international forms
   are not collapsed.
2. Quick-merge preview can incorrectly show `Both kept` when the values are really the
   same number.
3. Merge review can ask users to choose between two formats of the same number instead
   of choosing the primary display value.
4. Number type hints such as `mobile` vs `landline` are inconsistent or unavailable.

`P37-01` creates the data model and shared utilities that let all later country phases
plug into one consistent normalization system.

---

## 2. Objective

Introduce a single source of truth for phone-number country behavior:

- country metadata table
- shared lookup utilities
- normalization flow that can consume metadata
- number-type inference hooks
- display-format preference hooks

This ticket does **not** aim to solve every country immediately. It creates the system
that the later phases populate.

---

## 3. Deliverables

### 3.1 New metadata module

Add a shared module, expected shape:

- `src/lib/phone-country-rules.ts`

This should export:

- a typed country-rule table
- lookup by ISO country code
- lookup by calling code
- helper utilities for:
  - stripping trunk prefixes
  - classifying likely number type
  - choosing display labels

### 3.2 Shared types

Create explicit types for:

```ts
type PhoneNumberType = "mobile" | "landline" | "unknown";

type PhoneCountryRule = {
  iso2: string;
  callingCode: string;
  trunkPrefix?: string;
  nationalLengths: number[];
  mobilePrefixes?: string[];
  landlinePrefixes?: string[];
  preferredInternationalGrouping?: number[];
  preferredNationalGrouping?: number[];
  labels?: {
    mobile?: string;
    landline?: string;
  };
  examples?: {
    mobile?: string;
    landline?: string;
  };
};
```

The exact shape can evolve slightly during implementation, but the table must support:

- canonicalization
- display formatting
- type inference
- merge UI explanations

### 3.3 Refactor `phone-normalization.ts`

Refactor:

- [src/lib/phone-normalization.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/phone-normalization.ts)

So it no longer hardcodes country behavior inline as the main strategy.

Instead:

1. parse raw input into candidate parts
2. determine likely country context
3. apply metadata-table rules
4. emit canonical value
5. emit display forms
6. emit likely type

At the end of `P37-01`, the code should already be structured to support country-phase
drop-ins without further architectural rewrites.

### 3.4 Extend normalized output shape

The normalized phone candidate / stored phone entry model should support:

- canonical `e164`
- `countryCode`
- `callingCode`
- `displayInternational`
- `displayNational`
- `numberType`
- `validationStatus`

Example:

```ts
type StoredPhoneEntry = {
  label: string;
  value: string;
  isPrimary: boolean;
  e164?: string | null;
  countryCode?: string | null;
  callingCode?: string | null;
  displayInternational?: string | null;
  displayNational?: string | null;
  numberType?: "mobile" | "landline" | "unknown";
  validationStatus?: "valid" | "possible" | "invalid";
};
```

### 3.5 Shared comparison helpers

Add or refactor helpers so all phone-equality checks depend on the same logic:

- exact canonical identity
- weaker same-number fallback where canonicalization is incomplete
- same-number-but-different-format detection

These helpers must become the shared basis for:

- duplicate detection
- merge preview
- merge review
- union collapse

---

## 4. Explicit non-goals

`P37-01` should **not**:

- add every country in the world
- promise perfect global parsing
- redesign the merge UI beyond what is needed for new metadata fields
- change unrelated contact storage models

Those belong to later country rollout tickets.

---

## 5. Minimum country coverage in this foundation ticket

Even though this is a foundation ticket, it needs a few real rules so the architecture
is proven.

Minimum required seeded rules:

- `AU`
- `GB`
- `US`
- `CA`

Optional if low-effort:

- `NZ`
- `IE`

Reason:
- these give immediate coverage for the bugs already seen
- they prove trunk-prefix handling
- they prove shared calling-code families

---

## 6. File-level scope

Expected files to touch:

- [src/lib/phone-country-rules.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/phone-country-rules.ts) — new
- [src/lib/phone-normalization.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/phone-normalization.ts)
- [src/lib/duplicate-signals.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/duplicate-signals.ts)
- [src/server/contact-merge.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/server/contact-merge.ts)

Possible later follow-through in same ticket only if needed:

- [src/app/_components/merge-review.tsx](/Users/lnoormohamed/ChatGPT/Kontax/src/app/_components/merge-review.tsx)
- [src/app/_components/merge-suggestion-card.tsx](/Users/lnoormohamed/ChatGPT/Kontax/src/app/_components/merge-suggestion-card.tsx)

UI files should only change if the new metadata enables clearer labels such as
`mobile`, `landline`, or improved same-number handling.

---

## 7. Suggested implementation order

1. Add `PhoneCountryRule` type and metadata module.
2. Seed the table with AU, GB, US, and CA.
3. Refactor `normalizePhoneCandidate()` to consume the metadata table.
4. Add `numberType` inference.
5. Replace direct country-specific branching in `phone-normalization.ts` with metadata lookup.
6. Update duplicate matching helpers to use canonical identity first.
7. Update merge preview helpers to collapse same-number variants.
8. Wire new metadata into UI labels only if needed.

---

## 8. Test matrix

### 8.1 Canonicalization tests

Required examples:

- AU mobile:
  - `0410 000 083`
  - `+61 410 000 083`
  - must collapse to one canonical value

- AU landline:
  - `02 9000 1234`
  - `+61 2 9000 1234`

- GB mobile:
  - `07700 900111`
  - `+44 7700 900111`

- GB landline:
  - `01323 410051`
  - corresponding `+44` form

- US/CA:
  - `(415) 555-2671`
  - `4155552671`
  - `+1 415 555 2671`

### 8.2 Type inference tests

Required:

- AU `04...` => likely `mobile`
- AU `02/03/07/08...` => likely `landline`
- GB `07...` => likely `mobile`
- GB `01/02...` => likely `landline`
- US/CA => leave conservative if number-type certainty is weak

### 8.3 Merge behavior tests

Required:

- same number in local/international formats does **not** survive as `Both kept`
- merge review treats it as one primary number, not two distinct saved numbers
- clearly different numbers remain distinct

---

## 9. Acceptance criteria

`P37-01` is done when:

1. Kontax has a dedicated phone-country metadata table.
2. `phone-normalization.ts` consumes that metadata rather than embedding most rules inline.
3. AU, GB, US, and CA work through the new table.
4. Local and international forms of the same number collapse consistently for those countries.
5. Duplicate and merge flows use the same canonicalization logic.
6. Same-number variants no longer show `Both kept` in quick-merge or merge review for seeded countries.
7. The design is ready for later phases to add countries without another structural refactor.

---

## 10. Follow-on tickets unlocked by this work

After `P37-01`, the following tickets become straightforward country-data additions
instead of architecture work:

- `P37-02` — Australia, New Zealand, and Pacific
- `P37-03` — NANP
- `P37-04` — UK and Ireland
- `P37-05` onward — broader international coverage

The core goal of `P37-01` is not “support all countries.” It is: **make supporting all
countries a repeatable, low-risk process.**
