import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Search } from "lucide-react";
import { useState } from "react";

interface Session {
  phone: string;
  step: string;
  data: Record<string, any>;
  q: number;
  responses: number[];
  updated_at: string;
  report_token: string | null;
}

export default function StudentsPage() {
  const [searchTerm, setSearchTerm] = useState("");

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

  const filtered = sessions.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.phone.includes(term) ||
      s.data?.name?.toLowerCase().includes(term) ||
      s.data?.school?.toLowerCase().includes(term) ||
      s.data?.suburb?.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Learners</h1>
        <p className="text-gray-600">All WhatsApp assessment sessions</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, school or suburb…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
          />
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500">Loading…</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-2">No learners found</p>
          <p className="text-sm text-gray-500">
            {searchTerm ? "Try adjusting your search" : "Learners will appear here once they start the assessment"}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Phone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Grade</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">School</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Suburb</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Age</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Consented to Share</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.phone} className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-brand">
                            {(s.data?.name?.[0] || "?").toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-navy">{s.data?.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{s.phone.replace("whatsapp:", "")}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-3 py-1 bg-brand/10 text-brand rounded-full text-sm font-medium">
                        {s.data?.grade ? `Grade ${s.data.grade}` : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{s.data?.school || "—"}</td>
                    <td className="px-6 py-4 text-gray-600">{s.data?.suburb || "—"}</td>
                    <td className="px-6 py-4 text-gray-600">{s.data?.age || "—"}</td>
                    <td className="px-6 py-4">
                      {s.report_token ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">✅ Complete</span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">⏳ Q{s.q} / 30</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {s.data?.share_consent === true ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">✅ Yes</span>
                      ) : s.data?.share_consent === false ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">❌ No</span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">— Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(s.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filtered.length}</span> of{" "}
              <span className="font-semibold">{sessions.length}</span> learners
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
