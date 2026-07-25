import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Activity, Zap, MessageSquare, CheckCircle, AlertCircle, Clock, Database, Server, Users } from "lucide-react";

// Real system/status page. Everything here is measured live — a health ping of
// the backend API and Supabase, plus real counts from the database. It refreshes
// on an interval, so "last updated" and the numbers are genuine.
//
// Deliberately NOT shown: uptime %, per-service latency history, error rate, a
// live event stream. Those need monitoring infrastructure this project does not
// have, and a status page that shows numbers it can't actually measure is worse
// than one that shows fewer honest ones.

const API_HEALTH = "https://api.vulacareers.co.za/health";
const REFRESH_MS = 20000;

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function sessionStatus(row: { step: string; q: number; report_token: string | null }): string {
  if (row.report_token) return "Completed assessment";
  if (row.step === "assessment") return `Assessment in progress · Q${(row.q || 0) + 1}/30`;
  if (row.step === "results" || row.step === "exploring") return "Exploring results";
  return "Onboarding";
}

async function count(table: string, apply?: (q: any) => any): Promise<number> {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count: c, error } = await q;
  if (error) throw error;
  return c || 0;
}

interface Health { ok: boolean; ms: number | null }

async function loadStatus() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isoToday = startOfToday.toISOString();

  // --- API health (real ping) ---
  let api: Health = { ok: false, ms: null };
  {
    const t0 = performance.now();
    try {
      const r = await fetch(API_HEALTH, { cache: "no-store" });
      const j = await r.json();
      api = { ok: r.ok && j.status === "ok", ms: Math.round(performance.now() - t0) };
    } catch {
      api = { ok: false, ms: null };
    }
  }

  // --- Supabase health (real timed query) ---
  let db: Health = { ok: false, ms: null };
  const dbT0 = performance.now();
  const { error: dbErr } = await supabase.from("whatsapp_sessions").select("phone", { count: "exact", head: true });
  db = { ok: !dbErr, ms: Math.round(performance.now() - dbT0) };

  const [total, completed, activeToday, impressions, sponsors, waitlist, recent] = await Promise.all([
    count("whatsapp_sessions"),
    count("whatsapp_sessions", (q) => q.not("report_token", "is", null)),
    count("whatsapp_sessions", (q) => q.gte("updated_at", isoToday)),
    count("sponsor_matches"),
    count("colleges", (q) => q.eq("active", true)),
    count("waitlist").catch(() => 0),
    supabase
      .from("whatsapp_sessions")
      .select("phone, step, q, report_token, updated_at")
      .order("updated_at", { ascending: false })
      .limit(8)
      .then((r) => (r.data as any[]) || []),
  ]);

  return {
    api,
    db,
    metrics: { total, completed, activeToday, impressions, sponsors, waitlist },
    completion: total > 0 ? Math.round((completed / total) * 100) : 0,
    lastActivity: recent[0]?.updated_at || null,
    recent,
    fetchedAt: new Date().toISOString(),
  };
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${ok ? "text-green-400" : "text-red-400"}`}>
      <div className={`w-2 h-2 rounded-full ${ok ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

export default function BackendPage() {
  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["system-status"],
    queryFn: loadStatus,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const allOk = !!data && data.api.ok && data.db.ok;

  const metricCards = data
    ? [
        { label: "Total learners", value: data.metrics.total.toLocaleString(), icon: Users },
        { label: "Completed assessments", value: data.metrics.completed.toLocaleString(), icon: CheckCircle },
        { label: "Completion rate", value: `${data.completion}%`, icon: Activity },
        { label: "Active today", value: data.metrics.activeToday.toLocaleString(), icon: MessageSquare },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="relative p-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            {isLoading ? (
              <StatusPill ok={false} label="CHECKING…" />
            ) : allOk ? (
              <StatusPill ok label="ALL SYSTEMS OPERATIONAL" />
            ) : (
              <StatusPill ok={false} label="DEGRADED — see below" />
            )}
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">System</h1>
          <p className="text-slate-400">
            Live health and usage — refreshes every {REFRESH_MS / 1000}s.
            {dataUpdatedAt ? ` Last checked ${relTime(new Date(dataUpdatedAt).toISOString())}.` : ""}
          </p>
        </div>

        {isError && (
          <div className="mb-8 flex items-center gap-3 bg-red-900/40 border border-red-700 rounded-xl p-5 text-red-200">
            <AlertCircle className="w-5 h-5 shrink-0" />
            Could not load system status — the admin can't reach the database. That itself is a signal:
            check Supabase and your network.
          </div>
        )}

        {/* Real metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metricCards.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Icon className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <p className="text-slate-400 text-sm mb-1">{m.label}</p>
                <p className="text-3xl font-bold text-white tabular-nums">{isLoading ? "…" : m.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Health checks */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Health checks</h2>
                  <p className="text-slate-400 text-sm">Pinged live from this page</p>
                </div>
              </div>
              <div className="p-8 space-y-4">
                {[
                  { name: "Backend API (/health)", icon: Server, h: data?.api, note: "The webhook & report endpoints run here" },
                  { name: "Supabase database", icon: Database, h: data?.db, note: "Sessions, sponsors, impressions" },
                ].map((svc) => {
                  const Icon = svc.icon;
                  const ok = !!svc.h?.ok;
                  return (
                    <div key={svc.name} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-600">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? "bg-slate-500" : ok ? "bg-green-500" : "bg-red-500"}`} />
                        <Icon className="w-5 h-5 text-slate-400" />
                        <div className="flex-1">
                          <p className="text-white font-semibold">{svc.name}</p>
                          <p className="text-slate-400 text-xs">{svc.note}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isLoading ? "text-slate-400" : ok ? "text-green-400" : "text-red-400"}`}>
                          {isLoading ? "…" : ok ? "Reachable" : "Unreachable"}
                        </p>
                        <p className="text-slate-400 text-xs">{svc.h?.ms != null ? `${svc.h.ms} ms` : ""}</p>
                      </div>
                    </div>
                  );
                })}
                {/* WhatsApp pipeline — inferred from real learner activity, not a fake uptime */}
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-600">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#25d366]" />
                    <MessageSquare className="w-5 h-5 text-slate-400" />
                    <div className="flex-1">
                      <p className="text-white font-semibold">WhatsApp pipeline</p>
                      <p className="text-slate-400 text-xs">Last learner message received</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">{isLoading ? "…" : relTime(data?.lastActivity || null)}</p>
                    <p className="text-slate-400 text-xs">from live sessions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Latency + real totals */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 border border-emerald-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <Zap className="w-8 h-8 text-emerald-400" />
                <span className="text-emerald-400 text-xs font-bold">{allOk ? "OK" : "CHECK"}</span>
              </div>
              <p className="text-emerald-200 text-sm mb-2">API round-trip</p>
              <p className="text-2xl font-bold text-white tabular-nums">{data?.api.ms != null ? `${data.api.ms} ms` : "—"}</p>
              <p className="text-emerald-400 text-xs mt-4">DB query {data?.db.ms != null ? `${data.db.ms} ms` : "—"}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-900 to-blue-950 border border-blue-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <Activity className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-blue-200 text-sm mb-2">Sponsor impressions logged</p>
              <p className="text-2xl font-bold text-white tabular-nums">{isLoading ? "…" : (data?.metrics.impressions ?? 0).toLocaleString()}</p>
              <p className="text-blue-400 text-xs mt-4">{data?.metrics.sponsors ?? 0} active sponsor{(data?.metrics.sponsors ?? 0) === 1 ? "" : "s"} · {data?.metrics.waitlist ?? 0} on waitlist</p>
            </div>
          </div>
        </div>

        {/* Real recent activity */}
        <div className="mt-8 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Recent activity</h2>
            <p className="text-slate-400 text-sm">Most recent learner sessions</p>
          </div>
          <div className="p-8 space-y-3 max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="text-slate-500 text-sm">Loading…</p>
            ) : (data?.recent.length ?? 0) === 0 ? (
              <p className="text-slate-500 text-sm">No learner sessions yet.</p>
            ) : (
              data!.recent.map((row: any, idx: number) => (
                <div key={idx} className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-600">
                  <div className="mt-0.5">
                    {row.report_token ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Clock className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{sessionStatus(row)}</p>
                    <p className="text-slate-400 text-xs mt-1">···{String(row.phone || "").slice(-4)}</p>
                  </div>
                  <div className="text-slate-400 text-xs whitespace-nowrap flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {relTime(row.updated_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
