import { useEffect, useState } from "react";
import { formatZAR, type Product } from "../data/products";
import VariantPicker from "./VariantPicker";
import {
  defaultSelection,
  missingChoices,
  variantGroups,
  type VariantSelection,
} from "../lib/variants";

interface Props {
  product: Product;
  /** Which button opened the popup: plain add, or add and go to checkout. */
  mode: "add" | "quote";
  onCancel: () => void;
  /** Called only after the customer confirms a complete selection. */
  onConfirm: (variant: VariantSelection | undefined, qty: number) => void;
}

/**
 * Popup opened by "Add to Quote" / "Quote Now" for products that come in more
 * than one size or variation. Nothing is added until the customer confirms.
 */
export default function AddToQuoteDialog({ product, mode, onCancel, onConfirm }: Props) {
  const groups = variantGroups(product.specs);
  const [choice, setChoice] = useState<VariantSelection>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const selection: VariantSelection = { ...defaultSelection(groups), ...choice };

  // Close on Escape, like the other popups on the site.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const confirm = () => {
    const need = missingChoices(groups, selection);
    setMissing(need);
    if (need.length) return;
    onConfirm(Object.keys(selection).length ? selection : undefined, Math.max(1, qty));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Choose options for ${product.name}`}
      onClick={onCancel}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-brand-teal">Choose options</div>
            <h3 className="mt-2 font-display text-xl leading-tight text-brand-navy">{product.name}</h3>
            {product.sap && <div className="mt-1 text-xs text-brand-charcoal/60">SKU: {product.sap}</div>}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-black/10 px-3 py-1 text-sm font-bold text-brand-navy"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-4">
          <VariantPicker
            groups={groups}
            value={selection}
            missing={missing}
            compact
            onChange={(next) => {
              setChoice(next);
              setMissing(missingChoices(groups, next));
            }}
          />
          {missing.length > 0 && (
            <p className="mt-3 text-sm font-semibold text-brand-red" role="alert">
              Please choose a {missing.join(" and ").toLowerCase()} first.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-black/5 pt-4">
          <label className="text-xs font-bold uppercase tracking-widest text-brand-navy">
            Quantity
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="mt-2 block w-24 rounded-md border border-black/10 px-2 py-1.5 text-center text-sm font-semibold normal-case tracking-normal text-brand-charcoal"
              aria-label="Quantity"
            />
          </label>
          <div className="text-right">
            {/* All sizes of a product share one price in the catalogue. */}
            <div className="text-xs text-brand-charcoal/60">Price</div>
            <div className="font-bold text-brand-navy">
              {formatZAR(product.price)}
              {product.price > 0 && <span className="text-xs font-normal text-brand-charcoal/60"> each</span>}
            </div>
            {product.price > 0 && qty > 1 && (
              <div className="text-xs text-brand-charcoal/70">Total: {formatZAR(product.price * qty)}</div>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-lift rounded-full border border-brand-navy bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-navy hover:bg-brand-navy hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="btn-shine btn-lift rounded-full bg-brand-teal px-4 py-2 text-xs font-bold uppercase tracking-widest text-white"
          >
            {mode === "quote" ? "Add & Request Quote" : "Add to Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}
