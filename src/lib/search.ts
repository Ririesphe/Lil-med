// Shared product search matching used by the storefront and the admin product list.
//
// - Case-insensitive, and accents are ignored ("µL" / "ul" still match by letters).
// - Punctuation and repeated spaces are treated as word breaks, and a size
//   written as "12x75", "12 x 75" or "12*75" is read the same way, so all of
//   them search for the pieces "12" and "75".
// - Word-order independent: every search word must appear somewhere in the
//   searchable fields, in any order ("tube test" finds "Test Tube").
// - Partial words match ("micro" finds "Microcentrifuge").

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
  return normalized ? normalized.split(" ") : [];
}

/**
 * True when every word of the query appears (as a whole or partial word) in at
 * least one of the given fields. A blank query matches everything.
 */
export function matchesSearch(
  query: string,
  fields: Array<string | null | undefined>,
): boolean {
  const terms = searchTerms(query);
  if (terms.length === 0) return true;
  const haystack = ` ${fields
    .filter((f): f is string => typeof f === "string" && f.length > 0)
    .map(normalizeSearchText)
    .join(" ")} `;
  return terms.every((term) => haystack.includes(term));
}
