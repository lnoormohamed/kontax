# P10-08 Improved Duplicate Detection Signals

## Purpose
The current duplicate detection engine generates merge suggestions using a set of signals that does not capture common real-world duplicate patterns. Phone numbers formatted differently ("+1 (555) 123-4567" vs "5551234567") are treated as distinct, causing missed duplicates for imported contacts. Contacts at the same company with similar names are not scored higher than contacts sharing a name but with no other connection. Common name variants like "Jon" and "John" are not caught at all. These gaps reduce the practical usefulness of the duplicates tab because users see obvious duplicates that the engine missed. This ticket adds four new signals to the scoring engine, adds transparency via a per-suggestion "why was this suggested?" panel, and introduces auto-staling to prevent outdated suggestions from cluttering the list.

## Background
The MergeSuggestion model stores `confidence` (HIGH/MEDIUM/LOW), `score` (numeric), `signals` (JSON — array of signal contributions), and `reasons` (JSON — human-readable reasons). The scoring engine produces these fields when generating suggestions. The existing signals are not fully documented here, but the engine computes a score and maps it to a confidence level.

The `src/server/phonetics.ts` file (modified, per git status) contains the phonetic matching module. This module is already used by the duplicate engine for some purpose or is being prepared for one. This ticket formalizes its use as a supporting signal.

MergeSuggestion status `STALE` exists in the enum but may not be actively used. This ticket adds the auto-staling logic that marks suggestions as STALE when either contact is updated after the suggestion was generated.

The signal detail panel in the merge review screen (placeholder added by P10-07) needs content from this ticket. P10-08 defines the signal detail data structure and the panel UI.

## Scope

### In Scope
- Normalized phone matching signal (E.164 normalization before comparison)
- Company + name proximity signal
- Shared email domain + similar name signal (LOW confidence only)
- Phonetic name similarity signal using existing `src/server/phonetics.ts` module
- Signal detail panel in the merge review screen: per-signal score breakdown
- Auto-staling: mark STALE and re-queue for regeneration when either contact is updated
- Confidence thresholds review: ensure new signals do not inflate HIGH confidence inappropriately
- Documentation of the scoring algorithm and confidence thresholds

### Out of Scope
- Changing how suggestions are surfaced in the UI beyond the signal detail panel (UI changes owned by P10-05 and P10-04)
- Machine-learning-based scoring (not planned for Phase 10)
- Cross-user duplicate detection
- Matching on fields not currently in the Contact model
- International phone number normalization beyond E.164 (handle the most common formats; expand later)

## Design / Implementation Spec

### Signal Architecture

The scoring engine should be structured as a pipeline of independent signal functions. Each signal function takes two contacts and returns a `SignalResult`:

```typescript
interface SignalResult {
  signal: string;        // Machine-readable signal name, e.g. "phone_normalized_match"
  score: number;         // 0–1 contribution to total score
  weight: number;        // Weight applied to this signal's contribution
  matched: boolean;      // True if the signal fired (found a match)
  detail: string;        // Human-readable detail for the signal panel, e.g. "Phone 555-1234 matches"
  confidence: "strong" | "moderate" | "weak"; // Signal-level confidence (not suggestion-level)
}
```

The total suggestion score is a weighted sum of matched signal scores. The final confidence level (HIGH/MEDIUM/LOW) is computed from the total score and the confidence threshold table.

**Signal weights** (proposed — review and adjust based on testing):

| Signal | Weight | Max score contribution | Notes |
|---|---|---|---|
| Exact name match | 0.35 | 0.35 | Full name exact match |
| Fuzzy name match (existing) | 0.20 | 0.20 | Levenshtein or similar |
| Phonetic name match (new) | 0.10 | 0.10 | Supporting signal only |
| Exact email match | 0.30 | 0.30 | Email address match |
| Normalized phone match (new) | 0.25 | 0.25 | E.164-normalized phone match |
| Company + name proximity (new) | 0.15 | 0.15 | Same company + similar name |
| Shared email domain + similar name (new) | 0.08 | 0.08 | Weak — LOW confidence only |

**Confidence thresholds** (proposed):

| Total score | Confidence |
|---|---|
| ≥ 0.75 | HIGH |
| 0.45–0.74 | MEDIUM |
| 0.20–0.44 | LOW |
| < 0.20 | Not a suggestion (discard) |

