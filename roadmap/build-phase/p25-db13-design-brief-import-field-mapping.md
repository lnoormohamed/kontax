# P25-DB13 — Design Brief: Import Field Mapping & Suggestions

## Purpose

This brief specifies the design for Phase 25's additions to the import wizard: a new "Map fields" step (between Upload and Preview), the mapping table row anatomy, confidence indicators, "Did you mean?" suggestion chips, the "Create custom field" inline input, and the "Save as preset" prompt on the success screen. It extends the locked `08-import-export.md` design without modifying the Upload, Preview, or Success steps.

## Background

The existing import wizard (`08-import-export.md`) has a 3-step flow: Upload → Preview → Done. Phase 25 inserts a **Step 2: Map fields** between Upload and Preview, making it a 4-step wizard. This brief defines only the new step and its components — the step indicator update, and the preset prompt on the success screen. All other wizard states are unchanged.

The locked design language applies. All new components must feel native to the existing import card (max-width 720px centred, `border-radius: 14px`, white cards, section dividers at `#e9ece7`).

---

## Scope

### In scope

1. Updated 4-step progress indicator
2. Mapping table — full row anatomy
3. Confidence indicator dots (HIGH / MEDIUM / LOW)
4. "Did you mean?" suggestion chips
5. "Create custom field" inline input
6. Multi-value split toggle
7. "Save as preset" prompt on the success screen (Step 4)
8. "Load preset" auto-detection banner

### Out of scope

- The Upload step (Step 1) — unchanged
- The Preview step (Step 3) — unchanged
- The Success step (Step 4) — only the new "Save as preset" addition is in scope
- Export field selection (P25-06 — separate surface)

---

## Design / Implementation Spec

### 1. Updated Step Indicator

The existing 3-step indicator gains a fourth step. All visual properties are unchanged from `08-import-export.md`; only the count changes.

```
  ① Upload file  ──  ② Map fields  ──  ③ Preview  ──  ④ Done
```

- Step ② "Map fields" uses the same active/complete/future states as the existing steps.
- When Step ① is complete: the connecting line between ① and ② turns `#1f8a5b`.
- The "Map fields" label is 14px, bold when active, muted when future.

---

### 2. Mapping Table

The mapping table fills the import card content zone (same padding: `24px 32px`). One row per CSV column.

```
MAP YOUR COLUMNS
─────────────────────────────────────────────────────────────────────────

  Column          Sample value         Maps to            Confidence

  First Name      Jane                 [First name    ▾]  ●●●
  Last Name       Smith                [Last name     ▾]  ●●●
  Email Address   jane@example.com     [Email address ▾]  ●●●
  Tel             +1 555 0100          [Phone         ▾]  ●●
  Company         Acme Corp            [Company       ▾]  ●●●
  ??CRM_Stage??   Prospect             [Select…       ▾]  ○○○
  Internal_ID     C-00123              [⊘ Skip column ▾]  ○○○

─────────────────────────────────────────────────────────────────────────
  [← Back]                                        [Continue →]
```

**Section label:** "MAP YOUR COLUMNS" — `font-size: 11px`, `font-weight: 700`, uppercase, `color: #8b938c`, `letter-spacing: 0.08em`, `margin-bottom: 16px`.

**Table header row:**
- `font-size: 11px`, `font-weight: 700`, uppercase, `color: #8b938c`
- Columns: Column (flex 2), Sample value (flex 2), Maps to (flex 3), Confidence (flex 1)
- Bottom border: `1px solid #e9ece7`
- No outer table border

**Mapping row (standard — HIGH confidence):**
- Height: 52px
- Column name: `font-size: 14px`, `font-weight: 600`, `color: #1d2823`
- Sample value: `font-size: 13px`, `color: #5c655e`, monospace (`Geist Mono`)
- Dropdown: `height: 36px`, `border-radius: 8px`, `border: 1px solid #d8ddd6`, `font-size: 14px`, `color: #1d2823`. Chevron right-aligned. Focus: blue border.
- Row divider: `1px solid #f2f4f0`

**Mapping row (LOW confidence):**
- `background: #fff5f5` (very light red wash)
- `border-left: 3px solid #fca5a5` (red-300)
- Column name in the same style; sample value same
- Dropdown shows "[Select… ▾]" placeholder in `color: #8b938c`

**"Skip column" option in dropdown:**
Styled differently from field options — separated by a divider, `color: #b5472f`, `font-size: 13px`. Icon: `MinusCircle` 14px `color: #b5472f`. When selected, the row's sample value is shown with `text-decoration: line-through`, `color: #d8ddd6`.

---

### 3. Confidence Dots

Three dot indicators shown in the Confidence column for each row.

| Tier | Display | Colour |
|---|---|---|
| HIGH (≥ 0.85) | ●●● | `#1f8a5b` (status green) |
| MEDIUM (0.5–0.85) | ●●○ | `#bf8526` (amber) |
| LOW (< 0.5) | ○○○ | `#b5472f` (red) |

Dot: 8px circle, `display: inline-block`, 4px gap between dots.
- Filled: `background` set to the tier colour
- Empty: `background: #e9ece7`, `border: 1px solid #d8ddd6`

Tooltip on hover (3 dots area): "Detection confidence: HIGH / MEDIUM / LOW". Uses `HelpTooltip` dark popover pattern.

---

### 4. "Did You Mean?" Suggestion Chips

Appears below the dropdown for LOW and MEDIUM confidence rows. Up to 3 chips shown inline; overflow accessible via a `›` button.

```
  ──────────────────────────────────────────────────────────────
  |  💡  Did you mean:   [Job title]  [Company]  [Notes]   ›  |
  ──────────────────────────────────────────────────────────────
```

