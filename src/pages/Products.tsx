import { useMemo, useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  categories as CATS,
  products as LOCAL,
  formatZAR,
  type Product,
} from "../data/products";
import { useCart } from "../context/CartContext";
import { useLiveProducts } from "../hooks/useProducts";
import { buildSearchIndex, rankBySearch, searchTerms } from "../lib/search";
import AddToQuoteDialog from "../components/AddToQuoteDialog";
import { choiceGroups, variantGroups, type VariantSelection } from "../lib/variants";
import ProductImage from "../components/ProductImage";

const ALL = "All" as const;

// Older catalogue rows that repeat the paediatric tray products.
const repeatedBloodProducts = new Set([
  "disposable blood collection tube (serum clot activator tube)",
  "disposable blood collection tube (serum gel & clot activator tube)",
  "disposable vacuum blood collection tube (edta tube)",
  "disposable vacuum blood collection tube (heparin with separator gel tube)",
  "micro blood collection tubes",
]);

export default function Products() {
  const { items: dbItems } = useLiveProducts();
  const [params, setParams] = useSearchParams();
  const initial = params.get("category");
  const [category, setCategory] = useState<string>(initial ?? ALL);
  const [subCat, setSubCat] = useState<string>("All");
  // Search text and product-type filter live in the address (?q=…&type=…) so
  // they survive opening a product and coming Back, and a page refresh.
  const query = params.get("q") ?? "";
  const rawCat = params.get("type") || "All";
  const location = useLocation();
  const navType = useNavigationType();
  const listKey = `lilmed:products-view:${location.search}`;
  const saved = useRef<{ visible: number; scrollY: number } | null>(null);
  if (saved.current === null) {
    // When coming Back to this exact search, restore how far the visitor had got.
    let s: { visible: number; scrollY: number } | null = null;
    if (navType === "POP") {
      try {
        s = JSON.parse(sessionStorage.getItem(listKey) || "null");
      } catch {
        s = null;
      }
    }
    saved.current = s || { visible: 48, scrollY: 0 };
  }
  const [visible, setVisible] = useState(saved.current.visible);

  /** Update some address parameters, keeping the others; typing replaces the history entry. */
  function writeParams(changes: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "" || v === "All") next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace });
  }
  const setQuery = (v: string) => writeParams({ q: v }, true);
  const setRawCat = (v: string) => writeParams({ type: v }, true);

  useEffect(() => {
    const p = params.get("category");
    if (p) setCategory(p);
    const s = params.get("sub");
    setSubCat(s || "All");
  }, [params]);

  // A new search or filter starts from the top of the list (but not on the
  // first render, which may be restoring a previous view).
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    setVisible(48);
  }, [category, rawCat, subCat, query]);

  // Remember position and "show more" count for this exact search while browsing.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  useEffect(() => {
    const save = () => {
      // The page lingers during the page-change animation: ignore the scroll to
      // the top of the next page so the saved position is not overwritten.
      if (window.location.pathname !== "/products") return;
      try {
        sessionStorage.setItem(listKey, JSON.stringify({ visible: visibleRef.current, scrollY: window.scrollY }));
      } catch {
        /* storage unavailable: nothing to restore later */
      }
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      window.removeEventListener("scroll", save);
    };
  }, [listKey]);

  // Restore the scroll position after the page-change scroll-to-top has run.
  useEffect(() => {
    const y = saved.current?.scrollY || 0;
    if (y <= 0) return;
    // Keep trying for up to 2 seconds while the list renders, and stop as soon
    // as the position is reached or the visitor scrolls themselves.
    const started = Date.now();
    let last = -1;
    let timer = 0;
    const restore = () => {
      if (last >= 0 && Math.abs(window.scrollY - last) > 2) return; // visitor scrolled
      window.scrollTo(0, y);
      last = window.scrollY;
      if (Math.abs(last - y) > 2 && Date.now() - started < 2000) timer = window.setTimeout(restore, 50);
    };
    timer = window.setTimeout(restore, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefer live DB products once seeded. Fallback to local catalog if DB empty.
  const products: Product[] = useMemo(() => {
    const visible = (list: Product[]) =>
      list.filter((p) => !repeatedBloodProducts.has(p.name.trim().toLowerCase()));
    if (dbItems.length === 0) return visible(LOCAL);
    const mapped: Product[] = dbItems.map((p) => ({
      id: p.id,
      sap: p.sap || "",
      name: p.name,
      category: p.categories?.name || "Medical Products",
      rawCategory: p.raw_category || p.categories?.name || "",
      subcategory: p.description || "",
      casePack: "",
      innerMoq: p.inner_moq || "",
      price: Number(p.price) || 0,
      image: p.image_url || "",
      description: p.description || "",
    }));
    // Merge by product name: DB rows win, local-only catalogue items (newly
    // added ranges not yet seeded to the database) stay visible. Keying on the
    // name avoids duplicates because DB rows use generated UUIDs.
    const key = (n: string) => n.trim().toLowerCase();
    const merged = new Map<string, Product>(LOCAL.map((p) => [key(p.name), p]));
    mapped.forEach((p) => merged.set(key(p.name), { ...merged.get(key(p.name)), ...p }));
    return visible(Array.from(merged.values()));
  }, [dbItems]);

  const rawCategories = useMemo(
    () => Array.from(new Set(products.map((p) => p.rawCategory).filter(Boolean))).sort(),
    [products],
  );

  // Pre-normalised search text per product (rebuilt only when the product list changes).
  const searchIndex = useMemo(() => {
    const SKIP_SPECS = new Set(["Availability", "Supply"]); // generic wording on most products
    return new Map(
      products.map((p) => [
        p,
        buildSearchIndex({
          name: p.name,
          identifiers: [p.sap, p.category, p.rawCategory, p.subcategory, p.specs?.["Product code"]],
          details: [
            p.description,
            p.longDescription,
            ...Object.entries(p.specs || {})
              .filter(([k]) => !SKIP_SPECS.has(k))
              .map(([, v]) => v),
          ],
        }),
      ]),
    );
  }, [products]);

  const filtered = useMemo(() => {
    const list = products.filter((p) => {
      if (category !== ALL && p.category !== category) return false;
      if (rawCat !== "All" && p.rawCategory !== rawCat) return false;
      if (subCat !== "All" && p.rawCategory !== subCat) return false;
      return true;
    });
    // With a search, show matches ranked best-first.
    if (searchTerms(query).length > 0) {
      return rankBySearch(list, query, (p) => searchIndex.get(p)!);
    }
    if (category !== "Blood Collection Tubes & Needles") return list;
    const rank = (p: Product) => {
      const sub = p.subcategory || p.rawCategory || "";
      if (sub === "Paediatric Tubes 0.5ml") return 0;
      if (sub === "Blood Collection Needles") {
        return p.image.includes("/blood-collection/needles/") ? 1 : 2;
      }
      return 3;
    };
    return list
      .map((p, index) => ({ p, index }))
      .sort((a, b) => rank(a.p) - rank(b.p) || a.index - b.index)
      .map(({ p }) => p);
  }, [products, searchIndex, category, rawCat, subCat, query]);

  function updateCategory(c: string) {
    setCategory(c);
    setSubCat("All");
    writeParams({ category: c === ALL ? null : c, sub: null });
  }

  function updateSub(s: string) {
    setSubCat(s);
    writeParams({ category: category === ALL ? null : category, sub: s === "All" ? null : s });
  }

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-brand-navy py-16 text-white">
        <div className="pointer-events-none absolute -top-24 -right-16 h-96 w-96 rounded-full bg-brand-teal/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-96 w-96 rounded-full bg-brand-green/25 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-8">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand-teal">
            Complete product range
          </span>
          <h1 className="mt-3 font-display text-4xl md:text-6xl">Every product. One catalogue.</h1>
          <p className="mt-3 max-w-2xl text-white/70">
            Medical, laboratory & dental consumables — priced in Rands and ready to ship across
            South Africa.
          </p>
        </div>
      </section>

      <section className="sticky top-14 z-30 border-b border-black/5 bg-white/95 backdrop-blur md:top-16">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, categories, SKU…"
              className="min-w-[200px] flex-1 rounded-full border border-black/10 px-5 py-2.5 text-sm outline-none focus:border-brand-teal"
            />
            <select
              value={rawCat}
              onChange={(e) => setRawCat(e.target.value)}
              className="rounded-full border border-black/10 px-4 py-2.5 text-sm"
            >
              <option value="All">All product types ({products.length})</option>
              {rawCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[ALL, ...CATS.map((c) => c.name)].map((c) => (
              <button
                key={c}
                onClick={() => updateCategory(c)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  category === c
                    ? "bg-brand-navy text-white"
                    : "bg-brand-cream text-brand-navy hover:bg-brand-navy/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {subCat !== "All" && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-brand-charcoal/70">Filtered by sub-category:</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-semibold text-brand-teal">
                {subCat}
                <button
                  type="button"
                  onClick={() => updateSub("All")}
                  className="ml-1 text-brand-teal/80 hover:text-brand-navy font-bold"
                  title="Clear sub-category filter"
                >
                  ×
                </button>
              </span>
            </div>
          )}
        </div>
      </section>


      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="mb-6 text-sm text-brand-charcoal/70">
          Showing {Math.min(visible, filtered.length)} of {filtered.length} products
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-brand-cream p-16 text-center">
            <h3 className="font-display text-2xl text-brand-navy">No products match your search.</h3>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.slice(0, visible).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {visible < filtered.length && (
              <div className="mt-10 text-center">
                <button
                  onClick={() => setVisible((v) => v + 48)}
                  className="btn-shine btn-lift rounded-full bg-brand-navy px-8 py-3 text-sm font-bold uppercase tracking-wider text-white"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const navigate = useNavigate();
  const info = CATS.find((c) => c.name === product.category) || CATS[0];
  const [added, setAdded] = useState(false);
  const [preview, setPreview] = useState(false);
  // Size / variation popup: opened by "Add to Quote" / "Quote Now" for
  // products with more than one size; nothing is added until confirmed.
  const [choosing, setChoosing] = useState<null | "add" | "quote">(null);
  const groups = useMemo(() => variantGroups(product.specs), [product.specs]);
  const needsChoice = choiceGroups(groups).length > 0;

  const payload = (variant?: VariantSelection) => ({
    productId: product.id,
    name: product.name,
    price: product.price,
    image: product.image,
    sku: product.sap || undefined,
    variant,
  });
  // A product with a single size still records it on the quote.
  const singleOption = (): VariantSelection | undefined => {
    const one = Object.fromEntries(groups.filter((g) => g.options.length === 1).map((g) => [g.label, g.options[0]]));
    return Object.keys(one).length ? one : undefined;
  };
  const doAdd = (variant = singleOption(), qty = 1) => {
    add(payload(variant), qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };
  const doQuote = (variant = singleOption(), qty = 1) => {
    add(payload(variant), qty);
    navigate("/checkout");
  };
  const onAdd = () => {
    if (needsChoice) {
      setPreview(false);
      setChoosing("add");
    } else doAdd();
  };
  const onQuote = () => {
    if (needsChoice) {
      setPreview(false);
      setChoosing("quote");
    } else doQuote();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="group flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
      >
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="relative flex h-64 items-center justify-center overflow-hidden bg-white p-3 text-left ring-1 ring-black/5"
          aria-label={`View ${product.name}`}
        >
          <ProductImage
            src={product.image}
            alt={product.name}
            className="transition duration-500 group-hover:scale-110"
          />
          <span className="absolute bottom-3 right-3 rounded-full bg-brand-navy/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white opacity-0 transition group-hover:opacity-100">
            View
          </span>
        </button>
        <div className="flex flex-1 flex-col p-4">
          <span
            className="inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white"
            style={{ background: info.color }}
          >
            {product.rawCategory || product.category}
          </span>
          <Link
            to={`/product/${product.id}`}
            state={{ fromProducts: true }}
            className="mt-2 flex-1 font-display text-sm leading-tight text-brand-navy line-clamp-3 transition hover:text-brand-teal"
          >
            {product.name}
          </Link>
          <div className="mt-3 grid gap-1 text-[11px] text-brand-charcoal/60">
            {product.sap && <span>SKU: {product.sap}</span>}
            {product.innerMoq && <span>Pack: {product.innerMoq}</span>}
          </div>
          <div className="mt-3 font-bold text-lg text-brand-navy">{formatZAR(product.price)}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={onAdd}
              className={`btn-shine btn-lift rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white transition ${
                added ? "bg-brand-green" : "bg-brand-teal hover:bg-brand-teal-dark"
              }`}
            >
              {added ? "Added ✓" : "Add to Quote"}
            </button>
            <button
              onClick={onQuote}
              className="btn-lift rounded-full border border-brand-navy bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-brand-navy transition hover:bg-brand-navy hover:text-white"
            >
              Quote Now
            </button>
          </div>
          <Link
            to={`/product/${product.id}`}
            state={{ fromProducts: true }}
            className="mt-2 block text-center text-[11px] font-bold uppercase tracking-widest text-brand-teal transition hover:text-brand-navy"
          >
            View full details →
          </Link>
        </div>
      </motion.div>

      {choosing && (
        <AddToQuoteDialog
          product={product}
          mode={choosing}
          onCancel={() => setChoosing(null)}
          onConfirm={(variant, qty) => {
            const mode = choosing;
            setChoosing(null);
            if (mode === "quote") doQuote(variant, qty);
            else doAdd(variant, qty);
          }}
        />
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-brand-teal">
                  Product preview
                </div>
                <h3 className="mt-2 font-display text-2xl leading-tight text-brand-navy">
                  {product.name}
                </h3>
                {product.sap && (
                  <div className="mt-1 text-xs text-brand-charcoal/60">SKU: {product.sap}</div>
                )}
              </div>
              <button
                onClick={() => setPreview(false)}
                className="rounded-full border border-black/10 px-3 py-1 text-sm font-bold text-brand-navy"
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div className="flex h-72 items-center justify-center rounded-2xl bg-brand-cream p-4 md:h-[420px]">
                <ProductImage src={product.image} alt={product.name} loading="eager" />
              </div>
              <div>
                <div className="text-lg font-bold text-brand-navy">
                  {formatZAR(product.price)}
                </div>
                {product.description && (
                  <p className="mt-3 text-sm leading-relaxed text-brand-charcoal/80">
                    {product.description}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={onAdd}
                    className="btn-shine btn-lift rounded-full bg-brand-teal px-4 py-2 text-xs font-bold uppercase tracking-widest text-white"
                  >
                    Add to Quote
                  </button>
                  <button
                    onClick={onQuote}
                    className="btn-lift rounded-full border border-brand-navy bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-navy hover:bg-brand-navy hover:text-white"
                  >
                    Quote Now
                  </button>
                </div>
                <Link
                  to={`/product/${product.id}`}
            state={{ fromProducts: true }}
                  className="btn-shine btn-lift mt-3 block rounded-full bg-brand-navy px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-white"
                >
                  View full product page
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