The phonetic name match alone (0.10) cannot produce a HIGH confidence suggestion — it requires strong supporting signals. The shared email domain signal alone (0.08) cannot even reach LOW threshold — it requires name similarity to accompany it.

### Signal 1: Normalized Phone Matching

**Implementation file**: `src/lib/duplicates/signals/phone-normalized.ts`

**Goal**: Treat "+1 (555) 123-4567", "5551234567", "+15551234567", and "555-123-4567" as the same phone number.

**Normalization algorithm:**

```typescript
export function normalizePhone(raw: string): string {
  // Step 1: Remove all non-digit characters except leading +
  let stripped = raw.replace(/[^\d+]/g, "");
  
  // Step 2: Handle leading +
  if (stripped.startsWith("+")) {
    // Keep as is — already has country code
    return stripped;
  }
  
  // Step 3: Handle 11-digit numbers starting with 1 (North American)
  if (stripped.length === 11 && stripped.startsWith("1")) {
    return "+" + stripped;
  }
  
  // Step 4: Handle 10-digit North American numbers (assume +1)
  if (stripped.length === 10) {
    return "+1" + stripped;
  }
  
  // Step 5: For other lengths, return the stripped digits
  // (handles 7-digit local numbers and international numbers without + prefix)
  return stripped;
}

export function phonesMatch(a: string, b: string): boolean {
  const normA = normalizePhone(a);
  const normB = normalizePhone(b);
  
  if (normA === normB) return true;
  
  // Handle case where one has country code and the other does not
  // E.g., "+15551234567" vs "5551234567"
  const digitsA = normA.replace(/^\+/, "");
  const digitsB = normB.replace(/^\+/, "");
  
  // If one is a suffix of the other and the suffix starts from 10 digits in
  if (digitsA.endsWith(digitsB) || digitsB.endsWith(digitsA)) {
    const shorter = digitsA.length < digitsB.length ? digitsA : digitsB;
    if (shorter.length >= 7) return true; // Avoid matching very short suffixes
  }
  
  return false;
}
```

**Signal function:**

```typescript
export function phoneNormalizedMatchSignal(
  leftContact: Contact,
  rightContact: Contact
): SignalResult {
  const leftPhones = extractPhoneNumbers(leftContact); // string[]
  const rightPhones = extractPhoneNumbers(rightContact); // string[]
  
  const matchedPairs: string[] = [];
  for (const lp of leftPhones) {
    for (const rp of rightPhones) {
      if (phonesMatch(lp, rp)) {
        matchedPairs.push(lp);
        break;
      }
    }
  }
  
  if (matchedPairs.length === 0) {
    return { signal: "phone_normalized_match", score: 0, weight: 0.25, matched: false, detail: "", confidence: "strong" };
  }
  
  const matchRatio = matchedPairs.length / Math.max(leftPhones.length, rightPhones.length);
  const score = matchRatio >= 0.5 ? 1.0 : 0.7; // Full score if majority match, partial otherwise
  
  return {
    signal: "phone_normalized_match",
    score,
    weight: 0.25,
    matched: true,
    detail: `Phone ${matchedPairs[0]} matches after normalization`,
    confidence: "strong",
  };
}
```

**Limitations and known edge cases:**
- 7-digit local numbers (no area code) are ambiguous — two different contacts with "555-1234" in different cities should not match on phone alone. Weight this less if the phone has fewer than 10 digits.
- International numbers without a country code prefix cannot be reliably normalized. Mark as "uncertain" and only contribute a partial score.
- VoIP numbers, short codes, and toll-free numbers may not normalize correctly. Accept this limitation for Phase 10.

### Signal 2: Company + Name Proximity

**Implementation file**: `src/lib/duplicates/signals/company-name-proximity.ts`

**Goal**: "John Smith at Acme" and "J. Smith, Acme Corp" should score higher than name alone because the combination of same company + similar name is strong circumstantial evidence.

**Algorithm:**

