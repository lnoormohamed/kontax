/**
 * P28-01/02 — smart-list filter state.
 *
 * A "smart list" persists the meaningful filter dimensions of the contacts
 * list (the URL query params) so they can be recalled in one click. We capture
 * only the dimensions that change *which* contacts are shown — tab, filter,
 * search query, book, and scope — and deliberately ignore presentation params
 * (`sort`, `view`) so two lists that differ only in sort order are considered
 * the same list.
 *
 * `filterState` is stored as JSON on `SavedFilter`. Unknown keys are ignored on
 * read (P28-01 risk note: old saved filters must survive new filter types), so
 * the shape stays forward-compatible.
 */

export type ContactFilterState = {
  tab?: string;
  filter?: string;
  q?: string;
  book?: string;
  scope?: string;
};

// Values that mean "no filter" — the default People / All view. A state equal to
// the defaults is treated as empty (nothing worth saving / nothing to match).
const DEFAULTS: Record<keyof ContactFilterState, string> = {
  tab: "people",
  filter: "all",
  q: "",
  book: "",
  scope: "all",
};

const KEYS: (keyof ContactFilterState)[] = ["tab", "filter", "q", "book", "scope"];

type ParamGetter = Pick<URLSearchParams, "get"> | Record<string, string | undefined>;

const read = (params: ParamGetter, key: string): string => {
  const raw =
    typeof (params as URLSearchParams).get === "function"
      ? (params as URLSearchParams).get(key)
      : (params as Record<string, string | undefined>)[key];
  return (raw ?? "").trim();
};

/** Build a ContactFilterState from URL params, dropping any default values. */
export function fromParams(params: ParamGetter): ContactFilterState {
  const state: ContactFilterState = {};
  for (const key of KEYS) {
    const value = read(params, key);
    if (value && value !== DEFAULTS[key]) {
      state[key] = value;
    }
  }
  return state;
}

/** Coerce arbitrary JSON (from the DB) into a clean ContactFilterState. */
export function fromJson(value: unknown): ContactFilterState {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const state: ContactFilterState = {};
  for (const key of KEYS) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim() && raw.trim() !== DEFAULTS[key]) {
      state[key] = raw.trim();
    }
  }
  return state;
}

/** Canonical key order, defaults removed — used for equality. */
export function normalise(state: ContactFilterState): ContactFilterState {
  const out: ContactFilterState = {};
  for (const key of KEYS) {
    const value = state[key]?.trim();
    if (value && value !== DEFAULTS[key]) out[key] = value;
  }
  return out;
}

export function isEmpty(state: ContactFilterState): boolean {
  return Object.keys(normalise(state)).length === 0;
}

/** Stable equality between a saved state and the live URL params. */
export function matches(saved: ContactFilterState, params: ParamGetter): boolean {
  const a = normalise(saved);
  const b = normalise(fromParams(params));
  return KEYS.every((key) => (a[key] ?? "") === (b[key] ?? ""));
}

/** Serialise to a query string (no leading `?`) for navigation. */
export function toQueryString(state: ContactFilterState): string {
  const params = new URLSearchParams();
  const n = normalise(state);
  // tab/filter are always present in the app's hrefs; default them so the
  // recalled view lands on a well-formed URL.
  params.set("tab", n.tab ?? DEFAULTS.tab);
  params.set("filter", n.filter ?? DEFAULTS.filter);
  if (n.q) params.set("q", n.q);
  if (n.book) params.set("book", n.book);
  if (n.scope) params.set("scope", n.scope);
  return params.toString();
}

const FILTER_LABELS: Record<string, string> = {
  recent: "Recently updated",
  incomplete: "Missing details",
  favorites: "Favorites",
  emergency: "Emergency",
};

const TAB_LABELS: Record<string, string> = {
  archived: "Archived",
  duplicates: "Duplicates",
};

/**
 * Human-readable chips for the save/summary UI, e.g. [{k:"Search",v:"acme"}].
 * Book names aren't known here, so the caller may resolve `book` to a name.
 */
export function summarise(
  state: ContactFilterState,
  bookName?: (id: string) => string | undefined,
): { k: string; v: string }[] {
  const n = normalise(state);
  const chips: { k: string; v: string }[] = [];
  if (n.tab && TAB_LABELS[n.tab]) chips.push({ k: "View", v: TAB_LABELS[n.tab]! });
  if (n.filter && FILTER_LABELS[n.filter]) chips.push({ k: "Filter", v: FILTER_LABELS[n.filter]! });
  if (n.scope === "private") chips.push({ k: "Scope", v: "Private" });
  if (n.scope === "shared") chips.push({ k: "Scope", v: "Family" });
  if (n.book) chips.push({ k: "Book", v: bookName?.(n.book) ?? "Book" });
  if (n.q) chips.push({ k: "Search", v: n.q });
  return chips;
}
