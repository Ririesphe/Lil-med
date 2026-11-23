import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown, ChevronUp, Copy, ExternalLink, EyeOff, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import ProductImage from "../../components/ProductImage";
import { formatZAR } from "../../data/products";
import {
  candidateBrand,
  candidatePack,
  candidateSize,
  candidateUrl,
  catalogueCandidates,
  loadDatabaseCandidates,
} from "../../data/duplicate-candidates";
import { findDuplicates, type DuplicateCandidate, type DuplicateGroup, type DuplicateReport } from "../../lib/duplicates";
import { loadReviews, saveReviews, STATUS_LABEL, type ReviewDecision, type ReviewStatus } from "../../lib/duplicate-reviews";
import { buildSearchIndex, scoreSearch } from "../../lib/search";

type KindFilter = "all" | "exact" | "possible";
type StatusFilter = "all" | ReviewStatus;

const STATUS_STYLE: Record<ReviewStatus, string> = {
  open: "bg-amber-50 text-amber-800 ring-amber-200",
  reviewed: "bg-sky-50 text-sky-800 ring-sky-200",
  confirmed: "bg-rose-50 text-rose-800 ring-rose-200",
  dismissed: "bg-gray-100 text-gray-600 ring-gray-200",
};

export default function AdminDuplicates() {
  const [candidates, setCandidates] = useState<DuplicateCandidate[] | null>(null);
  const [dbCount, setDbCount] = useState(0);
  const [report, setReport] = useState<DuplicateReport | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewDecision>>(() => loadReviews());
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [q, setQ] = useState("");
  const [showVariants, setShowVariants] = useState(false);
  const [variantLimit, setVariantLimit] = useState(30);
  const [scanning, setScanning] = useState(true);
  const [scannedAt, setScannedAt] = useState<Date | null>(null);

  async function scan() {
    setScanning(true);
    const db = await loadDatabaseCandidates();
    const all = [...catalogueCandidates(), ...db];
    // Let the "Scanning…" state paint before the comparison runs.
    await new Promise((r) => setTimeout(r, 30));
    setCandidates(all);
    setDbCount(db.length);
    setReport(findDuplicates(all));
    setScannedAt(new Date());
    setScanning(false);
  }

  useEffect(() => {
    scan();
  }, []);

  const byKey = useMemo(() => new Map((candidates || []).map((c) => [c.key, c])), [candidates]);

  const statusOf = (g: DuplicateGroup): ReviewStatus => reviews[g.id]?.status ?? "open";

  function decide(g: DuplicateGroup, next: ReviewStatus) {
    setReviews((prev) => {
      const copy = { ...prev };
      if (next === "open") delete copy[g.id];
      else copy[g.id] = { status: next, at: new Date().toISOString(), members: g.members };
      saveReviews(copy);
      return copy;
    });
  }

  const counts = useMemo(() => {
    const c: Record<ReviewStatus, number> = { open: 0, reviewed: 0, confirmed: 0, dismissed: 0 };
    for (const g of report?.groups || []) c[statusOf(g)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, reviews]);

  const visibleGroups = useMemo(() => {
    if (!report) return [];
    return report.groups.filter((g) => {
      if (kind !== "all" && g.kind !== kind) return false;
      if (status !== "all" && statusOf(g) !== status) return false;
      if (q.trim()) {
        return g.members.some((k) => {
          const c = byKey.get(k);
          return c && scoreSearch(q, buildSearchIndex({ name: c.name, identifiers: [c.sku, c.category, c.subcategory] })) > 0;
        });
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, kind, status, q, reviews, byKey]);

  const tiles = report
    ? [
        { k: "Products scanned", v: report.scanned, hint: dbCount ? `${report.scanned - dbCount} website + ${dbCount} database` : "Website catalogue" },
        { k: "Duplicate groups", v: report.groups.length, hint: `${counts.open} not reviewed yet` },
        { k: "Products involved", v: report.involved, hint: "Appear in at least one group" },
        { k: "Exact matches", v: report.exactGroups, hint: `${report.exactPairs} matching pairs` },
        { k: "Possible matches", v: report.possibleGroups, hint: `${report.possiblePairs} matching pairs` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Duplicate products</h1>
          <p className="max-w-2xl text-sm text-gray-500">
            Products that look like the same item listed more than once. This page only finds and shows them —
            nothing is deleted, merged or changed. Your review decisions are saved in this browser.
          </p>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="inline-flex items-center gap-2 rounded-full border border-brand-navy px-4 py-2 text-sm font-bold text-brand-navy transition hover:bg-brand-navy hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={scanning ? "animate-spin" : ""} /> {scanning ? "Scanning…" : "Scan again"}
        </button>
      </div>

      {report && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.k} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-teal">{t.k}</div>
              <div className="mt-2 font-display text-3xl text-brand-navy">{t.v}</div>
              <div className="mt-1 text-xs text-gray-500">{t.hint}</div>
            </div>
          ))}
        </div>
      )}

      {report && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <Segment
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: `All (${report.groups.length})` },
              { value: "exact", label: `Exact (${report.exactGroups})` },
              { value: "possible", label: `Possible (${report.possibleGroups})` },
            ]}
          />
          <Segment
            value={status}
            onChange={setStatus}
            options={[
              { value: "open", label: `Not reviewed (${counts.open})` },
              { value: "reviewed", label: `Reviewed (${counts.reviewed})` },
              { value: "confirmed", label: `Confirmed (${counts.confirmed})` },
              { value: "dismissed", label: `Dismissed (${counts.dismissed})` },
              { value: "all", label: "All" },
            ]}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a product…"
            className="ml-auto rounded-full border border-black/10 px-4 py-2 text-sm"
          />
        </div>
      )}

      {scannedAt && (
        <p className="text-xs text-gray-500">
          Last scan {scannedAt.toLocaleTimeString()} · showing {visibleGroups.length} of {report?.groups.length} groups
        </p>
      )}

      <div className="space-y-4">
        {visibleGroups.map((g) => (
          <GroupCard key={g.id} group={g} byKey={byKey} status={statusOf(g)} decision={reviews[g.id]} onDecide={(s) => decide(g, s)} />
        ))}
        {report && visibleGroups.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-black/5">
            No groups match these filters.
          </div>
        )}
      </div>

      {report && report.variants.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <button
            onClick={() => setShowVariants((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div>
              <div className="font-semibold text-brand-navy">
                Similar products not flagged ({report.variants.length} pairs)
              </div>
              <div className="text-xs text-gray-500">
                Names are alike, but size, brand, colour, material, packaging, type or model number differ — treated as
                variants, not duplicates.
              </div>
            </div>
            {showVariants ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showVariants && (
            <div className="border-t px-5 py-3">
              <ul className="divide-y text-sm">
                {report.variants.slice(0, variantLimit).map((v) => (
                  <li key={`${v.a}|${v.b}`} className="py-2">
                    <span className="font-semibold text-brand-navy">{byKey.get(v.a)?.name}</span>
                    <span className="text-gray-400"> ↔ </span>
                    <span className="font-semibold text-brand-navy">{byKey.get(v.b)?.name}</span>
                    <div className="text-xs text-gray-500">{v.reasons.join(" · ")}</div>
                  </li>
                ))}
              </ul>
              {variantLimit < report.variants.length && (
                <button
                  onClick={() => setVariantLimit((n) => n + 50)}
                  className="mt-2 text-sm font-semibold text-brand-teal hover:underline"
                >
                  Show more
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Segment<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap rounded-full bg-brand-cream p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            value === o.value ? "bg-brand-navy text-white" : "text-brand-navy hover:bg-brand-navy/10"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function GroupCard({
  group,
  byKey,
  status,
  decision,
  onDecide,
}: {
  group: DuplicateGroup;
  byKey: Map<string, DuplicateCandidate>;
  status: ReviewStatus;
  decision?: ReviewDecision;
  onDecide: (s: ReviewStatus) => void;
}) {
  const [compare, setCompare] = useState(false);
  const members = group.members.map((k) => byKey.get(k)).filter(Boolean) as DuplicateCandidate[];
  const nameOf = (k: string) => byKey.get(k)?.name.trim() || k;
  const changed = decision && decision.members.join("|") !== group.members.join("|");

  return (
    <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-black/5 ${status === "dismissed" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${
            group.kind === "exact" ? "bg-rose-600 text-white" : "bg-amber-400 text-brand-navy"
          }`}
        >
          {group.kind === "exact" ? "Exact match" : "Possible match"}
        </span>
        <span className="text-sm font-semibold text-brand-navy">{members.length} products</span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${STATUS_STYLE[status]}`}>
          {STATUS_LABEL[status]}
          {decision && ` · ${new Date(decision.at).toLocaleDateString()}`}
        </span>
        {changed && <span className="text-[11px] text-amber-700">Group has changed since your decision</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <ActionButton onClick={() => setCompare((c) => !c)} icon={<Copy size={13} />}>
            {compare ? "Hide comparison" : "Compare"}
          </ActionButton>
          {status !== "reviewed" && (
            <ActionButton onClick={() => onDecide("reviewed")} icon={<CheckCircle2 size={13} />}>
              Mark reviewed
            </ActionButton>
          )}
          {status !== "confirmed" && (
            <ActionButton onClick={() => onDecide("confirmed")} icon={<ShieldCheck size={13} />} tone="rose">
              Confirm duplicate
            </ActionButton>
          )}
          {status !== "dismissed" && (
            <ActionButton onClick={() => onDecide("dismissed")} icon={<EyeOff size={13} />}>
              Not a duplicate
            </ActionButton>
          )}
          {status !== "open" && (
            <ActionButton onClick={() => onDecide("open")} icon={<RotateCcw size={13} />}>
              Undo
            </ActionButton>
          )}
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((c) => (
          <ProductTile key={c.key} c={c} />
        ))}
      </div>

      {compare && <CompareTable members={members} />}

      <div className="border-t bg-brand-cream/40 px-5 py-3">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-brand-teal">Why these were flagged</div>
        <ul className="space-y-2 text-sm">
          {group.pairs.map((p) => (
            <li key={`${p.a}|${p.b}`}>
              <div className="text-brand-navy">
                <span className="font-semibold">{nameOf(p.a)}</span>
                <span className="text-gray-400"> ↔ </span>
                <span className="font-semibold">{nameOf(p.b)}</span>
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    p.kind === "exact" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {p.kind}
                </span>
              </div>
              <div className="text-xs text-gray-600">{p.reasons.join(" · ")}</div>
              {p.notes.length > 0 && <div className="text-xs text-gray-500">Check: {p.notes.join(" · ")}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  icon,
  tone,
}: {
  children: ReactNode;
  onClick: () => void;
  icon: ReactNode;
  tone?: "rose";
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        tone === "rose"
          ? "border-rose-300 text-rose-700 hover:bg-rose-600 hover:text-white"
          : "border-black/10 text-brand-navy hover:bg-brand-navy hover:text-white"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ProductTile({ c }: { c: DuplicateCandidate }) {
  const url = candidateUrl(c);
  const rows: [string, string][] = [
    ["SKU", c.sku || "—"],
    ["Brand", candidateBrand(c) || "—"],
    ["Size", candidateSize(c) || "—"],
    ["Price", formatZAR(c.price || 0)],
    ["Stock", "Not tracked"],
    ["Category", [c.category, c.subcategory].filter(Boolean).join(" › ") || "—"],
  ];
  return (
    <div className="flex gap-3 rounded-xl border border-black/5 p-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
        <ProductImage src={c.image} alt={c.name} fallbackText="text-[9px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-snug text-brand-navy">{c.name}</div>
        <dl className="mt-1 grid grid-cols-[auto,1fr] gap-x-2 text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-400">{k}</dt>
              <dd className="truncate text-gray-700" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-1 flex items-center gap-3 text-xs">
          <span className="text-gray-400">
            {c.source === "catalogue" ? "Website catalogue" : "Admin database"} · ID {c.id}
          </span>
          {url && (
            <Link to={url} target="_blank" className="inline-flex items-center gap-1 font-semibold text-brand-teal hover:underline">
              View <ExternalLink size={11} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareTable({ members }: { members: DuplicateCandidate[] }) {
  const specKeys = Array.from(
    new Set(members.flatMap((m) => Object.keys(m.specs || {}))),
  ).filter((k) => !["Availability", "Supply"].includes(k));
  const rows: { label: string; values: string[] }[] = [
    { label: "Name", values: members.map((m) => m.name) },
    { label: "SKU", values: members.map((m) => m.sku || "—") },
    { label: "Category", values: members.map((m) => [m.category, m.subcategory].filter(Boolean).join(" › ") || "—") },
    { label: "Brand", values: members.map((m) => candidateBrand(m) || "—") },
    { label: "Size", values: members.map((m) => candidateSize(m) || "—") },
    { label: "Pack", values: members.map((m) => candidatePack(m) || "—") },
    { label: "Price", values: members.map((m) => formatZAR(m.price || 0)) },
    { label: "Description", values: members.map((m) => m.description || "—") },
    ...specKeys
      .filter((k) => !["Brand", "Manufacturer", "Size / capacity", "Pack size", "Pack"].includes(k))
      .map((k) => ({ label: k, values: members.map((m) => m.specs?.[k] || "—") })),
  ];
  return (
    <div className="overflow-x-auto border-t px-4 py-3">
      <table className="w-full min-w-[600px] text-xs">
        <tbody>
          {rows.map((r) => {
            const differs = new Set(r.values.map((v) => v.trim().toLowerCase())).size > 1;
            return (
              <tr key={r.label} className="border-b last:border-0 align-top">
                <th className="w-32 py-1.5 pr-3 text-left font-semibold text-gray-500">{r.label}</th>
                {r.values.map((v, i) => (
                  <td key={i} className={`whitespace-pre-line py-1.5 pr-3 ${differs ? "bg-amber-50 text-brand-navy" : "text-gray-600"}`}>
                    {v}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-gray-500">Highlighted rows differ between the products.</p>
    </div>
  );
}
