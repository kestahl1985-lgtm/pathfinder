import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Search, MessageCircle, Mail } from "lucide-react";
import { useState } from "react";

interface WaitlistEntry {
  id: string;
  name: string;
  contact: string;
  source: string;
  created_at: string;
}

// Waitlist contacts haven't messaged the Vula WhatsApp number yet, so the
// admin-triggered /send-message endpoint won't work for them (it deliberately
// only sends to phones with an existing whatsapp_sessions row, to keep the
// business number from being used to cold-message people — a WhatsApp policy
// violation risk). Instead this opens a click-to-chat wa.me link with a
// pre-filled invite, sent from the admin's own WhatsApp.
const VULA_WHATSAPP_NUMBER = "27768428433";

function isLikelyPhone(contact: string): boolean {
  return /\d{6,}/.test(contact.replace(/\s/g, ""));
}

function toWaMeDigits(contact: string): string {
  let digits = contact.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("0")) digits = "27" + digits.slice(1); // assume SA local format
  return digits;
}

function inviteWaMeLink(entry: WaitlistEntry): string {
  const firstName = entry.name?.split(" ")[0] || "there";
  const text = `Hi ${firstName}! 👋 Thanks for joining the Vula waitlist. You can start your free career assessment right now — just message START to +27 76 842 8433 on WhatsApp. Takes about 5 minutes!`;
  return `https://wa.me/${toWaMeDigits(entry.contact)}?text=${encodeURIComponent(text)}`;
}

function inviteMailtoLink(entry: WaitlistEntry): string {
  const firstName = entry.name?.split(" ")[0] || "there";
  const subject = "Vula is live — start your free career assessment";
  const body = `Hi ${firstName},\n\nThanks for joining the Vula waitlist. You can start your free career assessment right now on WhatsApp — just message START to +27 76 842 8433. Takes about 5 minutes.\n\n— Vula Career Guide`;
  return `mailto:${entry.contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function WaitlistPage() {
  const [searchTerm, setSearchTerm] = useState("");

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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-navy"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const phoneContact = isLikelyPhone(e.contact);
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
                        {phoneContact ? (
                          <a
                            href={inviteWaMeLink(e)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Invite via WhatsApp"
                            className="p-2 rounded-lg text-brand hover:bg-brand/10 transition inline-flex"
                          >
                            <MessageCircle size={18} />
                          </a>
                        ) : (
                          <a
                            href={inviteMailtoLink(e)}
                            title="Invite via email"
                            className="p-2 rounded-lg text-brand hover:bg-brand/10 transition inline-flex"
                          >
                            <Mail size={18} />
                          </a>
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