```typescript
export function companyNameProximitySignal(
  leftContact: Contact,
  rightContact: Contact
): SignalResult {
  const leftCompany = leftContact.company?.toLowerCase().trim() ?? "";
  const rightCompany = rightContact.company?.toLowerCase().trim() ?? "";
  
  if (!leftCompany || !rightCompany) {
    return notMatched("company_name_proximity");
  }
  
  // Company name similarity: normalized Levenshtein distance
  const companySimilarity = stringSimilarity(leftCompany, rightCompany);
  
  // Only fire this signal if companies are at least moderately similar
  if (companySimilarity < 0.6) {
    return notMatched("company_name_proximity");
  }
  
  // Name similarity (use existing name similarity function)
  const nameSimilarity = computeNameSimilarity(leftContact, rightContact);
  
  if (nameSimilarity < 0.5) {
    return notMatched("company_name_proximity");
  }
  
  // Combined score: weighted by how similar each is
  const combinedScore = (companySimilarity * 0.5) + (nameSimilarity * 0.5);
  
  return {
    signal: "company_name_proximity",
    score: combinedScore,
    weight: 0.15,
    matched: true,
    detail: `Similar name (${formatName(leftContact)} / ${formatName(rightContact)}) at similar company (${leftContact.company} / ${rightContact.company})`,
    confidence: "moderate",
  };
}
```

**String similarity function**: Use a normalized Levenshtein distance: `1 - (editDistance / maxLength)`. This gives 1.0 for exact match and 0.0 for completely different strings. The `string-similarity` npm package or a custom implementation can be used. Avoid heavy NLP libraries for this purpose.

**"Acme" vs "Acme Corp" handling**: The normalization should strip common company suffixes (Inc, Corp, LLC, Ltd, Co, Company) before comparing:

```typescript
const COMPANY_SUFFIXES = /\b(inc|corp|llc|ltd|co|company|incorporated|limited)\b\.?$/i;

function normalizeCompanyName(name: string): string {
  return name.replace(COMPANY_SUFFIXES, "").trim();
}
```

### Signal 3: Shared Email Domain + Similar Name

**Implementation file**: `src/lib/duplicates/signals/email-domain-name.ts`

**Goal**: "john@acme.com" and "j.smith@acme.com" are a weak signal of the same person, especially when paired with similar names. Must never produce HIGH confidence on its own.

**Algorithm:**

```typescript
export function emailDomainNameSignal(
  leftContact: Contact,
  rightContact: Contact
): SignalResult {
  const leftEmails = extractEmailAddresses(leftContact);
  const rightEmails = extractEmailAddresses(rightContact);
  
  if (!leftEmails.length || !rightEmails.length) {
    return notMatched("email_domain_name");
  }
  
  // Extract domains
  const leftDomains = new Set(leftEmails.map(e => e.split("@")[1]?.toLowerCase()).filter(Boolean));
  const rightDomains = new Set(rightEmails.map(e => e.split("@")[1]?.toLowerCase()).filter(Boolean));
  
  const sharedDomains = [...leftDomains].filter(d => rightDomains.has(d));
  
  if (sharedDomains.length === 0) {
    return notMatched("email_domain_name");
  }
  
  // Exclude common freemail providers — these are not meaningful shared domains
  const FREEMAIL_DOMAINS = new Set([
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com",
    "live.com", "msn.com"
  ]);
  
  const meaningfulDomains = sharedDomains.filter(d => !FREEMAIL_DOMAINS.has(d));
  
  if (meaningfulDomains.length === 0) {
    return notMatched("email_domain_name");
  }
  
  // Require name similarity for this signal to fire
  const nameSimilarity = computeNameSimilarity(leftContact, rightContact);
  if (nameSimilarity < 0.4) {
    return notMatched("email_domain_name");
  }
  
  return {
    signal: "email_domain_name",
    score: 0.5, // Never full score — this is a weak signal
    weight: 0.08,
    matched: true,
    detail: `Both have @${meaningfulDomains[0]} email and similar name`,
    confidence: "weak",
  };
}
```

**Why freemail domains are excluded**: Two contacts both having gmail.com emails tells us nothing about whether they're the same person. Only company/organization domains are meaningful for this signal.

**Confidence cap**: This signal contributes a maximum of `0.5 * 0.08 = 0.04` to the total score. It cannot alone push a suggestion to any confidence tier. It is only useful as a tie-breaker signal alongside other moderate signals.

### Signal 4: Phonetic Name Similarity

**Implementation file**: `src/lib/duplicates/signals/phonetic-name.ts`

**Goal**: "Jon" and "John", "Katherine" and "Catherine", "Steven" and "Stephen" should be recognized as phonetically similar.

