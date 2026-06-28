import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Users, CheckCircle, Target, TrendingUp, ArrowUpRight, Calendar } from "lucide-react";

interface Stat {
  label: string;
  value: number;
  change: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export default function DashboardPage() {
  const { data: students = [], isLoading: studentsLoading } = useQuery({
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
      const { data, error } = await supabase
        .from("assessments")
        .select("*")
        .eq("status", "completed");
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

  const conversionRate =
    students.length > 0 ? Math.round(((assessments.length / students.length) * 100)) : 0;

  const stats: Stat[] = [
    {
      label: "Total Students",
      value: students.length,
      change: 12,
      icon: <Users className="w-8 h-8" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Completed Assessments",
      value: assessments.length,
      change: 8,
      icon: <CheckCircle className="w-8 h-8" />,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Qualified Leads",
      value: leads.length,
      change: 15,
      icon: <Target className="w-8 h-8" />,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Conversion Rate",
      value: conversionRate,
      change: 3,
      icon: <TrendingUp className="w-8 h-8" />,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  const recentStudents = students.slice(0, 5);

  if (studentsLoading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600 flex items-center gap-2">
          <Calendar size={16} />
          Overview of your Pathfinder platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-4">
              <div className={`${stat.bgColor} p-3 rounded-lg ${stat.color}`}>{stat.icon}</div>
              <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <ArrowUpRight size={16} />
                {stat.change}%
              </div>
            </div>
            <p className="text-gray-600 text-sm font-medium mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900">
              {stat.value}
              {stat.label.includes("Rate") && "%"}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Students */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Students</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Grade</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">School</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No students yet
                  </td>
                </tr>
              ) : (
                recentStudents.map((student: any) => (
                  <tr key={student.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {student.first_name || student.last_name
                          ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
                          : "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{student.phone_number}</td>
                    <td className="px-6 py-4 text-gray-600">{student.grade || "N/A"}</td>
                    <td className="px-6 py-4 text-gray-600">{student.school_name || "N/A"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(student.created_at).toLocaleDateString()}
                    </td>
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
