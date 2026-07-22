import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Target, AlertTriangle, ShieldCheck, Layers, Search, Database } from "lucide-react";

// Backs the delivery promises in the sponsorship agreement:
//   clause 3.5   — Minimum Impression Floor, measured in LEARNERS REACHED
//                  (distinct people, not placement views)
//   clause 3.6   — founding-sponsor exit at day 90 if under a quarter of floor
//   clause 3.4.1 — rotation, and not overselling a province
//
// Data comes from two views created in
// supabase/migrations/20260722000001_sponsor_pacing.sql. Both are
// security_invoker, so admin RLS on colleges/sponsor_matches applies.

interface PacingRow {
  college_id: string;
  college_name: string;
  province: string | null;
  impression_floor: number;
  term_start: string;
  term_end: string;
  term_days: number;
  days_elapsed: number;
  delivered: number;
  views: number;
  expected_to_date: number;
  variance: number;
  status: string;
}

interface CapacityRow {
  province: string;
  active_sponsors: number;
  committed_floor: number;
  distinct_learners_reached: number;
  coverage_ratio: number | null;
  capacity_status: string;
}

const MISSING_VIEW = "MISSING_VIEW";

function isMissingView(err: unknown) {
  const m = String((err as any)?.message || err || "");
  return /does not exist|schema cache|42P01/i.test(m);
}

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s.startsWith("BREACH") || s.startsWith("OVERSOLD")) return "bg-red-50 text-red-700 ring-red-200";
  if (s.startsWith("BEHIND") || s.startsWith("TIGHT")) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (s.startsWith("MET") || s.startsWith("COVERED")) return "bg-lime/20 text-[#5a7a00] ring-lime/40";
  return "bg-brand/10 text-brand ring-brand/20";
}

