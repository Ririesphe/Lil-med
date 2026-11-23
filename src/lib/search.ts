// Shared product search used by the storefront products page and the admin
// product list.
//
// How a search works
// - Text is normalised: case and accents are ignored, punctuation and repeated
//   spaces become single word breaks, and sizes written "12x75", "12 x 75" or
//   "12*75" are read the same way.
// - The query is split into words. A product matches when EVERY word is found
//   somewhere in its searchable fields, in any order and not necessarily next
//   to each other. A word can match:
//     1. as a whole word        ("tube"    -> "Test Tube")
//     2. as part of a word      ("collect" -> "Collection")
//     3. with a small typo      ("tueb"    -> "Tube", "micros" -> "Microcentrifuge")
//   Typos are only tolerated in words of 4+ letters without digits, so sizes and
//   codes ("10ml", "B1-001") must be typed correctly.
// - Results are ranked: exact product name first, then products where every
//   word is a whole-word match, then partial-word matches, then typo matches.
//   Within each level, matches in the product name rank above matches found
//   only in the description or other fields. Typo matches are used as a
//   fallback: they appear only when nothing matches as typed.

/** Lower-case, strip accents, turn punctuation into spaces and collapse whitespace. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Size notation: "12x75", "12 x 75" and "12*75" all mean the same size.
    .replace(/(\d)\s*[x×]\s*(?=\d)/g, "$1 ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Split a search query into normalized words (empty array for a blank query). */
export function searchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? Array.from(new Set(normalized.split(" "))) : [];
}

type Text = string | null | undefined;

/** Searchable text of one product, split by how strongly a match should count. */
export interface SearchFields {
  /** Product name. */
  name: Text;
  /** Short identifiers: SKU / product code, category, subcategory, brand. Typos tolerated. */
  identifiers?: Text[];
  /** Longer text: descriptions and specification values. Exact / partial words only. */
  details?: Text[];
}

/** Pre-normalised form of a product's fields, so searches stay fast. */
export interface SearchIndex {
  name: string;
  nameWords: string[];
  /** Name + identifiers, used for typo matching. */
  fuzzyWords: string[];
  /** " word word ... " across every field, for whole/partial word checks. */
  allText: string;
  nameText: string;
}

const join = (values: Text[]) =>
  values
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(" ");

export function buildSearchIndex(fields: SearchFields): SearchIndex {
  const name = normalizeSearchText(fields.name || "");
  const ids = join(fields.identifiers || []);
  const details = join(fields.details || []);
  const nameWords = name ? name.split(" ") : [];
  const idWords = ids ? ids.split(" ") : [];
  return {
    name,
    nameWords,
    fuzzyWords: Array.from(new Set([...nameWords, ...idWords])),
    allText: ` ${[name, ids, details].filter(Boolean).join(" ")} `,
    nameText: ` ${name} `,
  };
}

/** Optimal string alignment distance (Levenshtein + adjacent transpositions), with early exit. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[cols - 1];
}

/** How many typos a search word may contain. */
function allowedTypos(term: string): number {
  if (term.length < 4 || /\d/.test(term)) return 0;
  return term.length >= 8 ? 2 : 1;
}

/** True when `term` is a misspelling of `word` or of the start of `word`. */
function fuzzyHit(term: string, word: string, max: number): boolean {
  if (/\d/.test(word)) return false;
  for (let len = term.length - max; len <= term.length + max; len++) {
    if (len < 3 || len > word.length) continue;
    if (editDistance(term, word.slice(0, len), max) <= max) return true;
  }
  return false;
}

// Match levels for a single search word (higher is better).
const WHOLE = 3;
const PARTIAL = 2;
const FUZZY = 1;

function termLevel(term: string, text: string, fuzzyWords: string[]): number {
  if (text.includes(` ${term} `)) return WHOLE;
  if (text.includes(term)) return PARTIAL;
  const max = allowedTypos(term);
  if (max > 0 && fuzzyWords.some((w) => fuzzyHit(term, w, max))) return FUZZY;
  return 0;
}

/**
 * Score a product against a query. 0 means "no match"; higher is a better match.
 * A blank query scores 1 for every product.
 */
export function scoreSearch(query: string, index: SearchIndex): number {
  const terms = searchTerms(query);
  if (terms.length === 0) return 1;

  // 1. Exact product name.
  if (index.name === terms.join(" ") || index.name === normalizeSearchText(query)) return 1000;

  let worst = WHOLE;
  let inName = 0;
  for (const term of terms) {
    const level = termLevel(term, index.allText, index.fuzzyWords);
    if (level === 0) return 0; // every word must match
    if (level < worst) worst = level;
    if (termLevel(term, index.nameText, index.nameWords) > 0) inName++;
  }

  // 2-4. Whole words > partial words > typos; name matches break ties.
  let score = worst * 200;
  score += Math.round((inName / terms.length) * 80);
  const phrase = terms.join(" ");
  if (index.name.startsWith(phrase)) score += 15;
  else if (index.nameText.includes(` ${phrase}`)) score += 10;
  return score;
}

/** Convenience: does the product match at all? */
export function matchesSearch(query: string, fields: SearchFields): boolean {
  return scoreSearch(query, buildSearchIndex(fields)) > 0;
}

/** Lowest score of a match that needed no typo correction. */
const MIN_EXACT_SCORE = PARTIAL * 200;

/**
 * Filter and rank a list. Items keep their original order when the query is
 * blank or when scores tie. Typo-corrected matches are only shown when nothing
 * matches as typed, so a correctly spelled search ("sample cups") is not padded
 * with near-misses ("caps").
 */
export function rankBySearch<T>(
  items: T[],
  query: string,
  getIndex: (item: T) => SearchIndex,
): T[] {
  if (searchTerms(query).length === 0) return items;
  const scored = items
    .map((item, i) => ({ item, i, score: scoreSearch(query, getIndex(item)) }))
    .filter((r) => r.score > 0);
  const hasExact = scored.some((r) => r.score >= MIN_EXACT_SCORE);
  return scored
    .filter((r) => !hasExact || r.score >= MIN_EXACT_SCORE)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.item);
}
