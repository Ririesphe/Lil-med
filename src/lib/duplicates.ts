// Duplicate-product detection.
//
// READ-ONLY: everything in this file only compares products and describes what
// it found. Nothing here deletes, merges, archives or edits a product.
//
// How two products are compared
// 1. Names are normalised (case, accents, spacing and punctuation ignored, size
//    notation such as "12x75" / "12 x 75" read the same) and split into words.
//    Word order is ignored. Plural and singular forms count as the same word
//    ("Syringes" = "Syringe"), and a small spelling difference is tolerated in
//    longer words ("Steriliser" ~ "Sterilizer").
// 2. Sizes and quantities in the name ("250ml", "16mm", "100") are compared
//    separately: if both names give a size and the sizes differ, the products
//    are treated as SIZE VARIANTS, not duplicates.
// 3. Other variant signals also stop a pair from being flagged:
//    - different colour or material words in the name (clear / amber, glass / plastic …)
//    - different Brand, Colour, Pack size or Size specification values
//    - different model numbers in the same range (e.g. ABC-20E vs ABC-20V40)
// 4. What is left is flagged as:
//    - EXACT match: the same name once case, spacing, punctuation and word
//      order are ignored, or the same SKU / product code.
//    - POSSIBLE match: names that differ only by plural/singular or a minor
//      spelling difference, where one name contains the other, or names that
//      share almost all of their words.
// 5. Flagged pairs are joined into groups (if A matches B and B matches C, all
//    three are shown together) and every pair records the reasons it was flagged.

import { editDistance, normalizeSearchText } from "./search";

export interface DuplicateCandidate {
  /** Unique key across all sources, e.g. "catalogue:121" or "database:uuid". */
  key: string;
  id: string;
  source: "catalogue" | "database";
  name: string;
  sku?: string;
  category?: string;
  subcategory?: string;
  image?: string;
  description?: string;
  price?: number;
  specs?: Record<string, string>;
}

export type MatchKind = "exact" | "possible";

export interface DuplicatePair {
  a: string;
  b: string;
  kind: MatchKind;
  /** Why the pair was flagged (first entry is the main reason). */
  reasons: string[];
  /** Differences worth checking before deciding (do not stop the flag). */
  notes: string[];
}

export interface VariantPair {
  a: string;
  b: string;
  /** Why the pair was NOT flagged. */
  reasons: string[];
}

export interface DuplicateGroup {
  /** Stable id built from the member keys, so review decisions survive reloads. */
  id: string;
  kind: MatchKind;
  members: string[];
  pairs: DuplicatePair[];
}

export interface DuplicateReport {
  scanned: number;
  groups: DuplicateGroup[];
  /** Products that appear in at least one group. */
  involved: number;
  exactGroups: number;
  possibleGroups: number;
  exactPairs: number;
  possiblePairs: number;
  /** Similar names that were NOT flagged because they look like variants. */
  variants: VariantPair[];
}

// ---------------------------------------------------------------------------
// Word handling

/** Linking words that do not identify a product. */
const STOP_WORDS = new Set(["a", "an", "and", "the", "of", "for", "with", "w", "in", "on", "to", "per", "by", "x"]);

/** Packaging words ("100/Pkt", "BX 1000") describe the pack, not the product. */
const PACK_WORDS = new Set([
  "pkt", "pk", "pack", "packet", "box", "bx", "tray", "case", "ctn", "carton", "pcs", "pc", "piece",
  "each", "ea", "bag", "roll", "unit", "set", "pair",
]);