function Bar({ delivered, floor, expected }: { delivered: number; floor: number; expected: number }) {
  const pct = floor > 0 ? Math.min(100, (delivered / floor) * 100) : 0;
  const marker = floor > 0 ? Math.min(100, (expected / floor) * 100) : 0;
  const behind = delivered < expected;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-slate-100">
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${behind ? "bg-amber-400" : "bg-lime"}`}
        style={{ width: `${pct}%` }}
      />
      {/* pro-rata expectation marker */}
      <div
        className="absolute -top-1 h-4.5 w-0.5 bg-navy/60"
        style={{ left: `${marker}%`, height: "1.05rem" }}
        title={`Expected by today: ${expected.toLocaleString()}`}
      />
    </div>
  );
}

export default function DeliveryPage() {
  const [province, setProvince] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const pacing = useQuery({
    queryKey: ["sponsor_pacing"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("sponsor_pacing").select("*").order("variance");
      if (error) throw isMissingView(error) ? new Error(MISSING_VIEW) : error;
      return (data as PacingRow[]) || [];
    },
  });

  const capacity = useQuery({
    queryKey: ["province_capacity"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("province_capacity").select("*").order("province");
      if (error) throw isMissingView(error) ? new Error(MISSING_VIEW) : error;
      return (data as CapacityRow[]) || [];
    },
  });

  const missing =
    (pacing.error as Error)?.message === MISSING_VIEW || (capacity.error as Error)?.message === MISSING_VIEW;

  const rows = pacing.data || [];
  const caps = capacity.data || [];

  const provinces = useMemo(
    () => Array.from(new Set(rows.map((r) => r.province || "National"))).sort(),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (province !== "all" && (r.province || "National") !== province) return false;
        if (status !== "all" && !r.status.toUpperCase().startsWith(status)) return false;
        if (search && !r.college_name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [rows, province, status, search]
  );

  const atRisk = rows.filter((r) => /BEHIND|BREACH/i.test(r.status)).length;
  const oversold = caps.filter((c) => /OVERSOLD|TIGHT/i.test(c.capacity_status)).length;
  const committed = rows.reduce((n, r) => n + (r.impression_floor || 0), 0);
  const reached = rows.reduce((n, r) => n + (r.delivered || 0), 0);

  const stats = [
    { label: "Sponsors behind floor", value: atRisk, icon: AlertTriangle, fg: atRisk ? "text-amber-600" : "text-slate-400" },
    { label: "Provinces at capacity", value: oversold, icon: Layers, fg: oversold ? "text-red-600" : "text-slate-400" },
    { label: "Learners committed", value: committed.toLocaleString(), icon: Target, fg: "text-brand" },
    { label: "Learners reached", value: reached.toLocaleString(), icon: ShieldCheck, fg: "text-[#6f9e00]" },
  ];

  if (missing) {
    return (
      <div>
        <div className="mb-7">
          <h1 className="text-3xl font-extrabold text-navy">Delivery &amp; Commitments</h1>
          <p className="text-slate-500 mt-1">Floor tracking, pacing and province capacity</p>
        </div>
        <div className="bg-white rounded-2xl p-8 ring-1 ring-slate-200/70 max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <Database size={20} className="text-amber-600" />
            <h2 className="text-lg font-bold text-navy">Migration not applied yet</h2>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            This page reads two database views that do not exist yet:{" "}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-navy">sponsor_pacing</code> and{" "}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-navy">province_capacity</code>.
          </p>
          <p className="text-slate-600 text-sm leading-relaxed mt-3">
            Run <code className="px-1.5 py-0.5 rounded bg-slate-100 text-navy">supabase/migrations/20260722000001_sponsor_pacing.sql</code>{" "}
            in the Supabase SQL editor, then reload. It adds the floor and term columns to{" "}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-navy">colleges</code> and creates both views.
          </p>
          <p className="text-slate-500 text-xs leading-relaxed mt-4">
            Placement rotation already works without this — the views are for tracking what has been
            delivered against what was promised.
          </p>
        </div>
      </div>
    );
  }

  if (pacing.isLoading || capacity.isLoading)
    return <div className="text-center py-20 text-slate-400">Loading delivery data…</div>;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold text-navy">Delivery &amp; Commitments</h1>
        <p className="text-slate-500 mt-1">
          Learners reached against contracted floors — distinct people, not placement views
        </p>
      </div>

      {/* ---- headline numbers ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {stats.map(({ label, value, icon: Icon, fg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{label}</div>
                <div className="text-3xl font-extrabold text-navy mt-2 tabular-nums">{value}</div>
              </div>
              <Icon size={20} className={fg} />
            </div>
          </div>
        ))}
      </div>

      {/* ---- province capacity ---- */}
      <div className="mb-7">
        <h2 className="text-lg font-bold text-navy mb-1">Province capacity</h2>
        <p className="text-slate-500 text-sm mb-3">
          Every floor sold in a province is a claim on the same pool of learners. Do not onboard another
          sponsor where this reads TIGHT or OVERSOLD (clause 3.4.1).
        </p>
        {caps.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 ring-1 ring-slate-200/70 text-slate-400 text-sm">
            No sponsors with an agreed floor yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {caps.map((c) => (
              <div key={c.province} className="bg-white rounded-2xl p-5 ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-navy">{c.province}</div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ring-1 ${statusTone(c.capacity_status)}`}>
                    {c.capacity_status.split("—")[0].trim()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xl font-extrabold text-navy tabular-nums">{c.active_sponsors}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Sponsors</div>
                  </div>
                  <div>
                    <div className="text-xl font-extrabold text-navy tabular-nums">
                      {c.committed_floor.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Committed</div>
                  </div>
                  <div>
                    <div className="text-xl font-extrabold text-navy tabular-nums">
                      {c.distinct_learners_reached.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Reached</div>
                  </div>
                </div>
                {c.coverage_ratio !== null && (
                  <div className="mt-3 text-xs text-slate-500">
                    Coverage <span className="font-bold text-navy tabular-nums">{c.coverage_ratio}×</span> of committed floors
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- sponsor pacing ---- */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-navy">Sponsor pacing</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            The marker on each bar is the pro-rata expectation for today. Falling behind it is the early
            warning; the floor itself is only assessed at end of term.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sponsor…"
                className="pl-9 pr-3 py-2 text-sm rounded-xl ring-1 ring-slate-200 focus:ring-brand outline-none w-56"
              />
            </div>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl ring-1 ring-slate-200 focus:ring-brand outline-none"
            >
              <option value="all">All provinces</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl ring-1 ring-slate-200 focus:ring-brand outline-none"
            >
              <option value="all">All statuses</option>
              <option value="BREACH">Breach</option>
              <option value="BEHIND">Behind</option>
              <option value="ON TRACK">On track</option>
              <option value="MET">Met</option>
            </select>
            {(province !== "all" || status !== "all" || search) && (
              <button
                onClick={() => {
                  setProvince("all");
                  setStatus("all");
                  setSearch("");
                }}
                className="px-3 py-2 text-sm rounded-xl text-slate-500 hover:text-navy hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            {rows.length === 0
              ? "No sponsors have an agreed floor and term yet. Set them on the Sponsors page."
              : "No sponsors match these filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-bold">Sponsor</th>
                  <th className="px-5 py-3 font-bold">Province</th>
                  <th className="px-5 py-3 font-bold w-56">Progress to floor</th>
                  <th className="px-5 py-3 font-bold text-right">Reached</th>
                  <th className="px-5 py-3 font-bold text-right">Floor</th>
                  <th className="px-5 py-3 font-bold text-right">Variance</th>
                  <th className="px-5 py-3 font-bold text-right">Term</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.college_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-semibold text-navy">
                      {r.college_name}
                      <span className="block text-[11px] font-normal text-slate-400 tabular-nums">
                        {r.views.toLocaleString()} placement views
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{r.province || "National"}</td>
                    <td className="px-5 py-3.5">
                      <Bar delivered={r.delivered} floor={r.impression_floor} expected={r.expected_to_date} />
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-navy">
                      {r.delivered.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-600">
                      {r.impression_floor.toLocaleString()}
                    </td>
                    <td
                      className={`px-5 py-3.5 text-right tabular-nums font-semibold ${
                        r.variance < 0 ? "text-amber-600" : "text-[#6f9e00]"
                      }`}
                    >
                      {r.variance > 0 ? "+" : ""}
                      {r.variance.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-500 text-xs">
                      {r.days_elapsed}/{r.term_days}d
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ring-1 whitespace-nowrap ${statusTone(r.status)}`}>
                        {r.status.split("—")[0].trim()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-4 leading-relaxed max-w-3xl">
        <b>Reached</b> counts distinct learners; <b>placement views</b> counts every time a placement was
        shown, including repeat views by the same person. The contractual measure in clause 3.5 is
        learners reached. Founding sponsors may exit at day 90 under clause 3.6 if reached is below a
        quarter of the floor.
      </p>
    </div>
  );
}
