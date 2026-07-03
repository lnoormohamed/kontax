# Kontax — Brand Assets Design Brief

## Product

**Name:** Kontax
**URL:** getkontax.com
**Tagline:** Your contacts, beautifully organised.
**Description:** A clean, minimal contact management app for individuals and teams.

---

## Brand Colours

| Role | Hex |
|---|---|
| Primary (dark forest green) | `#17352e` |
| Dark surface | `#1d2823` |
| Muted / secondary text | `#8b938c` |
| Background | `#ffffff` |

---

## Assets Required

### 1. Favicon
- **File:** `favicon.ico`
- **Size:** 48×48px
- Must work on both white and dark backgrounds

### 2. PWA Icons
Used when the app is installed on a phone or desktop home screen.

| File | Size | Purpose |
|---|---|---|
| `icon-192.png` | 192×192px | Standard icon (`purpose: any`) |
| `icon-512.png` | 512×512px | Maskable icon (`purpose: maskable`) |

For the maskable icon: keep the logo centred within the inner 80% of the canvas (the safe zone). The outer 20% may be cropped into a circle or squircle on Android — nothing important should sit outside the safe zone.

### 3. Apple Touch Icon
- **File:** `apple-touch-icon.png`
- **Size:** 180×180px
- No transparency — use a solid background (`#ffffff` or `#17352e`)
- Used when the app is saved to an iPhone home screen

### 4. Open Graph Image
Shown as the preview image when a getkontax.com link is shared on Slack, iMessage, Twitter/X, LinkedIn, etc.

- **File:** `opengraph-image.png`
- **Size:** 1200×630px
- **Background:** `#17352e`
- Should show the Kontax logo/wordmark and tagline
- Reference the current generated placeholder at `https://getkontax.com/opengraph-image`

### 5. Social Avatar *(optional)*
For Twitter/X, LinkedIn, and App Store use.

- **File:** `avatar.png`
- **Size:** 400×400px square
- Solid background, logo centred

---

## Style Notes

- The app UI is clean, minimal, and typographic — avoid gradients, drop shadows, or decorative flourishes
- The icon should be immediately recognisable at 48px — a simple monogram or abstract mark works better than a detailed illustration at small sizes
- Stick to the brand colour palette above; do not introduce new colours

---

## Deliverables

- PNG exports at each size listed above
- Source file in Figma (preferred) or Sketch
- All assets exported at 1× (no `@2x` suffix needed — sizes above are final pixel dimensions)
