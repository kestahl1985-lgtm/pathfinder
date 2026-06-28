import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useState } from "react";
import { Filter, ArrowRight } from "lucide-react";

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
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
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

  const statusConfig: Record<string, { color: string; bgColor: string; icon: string }> = {
    new: { color: "text-blue-700", bgColor: "bg-blue-100", icon: "🆕" },
    contacted: { color: "text-purple-700", bgColor: "bg-purple-100", icon: "📞" },
    interested: { color: "text-orange-700", bgColor: "bg-orange-100", icon: "👀" },
    enrolled: { color: "text-green-700", bgColor: "bg-green-100", icon: "✅" },
    rejected: { color: "text-red-700", bgColor: "bg-red-100", icon: "❌" },
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Qualified Leads</h1>
        <p className="text-gray-600">Track and manage student enrollments</p>
      </div>

      {/* Filter */}
      <div className="mb-6 flex gap-3">
        <div className="flex gap-2 flex-wrap">
          {["all", "new", "contacted", "interested", "enrolled", "rejected"].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedStatus === status
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {status === "all" ? "All Leads" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {leadsLoading && <div className="text-center py-12 text-gray-500">Loading leads...</div>}

      {!leadsLoading && filteredLeads.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-2">No leads found</p>
          <p className="text-sm text-gray-500">Students who complete assessments will appear here</p>
        </div>
      )}

      {filteredLeads.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Student</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">College</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Update Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const config = statusConfig[lead.status];
                  return (
                    <tr key={lead.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{getStudentName(lead.student_id)}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{getCollegeName(lead.college_id)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${config.bgColor} ${config.color}`}>
                          {config.icon} {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            updateMutation.mutate({
                              leadId: lead.id,
                              newStatus: e.target.value,
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer disabled:opacity-50"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="interested">Interested</option>
                          <option value="enrolled">Enrolled</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredLeads.length}</span> leads
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
