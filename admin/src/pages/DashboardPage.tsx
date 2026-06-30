import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Users, CheckCircle, Target, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assessments").select("*").eq("status", "completed");
      if (error) throw error;
      return data || [];
    },
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const conversion = students.length > 0 ? Math.round((assessments.length / students.length) * 100) : 0;

  const stats = [
    { label: "Total Learners", value: students.length, icon: Users, ring: "from-brand2/20 to-brand2/5", fg: "text-brand2" },
    { label: "Completed Assessments", value: assessments.length, icon: CheckCircle, ring: "from-lime/25 to-lime/5", fg: "text-[#6f9e00]" },
    { label: "Qualified Leads", value: leads.length, icon: Target, ring: "from-brand/20 to-brand/5", fg: "text-brand" },
    { label: "Conversion", value: `${conversion}%`, icon: TrendingUp, ring: "from-[#25d366]/20 to-[#25d366]/5", fg: "text-[#1aa34a]" },
  ];

  const recent = students.slice(0, 6);

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
          <span className="text-xs text-slate-400">{students.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="text-left font-semibold px-6 py-3">Name</th>
                <th className="text-left font-semibold px-6 py-3">Phone</th>
                <th className="text-left font-semibold px-6 py-3">Grade</th>
                <th className="text-left font-semibold px-6 py-3">School</th>
                <th className="text-left font-semibold px-6 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400">No learners yet</td>
                </tr>
              ) : (
                recent.map((s: any) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3.5 font-medium text-navy">
                      {s.first_name || s.last_name ? `${s.first_name || ""} ${s.last_name || ""}`.trim() : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{s.phone_number}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-semibold">
                        {s.grade || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{s.school_name || "—"}</td>
                    <td className="px-6 py-3.5 text-slate-400">{new Date(s.created_at).toLocaleDateString()}</td>
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
