# P46-20 — Cross-script name matching in duplicate detection

Status: **Built & verified (2026-07-07)** · Priority: P2 · Depends: duplicate-scoring rounds 1–7 (ae53c5a…77e7cc7)

> Verified: 35 scoring unit tests (4 new P46-20 cases) green; both i18n
> staging batches re-graded — 10-language batch unchanged at 0 failures,
> round-1 batch gained two correct new 陈志强↔陳志強 pairs (romanized-name
> +70, no conflict penalty) with zero negative-group leaks. Mixed-format
> names ("Olga Smirnova (Ольга)") romanize with the parenthetical inline
> and only match via identifiers — documented limitation.

Phase: [Phase 46](phase-46-alphabet-scrubber.md) · Spec: follow-on from the 2026-07-06/07 multi-script duplicate hard-tests

The multi-script hardening rounds made name signals *correct* inside each
script (exact matches, conflict penalties, and warnings now work for
Arabic/CJK/Hangul/Cyrillic/Indic/Thai/…), but three duplicate shapes still
only surface when the records happen to share an email or phone:

1. **Simplified ↔ traditional Chinese** — 陈志强 and 陳志強 are the same
   person; no Unicode fold maps between the character sets, so the name
   signals stay silent and a shared identifier currently even draws a
   name-conflict penalty.
2. **Native script ↔ romanized** — 李娜 vs "Li Na", Ольга Смирнова vs
   "Olga Smirnova", タナカ タロウ vs "Tanaka Tarou". Typical after importing
   from a provider that romanizes plus one that doesn't.
3. **Kana ↔ romaji** — covered by the same mechanism as (2).

Both `pinyin-pro` and `transliteration` are already dependencies (the
P46-01 CharRomanization sort-key seeder uses them), so this needs no new
packages and no DB table: romanization can run as a pure function inside
the scorer.

Scope:

1. **`src/lib/name-romanization.ts`** — `romanizedNameKey(fullName)`:
   per-token, Han → toneless pinyin (`pinyin-pro`, handles simplified AND
   traditional), other non-Latin scripts → `transliteration`, Latin kept
   as-is; folded to lowercase a–z tokens. Returns `""` for Latin-only
   input (signal only applies cross-script). Module-level memo cache —
   the scorer is O(n²) pairs but romanization is O(n) contacts.
2. **New supporting signals in `getSignalDetails`** (never hard matches):
   `romanized-name` (+70) when romanized keys are equal and at least one
   side is non-Latin; `romanized-fuzzy-name` (+40) when the romanized keys
   pass the same per-token fuzzy gates as Latin names (covers
   "Tarou"/"Taro" length variants).
3. **Penalty exemption** — `namesGenuinelyDiffer` treats romanized-equal
   names as NOT conflicting, so 陈志强/陳志強 with a shared email stops
   drawing the −40 conflicting-name penalty and returns to high
   confidence.
4. **Known non-goals** — kanji ↔ kana readings (needs a name dictionary;
   pinyin gives Chinese readings for kanji), Arabic vocalized romanization
   (transliteration output is consonantal junk — it simply won't match,
   which fails safe), Korean syllable segmentation ("gimminjun" vs
   "Kim Min-jun"). These continue to surface via shared identifiers only.

Safety bar: romanization must never *create* a false positive that the
in-script logic prevents — 王芳/王磊 ("wang fang"/"wang lei") and
राम/रीमा ("raam"/"riimaa") must stay distinct after romanization, and the
D/negative groups in both staging QA batches (`dupe-qa-i18n`,
`dupe-qa-i18n2`) must stay at zero suggestions.

Acceptance: 陈志强 ↔ 陳志強 with a shared identifier is HIGH with a
"same name across scripts" reason (no conflict penalty); 李娜 ↔ "Li Na"
and Ольга ↔ "Olga Smirnova" pair up at medium+ even with an identifier,
and their conflict penalties disappear; タナカ タロウ ↔ "Tanaka Tarou"
matches via romanized fuzzy; all existing 31 scoring unit tests still
pass; re-grading both i18n staging batches shows cross-script pairs at
≥ their previous scores and zero new negative-group suggestions.