/** Word classes that describe a variant of the same product rather than a different listing. */
const VARIANT_CLASSES: Record<string, string[]> = {
  colour: [
    "clear", "amber", "white", "black", "red", "blue", "green", "yellow", "orange", "purple", "violet",
    "grey", "gray", "pink", "brown", "natural", "silver", "gold", "transparent", "lavender", "beige", "navy",
  ],
  material: [
    "glass", "plastic", "pp", "ps", "pe", "pet", "hdpe", "ldpe", "pvc", "vinyl", "latex", "nitrile",
    "polypropylene", "polystyrene", "polyethylene", "borosilicate", "stainless", "steel", "paper", "cotton",
    "rubber", "silicone", "aluminium", "aluminum", "wood", "wooden", "foam", "fabric", "nylon",
  ],
  sterility: ["sterile", "nonsterile", "unsterile"],
  person: ["adult", "paediatric", "pediatric", "child", "children", "infant", "neonatal", "junior"],
  size: ["small", "medium", "large", "xl", "xxl", "xs", "mini", "micro", "jumbo", "standard"],
  side: ["left", "right", "single", "double", "twin", "triple"],
  phase: ["manual", "automatic", "auto", "electric", "electronic", "digital", "analogue", "analog"],
};
const VARIANT_CLASS_OF = new Map<string, string>();
for (const [cls, words] of Object.entries(VARIANT_CLASSES)) for (const w of words) VARIANT_CLASS_OF.set(w, cls);

const UNIT = "ml|ul|µl|l|lt|ltr|ltrs|litre|litres|liter|liters|mm|cm|m|g|gm|kg|mg|cc|oz|gal|ply|pcs|pc|mic|micron|g|ga|inch|in";

