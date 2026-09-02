"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Cell
} from "recharts";

// Mock Data
const revenueByBranchData = [
    { name: "COL-1", value: 450 },
    { name: "COL-2", value: 380 },
    { name: "KAN-M", value: 290 },
    { name: "GALLE", value: 310 },
    { name: "JAFFNA", value: 180 },
    { name: "N'ELIYA", value: 210 },
];

const globalRevenueTrendData = [
    { name: "MAY", value: 300 },
    { name: "JUN", value: 450 },
    { name: "JUL", value: 600 },
    { name: "AUG", value: 550 },
    { name: "SEP", value: 750 },
    { name: "OCT", value: 900 },
];

export default function SuperAdminDashboardPage() {
    return (
        <div className="max-w-[1600px] mx-auto w-full font-sans text-slate-900 bg-slate-50/50 min-h-screen pt-4 flex flex-col xl:flex-row gap-6">

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col gap-6">

                {/* Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

                    {/* Total Branches */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 text-center h-[160px]">
                        <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-1">
                            <span className="material-icons text-xl">domain</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-900">14</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Total<br />Branches</p>
                    </div>

                    {/* Total Patients */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 text-center h-[160px]">
                        <div className="w-10 h-10 bg-teal-50 text-teal-500 rounded-xl flex items-center justify-center mb-1">
                            <span className="material-icons text-xl">people</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-900">12,842</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Total<br />Patients</p>
                    </div>

                    {/* Total Revenue */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 text-center h-[160px]">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center mb-1">
                            <span className="material-icons text-xl">account_balance_wallet</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-900">84.2M</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Total<br />Revenue</p>
                    </div>

                    {/* Active Users */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 text-center h-[160px]">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-1">
                            <span className="material-icons text-xl">person_outline</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-900">158</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Active<br />Users</p>
                    </div>

                    {/* Pending Verifications */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 text-center h-[160px]">
                        <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center mb-1">
                            <span className="material-icons text-xl">fact_check</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-900">24</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Pending<br />Verifications</p>
                    </div>

                    {/* Failed Deliveries */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 text-center h-[160px]">
                        <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-1">
                            <span className="material-icons text-xl">warning_amber</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-900">12</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Failed<br />Deliveries</p>
                    </div>

                </div>

                {/* Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[400px]">

                    {/* Revenue by Branch */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-[16px] font-extrabold text-slate-900">Revenue by Branch</h2>
                                <p className="text-[12px] font-medium text-slate-500">Performance comparison across regions</p>
                            </div>
                            <button className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
                                <span className="material-icons text-sm">more_horiz</span>
                            </button>
                        </div>
                        <div className="flex-1 w-full min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueByBranchData} margin={{ top: 20, right: 0, left: -20, bottom: 20 }}>
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        cursor={{ fill: "rgba(59,130,246,0.05)" }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                                        {revenueByBranchData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill="rgba(241, 245, 249, 1)" />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Global Revenue Trend */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-[16px] font-extrabold text-slate-900">Global Revenue Trend</h2>
                                <p className="text-[12px] font-medium text-slate-500">6-month growth analysis</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div> Current
                                </span>
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <div className="w-2 h-2 rounded-full bg-slate-200"></div> Target
                                </span>
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={globalRevenueTrendData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* Footer Component Area */}
                <div className="mt-4 pt-6 pb-2 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs font-semibold text-slate-400">
                    <div className="flex gap-4 items-center">
                        <span>&copy; 2023 Laboratory Management ERP. Global Edition</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>System Ver: 4.2.0-GA</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-4 sm:mt-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">CLUSTER: AP-SOUTH-1</span>
                    </div>
                </div>

            </div>

            {/* Right Sidebar Widgets */}
            <div className="w-full xl:w-[320px] flex flex-col gap-6 flex-shrink-0">

                {/* System Health */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
                    {/* Status dot in corner */}
                    <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>

                    <h2 className="text-lg font-extrabold text-slate-800 mb-8 mt-1">System Health</h2>

                    <div className="space-y-6">
                        {/* Global Server Load */}
                        <div>
                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                <span>Global Server Load</span>
                                <span className="text-blue-600">34%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '34%' }}></div>
                            </div>
                        </div>

                        {/* API Response Time */}
                        <div>
                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                <span>API Response Time</span>
                                <span className="text-emerald-500">124MS</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '40%' }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-wider">Live Status</p>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                Reporting Engine Online
                            </li>
                            <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                SMS/Email Gateway Active
                            </li>
                            <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                Backup Process Pending
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Critical Alerts */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex-1 min-h-[300px]">
                    <h2 className="text-lg font-extrabold text-slate-800 mb-6 mt-1">Critical Alerts</h2>

                    <div className="space-y-4">
                        {/* Alert 1 */}
                        <div className="bg-red-50/50 border border-red-100/60 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-red-600 mb-1.5">
                                <span className="material-icons text-sm">error_outline</span>
                                <span className="text-sm font-bold">Branch Offline</span>
                            </div>
                            <p className="text-xs text-red-500/90 font-medium leading-relaxed">
                                Jaffna Regional Hub connection lost at 08:42 AM.
                            </p>
                        </div>

                        {/* Alert 2 */}
                        <div className="bg-amber-50/50 border border-amber-100/60 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-amber-600 mb-1.5">
                                <span className="material-icons text-sm">security</span>
                                <span className="text-sm font-bold">Security Alert</span>
                            </div>
                            <p className="text-xs text-amber-600/90 font-medium leading-relaxed">
                                Multiple failed login attempts detected from IP 192.168.1.1
                            </p>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
}