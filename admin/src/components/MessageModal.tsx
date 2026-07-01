import { useState } from "react";
import { X, Send, Loader, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  phone: string; // whatsapp:+27... or +27...
  name?: string;
  onClose: () => void;
}

export default function MessageModal({ phone, name, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const displayPhone = phone.replace("whatsapp:", "");

  const handleSend = async () => {
    setError("");
    if (!message.trim()) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Your session expired — please sign in again.");

      const res = await fetch(`${API_URL}/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone, message: message.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to send message");
      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-navy">Send WhatsApp message</h2>
            <p className="text-sm text-gray-500">
              {name ? `${name} · ` : ""}
              {displayPhone}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {sent ? (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="font-semibold text-navy">Message sent!</p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-lg bg-brand text-white font-medium hover:opacity-90 transition"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  WhatsApp only allows free-form replies within 24 hours of the learner's last message. If it's
                  been longer, this send may be rejected.
                </p>
              </div>

              {error && (
                <div className="mb-3 flex gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 4096))}
                placeholder="Type your message…"
                rows={5}
                autoFocus
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none resize-none"
              />
              <div className="flex items-center justify-between mt-1.5 mb-4">
                <span className="text-xs text-gray-400">{message.length} / 4096</span>
              </div>

              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-brand2 to-brand hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending…" : "Send message"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
