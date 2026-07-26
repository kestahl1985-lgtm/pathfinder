import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Search, MessageCircle, FileDown, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import MessageModal from "../components/MessageModal";

const API_URL = import.meta.env.VITE_API_URL;

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
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [messaging, setMessaging] = useState<{ phone: string; name?: string } | null>(null);
  const [confirming, setConfirming] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Erase a learner across every table that keys off their phone — the same
  // cascade as the learner-facing DELETE command (lib/assessment.js
  // deleteSession). Irreversible; POPIA right-to-erasure from the admin side.
  const deleteLearner = async (phone: string) => {
    setDeleting(true);
    setDeleteError("");
    await supabase.from("sponsor_matches").delete().eq("phone", phone);
    await supabase.from("reengagement_queue").delete().eq("phone", phone);
    const { error } = await supabase.from("whatsapp_sessions").delete().eq("phone", phone);
    setDeleting(false);
    if (error) { setDeleteError(error.message); return; }
    setConfirming(null);
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

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
      s.data?.surname?.toLowerCase().includes(term) ||
      s.data?.province?.toLowerCase().includes(term) ||
      s.data?.city?.toLowerCase().includes(term) ||
      s.data?.suburb?.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Students</h1>
        <p className="text-gray-600">All WhatsApp assessment sessions. Completed students have a downloadable PDF report.</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, surname, phone or province…"
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
            {searchTerm ? "Try adjusting your search" : "Students will appear here once they start the assessment"}
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Province</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Age</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Report</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Last Active</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy"></th>
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
                        <span className="font-medium text-navy">{[s.data?.name, s.data?.surname].filter(Boolean).join(" ") || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{s.phone.replace("whatsapp:", "")}</td>
                    <td className="px-6 py-4 text-gray-600">{s.data?.province || "—"}</td>
                    <td className="px-6 py-4 text-gray-600">{s.data?.age || "—"}</td>
                    <td className="px-6 py-4">
                      {s.report_token ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">✅ Complete</span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">⏳ Q{s.q} / 30</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {s.report_token ? (
                        <a
                          href={`${API_URL}/report?t=${s.report_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download PDF report"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-brand2 to-brand hover:shadow-md transition"
                        >
                          <FileDown size={14} /> PDF
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(s.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setMessaging({ phone: s.phone, name: s.data?.name })}
                          title="Send WhatsApp message"
                          className="p-2 rounded-lg text-brand hover:bg-brand/10 transition"
                        >
                          <MessageCircle size={18} />
                        </button>
                        <button
                          onClick={() => { setDeleteError(""); setConfirming(s); }}
                          title="Delete learner and all their data"
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
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

      {messaging && (
        <MessageModal phone={messaging.phone} name={messaging.name} onClose={() => setMessaging(null)} />
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => !deleting && setConfirming(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-lg font-bold text-navy">Delete this learner?</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                This permanently erases{" "}
                <span className="font-semibold text-navy">
                  {[confirming.data?.name, confirming.data?.surname].filter(Boolean).join(" ") || confirming.phone.replace("whatsapp:", "")}
                </span>{" "}
                — their session, assessment answers, any sponsor-match records and re-engagement entries.
                This mirrors a learner's own DELETE request and <span className="font-semibold">cannot be undone</span>.
              </p>
              {deleteError && <p className="text-xs text-red-600 mt-3">{deleteError}</p>}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setConfirming(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteLearner(confirming.phone)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? <><Loader2 size={16} className="animate-spin" /> Deleting…</> : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
