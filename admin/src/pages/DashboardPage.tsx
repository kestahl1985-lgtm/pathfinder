import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Users, CheckCircle, GraduationCap, TrendingUp } from "lucide-react";

interface Session {
  phone: string;
  step: string;
  data: Record<string, any>;
  q: number;
  responses: number[];
  updated_at: string;
  report_token: string | null;
}

export default function DashboardPage() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_sessions")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as Session[]) || [];
    },
  });

  const { data: sponsorCount = 0 } = useQuery({
    queryKey: ["colleges", "active-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("colleges")
        .select("*", { count: "exact", head: true })
        .eq("active", true);
      if (error) throw error;
      return count || 0;
    },
  });

  const completed = sessions.filter((s) => s.report_token);
  const conversion = sessions.length > 0 ? Math.round((completed.length / sessions.length) * 100) : 0;

  const stats = [
    { label: "Total Learners", value: sessions.length, icon: Users, ring: "from-brand2/20 to-brand2/5", fg: "text-brand2" },
    { label: "Completed Assessments", value: completed.length, icon: CheckCircle, ring: "from-lime/25 to-lime/5", fg: "text-[#6f9e00]" },
    { label: "Active Sponsors", value: sponsorCount, icon: GraduationCap, ring: "from-brand/20 to-brand/5", fg: "text-brand" },
    { label: "Conversion", value: `${conversion}%`, icon: TrendingUp, ring: "from-[#25d366]/20 to-[#25d366]/5", fg: "text-[#1aa34a]" },
  ];

  const recent = sessions.slice(0, 6);

  if (isLoading) return <div className="text-center py-20 text-slate-400">Loading dashboard…</div>;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold text-navy">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your Vula platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-sm hover:shadow-md transition">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.ring} grid place-items-center mb-4`}>
                <Icon className={`w-6 h-6 ${s.fg}`} />
              </div>
              <div className="text-3xl font-extrabold text-navy font-heading">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">Recent Learners</h2>
          <span className="text-xs text-slate-400">{sessions.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="text-left font-semibold px-6 py-3">Name</th>
                <th className="text-left font-semibold px-6 py-3">Phone</th>
                <th className="text-left font-semibold px-6 py-3">Age</th>
                <th className="text-left font-semibold px-6 py-3">Province</th>
                <th className="text-left font-semibold px-6 py-3">Status</th>
                <th className="text-left font-semibold px-6 py-3">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">No learners yet</td>
                </tr>
              ) : (
                recent.map((s) => (
                  <tr key={s.phone} className="border-t border-slate-100 hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3.5 font-medium text-navy">{s.data?.name || "—"}</td>
                    <td className="px-6 py-3.5 text-slate-500">{s.phone.replace("whatsapp:", "")}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-semibold">
                        {s.data?.age || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{s.data?.province || "—"}</td>
                    <td className="px-6 py-3.5">
                      {s.report_token ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">✅ Complete</span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">⏳ Q{s.q}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">{new Date(s.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
