import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { describeSelection, type VariantSelection } from "../lib/variants";

export interface CartItem {
  /** Line id: product id plus the chosen variation, so each size is its own line. */
  id: string;
  /** Catalogue product id (older saved carts only have `id`). */
  productId?: string;
  name: string;
  price: number;
  image: string;
  qty: number;
  /** Product code / SKU shown on the quote. */
  sku?: string;
  /** Chosen size / variation, e.g. { Size: "10ml" }. */
  variant?: VariantSelection;
}

export type CartAddInput = Omit<CartItem, "qty" | "id"> & { id?: string; productId?: string };

interface CartCtx {
  items: CartItem[];
  add: (i: CartAddInput, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  /** Change the chosen variation of a line (merges with an existing line of that variation). */
  setVariant: (id: string, variant: VariantSelection) => void;
  clear: () => void;
  count: number;
  total: number;
}
const Ctx = createContext<CartCtx | null>(null);
const KEY = "lilmed:cart";

export const productIdOf = (i: Pick<CartItem, "id" | "productId">) => i.productId || i.id;

function lineId(productId: string, variant?: VariantSelection) {
  const v = describeSelection(variant);
  return v ? `${productId}|${v}` : productId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hyd, setHyd] = useState(false);
  useEffect(() => { try { const r = localStorage.getItem(KEY); if (r) setItems(JSON.parse(r)); } catch {} setHyd(true); }, []);
  useEffect(() => { if (hyd) try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }, [items, hyd]);

  const value = useMemo<CartCtx>(() => ({
    items,
    add: (i, qty = 1) => setItems(prev => {
      const productId = i.productId || i.id || "";
      const id = lineId(productId, i.variant);
      const ex = prev.find(p => p.id === id);
      if (ex) return prev.map(p => p.id === id ? { ...p, qty: p.qty + qty } : p);
      return [...prev, { ...i, productId, id, qty }];
    }),
    remove: (id) => setItems(prev => prev.filter(p => p.id !== id)),
    setQty: (id, qty) => setItems(prev => prev.map(p => p.id === id ? { ...p, qty: Math.max(1, qty) } : p)),
    setVariant: (id, variant) => setItems(prev => {
      const line = prev.find(p => p.id === id);
      if (!line) return prev;
      const newId = lineId(productIdOf(line), variant);
      if (newId === id) return prev;
      const other = prev.find(p => p.id === newId);
      if (other) {
        // Same product and size already in the basket: combine the quantities.
        return prev
          .filter(p => p.id !== id)
          .map(p => p.id === newId ? { ...p, qty: p.qty + line.qty } : p);
      }
      return prev.map(p => p.id === id ? { ...p, id: newId, productId: productIdOf(line), variant } : p);
    }),
    clear: () => setItems([]),
    count: items.reduce((s, i) => s + i.qty, 0),
    total: items.reduce((s, i) => s + i.qty * i.price, 0),
  }), [items]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useCart() { const c = useContext(Ctx); if (!c) throw new Error("useCart within CartProvider"); return c; }
