// P30-01: reserved usernames — system routes, brand protection, common squatting targets.
// Stored and checked lowercase; the availability check normalises before querying this set.
export const RESERVED_USERNAMES = new Set([
  // System routes
  "admin", "api", "app", "auth", "blog", "cron", "dav", "dev", "developers",
  "help", "import", "login", "logout", "onboarding", "pricing", "privacy",
  "register", "reset", "settings", "share", "shares", "signup", "sitemap",
  "support", "terms", "u", "users", "verify",
  // Brand protection
  "kontax", "kontaxapp", "kontax-app", "team", "official", "vexon",
  // Common squatting
  "me", "about", "home", "index", "null", "undefined", "root",
  "contact", "contacts", "anonymous", "deleted", "ghost",
]);

// Simple profanity guard — catches obvious offensive substrings.
// Not exhaustive; the reserved list above handles brand-critical words.
const PROFANITY_FRAGMENTS = [
  "fuck", "shit", "cunt", "nigger", "nigga", "fag", "faggot",
  "asshole", "bitch", "bastard", "whore", "slut", "porn", "sex",
];

export function containsProfanity(username: string): boolean {
  const lower = username.toLowerCase();
  return PROFANITY_FRAGMENTS.some((f) => lower.includes(f));
}
