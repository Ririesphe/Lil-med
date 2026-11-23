// Turns the website catalogue and the admin database rows into the shape the
// duplicate scanner compares. Read-only: products are copied, never changed.

import { products, type Product } from "./products";
import type { DuplicateCandidate } from "../lib/duplicates";
import { supabase, type DbProduct } from "../lib/supabase";

export function catalogueCandidate(p: Product): DuplicateCandidate {
  return {
    key: `catalogue:${p.id}`,
    id: p.id,
    source: "catalogue",
    name: p.name,
    sku: p.sap,
    category: p.category,
    subcategory: p.subcategory,
    image: p.image,
    description: p.description,
    price: p.price,
    specs: p.specs,
  };
}

export function databaseCandidate(p: DbProduct): DuplicateCandidate {
  return {
    key: `database:${p.id}`,
    id: p.id,
    source: "database",
    name: p.name,
    sku: p.sap || "",
    category: p.categories?.name || "",
    subcategory: p.raw_category || "",
    image: p.image_url || "",
    description: p.description || "",
    price: Number(p.price) || 0,
    specs: p.inner_moq ? { "Pack size": p.inner_moq } : undefined,
  };
}

export const catalogueCandidates = (): DuplicateCandidate[] => products.map(catalogueCandidate);

/**
 * Products saved in the admin database, if one is connected. Returns an empty
 * list (rather than failing) when the database is not configured or unreachable.
 */
export async function loadDatabaseCandidates(): Promise<DuplicateCandidate[]> {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return [];
  try {
    const { data, error } = await supabase.from("products").select("*, categories(name)").limit(5000);
    if (error || !data) return [];
    return (data as DbProduct[]).map(databaseCandidate);
  } catch {
    return [];
  }
}

/** Brand from the specification data, if recorded. */
export function candidateBrand(c: DuplicateCandidate): string {
  return c.specs?.Brand || c.specs?.Manufacturer || "";
}

/** Size / capacity from the specification data, if recorded. */
export function candidateSize(c: DuplicateCandidate): string {
  const s = c.specs || {};
  return (
    s["Size / capacity"] ||
    s.Volume ||
    s.Capacity ||
    s.Dimensions ||
    (s.Sizes ? s.Sizes.split(/\n+/).filter(Boolean).join(" · ") : "") ||
    ""
  );
}

/** Pack size from the specification data, if recorded. */
export function candidatePack(c: DuplicateCandidate): string {
  const s = c.specs || {};
  return s["Pack size"] || s.Pack || "";
}

/** Link to the product's page on the website (catalogue products only). */
export function candidateUrl(c: DuplicateCandidate): string | null {
  return c.source === "catalogue" ? `/product/${encodeURIComponent(c.id)}` : null;
}
