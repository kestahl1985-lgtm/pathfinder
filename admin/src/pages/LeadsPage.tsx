import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useState } from "react";

interface Lead {
  id: string;
  student_id: string;
  college_id: string;
  status: "new" | "contacted" | "interested" | "enrolled" | "rejected";
  notes: string;
  created_at: string;
}

interface Student {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number: string;
}

interface College {
  id: string;
  name: string;
}

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Lead[]) || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*");
      if (error) throw error;
      return (data as Student[]) || [];
    },
  });

  const { data: colleges = [] } = useQuery({
    queryKey: ["colleges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("colleges").select("*");
      if (error) throw error;
      return (data as College[]) || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (leadId: string, newStatus: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const filteredLeads =
    selectedStatus === "all" ? leads : leads.filter((l) => l.status === selectedStatus);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "#3b82f6",
      contacted: "#8b5cf6",
      interested: "#f59e0b",
      enrolled: "#10b981",
      rejected: "#ef4444",
    };
    return colors[status] || "#6b7280";
  };

  const getStudentName = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    return student
      ? `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Unknown"
      : "Unknown";
  };

  const getCollegeName = (collegeId: string) => {
    const college = colleges.find((c) => c.id === collegeId);
    return college?.name || "Unknown";
  };

  return (
    <div>
      <h1 style={{ marginBottom: "20px" }}>Qualified Leads</h1>

      <div style={{ marginBottom: "20px" }}>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{
            padding: "10px",
            border: "1px solid #d1d5db",
            borderRadius: "4px",
            backgroundColor: "white",
          }}
        >
          <option value="all">All Leads</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="interested">Interested</option>
          <option value="enrolled">Enrolled</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {leadsLoading && <p>Loading...</p>}

      {!leadsLoading && !filteredLeads.length && <p>No leads found.</p>}

      {filteredLeads.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Student</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>College</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Status</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px" }}>{getStudentName(lead.student_id)}</td>
                  <td style={{ padding: "12px" }}>{getCollegeName(lead.college_id)}</td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        backgroundColor: getStatusColor(lead.status) + "20",
                        color: getStatusColor(lead.status),
                        padding: "6px 12px",
                        borderRadius: "4px",
                        fontSize: "14px",
                        fontWeight: "500",
                      }}
                    >
                      {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <select
                      value={lead.status}
                      onChange={(e) => updateMutation.mutate(lead.id, e.target.value)}
                      style={{
                        padding: "6px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        backgroundColor: "white",
                        cursor: "pointer",
                      }}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="interested">Interested</option>
                      <option value="enrolled">Enrolled</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
