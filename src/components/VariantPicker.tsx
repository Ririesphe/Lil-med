import { choiceGroups, describeSelection, type VariantGroup, type VariantSelection } from "../lib/variants";

interface Props {
  groups: VariantGroup[];
  value: VariantSelection;
  onChange: (next: VariantSelection) => void;
  /** Labels that still need a choice; shown as a prompt. */
  missing?: string[];
  compact?: boolean;
}

/** Size / colour chips for products that come in more than one variation. */
export default function VariantPicker({ groups, value, onChange, missing = [], compact }: Props) {
  const choices = choiceGroups(groups);
  if (choices.length === 0) return null;
  const summary = describeSelection(value);
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {choices.map((g) => {
        const needs = missing.includes(g.label);
        return (
          <fieldset key={g.label}>
            <legend
              className={`text-xs font-bold uppercase tracking-widest ${
                needs ? "text-brand-red" : "text-brand-navy"
              }`}
            >
              Choose {g.label.toLowerCase()}
              {needs && <span className="ml-1 normal-case tracking-normal">— required</span>}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`Choose ${g.label}`}>
              {g.options.map((o) => {
                const on = value[g.label] === o;
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange({ ...value, [g.label]: o })}
                    className={`rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition ${
                      on
                        ? "border-brand-teal bg-brand-teal text-white"
                        : "border-black/10 bg-white text-brand-navy hover:border-brand-teal hover:text-brand-teal"
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <div className="text-xs text-brand-charcoal/70">
        Selected: <span className="font-semibold text-brand-navy">{summary || "nothing yet"}</span>
      </div>
    </div>
  );
}
