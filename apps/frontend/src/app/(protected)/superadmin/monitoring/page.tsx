"use client";

import DemoDataBanner from '@/components/shared/DemoDataBanner';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from "recharts";

// Mock Data
const kafkaStreamData = [
    { time: "T-60s", value: 400 },
    { time: "T-55s", value: 650 },
    { time: "T-50s", value: 300 },
    { time: "T-45s", value: 900 },
    { time: "T-40s", value: 500 },
    { time: "T-35s", value: 850 },
    { time: "T-30s", value: 450 },
    { time: "T-25s", value: 1200 },
    { time: "T-20s", value: 1482 },
    { time: "T-15s", value: 900 },
    { time: "T-10s", value: 650 },
    { time: "T-5s", value: 1000 },
    { time: "Now", value: 850 },
];

export default function SystemMonitoringPage() {
    return (
        <div className="max-w-[1600px] mx-auto w-full font-sans text-slate-900 min-h-screen flex flex-col xl:flex-row xl:flex-wrap gap-6">
            <div className="basis-full"><DemoDataBanner /></div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col gap-6">

                {/* Server Health Status Header */}
                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
                        <span className="material-icons text-sm">dns</span>
                        Server Health Status
                    </div>
                    <span className="text-xs font-semibold text-slate-400">Updated: Just Now</span>
                </div>

                {/* KPI Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* CPU Usage */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">CPU Usage</h3>
                            <span className="text-xl font-extrabold text-blue-500">42.8%</span>
                        </div>
                        <div className="mb-3">
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '42.8%' }}></div>
                            </div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span>Core 01: 38%</span>
                            <span>Core 02: 48%</span>
                        </div>
                    </div>

                    {/* Memory Utilization */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Memory Utilization</h3>
                            <span className="text-xl font-extrabold text-indigo-500">12.4 GB</span>
                        </div>
                        <div className="mb-3">
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                            </div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span>Used: 12.4GB</span>
                            <span>Free: 4.2GB</span>
                        </div>
                    </div>

                    {/* Disk I/O */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Disk I/O</h3>
                            <span className="text-xl font-extrabold text-emerald-500">125 MB/s</span>
                        </div>
                        <div className="mb-3">
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '40%' }}></div>
                            </div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span>Reads: 85MB/s</span>
                            <span>Writes: 40MB/s</span>
                        </div>
                    </div>

                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Kafka Event Stream Chart */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col min-h-[350px]">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Kafka Event Stream</h2>
                                <p className="text-xs font-medium text-slate-500 mt-1">Throughput messages per second (avg/s)</p>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs bg-emerald-50 px-2 py-1 rounded">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                Live
                                <span className="material-icons text-[14px] ml-1">fullscreen</span>
                            </div>
                        </div>

                        <div className="relative flex-1 w-full mt-4">
                            <div className="absolute top-4 right-10 bg-white border border-blue-100 shadow-sm p-3 rounded-xl z-10 font-mono text-xs">
                                <div className="text-blue-600 font-bold mb-1">Current: <span className="text-slate-800">1,482 msg/s</span></div>
                                <div className="text-slate-500">Peak: 2,180 msg/s</div>
                            </div>

                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={kafkaStreamData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="time"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#3b82f6"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorValue)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Core Microservices */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
                        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-6">Core Microservices</h2>

                        <div className="flex flex-col gap-4 flex-1">
                            {/* Service 1 */}
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                                    <span className="text-sm font-bold text-slate-700">API Backend</span>
                                </div>
                                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded uppercase tracking-wider">Online</span>
                            </div>

                            {/* Service 2 */}
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                                    <span className="text-sm font-bold text-slate-700">Auth Server</span>
                                </div>
                                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded uppercase tracking-wider">Online</span>
                            </div>

                            {/* Service 3 */}
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                                    <span className="text-sm font-bold text-slate-700">Kafka Broker</span>
                                </div>
                                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded uppercase tracking-wider">Online</span>
                            </div>

                            {/* Service 4 */}
                            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 border border-red-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
                                    <span className="text-sm font-bold text-slate-900">Notification Hub</span>
                                </div>
                                <span className="text-[10px] font-extrabold text-red-600 bg-red-100 px-2.5 py-1 rounded uppercase tracking-wider">Degraded</span>
                            </div>

                            {/* Service 5 */}
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                                    <span className="text-sm font-bold text-slate-700">ELK Stack</span>
                                </div>
                                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded uppercase tracking-wider">Online</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Live Authentication Logs Placeholder */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Live Authentication Logs</h2>
                        <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                        <span>Autoscroll enabled</span>
                        <span className="material-icons text-[14px]">toggle_on</span>
                    </div>
                </div>

            </div>

            {/* Right Sidebar */}
            <div className="w-full xl:w-[320px] flex flex-col gap-6 flex-shrink-0">

                {/* Critical Alerts Dashboard */}
                <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Critical Alerts</h2>
                        <div className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">2</div>
                    </div>

                    <div className="space-y-4">
                        {/* High Latency Alert */}
                        <div className="bg-red-50/80 border border-red-100 rounded-xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                                <span className="material-icons text-red-500 text-lg mt-0.5">warning_amber</span>
                                <div>
                                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">High Latency</h3>
                                    <p className="text-xs font-medium text-red-600/90 leading-relaxed">
                                        Cluster-B responding with avg. 1250ms delay. DB sync lag detected.
                                    </p>
                                    <a href="#" className="inline-block mt-3 text-xs font-bold text-red-600 underline underline-offset-2 decoration-red-300 hover:decoration-red-600 transition-colors">
                                        Trace Route
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Brute Force Alert */}
                        <div className="bg-orange-50/80 border border-orange-100/80 rounded-xl p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                                <span className="material-icons text-orange-500 text-lg mt-0.5">security</span>
                                <div>
                                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">Brute Force Attempt</h3>
                                    <p className="text-xs font-medium text-orange-700/90 leading-relaxed">
                                        Multiple failed login attempts from IP 45.22.10.12 (User: admin_remote_92).
                                    </p>
                                    <a href="#" className="inline-block mt-3 text-xs font-bold text-orange-600 underline underline-offset-2 decoration-orange-300 hover:decoration-orange-600 transition-colors">
                                        Ban IP Range
                                    </a>
                                </div>
                            </div>
                        </div>

                        <button className="w-full py-3 mt-2 text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all uppercase tracking-wider">
                            Clear All Logs
                        </button>
                    </div>
                </div>

                {/* Admin Quick Links */}
                <div className="bg-slate-900 rounded-2xl p-6 shadow-lg shadow-slate-900/20 mt-2">
                    <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-5">Admin Quick Links</h2>

                    <div className="space-y-3">
                        <button className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all group">
                            <span className="material-icons text-blue-400 group-hover:text-blue-300 text-[18px]">terminal</span>
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Access Console</span>
                        </button>

                        <button className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all group">
                            <span className="material-icons text-indigo-400 group-hover:text-indigo-300 text-[18px]">history</span>
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Rollback Cluster</span>
                        </button>

                        <button className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all group">
                            <span className="material-icons text-emerald-400 group-hover:text-emerald-300 text-[18px]">description</span>
                            <span className="text-xs font-bold text-white uppercase tracking-wider">System Config</span>
                        </button>
                    </div>
                </div>

            </div>

        </div>
    );
}
