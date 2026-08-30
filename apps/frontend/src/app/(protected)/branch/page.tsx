"use client";

import { PureComponent, ReactNode } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
    { name: 'Mon', revenue: 4000 },
    { name: 'Tue', revenue: 8000 },
    { name: 'Wed', revenue: 5000 },
    { name: 'Thu', revenue: 7000 },
    { name: 'Fri', revenue: 15000 },
    { name: 'Sat', revenue: 22000 },
    { name: 'Sun', revenue: 19000 },
];

export default function BranchDashboard() {
    return (
        <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-76px)] p-6 font-sans">

            {/* Top KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {/* Total Patients */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                            <span className="material-icons text-[20px]">group</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <span className="material-icons text-[12px]">trending_up</span> 12%
                        </span>
                    </div>
                    <div>
                        <h3 className="text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest mb-1.5">TOTAL PATIENTS</h3>
                        <p className="text-3xl font-extrabold text-[#0f172a] tracking-tight">2,482</p>
                    </div>
                </div>

                {/* Test Orders */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
                            <span className="material-icons text-[20px]">science</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <span className="material-icons text-[12px]">trending_up</span> 5.4%
                        </span>
                    </div>
                    <div>
                        <h3 className="text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest mb-1.5">TEST ORDERS</h3>
                        <p className="text-3xl font-extrabold text-[#0f172a] tracking-tight">842</p>
                    </div>
                </div>

                {/* Revenue */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                            <span className="material-icons text-[20px]">payments</span>
                        </div>
                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <span className="material-icons text-[12px]">trending_down</span> 2.1%
                        </span>
                    </div>
                    <div>
                        <h3 className="text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest mb-1.5">REVENUE</h3>
                        <p className="text-3xl font-extrabold text-[#0f172a] tracking-tight">LKR 1.2M</p>
                    </div>
                </div>

                {/* Pending Reports */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                            <span className="material-icons text-[20px]">assignment_late</span>
                        </div>
                        {/* No trend for pending */}
                    </div>
                    <div>
                        <h3 className="text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest mb-1.5">PENDING REPORTS</h3>
                        <p className="text-3xl font-extrabold text-[#0f172a] tracking-tight">47</p>
                    </div>
                </div>
            </div>

            {/* Middle Row (Charts) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                {/* Left Column for Charts (takes 2 columns width) */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Revenue Trend Chart */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col w-full h-[320px]">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6]">
                            <h2 className="text-[14px] font-extrabold text-[#0f172a]">Revenue Trend (Last 7 Days)</h2>
                            <button className="text-[12px] font-bold text-[#1277E1] hover:underline">Download CSV</button>
                        </div>
                        <div className="flex-1 p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorReveu" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#1277E1" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#1277E1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                        dy={10}
                                    />
                                    <YAxis hide={true} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                    />
                                    <Area type="monotone" dataKey="revenue" stroke="#1277E1" strokeWidth={4} fillOpacity={1} fill="url(#colorReveu)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Test Volume Chart */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col w-full h-[320px]">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6]">
                            <h2 className="text-[14px] font-extrabold text-[#0f172a]">Test Volume by Category</h2>
                            <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#64748b] px-2 py-1 rounded-md uppercase tracking-wider">MONTHLY</span>
                        </div>
                        <div className="flex-1 p-5 flex items-end justify-between gap-2 pb-8">
                            {/* Static CSS-based bar chart to match precise UI */}
                            <div className="group flex flex-col items-center gap-2 flex-1 pt-6 h-full justify-end cursor-pointer">
                                <div className="w-full bg-[#1277E1] max-w-[50px] rounded-t-lg transition-all duration-300 group-hover:bg-blue-600 relative h-[60%]">
                                    <div className="absolute -top-4 left-0 right-0 h-4 bg-[#e2e8f0] rounded-t-lg opacity-50"></div>
                                </div>
                                <span className="text-[10px] font-extrabold text-[#64748b]">Blood</span>
                            </div>

                            <div className="group flex flex-col items-center gap-2 flex-1 pt-6 h-full justify-end cursor-pointer">
                                <div className="w-full bg-[#1277E1] max-w-[50px] rounded-t-lg transition-all duration-300 group-hover:bg-blue-600 relative h-[35%]">
                                    <div className="absolute -top-12 left-0 right-0 h-12 bg-[#e2e8f0] rounded-t-lg opacity-50"></div>
                                </div>
                                <span className="text-[10px] font-extrabold text-[#64748b]">Urine</span>
                            </div>

                            <div className="group flex flex-col items-center gap-2 flex-1 pt-6 h-full justify-end cursor-pointer">
                                <div className="w-full bg-[#1277E1] max-w-[50px] rounded-t-lg transition-all duration-300 group-hover:bg-blue-600 relative h-[75%]">
                                    <div className="absolute -top-2 left-0 right-0 h-2 bg-[#e2e8f0] rounded-t-lg opacity-50"></div>
                                </div>
                                <span className="text-[10px] font-extrabold text-[#64748b]">Biopsy</span>
                            </div>

                            <div className="group flex flex-col items-center gap-2 flex-1 pt-6 h-full justify-end cursor-pointer">
                                <div className="w-full bg-[#1277E1] max-w-[50px] rounded-t-lg transition-all duration-300 group-hover:bg-blue-600 relative h-[45%]">
                                    <div className="absolute -top-6 left-0 right-0 h-6 bg-[#e2e8f0] rounded-t-lg opacity-50"></div>
                                </div>
                                <span className="text-[10px] font-extrabold text-[#64748b]">PCR</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>



        </div>
    );
}