**Integration with existing phonetics module:**

The `src/server/phonetics.ts` module already exists. Examine its current API before implementing this signal. If it provides a function that converts a name to a phonetic key (e.g., Soundex, Metaphone, or Double Metaphone), use that directly.

```typescript
import { toPhoneticKey } from "@/server/phonetics";

export function phoneticNameSignal(
  leftContact: Contact,
  rightContact: Contact
): SignalResult {
  // Compare first names phonetically
  const leftFirst = leftContact.firstName ?? extractFirstName(leftContact.fullName);
  const rightFirst = rightContact.firstName ?? extractFirstName(rightContact.fullName);
  
  if (!leftFirst || !rightFirst) {
    return notMatched("phonetic_name");
  }
  
  const leftKey = toPhoneticKey(leftFirst.toLowerCase());
  const rightKey = toPhoneticKey(rightFirst.toLowerCase());
  
  if (!leftKey || !rightKey || leftKey !== rightKey) {
    return notMatched("phonetic_name");
  }
  
  // Also compare last names phonetically if available
  const leftLast = leftContact.lastName ?? extractLastName(leftContact.fullName);
  const rightLast = rightContact.lastName ?? extractLastName(rightContact.fullName);
  
  let score = 0.7; // First name phonetic match alone is moderate
  
  if (leftLast && rightLast) {
    const leftLastKey = toPhoneticKey(leftLast.toLowerCase());
    const rightLastKey = toPhoneticKey(rightLast.toLowerCase());
    if (leftLastKey === rightLastKey) {
      score = 1.0; // Both names match phonetically
    }
  }
  
  return {
    signal: "phonetic_name",
    score,
    weight: 0.10, // Low weight — supporting signal only
    matched: true,
    detail: `Name "${leftFirst}" sounds like "${rightFirst}"`,
    confidence: "moderate",
  };
}
```

**Phonetic algorithm choice**: If `src/server/phonetics.ts` already implements a specific algorithm, use it. If not, implement Double Metaphone, which handles English name variants better than Soundex. Double Metaphone produces two phonetic keys per name (primary and secondary alternative pronunciation) — a match on either key counts as a phonetic match.

**Confidence constraint**: The phonetic signal weight (0.10) ensures that even a full phonetic name match alone scores 0.10, which is below the LOW confidence threshold (0.20). Phonetic matching alone should never produce a suggestion. It should only contribute to a suggestion that already has another signal (email match, phone match, company+name) that crosses the LOW threshold.

**Common phonetic equivalents handled by Double Metaphone:**
- Jon / John (both key to "JN")
- Katherine / Catherine / Kathryn / Katarine
- Steven / Stephen (both key to "STFN" or similar)
- Geoffrey / Jeffrey
- Clare / Claire
- Sara / Sarah
- Marc / Mark

### Auto-Staling Logic

When either contact in a MergeSuggestion is updated after the suggestion was generated, the suggestion's signal data is no longer accurate (the reasons may reference field values that have since changed). Mark the suggestion as STALE and regenerate.

**Trigger point**: In the contact update path (P10-02), after writing the mutation and emitting ActivityEvent, check for open suggestions involving this contact:

```typescript
async function autoStaleContactSuggestions(
  tx: PrismaTransactionClient,
  contactId: string,
  userId: string
): Promise<void> {
  const stalledCount = await tx.mergeSuggestion.updateMany({
    where: {
      userId,
      status: "OPEN",
      OR: [
        { leftContactId: contactId },
        { rightContactId: contactId },
      ],
    },
    data: { status: "STALE" },
  });
  
  if (stalledCount.count > 0) {
    // Enqueue regeneration job for each staled suggestion
    // For Phase 10, re-run scoring synchronously on next request to the duplicates tab
    // For Phase 11+, use a background job queue
    await tx.contact.update({
      where: { id: contactId },
      data: { needsDuplicateRescan: true }, // If such a flag exists
    });
  }
}
```

**Regeneration strategy for Phase 10**: Re-scoring is triggered lazily when the user visits the duplicates tab. Any STALE suggestions are removed from the active list (not shown), and the affected contacts are queued for re-scoring. Re-scoring happens in the background via a lightweight async call after the duplicates tab renders. This avoids blocking the duplicates tab load while keeping stale suggestions out of view.

