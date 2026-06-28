import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

interface Stat {
  label: string;
  value: number;
  icon: string;
  color: string;
}

export default function DashboardPage() {
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: assessments } = useQuery({
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

  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const stats: Stat[] = [
    {
      label: "Total Students",
      value: students?.length || 0,
      icon: "👥",
      color: "#3b82f6",
    },
    {
      label: "Completed Assessments",
      value: assessments?.length || 0,
      icon: "✅",
      color: "#10b981",
    },
    {
      label: "Qualified Leads",
      value: leads?.length || 0,
      icon: "📋",
      color: "#f59e0b",
    },
    {
      label: "Conversion Rate",
      value:
        students && students.length > 0
          ? Math.round((((assessments?.length || 0) / students.length) * 100) as number)
          : 0,
      icon: "📊",
      color: "#8b5cf6",
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: "30px" }}>Dashboard</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "10px" }}>{stat.icon}</div>
            <p style={{ margin: "0 0 10px 0", color: "#6b7280", fontSize: "14px" }}>
              {stat.label}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: "bold",
                color: stat.color,
              }}
            >
              {stat.value}
              {stat.label.includes("Rate") ? "%" : ""}
            </p>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
        <p style={{ color: "#6b7280" }}>
          {students?.length || 0} students, {assessments?.length || 0} assessments completed,{" "}
          {leads?.length || 0} qualified leads
        </p>
      </div>
    </div>
  );
}
