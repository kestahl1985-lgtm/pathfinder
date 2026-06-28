import { Activity, Zap, MessageSquare, TrendingUp, AlertCircle, CheckCircle, Clock, Eye } from "lucide-react";

interface SystemStatus {
  name: string;
  status: "healthy" | "warning" | "error";
  uptime: string;
  latency: number;
}

const systemStatus: SystemStatus[] = [
  { name: "WhatsApp Gateway", status: "healthy", uptime: "99.8%", latency: 145 },
  { name: "Claude API", status: "healthy", uptime: "99.9%", latency: 320 },
  { name: "Supabase", status: "healthy", uptime: "99.95%", latency: 89 },
  { name: "Twilio", status: "healthy", uptime: "99.7%", latency: 220 },
];

const activityLog = [
  { id: 1, type: "webhook", message: "WhatsApp message received from +27123456789", time: "2 min ago", status: "success" },
  { id: 2, type: "assessment", message: "Student completed question 12", time: "5 min ago", status: "success" },
  { id: 3, type: "claude", message: "Generated midway insight for assessment", time: "8 min ago", status: "success" },
  { id: 4, type: "database", message: "Assessment data stored", time: "10 min ago", status: "success" },
  { id: 5, type: "webhook", message: "WhatsApp message sent successfully", time: "12 min ago", status: "success" },
];

const metrics = [
  { label: "Messages Processed", value: "1,247", change: "+12%", icon: MessageSquare },
  { label: "Assessments Active", value: "48", change: "+5", icon: Activity },
  { label: "API Response Time", value: "234ms", change: "-8%", icon: Zap },
  { label: "Uptime", value: "99.8%", change: "↔", icon: TrendingUp },
];

export default function BackendPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob animation-delay-4000" />
      </div>

      <div className="relative p-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm font-semibold">SYSTEM OPERATIONAL</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Backend Control Center</h1>
          <p className="text-slate-400">Real-time monitoring and management</p>
        </div>

        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="group bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/20"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition">
                    <Icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-green-400 text-xs font-semibold">{metric.change}</span>
                </div>
                <p className="text-slate-400 text-sm mb-1">{metric.label}</p>
                <p className="text-3xl font-bold text-white">{metric.value}</p>
              </div>
            );
          })}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Status */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-8 py-6 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">System Health</h2>
                  <p className="text-slate-400 text-sm">All integrations status</p>
                </div>
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold">All Green</span>
                </div>
              </div>

              {/* Services */}
              <div className="p-8 space-y-4">
                {systemStatus.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl border border-slate-600 hover:border-slate-500 transition group"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-2 h-2 rounded-full ${service.status === "healthy" ? "bg-green-500" : service.status === "warning" ? "bg-yellow-500" : "bg-red-500"}`} />
                      <div className="flex-1">
                        <p className="text-white font-semibold">{service.name}</p>
                        <p className="text-slate-400 text-xs">Latency: {service.latency}ms</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-semibold">{service.uptime}</p>
                      <p className="text-slate-400 text-xs">Uptime</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 border border-emerald-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
                <span className="text-emerald-400 text-xs font-bold">LIVE</span>
              </div>
              <p className="text-emerald-200 text-sm mb-2">Production Status</p>
              <p className="text-2xl font-bold text-white">Operational</p>
              <p className="text-emerald-400 text-xs mt-4">No alerts • All systems green</p>
            </div>

            {/* Response Time */}
            <div className="bg-gradient-to-br from-blue-900 to-blue-950 border border-blue-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <Zap className="w-8 h-8 text-blue-400" />
                <span className="text-blue-400 text-xs font-bold">OPTIMAL</span>
              </div>
              <p className="text-blue-200 text-sm mb-2">Avg Response Time</p>
              <p className="text-2xl font-bold text-white">189ms</p>
              <p className="text-blue-400 text-xs mt-4">Within SLA targets</p>
            </div>

            {/* Error Rate */}
            <div className="bg-gradient-to-br from-purple-900 to-purple-950 border border-purple-700 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <Activity className="w-8 h-8 text-purple-400" />
                <span className="text-purple-400 text-xs font-bold">LOW</span>
              </div>
              <p className="text-purple-200 text-sm mb-2">Error Rate</p>
              <p className="text-2xl font-bold text-white">0.02%</p>
              <p className="text-purple-400 text-xs mt-4">Excellent reliability</p>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="mt-8 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Live Activity</h2>
              <p className="text-slate-400 text-sm">Real-time event stream</p>
            </div>
            <Eye className="w-5 h-5 text-slate-400" />
          </div>

          {/* Activity Feed */}
          <div className="p-8 space-y-3 max-h-96 overflow-y-auto">
            {activityLog.map((activity, idx) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-600 hover:border-slate-500 transition group animate-fade-in"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="mt-1">
                  {activity.status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm group-hover:text-blue-300 transition">
                    {activity.message}
                  </p>
                  <p className="text-slate-400 text-xs mt-1">{activity.type.toUpperCase()}</p>
                </div>
                <div className="text-slate-400 text-xs whitespace-nowrap flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {activity.time}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-400 text-xs">
          <p>Last updated: Just now • Refresh rate: 5s</p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