**What "STALE" means to the UI (P10-05 integration):** STALE suggestions are not shown in the open suggestions list. They are silently removed. The contact may re-appear as a new suggestion after re-scoring, or may not if the update resolved the signal that triggered the suggestion.

**Auto-stale triggers:**
- CONTACT_UPDATED event emitted
- CONTACT_ARCHIVED / CONTACT_RESTORED event emitted
- CONTACT_MERGED event emitted (the absorbed contact's suggestions should be staled — but merging already changes the status to MERGED for the accepted suggestion)

**Do not auto-stale on**: SYNC_PULLED events that bring in no field changes (P10-02 skips the event entirely if no diffs — so this naturally does not trigger auto-staling if implemented correctly).

### Signal Detail Panel

The "Why was this suggested?" expandable section in the merge review screen (placeholder in P10-07) needs a data structure and rendering spec.

**Data structure in MergeSuggestion.signals JSON:**

```typescript
interface SuggestionSignals {
  totalScore: number;
  signals: SignalResult[];
  generatedAt: string; // ISO 8601 — when these signals were computed
}
```

**API change**: The existing endpoint that returns a MergeSuggestion must include the `signals` field in its response. The client can then render the signal detail panel without a separate request.

**Signal panel rendering:**

```
Why was this suggested?
────────────────────────────────────────────────
✓ Phone match          +25 pts   555-1234 matches after normalization
✓ Phonetic name match  +7 pts    "Jon" sounds like "John"
✗ Email match          0 pts     No matching email addresses
✗ Company proximity    0 pts     Different companies
────────────────────────────────────────────────
Total score: 32 pts → MEDIUM confidence
```

**Visual spec:**
- Checkmark icon (green-500) for matched signals, X icon (gray-300) for unmatched
- Score contribution shown as "+N pts" in monospace or tabular number font
- Detail string from `SignalResult.detail`
- Total score line at the bottom with confidence label
- Collapsed by default, expanded on click ("Why was this suggested? ▶" / "▼")

**Engineering note**: If a suggestion was generated before this ticket shipped, it will have an older `signals` JSON structure that may not include the new signal types. Handle gracefully: show only the signals present in the JSON, and show a "Re-score this suggestion" action that triggers a fresh scoring run.

### Scoring Engine Integration

**Location**: `src/lib/duplicates/scoring.ts` (or wherever the existing scoring engine lives)

The scoring engine function signature must be updated to:

```typescript
export interface ScoringResult {
  score: number;
  confidence: MergeSuggestionConfidence;
  signals: SignalResult[];
  reasons: string[]; // Human-readable summary array — preserved for backward compatibility
}

export async function scoreContactPair(
  left: Contact,
  right: Contact
): Promise<ScoringResult | null> {
  // Run all signals
  const signalResults = await Promise.all([
    exactNameMatchSignal(left, right),
    fuzzyNameMatchSignal(left, right),
    phoneticNameSignal(left, right),        // NEW
    exactEmailMatchSignal(left, right),
    phoneNormalizedMatchSignal(left, right), // NEW
    companyNameProximitySignal(left, right), // NEW
    emailDomainNameSignal(left, right),      // NEW
  ]);
  
  // Compute weighted score
  const totalScore = signalResults
    .filter(s => s.matched)
    .reduce((acc, s) => acc + (s.score * s.weight), 0);
  
  // Discard below minimum threshold
  if (totalScore < 0.20) return null;
  
  const confidence = totalScore >= 0.75 ? "HIGH"
    : totalScore >= 0.45 ? "MEDIUM"
    : "LOW";
  
  return {
    score: totalScore,
    confidence,
    signals: signalResults,
    reasons: signalResults
      .filter(s => s.matched)
      .map(s => s.detail),
  };
}
```

### Testing Requirements

**Unit tests** (`src/lib/duplicates/signals/__tests__/`):

- `phone-normalized.test.ts`:
  - "+1 (555) 123-4567" and "5551234567" match
  - "+15551234567" and "555-123-4567" match
  - "555-1234" (7 digits) and "5551234" match
  - "+44 20 7946 0958" and "+442079460958" match
  - "+15551234567" and "+15559876543" do not match
  - Empty strings do not match

- `phonetic-name.test.ts`:
  - "Jon" and "John" match
  - "Katherine" and "Catherine" match
  - "Steven" and "Stephen" match
  - "John" and "Jane" do not match
  - "Smith" and "Smyth" — test whether Double Metaphone considers these equivalent

- `company-name-proximity.test.ts`:
  - "Acme" and "Acme Corp" match (after suffix stripping)
  - "Google" and "Google LLC" match
  - "Microsoft" and "Apple" do not match
  - Null companies do not fire the signal

- `email-domain-name.test.ts`:
  - "@acme.com" shared domain fires the signal (non-freemail)
  - "@gmail.com" shared domain does not fire the signal (freemail)
  - Different domains do not fire the signal

**Integration tests**: Run `scoreContactPair` on realistic contact pair scenarios:
  - Jon Smith (555-1234, jon@acme.com) vs John Smith (555-1234, jsmith@acme.com) → should be HIGH confidence
  - Jane Doe (gmail, no phone) vs Jane Do (gmail, no phone) → should be MEDIUM (name similarity only)
  - Random unrelated contacts → should return null (no suggestion)

## Acceptance Criteria

- Phone normalization correctly treats "+1 (555) 123-4567", "5551234567", and "+15551234567" as matching
- Phone normalization correctly treats "+15551234567" and "+15559876543" as non-matching
- Freemail domains (gmail.com, yahoo.com, etc.) are excluded from the email domain signal
- Phonetic name matching catches "Jon" / "John" and "Katherine" / "Catherine"
- Phonetic name matching alone does not produce a HIGH confidence suggestion
- Company + name proximity fires for "Acme" / "Acme Corp" after suffix stripping
- Company + name proximity does not fire when companies are dissimilar
- Each MergeSuggestion's `signals` JSON is populated with `SignalResult[]` from the new scoring engine
- The signal detail panel in the merge review screen shows each matched signal with its score contribution and detail string
- STALE auto-detection marks suggestions as STALE when either contact is updated
- STALE suggestions are not shown in the active suggestions list
- STALE suggestions are re-scored on the next duplicates tab load
- Scoring engine tests pass for all four new signal types
- Existing suggestions generated before this ticket have graceful handling of missing new signals
- Confidence thresholds prevent any new signal from inflating the HIGH confidence bucket inappropriately
- TypeScript compilation passes with no new errors

## Risks and Open Questions

- **`src/server/phonetics.ts` API stability**: The git status shows this file is modified. The exact API of the phonetics module must be confirmed before implementing `phoneticNameSignal`. If the module's function signature is being changed by concurrent work, coordinate to avoid merge conflicts.
- **Confidence threshold calibration**: The proposed weights and thresholds are starting points. They should be validated against a sample of real user data (anonymized) before shipping. A threshold that is too high misses duplicates; too low floods users with false positives. Plan for a calibration step using the existing contacts dataset.
- **Performance of scoring engine**: Running 7 signals against every contact pair in the suggestion generation sweep is computationally heavier than the previous engine. For users with thousands of contacts, the O(n²) pair comparison is the bottleneck, not the per-pair signal computation. Ensure the suggestion generation process uses pre-filtering (blocking on first-letter match, email domain, or phone suffix) before running the full scoring pipeline.
- **Lazy re-scoring on duplicates tab load**: The auto-stale + lazy re-score approach means the user may see a briefly empty suggestions section if many suggestions are staled at once (e.g., after an import). Consider showing STALE suggestions with a "Refreshing..." indicator rather than hiding them immediately.
- **Double Metaphone dependency**: Adding a phonetic library dependency (e.g., `natural` or `double-metaphone`) adds to the bundle size. If `src/server/phonetics.ts` already implements phonetic keying, use it. If not, evaluate the smallest viable library for Double Metaphone specifically. Alternatively, implement a compact Soundex or Metaphone variant inline without an external library.
- **Company suffix list completeness**: The proposed list (Inc, Corp, LLC, Ltd, Co, Company, Incorporated, Limited) covers North American and UK common suffixes. International equivalents (GmbH, SA, SAS, NV, SpA, AB) are not included. For Phase 10, the list is explicitly North America/UK only — document this limitation.

## Outcome

The duplicate detection engine catches common real-world duplicate patterns (phone formatting variants, name spelling variants, same-company contacts) with transparent signal explanations per suggestion, and keeps the suggestion list fresh by auto-staling whenever a contact is modified.
