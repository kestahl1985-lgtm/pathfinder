import { useAuth } from "../lib/auth";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, Users, Target, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/", label: "Dashboard", icon: BarChart3 },
    { path: "/students", label: "Students", icon: Users },
    { path: "/leads", label: "Qualified Leads", icon: Target },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 flex flex-col border-r border-slate-700`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6">
          {sidebarOpen && <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Pathfinder</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-slate-700 rounded-lg transition"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive(path)
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Icon size={20} />
              {sidebarOpen && <span className="font-medium">{label}</span>}
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-slate-700">
          {sidebarOpen && (
            <div className="mb-4 p-3 bg-slate-700 rounded-lg">
              <p className="text-xs text-slate-400">Logged in as</p>
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition font-medium"
          >
            <LogOut size={18} />
            {sidebarOpen && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
