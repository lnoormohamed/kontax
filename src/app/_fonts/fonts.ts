import localFont from "next/font/local";

// P50-01 · Geist + Geist Mono, self-hosted. The files are Latin subsets
// (Basic Latin, Latin-1, Latin Extended-A, general punctuation, £/€, arrows,
// ✓) cut from the `geist` package with pyftsubset; the sans file is the
// variable font pinned to the 400–700 weight range the site uses. Glyphs
// outside the subset (e.g. contact names in other scripts) fall back to the
// system font per glyph. Licence: OFL-Geist.txt.
//
//   pyftsubset Geist[400-700].ttf --unicodes=<range> --layout-features='*' --flavor=woff2
//   pyftsubset GeistMono-Medium.woff2 --unicodes=<range> --layout-features='*' --flavor=woff2

export const geistSans = localFont({
  src: "./Geist-Latin-Variable.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  variable: "--font-geist-sans",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
});

export const geistMono = localFont({
  src: "./GeistMono-Latin-Medium.woff2",
  weight: "500",
  style: "normal",
  display: "swap",
  variable: "--font-geist-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});
