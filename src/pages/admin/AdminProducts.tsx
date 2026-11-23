import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pencil, Plus, Save, Trash2, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { formatZAR } from "../../data/products";
import { logAction } from "../../lib/audit";
import { supabase, type DbCategory, type DbProduct } from "../../lib/supabase";
import { buildSearchIndex, rankBySearch } from "../../lib/search";
import ProductImage from "../../components/ProductImage";
import { findMatchesFor, type DuplicatePair } from "../../lib/duplicates";
import { catalogueCandidates, databaseCandidate } from "../../data/duplicate-candidates";

interface FormState {
  name: string;
  sap: string;
  category_id: string;
  raw_category: string;
  inner_moq: string;
  price: number;
  description: string;
  image_url: string;
}

const emptyForm: FormState = {
  name: "",
  sap: "",
  category_id: "",
  raw_category: "",
  inner_moq: "",
  price: 0,
  description: "",
  image_url: "",
};

export default function AdminProducts() {
  const [items, setItems] = useState<DbProduct[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  // Set when "Save" found possible duplicates; the admin must choose "Save anyway" or Cancel.
  const [dupWarning, setDupWarning] = useState<DuplicatePair[] | null>(null);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function load() {
    const [{ data: productRows }, { data: categoryRows }] = await Promise.all([
      supabase
        .from("products")
        .select("*, categories(name)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("categories").select("id,name,slug").order("name", { ascending: true }),
    ]);
    setItems((productRows as DbProduct[]) || []);
    setCategories((categoryRows as DbCategory[]) || []);
  }

  function startEdit(p: DbProduct) {
    setEditing(p.id);
    setForm({
      name: p.name,
      sap: p.sap ?? "",
      category_id: p.category_id ?? "",
      raw_category: p.raw_category ?? "",
      inner_moq: p.inner_moq ?? "",
      price: Number(p.price) || 0,
      description: p.description ?? "",
      image_url: p.image_url ?? "",
    });
  }

  // Existing products the new product would duplicate (website catalogue + database).
  const existingCandidates = useMemo(
    () => [...catalogueCandidates(), ...items.map(databaseCandidate)],
    [items],
  );
  const categoryName = categories.find((c) => c.id === form.category_id)?.name || "";
  const duplicateMatches = useMemo(() => {
    if (!creating || form.name.trim().length < 3) return [];
    return findMatchesFor(
      {
        id: "new",
        source: "database",
        name: form.name,
        sku: form.sap,
        category: categoryName,
        subcategory: form.raw_category,
        image: form.image_url,
        description: form.description,
        price: form.price,
        specs: form.inner_moq ? { "Pack size": form.inner_moq } : undefined,
      },
      existingCandidates,
    );
  }, [creating, form, categoryName, existingCandidates]);
  const candidateByKey = useMemo(
    () => new Map(existingCandidates.map((c) => [c.key, c])),
    [existingCandidates],
  );

  async function save(id: string | null, confirmedDuplicate = false) {
    // New product: warn about possible duplicates first. Nothing is changed or merged.
    if (!id && !confirmedDuplicate && duplicateMatches.length > 0) {
      setDupWarning(duplicateMatches);
      return;
    }
    setDupWarning(null);
    const payload = {
      name: form.name,
      sap: form.sap || null,
      category_id: form.category_id || null,
      raw_category: form.raw_category || null,
      inner_moq: form.inner_moq || null,
      price: form.price,
      description: form.description || null,
      image_url: form.image_url || null,
    };
    if (id) {
      await supabase.from("products").update(payload).eq("id", id);
      logAction("product.update", id, payload);
    } else {
      const { data } = await supabase.from("products").insert(payload).select().single();
      logAction("product.create", data?.id, confirmedDuplicate ? { ...payload, saved_despite_duplicate_warning: true } : payload);
    }
    setEditing(null);
    setCreating(false);
    setForm(emptyForm);
  }

  async function remove(p: DbProduct) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await supabase.from("products").delete().eq("id", p.id);
    logAction("product.delete", p.id, { name: p.name });
  }

  async function upload(file: File) {
    const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.-]+/gi, "_")}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      alert(error.message);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
  }

  const filtered = rankBySearch(items, q, (p) =>
    buildSearchIndex({
      name: p.name,
      identifiers: [p.sap, p.raw_category, p.categories?.name],
      details: [p.description],
    }),
  );

  const subCategoryOptions = Array.from(
    new Set(items.map((p) => p.raw_category).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Products</h1>
          <p className="text-sm text-gray-500">
            Manage the live catalogue. Uploaded products override the built-in list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="rounded-full border border-black/10 px-4 py-2 text-sm"
          />
          <button
            onClick={() => {
              setCreating(true);
              setEditing(null);
              setForm(emptyForm);
              setDupWarning(null);
            }}
            className="btn-shine inline-flex items-center gap-1 rounded-full bg-brand-teal px-4 py-2 text-sm font-bold text-white"
          >
            <Plus size={16} /> Add product
          </button>
        </div>
      </div>

      {(creating || editing) && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="font-display text-lg text-brand-navy">
            {creating ? "New product" : "Edit product"}
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="SKU / Model" value={form.sap} onChange={(v) => setForm({ ...form, sap: v })} />
            <Select
              label="Category"
              value={form.category_id}
              onChange={(v) => setForm({ ...form, category_id: v })}
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
              placeholder="Choose existing category"
            />
            <Input
              label="Sub-category"
              value={form.raw_category}
              onChange={(v) => setForm({ ...form, raw_category: v })}
              list="admin-product-subcategories"
            />
            <datalist id="admin-product-subcategories">
              {subCategoryOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <Input label="Pack" value={form.inner_moq} onChange={(v) => setForm({ ...form, inner_moq: v })} />
            <Input
              label="Price (ZAR)"
              type="number"
              value={String(form.price)}
              onChange={(v) => setForm({ ...form, price: Number(v) || 0 })}
            />
            <div className="flex items-end gap-3 md:col-span-2">
              <div className="flex-1">
                <Input
                  label="Image URL"
                  value={form.image_url}
                  onChange={(v) => setForm({ ...form, image_url: v })}
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-navy px-3 py-2 text-xs font-bold text-brand-navy transition hover:bg-brand-navy hover:text-white">
                <Upload size={14} /> Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-navy">
                Description
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-brand-teal"
              />
            </div>
          </div>
          {form.image_url && (
            <img src={form.image_url} alt="preview" className="mt-3 h-24 rounded ring-1 ring-black/5" />
          )}
          {creating && duplicateMatches.length > 0 && (
            <div
              className={`mt-4 rounded-xl p-4 text-sm ring-1 ${
                dupWarning ? "bg-rose-50 ring-rose-300" : "bg-amber-50 ring-amber-200"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-brand-navy">
                <AlertTriangle size={16} className={dupWarning ? "text-rose-600" : "text-amber-600"} />
                {dupWarning
                  ? "This product may already exist. Check the matches below before saving."
                  : `Possible duplicate${duplicateMatches.length > 1 ? "s" : ""} of existing products`}
              </div>
              <ul className="mt-2 space-y-2">
                {duplicateMatches.slice(0, 8).map((m) => {
                  const c = candidateByKey.get(m.b);
                  if (!c) return null;
                  return (
                    <li key={m.b} className="flex gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
                        <ProductImage src={c.image} alt={c.name} fallbackText="text-[8px]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-brand-navy">
                          {c.name}
                          <span
                            className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              m.kind === "exact" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {m.kind}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {[c.sku, [c.category, c.subcategory].filter(Boolean).join(" › ")].filter(Boolean).join(" · ")}
                        </div>
                        <div className="text-xs text-gray-500">{m.reasons.join(" · ")}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {duplicateMatches.length > 8 && (
                <div className="mt-1 text-xs text-gray-500">…and {duplicateMatches.length - 8} more.</div>
              )}
              <div className="mt-2 text-xs text-gray-500">
                Size, brand, colour and packaging variants of the same product are not listed here.{" "}
                <Link to="/admin/duplicates" className="font-semibold text-brand-teal hover:underline">
                  Open the duplicate report
                </Link>
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setCreating(false);
                setEditing(null);
                setDupWarning(null);
              }}
              className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-brand-navy"
            >
              Cancel
            </button>
            {dupWarning ? (
              <button
                onClick={() => save(null, true)}
                className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white"
              >
                <Save size={14} /> Save anyway
              </button>
            ) : (
              <button
                onClick={() => save(editing)}
                className="btn-shine inline-flex items-center gap-1 rounded-full bg-brand-teal px-4 py-2 text-sm font-bold text-white"
              >
                <Save size={14} /> Save
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream text-left text-brand-navy">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">
                  {p.image_url ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-white ring-1 ring-black/5">
                      <ProductImage src={p.image_url} alt={p.name} fallbackText="text-[7px]" />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded bg-brand-cream" />
                  )}
                </td>
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{p.sap || "—"}</td>
                <td className="px-4 py-2 text-xs">
                  <div className="font-semibold text-brand-navy">{p.categories?.name || "—"}</div>
                  <div className="text-gray-500">{p.raw_category || "—"}</div>
                </td>
                <td className="px-4 py-2 text-right font-bold text-brand-navy">
                  {formatZAR(Number(p.price))}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => startEdit(p)}
                    className="rounded p-2 text-brand-navy hover:bg-brand-navy/10"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="rounded p-2 text-brand-red hover:bg-brand-red/10"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                  No products yet. Click <b>Add product</b> to create your first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  list,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  list?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-navy">
        {label}
      </span>
      <input
        type={type}
        list={list}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-black/10 p-2 text-sm outline-none focus:border-brand-teal"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-navy">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-black/10 bg-white p-2 text-sm outline-none focus:border-brand-teal"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
