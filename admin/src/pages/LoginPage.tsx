import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-deepnavy via-navy to-deepnavy px-4 overflow-hidden">
      <div className="absolute -top-40 -right-32 w-96 h-96 rounded-full bg-brand/30 blur-3xl" />
      <div className="absolute -bottom-40 -left-32 w-96 h-96 rounded-full bg-brand2/20 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand2 to-brand grid place-items-center shadow-xl shadow-brand/40 mb-4">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="18.4" r="1.5" fill="#fff" />
              <path d="M12 18 C10.8 14 9 10.6 8.2 7.8" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
              <circle cx="8.2" cy="7" r="1.5" fill="#fff" />
              <path d="M12 18 C13.2 14 15 10.6 15.8 7.8" stroke="#b6f400" strokeWidth="1.9" strokeLinecap="round" />
              <circle cx="15.8" cy="6.8" r="2" fill="#b6f400" />
            </svg>
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-white">vula</h1>
          <p className="text-muted text-sm mt-1">Admin dashboard</p>
        </div>

        <div className="bg-white/[0.04] backdrop-blur border border-white/10 rounded-2xl p-7 shadow-2xl">
          {error && (
            <div className="mb-5 flex gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@vulacareers.co.za"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-heading font-bold text-white bg-gradient-to-r from-brand2 to-brand hover:shadow-lg hover:shadow-brand/40 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader className="w-5 h-5 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">Secure access · Vula · vulacareers.co.za</p>
      </div>
    </div>
  );
}
