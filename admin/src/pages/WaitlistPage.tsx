import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Search, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

interface WaitlistEntry {
  id: string;
  name: string;
  contact: string;
  source: string;
  created_at: string;
  invited_at: string | null;
}

function isLikelyPhone(contact: string): boolean {
  return /\d{6,}/.test(contact.replace(/\s/g, ""));
}

export default function WaitlistPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["waitlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as WaitlistEntry[]) || [];
    },
  });

  const filtered = entries.filter((e) => {
    const term = searchTerm.toLowerCase();
    return e.name?.toLowerCase().includes(term) || e.contact?.toLowerCase().includes(term);
  });

  const sendInvite = async (entry: WaitlistEntry) => {
    setErrorById((m) => ({ ...m, [entry.id]: "" }));
    setSendingId(entry.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired — please sign in again.");

      const res = await fetch(`${API_URL}/waitlist-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ waitlistId: entry.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to send invite");
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    } catch (err) {
      setErrorById((m) => ({ ...m, [entry.id]: err instanceof Error ? err.message : "Failed to send invite" }));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Waitlist</h1>
        <p className="text-gray-600">People who signed up before launch</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or contact…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
          />
        </div>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500">Loading waitlist…</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-2">No waitlist signups yet</p>
          <p className="text-sm text-gray-500">
            {searchTerm ? "Try adjusting your search" : "Signups from the marketing site will appear here"}
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Contact</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Source</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Signed Up</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Invite</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const phoneContact = isLikelyPhone(e.contact);
                  const sending = sendingId === e.id;
                  const error = errorById[e.id];
                  return (
                    <tr key={e.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-brand">
                              {(e.name?.[0] || "?").toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-navy">{e.name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{e.contact}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-1 bg-brand/10 text-brand rounded-full text-sm font-medium">
                          {e.source || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {new Date(e.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {!phoneContact ? (
                          <span className="text-xs text-gray-400" title="Email contact — WhatsApp invite needs a phone number">
                            Email only
                          </span>
                        ) : e.invited_at ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                            <CheckCircle2 size={14} /> Invited {new Date(e.invited_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <div>
                            <button
                              onClick={() => sendInvite(e)}
                              disabled={sending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-brand2 to-brand hover:shadow-md transition disabled:opacity-50"
                            >
                              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              {sending ? "Sending…" : "Send Vula invite"}
                            </button>
                            {error && (
                              <div className="flex items-start gap-1 mt-1.5 text-xs text-red-600 max-w-[220px]">
                                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filtered.length}</span> of{" "}
              <span className="font-semibold">{entries.length}</span> signups
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