**Container:** `background: #f9faf8`, `border: 1px solid #e9ece7`, `border-radius: 8px`, `padding: 8px 12px`, `margin-top: -4px` (visually attached below the row).

**Lightbulb icon:** `Lightbulb` Lucide, 14px, `color: #bf8526`. "Did you mean:" label: `font-size: 13px`, `color: #5c655e`.

**Suggestion chip:**
- `background: #ffffff`, `border: 1px solid #d8ddd6`, `border-radius: 999px`, `padding: 3px 12px`, `font-size: 13px`, `color: #1d2823`
- Hover: `background: #e3efe7`, `border-color: #17352e`, `color: #17352e`
- Click: applies the field to the dropdown, shows a brief green flash on the row (`background: #e3efe7`, 600ms transition back to white)

**"›" overflow button:** `font-size: 13px`, `color: #4158f4`. Click opens a popover listing all suggestions (up to 5) ranked by confidence. Each shown with its confidence dot.

---

### 5. "Create Custom Field" Inline Input

Available as the last option in the field dropdown, and as a fallback link below suggestion chips when no suggestions are available.

**In dropdown:** separated by a divider. `font-size: 13px`, `color: #4158f4`, `font-style: italic`, `font-weight: 500`. Icon: `Plus` 14px `color: #4158f4`. Label: "Create custom field…"

**After selecting "Create custom field":** the dropdown closes and is replaced by an inline input:

```
  ??CRM_Stage??   Prospect   [CRM Stage             ] [✓]   ○○○
                              custom field name →
```

- Input: same height/radius as the dropdown (`height: 36px`, `border-radius: 8px`)
- Default value: the column header (trimmed)
- `[✓]` confirm button: 36×36px, `background: #17352e`, white check icon
- Placeholder: "Custom field name"
- `font-size: 14px`
- Error state (duplicate name): red border, "This name is already in use" below the input in `font-size: 12px`, `color: #b5472f`

---

### 6. Multi-Value Split Toggle

Appears below the dropdown for phone and email columns where multi-value cells are detected.

```
  ─────────────────────────────────────────────────────────
  |  🔀  Multiple values detected in this column           |
  |       ☑  Split into separate entries  (÷ "; ")         |
  |       Preview: "+1 555 0100"  and  "+1 555 0200"       |
  ─────────────────────────────────────────────────────────
```

**Container:** same style as the suggestion chips container (`#f9faf8`, border).

- Shuffle icon: `Shuffle` Lucide, 14px, `color: #4158f4`
- "Multiple values detected" label: `font-size: 13px`, `color: #5c655e`
- Checkbox + label row: `font-size: 13px`, `color: #1d2823`. `(÷ ";")` shows the detected delimiter in `Geist Mono`, `color: #8b938c`.
- Preview line: `font-size: 12px`, `color: #8b938c`, `font-style: italic`. Shows the first sample value split.

---

### 7. "Save as Preset" Prompt (Step 4 Success Screen)

Inserted below the success check and contact count, before the "View contacts" and "Undo import" buttons.

```
─────────────────────────────────────────────────────────────────────

  💾  Save this column mapping for future imports?

     Preset name:  [Google Contacts export              ]

     [Save preset]     [Skip]

─────────────────────────────────────────────────────────────────────
```

**Container:** `background: #f9faf8`, `border: 1px solid #e9ece7`, `border-radius: 10px`, `padding: 16px 20px`.

- Save icon: `Save` Lucide, 14px, `color: #4158f4`
- Prompt text: `font-size: 14px`, `color: #5c655e`, `margin-bottom: 12px`
- Name input: `height: 40px`, `border-radius: 10px`, `font-size: 14px`. Default value: filename stem.
- "Save preset": `background: #4158f4`, `color: #fff`, `height: 36px`, `border-radius: 8px`, `font-size: 13px`
- "Skip": `color: #8b938c`, text button, `font-size: 13px`

**Update existing preset state** (same header set already saved):
```
  💾  Update "Google Contacts export" preset?

     ● Update existing preset
     ○ Save as new preset:  [                    ]

     [Update]    [Skip]
```

---

### 8. Preset Auto-Detection Banner

Shown at the top of Step 2 when a matching preset is found for the uploaded file.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✨  We found a saved mapping for this file format                  │
│      "Google Contacts export" (last used 3 days ago)               │
│                                                                     │
│      [Apply saved mapping]              [Map manually]             │
└─────────────────────────────────────────────────────────────────────┘
```

- `background: #f0f9ff` (light blue), `border: 1px solid #bae6fd`, `border-radius: 10px`, `padding: 16px 20px`
- Sparkles icon: `Sparkles` Lucide, 16px, `color: #0284c7`
- Headline: `font-size: 14px`, `font-weight: 600`, `color: #0c4a6e`
- Preset name + date: `font-size: 13px`, `color: #0369a1`
- "Apply saved mapping": `background: #0284c7`, `color: #fff`, `height: 36px`, `border-radius: 8px`, `font-size: 13px`
- "Map manually": `color: #5c655e`, text button

---

## Acceptance Criteria

- Designer can produce the full mapping step without a follow-up meeting.
- The 4-step indicator update is specified.
- All three confidence tiers have distinct visual treatments (dot colours, row background).
- Suggestion chip hover and click states are specified.
- The "Create custom field" inline input (default value, confirm button, error state) is specified.
- The multi-value split toggle and preview line are specified.
- The "Save as preset" prompt (new + update variants) is specified.
- The preset auto-detection banner is specified.
- Large CSV (> 20 columns) handling: note that only LOW/MEDIUM confidence rows are shown by default; a "Show all N columns" toggle reveals HIGH confidence rows.
- Mobile: table rows stack as column-name / sample / dropdown / confidence chips vertically.
