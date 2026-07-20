import { useAuth } from "../lib/auth";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, GraduationCap, Cpu, LogOut, ClipboardList, TrendingUp, Clock } from "lucide-react";

function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-xl bg-gradient-to-br from-brand2 to-brand grid place-items-center shadow-lg shadow-brand/30 shrink-0"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="18.4" r="1.5" fill="#fff" />
        <path d="M12 18 C10.8 14 9 10.6 8.2 7.8" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="8.2" cy="7" r="1.5" fill="#fff" />
        <path d="M12 18 C13.2 14 15 10.6 15.8 7.8" stroke="#b6f400" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="15.8" cy="6.8" r="2" fill="#b6f400" />
      </svg>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const nav = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/students", label: "Students", icon: Users },
    { path: "/sponsors", label: "Sponsors", icon: GraduationCap },
    { path: "/sponsor-impact", label: "Sponsor Impact", icon: TrendingUp },
    { path: "/reengagement", label: "Re-engagement", icon: Clock },
    { path: "/waitlist", label: "Waitlist", icon: ClipboardList },
    { path: "/backend", label: "System", icon: Cpu },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-gradient-to-b from-deepnavy to-navy text-white flex flex-col">
        <div className="flex items-center gap-3 px-6 h-[72px] border-b border-white/5">
          <LogoMark />
          <div className="leading-none">
            <div className="font-heading font-extrabold text-xl tracking-tight">vula</div>
            <div className="text-[10px] text-muted mt-1">Admin</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {nav.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition relative ${
                  active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-lime" />}
                <Icon size={18} className={active ? "text-lime" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-white/10 grid place-items-center font-semibold text-sm">
              {(user?.email?.[0] || "A").toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted">Signed in</div>
              <div className="text-sm font-medium truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition border border-white/10"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
