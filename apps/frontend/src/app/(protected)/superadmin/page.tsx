"use client";

import { useState, useEffect } from "react";
import { getBranches, getBranchDashboardReport } from "@/lib/api";

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


const formatRevenue = (val: number | string) => {
    const num = Number(val);
    if (isNaN(num)) return 'LKR 0';
    if (num >= 1000000) return `LKR ${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `LKR ${(num / 1000).toFixed(1)}K`;
    return `LKR ${num.toLocaleString()}`;
};

const formatYAxis = (val: number | string) => {
    const num = Number(val);
    if (isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
};

export default function SuperAdminDashboardPage() {
    const [stats, setStats] = useState({
        totalBranches: 0,
        totalPatients: 0,
        totalRevenue: 0,
        pendingVerifications: 0,
    });
    
    const [revenueByBranchData, setRevenueByBranchData] = useState<any[]>([]);
    const [globalRevenueTrendData, setGlobalRevenueTrendData] = useState<any[]>([]);
    
    useEffect(() => {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const start = thirtyDaysAgo.toISOString().split('T')[0];
        const end = today.toISOString().split('T')[0];

        async function loadData() {
            try {
                const branches = await getBranches();
                const globalReport = await getBranchDashboardReport("ALL", start, end);
                
                setStats({
                    totalBranches: branches.length,
                    totalPatients: parseInt(globalReport.kpis.totalPatients, 10) || 0,
                    totalRevenue: Number(globalReport.kpis.totalRevenue) || 0,
                    pendingVerifications: parseInt(globalReport.kpis.pendingReports, 10)
                });
                
                if (globalReport.revenueTrend) {
                    setGlobalRevenueTrendData(globalReport.revenueTrend.map((t: any) => ({
                        name: t.date,
                        value: t.revenue
                    })));
                }

                const branchRev = await Promise.all(branches.map(async (b) => {
                    try {
                        const r = await getBranchDashboardReport(b.code, start, end);
                        return { name: b.code, value: r.kpis.totalRevenue };
                    } catch (e) {
                        return { name: b.code, value: 0 };
                    }
                }));
                
                setRevenueByBranchData(branchRev);
                
            } catch (err) {
                console.error("Failed to load global dashboard data", err);
            }
        }
        
        loadData();
    }, []);

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
                        <h3 className="text-3xl font-extrabold text-slate-900">{stats.totalBranches}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Total<br />Branches</p>
                    </div>

                    {/* Total Patients */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 text-center h-[160px]">
                        <div className="w-10 h-10 bg-teal-50 text-teal-500 rounded-xl flex items-center justify-center mb-1">
                            <span className="material-icons text-xl">people</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-900">{Number(stats.totalPatients).toLocaleString()}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Total<br />Patients</p>
                    </div>

                    {/* Total Revenue */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2 text-center h-[160px]">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center mb-1">
                            <span className="material-icons text-xl">account_balance_wallet</span>
                        </div>
                        <h3 className="text-3xl font-extrabold text-slate-900">{formatRevenue(stats.totalRevenue)}</h3>
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
                        <h3 className="text-3xl font-extrabold text-slate-900">{stats.pendingVerifications}</h3>
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
                                <BarChart data={revenueByBranchData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        tickFormatter={(val) => formatYAxis(val)}
                                        width={60}
                                    />
                                    <Tooltip
                                        formatter={(value) => [`LKR ${Number(value).toLocaleString()}`, 'Revenue']}
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
                                <p className="text-[12px] font-medium text-slate-500">30-day growth analysis</p>
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
                                <LineChart data={globalRevenueTrendData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        tickFormatter={(val) => formatYAxis(val)}
                                        width={60}
                                    />
                                    <Tooltip
                                        formatter={(value) => [`LKR ${Number(value).toLocaleString()}`, 'Revenue']}
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


        </div>
    );
}