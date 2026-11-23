// Product size / variation options, read from the product's existing
// specification data. Nothing here invents options: a group is only created
// from a specification field that clearly lists choices, e.g.
//   Sizes:     "Serological pipette 25ml\nSerological pipette 10ml\n..."
//   Volume:    "10 ml, 20 ml"
//   Capacity:  "100 ml, 250 ml, 500 ml, 1000 ml"
//   Colour:    "Clear or amber"
//   Available colours: "Green - Red - Yellow - Blue"
// Descriptive values that merely contain a comma or slash
// ("Borosilicate, 1st hydrolytic class glass", "1.5 inch / 40 mm") are not
// treated as choices.

export interface VariantGroup {
  /** Specification field the options come from, e.g. "Sizes". */
  key: string;
  /** Label shown to the customer, e.g. "Size". */
  label: string;
  options: string[];
}

/** Chosen option per group label, e.g. { Size: "10ml" }. */
export type VariantSelection = Record<string, string>;

const MEASURE = /^\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:ml|µl|ul|l|mm|cm|m|g|kg|oz|gal)\b/i;
const COLOUR_WORD =
  /^(?:clear|amber|white|black|red|blue|green|yellow|orange|purple|violet|grey|gray|pink|brown|natural|silver|gold|transparent|light blue|dark blue|lavender|beige)$/i;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const unique = (xs: string[]) => Array.from(new Set(xs.map(tidy).filter(Boolean)));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "a, b or c" / "a; b" -> ["a","b","c"] */
function splitList(value: string): string[] {
  return value.split(/\s*(?:,|;|\bor\b)\s*/i).map(tidy).filter(Boolean);
}

function measureList(value: string): string[] | null {
  const parts = splitList(value);
  return parts.length > 1 && parts.every((p) => MEASURE.test(p)) ? unique(parts) : null;
}

function colourList(value: string, separators: RegExp): string[] | null {
  const parts = value
    .split(separators)
    .map(tidy)
    .filter((p) => p && !/^custom$/i.test(p)); // "or custom" = made to order, not a stock option
  return parts.length > 1 && parts.every((p) => COLOUR_WORD.test(p)) ? unique(parts.map(cap)) : null;
}

/**
 * Option groups for a product. Groups with a single option are included (so
 * the quote still records it) but need no choice from the customer.
 */
export function variantGroups(specs: Record<string, string> | undefined | null): VariantGroup[] {
  if (!specs) return [];
  const groups: VariantGroup[] = [];

  if (specs.Sizes) {
    const lines = unique(specs.Sizes.split(/\n+/));
    const options = lines.length > 1 ? lines : measureList(specs.Sizes) || lines;
    groups.push({ key: "Sizes", label: "Size", options });
  } else {
    // Volume-type fields first; dimensions only when no volume list exists,
    // because they describe the same choice.
    for (const key of ["Volume", "Capacity", "Total volume"]) {
      const list = specs[key] ? measureList(specs[key]) : null;
      if (list) {
        groups.push({ key, label: "Size", options: list });
        break;
      }
    }
    if (groups.length === 0 && specs.Dimensions) {
      const list = measureList(specs.Dimensions);
      if (list) groups.push({ key: "Dimensions", label: "Size", options: list });
    }
  }

  const colour =
    (specs.Colour && colourList(specs.Colour, /\s*(?:,|;|\bor\b)\s*/i)) ||
    (specs["Available colours"] && colourList(specs["Available colours"], /\s*(?:-|,|;|\bor\b)\s*/i));
  if (colour) groups.push({ key: specs.Colour ? "Colour" : "Available colours", label: "Colour", options: colour });

  return groups;
}

/** Groups where the customer has to pick (more than one option). */
export function choiceGroups(groups: VariantGroup[]): VariantGroup[] {
  return groups.filter((g) => g.options.length > 1);
}

/** Selection pre-filled only for groups that have exactly one option. */
export function defaultSelection(groups: VariantGroup[]): VariantSelection {
  const sel: VariantSelection = {};
  for (const g of groups) if (g.options.length === 1) sel[g.label] = g.options[0];
  return sel;
}

/** Labels of groups that still need a choice. */
export function missingChoices(groups: VariantGroup[], sel: VariantSelection): string[] {
  return groups.filter((g) => !sel[g.label]).map((g) => g.label);
}

/** "Size: 10ml · Colour: Amber" (empty string when nothing is selected). */
export function describeSelection(sel: VariantSelection | undefined | null): string {
  if (!sel) return "";
  return Object.entries(sel)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}
