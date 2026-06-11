// Email visual-language tokens (P20-DB03 / P20-03). Email clients strip external
// CSS and ignore Tailwind, so every email style is an inline value drawn from
// this single source of truth. Mirrors the design kit in the P20-DB03 handoff.

export const tokens = {
  // Core palette
  ink: "#1d2823", // headings, primary body text
  secondary: "#5c655e", // body / descriptive copy
  muted: "#8b938c", // meta, timestamps, footnotes
  hairline: "#d8ddd6", // internal dividers
  blue: "#4158f4", // CTA buttons, links
  red: "#dc2626", // security / destructive labels & buttons
  amber: "#d97706", // warning / payment-failure accents
  green: "#16a34a", // success states (plan upgraded)
  bgPage: "#f4f4f5", // outer email background
  bgCard: "#ffffff", // container background
  bgDetail: "#f4f4f5", // detail-block background
  border: "#e4e4e7", // container border

  // Brand & component extensions (documented in the design's extended palette)
  brand: "#17352e", // wordmark green
  brandTile: "#dff0e7", // wordmark "K" glyph
  footer: "#71717a", // footer text (zinc-500)
  warnBg: "#fffbeb", // warning block background (amber-50)
  warnInk: "#92400e", // warning copy on amber bg (amber-800)

  // Typography
  fontFamily:
    '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
} as const;

export type Tokens = typeof tokens;
