import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Send, X, Clock, AlertCircle, Loader } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

interface QueueRow {
  id: string;
  phone: string;
  status: string;
  queued_at: string;
}

interface SessionInfo {
  phone: string;
  data: Record<string, any>;
}

export default function ReengagementPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["reengagement_queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reengagement_queue")
        .select("*")
        .eq("status", "pending")
        .order("queued_at", { ascending: true });
      if (error) throw error;
      return (data as QueueRow[]) || [];
    },
  });

  // whatsapp_sessions has no FK to reengagement_queue (different tables,
  // joined manually here), so fetch learner context in a second query keyed
  // on the phones actually in the queue.
  const { data: sessions = [] } = useQuery({
    queryKey: ["reengagement_sessions", rows.map((r) => r.phone).join(",")],
    enabled: rows.length > 0,
    queryFn: async () => {
      const phones = rows.map((r) => r.phone);
      const { data, error } = await supabase.from("whatsapp_sessions").select("phone, data").in("phone", phones);
      if (error) throw error;
      return (data as SessionInfo[]) || [];
    },
  });

  const sessionByPhone = new Map(sessions.map((s) => [s.phone, s]));
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["reengagement_queue"] });
    queryClient.invalidateQueries({ queryKey: ["reengagement_sessions"] });
  };

  const action = async (queueId: string, act: "send" | "skip") => {
    setError("");
    setActioningId(queueId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired — please sign in again.");

      const res = await fetch(`${API_URL}/reengage-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ queueId, action: act }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `Failed to ${act}`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${act}`);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Re-engagement Schedule</h1>
        <p className="text-gray-600">
          Learners due for a check-in nudge. Sending is manual — review who's on the list and send (or skip) each one.
        </p>
      </div>

      <div className="mb-4 flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          Sending uses a WhatsApp Message Template (learners are outside the 24h free-form reply window by the time
          they're due). That template needs to be approved in Meta Business Manager before Send will work — see
          WHATSAPP_PRODUCTION.md.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}

      {isLoading && <div className="text-center py-12 text-gray-500">Loading schedule…</div>}

      {!isLoading && rows.length === 0 && (
        <div className="text-center py-12">
          <Clock size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 mb-2">Nobody's due right now</p>
          <p className="text-sm text-gray-500">
            This fills up automatically — a daily job checks which learners are due for a check-in and adds them here.
          </p>
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Learner</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Phone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy">Queued</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const s = sessionByPhone.get(row.phone);
                  const name = [s?.data?.name, s?.data?.surname].filter(Boolean).join(" ") || "—";
                  const busy = actioningId === row.id;
                  return (
                    <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-navy">{name}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{row.phone.replace("whatsapp:", "")}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{new Date(row.queued_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => action(row.id, "send")}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-brand2 to-brand hover:shadow-md transition disabled:opacity-50"
                          >
                            {busy ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                            Send
                          </button>
                          <button
                            onClick={() => action(row.id, "skip")}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
                          >
                            <X size={14} />
                            Skip
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
