import { useAuth } from "../lib/auth";
import { Link, useLocation } from "react-router-dom";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        style={{
          width: "250px",
          backgroundColor: "#1f2937",
          color: "white",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 30 }}>Pathfinder</h1>

        <Link
          to="/"
          style={{
            padding: "12px",
            marginBottom: "10px",
            backgroundColor: isActive("/") ? "#374151" : "transparent",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          📊 Dashboard
        </Link>

        <Link
          to="/students"
          style={{
            padding: "12px",
            marginBottom: "10px",
            backgroundColor: isActive("/students") ? "#374151" : "transparent",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          👥 Students
        </Link>

        <Link
          to="/leads"
          style={{
            padding: "12px",
            marginBottom: "20px",
            backgroundColor: isActive("/leads") ? "#374151" : "transparent",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          📋 Leads
        </Link>

        <div style={{ marginTop: "auto", paddingTop: "20px", borderTop: "1px solid #374151" }}>
          <p style={{ marginBottom: "10px", fontSize: "14px" }}>{user?.email}</p>
          <button
            onClick={() => signOut()}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: "30px", backgroundColor: "#f9fafb", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