function singular(word: string): string {
  if (word.length < 4 || /\d/.test(word) || !word.endsWith("s") || word.endsWith("ss") || word.endsWith("us")) return word;
  if (/(ch|sh|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  return word.slice(0, -1);
}

interface Prepared {
  c: DuplicateCandidate;
  /** Normalised name (without the product's own code). */
  norm: string;
  /** The name contained the product's own code, which was removed for comparison. */
  codeInName: boolean;
  /** Sorted words of the name, unchanged — used for the exact test. */
  exactKey: string;
  /** Name words without numbers or stop words, singular form. */
  words: string[];
  /** Sizes / numbers from the name ("250ml", "16mm", "100"). */
  measures: string[];
  /** Variant words found in the name, by class. */
  variantWords: Map<string, Set<string>>;
  /** Name words before singular/plural handling, sorted — tells "plural only" apart from spelling. */
  rawKey: string;
  /** Main product noun: last word of the name before "with / for", brackets or " - ", skipping colour/material words. */
  head: string;
  /** Words inside brackets or after " - " ("(EDTA Tube)", "- Filtered"). */
  qualifier: string[];
  /** Words after "with" ("Caps with Septa" -> septa). */
  withWords: Set<string>;
  topCategory: string;
  skus: string[];
  brand: string;
  colour: string;
  pack: string;
  size: string;
  description: string;
}

const clean = (v: string | undefined | null) =>
  normalizeSearchText(prepareSizes(v || ""))
    .split(" ")
    .map(singular)
    .join(" ")
    .replace(/(\d) (ml|ul|l|lt|ltr|mm|cm|m|g|kg|mg|ply)\b/g, "$1$2")
    .replace(/(\d+)(?:lt|ltr)\b/g, "$1l");

interface Parsed {
  words: string[];
  raw: string[];
  measures: string[];
  withWords: string[];
  headCandidates: string[];
}

/** Keep decimal sizes together ("0.5ml" stays one size) and read µl / μl as ul. */
function prepareSizes(text: string): string {
  return text.replace(/[µμ]/g, "u").replace(/(\d)[.,](\d)/g, "$1dot$2");
}

/** Readable size for reasons shown to the admin ("0dot5ml" -> "0.5ml"). */
const showSize = (m: string) => m.replace(/(\d)dot(\d)/g, "$1.$2");

function parseWords(text: string): Parsed {
  const norm = normalizeSearchText(prepareSizes(text));
  // Join a number to the unit that follows it: "10 ml" -> "10ml".
  const joined = norm.replace(new RegExp(`(\\d) (${UNIT})\\b`, "g"), "$1$2");
  const out: Parsed = { words: [], raw: [], measures: [], withWords: [], headCandidates: [] };
  let afterLink = false;
  let afterWith = false;
  for (const t of joined ? joined.split(" ") : []) {
    if (/^\d/.test(t)) {
      // Sizes and quantities: "250ml", "16mm", "100". Codes like "GL45" stay words.
      out.measures.push(t.replace(/^(\d+)(?:ltrs?|litres?|liters?|lt)$/, "$1l"));
      continue;
    }
    if (STOP_WORDS.has(t)) {
      if (["with", "w", "for", "in"].includes(t)) afterLink = true;
      if (t === "with" || t === "w") afterWith = true;
      continue;
    }
    if (PACK_WORDS.has(t)) continue;
    const s = singular(t);
    out.words.push(s);
    out.raw.push(t);
    if (afterWith) out.withWords.push(s);
    if (!afterLink && !VARIANT_CLASS_OF.has(s)) out.headCandidates.push(s);
  }
  return out;
}

function prepare(c: DuplicateCandidate): Prepared {
  const specs = c.specs || {};
  const codeSources = [c.sku, specs["Product code"], specs["SKU"], specs["Code"]];
  const skus = Array.from(
    new Set(
      codeSources
        .flatMap((v) => (v || "").split(/\s*(?:\/|,|;|\n)\s*/))
        .map((v) => v.trim().toUpperCase().replace(/\s+/g, ""))
        .filter((v) => v.length >= 2),
    ),
  );

  // Some names start with their own product code ("NP171 Twinsaver Toilet
  // Paper"). The code is compared as a SKU, so take it out of the name.
  let name = c.name || "";
  let codeInName = false;
  for (const code of skus) {
    const re = new RegExp(`(^|[^A-Za-z0-9])${code.replace(/[^A-Z0-9]/g, "[^A-Za-z0-9]?")}(?=$|[^A-Za-z0-9])`, "i");
    if (code.length >= 4 && /[A-Z]/.test(code) && /\d/.test(code) && re.test(name)) {
      name = name.replace(re, "$1").trim();
      codeInName = true;
    }
  }
  const norm = normalizeSearchText(name);
  // Split off qualifiers: "(EDTA Tube)", " - Stainless Steel", " — Clot Activator".
  const qualifierText: string[] = [];
  const main = name
    .replace(/\(([^)]*)\)/g, (_, q: string) => {
      qualifierText.push(q);
      return " ";
    })
    .replace(/\s[-–—]\s(.*)$/, (_, q: string) => {
      qualifierText.push(q);
      return " ";
    });
  const all = parseWords(name);
  const mainParsed = parseWords(main);
  const qualifier = Array.from(new Set(parseWords(qualifierText.join(" ")).words)).sort();
  const words = all.words;
  const measures = all.measures;
  const tokens = norm ? norm.split(" ") : [];
  const head =
    mainParsed.headCandidates[mainParsed.headCandidates.length - 1] ||
    all.headCandidates[all.headCandidates.length - 1] ||
    words[words.length - 1] ||
    "";

  const variantWords = new Map<string, Set<string>>();
  for (const w of words) {
    const cls = VARIANT_CLASS_OF.get(w);
    if (!cls) continue;
    if (!variantWords.has(cls)) variantWords.set(cls, new Set());
    variantWords.get(cls)!.add(w);
  }

  return {
    c,
    norm,
    codeInName,
    exactKey: [...tokens].sort().join(" "),
    rawKey: Array.from(new Set(all.raw)).sort().join(" "),
    words: Array.from(new Set(words)),
    qualifier,
    withWords: new Set(all.withWords),
    topCategory: clean(c.category),
    measures: Array.from(new Set(measures)).sort(),
    variantWords,
    head,
    skus,
    brand: clean(specs.Brand || specs.Manufacturer),
    colour: clean(specs.Colour || specs.Color),
    pack: clean(specs["Pack size"] || specs.Pack || specs["Packing"]),
    size: clean(specs["Size / capacity"] || specs.Volume || specs.Capacity || specs.Dimensions),
    description: clean(c.description),
  };
}

/** Same word, or the same apart from a small spelling difference. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false; // codes must match exactly
  const shorter = Math.min(a.length, b.length);
  if (shorter < 5) return false;
  const max = shorter >= 9 ? 2 : 1;
  return editDistance(a, b, max) <= max;
}

/** Number of words in `small` that have a matching word in `big` (each used once). */
function matchedWords(small: string[], big: string[]): { matched: number; spelling: boolean } {
  const used = new Set<number>();
  let matched = 0;
  let spelling = false;
  for (const w of small) {
    let idx = big.findIndex((b, i) => !used.has(i) && b === w);
    if (idx < 0) {
      idx = big.findIndex((b, i) => !used.has(i) && sameWord(w, b));
      if (idx >= 0) spelling = true;
    }
    if (idx >= 0) {
      used.add(idx);
      matched++;
    }
  }
  return { matched, spelling };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Leading letters + digits of a code with its final distinguishing part removed ("BDF-20V40" -> "BDF-20"). */
function codePrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(0, i);
}

/**
 * Two different model numbers from the same range: they share a prefix and
 * the parts that differ both contain letters (BDF-20E vs BDF-20V40). Plain
 * catalogue numbers that only differ in digits (LM-B2-259 vs LM-B2-286) are
 * NOT treated as model variants.
 */
function modelVariant(a: string[], b: string[]): [string, string] | null {
  for (const x of a) {
    for (const y of b) {
      if (x === y) continue;
      const prefix = codePrefix(x, y);
      if (prefix.replace(/[^A-Z0-9]/g, "").length < 3) continue;
      const restA = x.slice(prefix.length);
      const restB = y.slice(prefix.length);
      if (/[A-Z]/.test(restA) && /[A-Z]/.test(restB)) return [x, y];
    }
  }
  return null;
}

function describeVariantWords(a: Prepared, b: Prepared): string[] {
  const out: string[] = [];
  for (const [cls, wordsA] of a.variantWords) {
    const wordsB = b.variantWords.get(cls);
    if (!wordsB) continue;
    const onlyA = [...wordsA].filter((w) => !wordsB.has(w));
    const onlyB = [...wordsB].filter((w) => !wordsA.has(w));
    if (onlyA.length && onlyB.length) {
      out.push(`Different ${cls === "person" ? "patient type" : cls === "phase" ? "operation" : cls}: ${onlyA.join(", ")} vs ${onlyB.join(", ")}`);
    }
  }
  return out;
}

type NameMatch = { kind: MatchKind; reason: string } | { variant: string } | null;

function compareNames(a: Prepared, b: Prepared): NameMatch {
  const sameName = !!a.norm && a.norm === b.norm;
  if ((sameName || (a.exactKey && a.exactKey === b.exactKey)) && (a.codeInName || b.codeInName)) {
    return { kind: "possible", reason: "Same name apart from the product code written in the name" };
  }
  if (sameName) return { kind: "exact", reason: "Same name (ignoring case, spacing and punctuation)" };
  if (a.exactKey && a.exactKey === b.exactKey) return { kind: "exact", reason: "Same name in a different word order" };

  const A = a.words;
  const B = b.words;
  if (A.length === 0 || B.length === 0) return null;
  const smallP = A.length <= B.length ? a : b;
  const bigP = smallP === a ? b : a;
  const small = smallP.words;
  const big = bigP.words;
  const { matched, spelling } = matchedWords(small, big);
  if (matched < small.length) return null; // a word of the shorter name is missing from the longer one

  // Same words (after plural / spelling allowance).
  if (small.length === big.length) {
    if (spelling) return { kind: "possible", reason: "Same name apart from a minor spelling difference" };
    if (a.rawKey !== b.rawKey) return { kind: "possible", reason: "Same name apart from singular / plural or a repeated word" };
    return { kind: "possible", reason: "Same name apart from punctuation or how a unit is written (e.g. µl / ul)" };
  }

  // One name contains the other ("Syringes" vs "Disposable Syringe"): one extra
  // word at most, and both must be the same kind of product (same main noun).
  if (big.length - small.length > 1) return null;
  if (!sameWord(smallP.head, bigP.head)) return null;
  // A one-word name ("Autoclave") only counts within the same main category,
  // unless one product has no category yet (e.g. a product being created).
  if (small.length === 1 && smallP.topCategory && bigP.topCategory && smallP.topCategory !== bigP.topCategory) return null;
  const extras = big.filter((w) => !small.some((x) => sameWord(x, w)));
  if (extras.length && extras.every((w) => bigP.withWords.has(w))) {
    return { variant: `Different configuration: one is "with ${extras.join(" ")}"` };
  }
  return {
    kind: "possible",
    reason: `One name contains the other ("${smallP.c.name.trim()}" is part of "${bigP.c.name.trim()}")`,
  };
}

function compare(a: Prepared, b: Prepared): { pair?: DuplicatePair; variant?: VariantPair } {
  const sharedSku = a.skus.find((s) => b.skus.includes(s));
  const nameResult = compareNames(a, b);
  if (!nameResult && !sharedSku) return {};
  const name = nameResult && "kind" in nameResult ? nameResult : null;

  // ---- Variant checks: any of these means "related product, not a duplicate".
  const variantReasons: string[] = [];
  if (nameResult && "variant" in nameResult) variantReasons.push(nameResult.variant);
  if (a.qualifier.length && b.qualifier.length && !sameSet(a.qualifier, b.qualifier)) {
    variantReasons.push(`Different type: ${a.qualifier.join(" ")} vs ${b.qualifier.join(" ")}`);
  }
  if (a.measures.length && b.measures.length && !sameSet(a.measures, b.measures)) {
    variantReasons.push(`Different size in name: ${a.measures.map(showSize).join(" ")} vs ${b.measures.map(showSize).join(" ")}`);
  }
  variantReasons.push(...describeVariantWords(a, b));
  if (a.brand && b.brand && a.brand !== b.brand) variantReasons.push(`Different brand: ${a.c.specs?.Brand ?? a.brand} vs ${b.c.specs?.Brand ?? b.brand}`);
  if (a.colour && b.colour && a.colour !== b.colour) variantReasons.push(`Different colour: ${a.colour} vs ${b.colour}`);
  if (a.pack && b.pack && a.pack !== b.pack) variantReasons.push(`Different packaging: ${a.pack} vs ${b.pack}`);
  const overlapNotes: string[] = [];
  if (a.size && b.size && a.size !== b.size) {
    // "100 ml, 250 ml, 500 ml" already includes "250 ml": the general listing
    // offers this size, which is an overlap rather than a separate variant.
    const [wide, narrow] = a.size.length >= b.size.length ? [a, b] : [b, a];
    if (` ${wide.size} `.includes(` ${narrow.size} `)) {
      overlapNotes.push(`"${wide.c.name.trim()}" already offers the size of "${narrow.c.name.trim()}" (${narrow.size})`);
    } else {
      variantReasons.push(`Different size: ${a.size} vs ${b.size}`);
    }
  }
  if (!sharedSku) {
    const model = modelVariant(a.skus, b.skus);
    if (model) variantReasons.push(`Different model number: ${model[0]} vs ${model[1]}`);
  }

  if (variantReasons.length) {
    // A shared SKU with an otherwise different listing is still worth showing.
    if (!sharedSku) return { variant: { a: a.c.key, b: b.c.key, reasons: variantReasons } };
  }

  const reasons: string[] = [];
  let kind: MatchKind = name?.kind ?? "possible";
  if (name) reasons.push(name.reason);
  if (sharedSku) {
    reasons.unshift(`Same SKU / product code: ${sharedSku}`);
    if (name?.kind === "exact" || a.skus.length === 1 && b.skus.length === 1) kind = "exact";
  }

  // ---- Supporting evidence and things to check.
  const notes: string[] = [];
  reasons.push(...overlapNotes);
  if (a.c.image && a.c.image === b.c.image) reasons.push("Same product image");
  if (a.description && a.description.length > 20 && a.description === b.description) reasons.push("Same description");
  const catA = [a.c.category, a.c.subcategory].filter(Boolean).join(" › ");
  const catB = [b.c.category, b.c.subcategory].filter(Boolean).join(" › ");
  if (catA && catB && catA !== catB) notes.push(`Listed in different categories: ${catA} / ${catB}`);
  else if (catA && catA === catB) reasons.push("Same category");
  const skuA = a.skus.join(" / ");
  const skuB = b.skus.join(" / ");
  if (skuA && skuB && !sharedSku) notes.push(`Different SKUs: ${skuA} vs ${skuB}`);
  if (!!a.measures.length !== !!b.measures.length) notes.push("Only one name states a size — check whether one listing covers several sizes");
  if (a.c.source !== b.c.source) notes.push("One product is from the website catalogue, the other from the admin database");
  notes.push(...variantReasons); // only reached when the SKU is shared

  return { pair: { a: a.c.key, b: b.c.key, kind, reasons, notes } };
}

// ---------------------------------------------------------------------------

function groupId(members: string[]): string {
  return [...members].sort().join("|");
}

/**
 * Scan every product and return groups of possible duplicates.
 * Pure function: the input array and its products are never modified.
 */
export function findDuplicates(candidates: DuplicateCandidate[]): DuplicateReport {
  const prepared = candidates.map(prepare);
  const pairs: DuplicatePair[] = [];
  const variants: VariantPair[] = [];

  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const r = compare(prepared[i], prepared[j]);
      if (r.pair) pairs.push(r.pair);
      else if (r.variant) variants.push(r.variant);
    }
  }

  // Union-find over flagged pairs.
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let root = k;
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(k, root);
    return root;
  };
  for (const p of pairs) {
    if (!parent.has(p.a)) parent.set(p.a, p.a);
    if (!parent.has(p.b)) parent.set(p.b, p.b);
    const ra = find(p.a);
    const rb = find(p.b);
    if (ra !== rb) parent.set(rb, ra);
  }

  const order = new Map(candidates.map((c, i) => [c.key, i]));
  const byRoot = new Map<string, DuplicateGroup>();
  for (const p of pairs) {
    const root = find(p.a);
    let g = byRoot.get(root);
    if (!g) {
      g = { id: "", kind: "exact", members: [], pairs: [] };
      byRoot.set(root, g);
    }
    g.pairs.push(p);
    for (const k of [p.a, p.b]) if (!g.members.includes(k)) g.members.push(k);
  }

  const groups = Array.from(byRoot.values()).map((g) => {
    g.members.sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0));
    g.id = groupId(g.members);
    g.kind = g.pairs.every((p) => p.kind === "exact") ? "exact" : "possible";
    return g;
  });
  groups.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "exact" ? -1 : 1) || (order.get(x.members[0]) ?? 0) - (order.get(y.members[0]) ?? 0));

  const involved = new Set(groups.flatMap((g) => g.members)).size;
  return {
    scanned: candidates.length,
    groups,
    involved,
    exactGroups: groups.filter((g) => g.kind === "exact").length,
    possibleGroups: groups.filter((g) => g.kind === "possible").length,
    exactPairs: pairs.filter((p) => p.kind === "exact").length,
    possiblePairs: pairs.filter((p) => p.kind === "possible").length,
    variants,
  };
}

/**
 * Products that look like duplicates of a product that is about to be created
 * or imported. Uses the same rules as the full scan.
 */
export function findMatchesFor(newProduct: Omit<DuplicateCandidate, "key"> & { key?: string }, existing: DuplicateCandidate[]): DuplicatePair[] {
  const target = prepare({ ...newProduct, key: newProduct.key || "new:product" } as DuplicateCandidate);
  const out: DuplicatePair[] = [];
  for (const c of existing) {
    if (c.key === target.c.key) continue;
    const r = compare(target, prepare(c));
    if (r.pair) out.push(r.pair);
  }
  return out.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "exact" ? -1 : 1));
}
