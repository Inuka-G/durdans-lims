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

            {/* Middle Row (Charts + Actions/Alerts) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

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

                {/* Right Column (Alerts + Actions) */}
                <div className="flex flex-col gap-6 h-full">

                    {/* Alerts & Notifications */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex-1 flex flex-col">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6]">
                            <h2 className="text-[13px] font-extrabold text-[#0f172a] uppercase tracking-wider">ALERTS & NOTIFICATIONS</h2>
                            <span className="bg-[#ef4444] text-white text-[11px] font-extrabold px-1.5 py-0.5 rounded-full w-5 h-5 flex items-center justify-center">3</span>
                        </div>

                        <div className="p-4 space-y-3">
                            {/* Alert 1 */}
                            <div className="bg-[#fff7ed] border border-[#ffedd5] rounded-xl p-4 flex gap-3">
                                <span className="material-icons text-[#ea580c] text-[20px] shrink-0 mt-0.5">verified</span>
                                <div>
                                    <h4 className="text-[13px] font-extrabold text-[#9a3412]">Pending Verification</h4>
                                    <p className="text-[11px] font-medium text-[#c2410c] mt-1 leading-snug">
                                        5 Blood reports require senior pathologist verification for Colombo-03.
                                    </p>
                                    <button className="text-[11px] font-extrabold text-[#ea580c] mt-2 hover:underline">Resolve Now</button>
                                </div>
                            </div>

                            {/* Alert 2 */}
                            <div className="bg-[#fef2f2] border border-[#fee2e2] rounded-xl p-4 flex gap-3">
                                <span className="material-icons text-[#ef4444] text-[20px] shrink-0 mt-0.5">error_outline</span>
                                <div>
                                    <h4 className="text-[13px] font-extrabold text-[#991b1b]">Failed Delivery</h4>
                                    <p className="text-[11px] font-medium text-[#b91c1c] mt-1 leading-snug">
                                        System failed to email results for Order #ORD-8821 due to invalid email.
                                    </p>
                                    <button className="text-[11px] font-extrabold text-[#ef4444] mt-2 hover:underline">Edit Email</button>
                                </div>
                            </div>

                            {/* Alert 3 */}
                            <div className="bg-[#f0f9ff] border border-[#e0f2fe] rounded-xl p-4 flex gap-3">
                                <span className="material-icons text-[#0284c7] text-[20px] shrink-0 mt-0.5">inventory_2</span>
                                <div>
                                    <h4 className="text-[13px] font-extrabold text-[#075985]">Stock Alert</h4>
                                    <p className="text-[11px] font-medium text-[#0369a1] mt-1 leading-snug">
                                        Reagent level for HbA1c testing is below 15% threshold.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto border-t border-[#ecf0f6] p-3 text-center">
                            <button className="text-[10px] font-extrabold text-[#64748b] hover:text-[#0f172a] uppercase tracking-widest w-full">VIEW ALL NOTIFICATIONS</button>
                        </div>
                    </div>

                    {/* Quick Admin Actions */}
                    <div className="bg-[#1277E1] rounded-2xl shadow-md p-5 text-white">
                        <h2 className="text-[14px] font-extrabold mb-4">Quick Admin Actions</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <button className="bg-[#1e40af]/30 hover:bg-[#1e40af]/50 border border-[#3b82f6]/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors group">
                                <span className="material-icons text-[24px] text-white/80 group-hover:text-white transition-colors">person_add</span>
                                <span className="text-[11px] font-bold text-white/90">Add User</span>
                            </button>
                            <button className="bg-[#1e40af]/30 hover:bg-[#1e40af]/50 border border-[#3b82f6]/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors group">
                                <span className="material-icons text-[24px] text-white/80 group-hover:text-white transition-colors">bar_chart</span>
                                <span className="text-[11px] font-bold text-white/90">Pull Report</span>
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* Bottom Row: Haematology Test Details */}
            <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm mb-6 overflow-hidden">
                <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6] bg-red-50/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center border border-red-100">
                            <span className="material-icons">bloodtype</span>
                        </div>
                        <div>
                            <h2 className="text-[14px] font-extrabold text-[#0f172a] uppercase tracking-wider">HAEMATOLOGY TEST DETAILS</h2>
                            <p className="text-[11px] font-medium text-[#64748b] mt-0.5">Live monitoring of blood and bone marrow tests processing across this branch.</p>
                        </div>
                    </div>
                    <button className="bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] hover:border-[#cbd5e1] transition-colors rounded-lg px-3 py-1.5 text-[11px] font-bold flex items-center gap-2 shadow-sm">
                        <span className="material-icons text-[14px]">download</span> Export Data
                    </button>
                </div>

                <div className="divide-y divide-[#ecf0f6]">

                    {/* Test 1: Full Blood Count */}
                    <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-1">
                                <span className="text-[12px] font-bold">FBC</span>
                            </div>
                            <div>
                                <h4 className="text-[14px] font-extrabold text-[#0f172a] mb-1">Full Blood Count (FBC)</h4>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
                                    <span className="font-semibold text-[#64748b]">Code: 420-1</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Auto-Analyzed</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 sm:ml-auto">
                            <div className="flex flex-col items-end">
                                <span className="text-[18px] font-extrabold text-[#0f172a]">1,245</span>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Orders Today</span>
                            </div>
                            <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                                42 Pending
                            </span>
                        </div>
                    </div>

                    {/* Test 2: ESR */}
                    <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-1">
                                <span className="text-[12px] font-bold">ESR</span>
                            </div>
                            <div>
                                <h4 className="text-[14px] font-extrabold text-[#0f172a] mb-1">Erythrocyte Sedimentation Rate</h4>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
                                    <span className="font-semibold text-[#64748b]">Code: 421-2</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Manual Entry Needed</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 sm:ml-auto">
                            <div className="flex flex-col items-end">
                                <span className="text-[18px] font-extrabold text-[#0f172a]">452</span>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Orders Today</span>
                            </div>
                            <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                                8 Processing
                            </span>
                        </div>
                    </div>

                    {/* Test 3: WBC Count */}
                    <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-1">
                                <span className="text-[12px] font-bold">WBC</span>
                            </div>
                            <div>
                                <h4 className="text-[14px] font-extrabold text-[#0f172a] mb-1">White Blood Cells Count</h4>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
                                    <span className="font-semibold text-[#64748b]">Code: 422-3</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Auto-Analyzed</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 sm:ml-auto">
                            <div className="flex flex-col items-end">
                                <span className="text-[18px] font-extrabold text-[#0f172a]">890</span>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Orders Today</span>
                            </div>
                            <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                                All Clear
                            </span>
                        </div>
                    </div>

                    {/* Test 4: RBC Count */}
                    <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-1">
                                <span className="text-[12px] font-bold">RBC</span>
                            </div>
                            <div>
                                <h4 className="text-[14px] font-extrabold text-[#0f172a] mb-1">Red Blood Cells Count</h4>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
                                    <span className="font-semibold text-[#64748b]">Code: 423-4</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Auto-Analyzed</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 sm:ml-auto">
                            <div className="flex flex-col items-end">
                                <span className="text-[18px] font-extrabold text-[#0f172a]">850</span>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Orders Today</span>
                            </div>
                            <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                                12 Pending
                            </span>
                        </div>
                    </div>

                    {/* Test 5: Haemoglobin */}
                    <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-1">
                                <span className="text-[12px] font-bold">Hb</span>
                            </div>
                            <div>
                                <h4 className="text-[14px] font-extrabold text-[#0f172a] mb-1">Haemoglobin</h4>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
                                    <span className="font-semibold text-[#64748b]">Code: 424-5</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Auto-Analyzed</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 sm:ml-auto">
                            <div className="flex flex-col items-end">
                                <span className="text-[18px] font-extrabold text-[#0f172a]">1,102</span>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Orders Today</span>
                            </div>
                            <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                                5 Abnormal
                            </span>
                        </div>
                    </div>

                    {/* Test 6: Platelet Count */}
                    <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-1">
                                <span className="text-[12px] font-bold">PLT</span>
                            </div>
                            <div>
                                <h4 className="text-[14px] font-extrabold text-[#0f172a] mb-1">Platelet Count</h4>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
                                    <span className="font-semibold text-[#64748b]">Code: 425-6</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Auto-Analyzed</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 sm:ml-auto">
                            <div className="flex flex-col items-end">
                                <span className="text-[18px] font-extrabold text-[#0f172a]">940</span>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Orders Today</span>
                            </div>
                            <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                                All Clear
                            </span>
                        </div>
                    </div>

                    {/* Test 7: Hematocrit */}
                    <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-1">
                                <span className="text-[12px] font-bold">Hct</span>
                            </div>
                            <div>
                                <h4 className="text-[14px] font-extrabold text-[#0f172a] mb-1">Hematocrit</h4>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
                                    <span className="font-semibold text-[#64748b]">Code: 426-7</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Supervisor Review needed</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 sm:ml-auto">
                            <div className="flex flex-col items-end">
                                <span className="text-[18px] font-extrabold text-[#0f172a]">650</span>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Orders Today</span>
                            </div>
                            <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                                4 Quality Check
                            </span>
                        </div>
                    </div>

                    {/* Test 8: Neutrophils & Lymphocytes */}
                    <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-1">
                                <span className="text-[12px] font-bold">N/L</span>
                            </div>
                            <div>
                                <h4 className="text-[14px] font-extrabold text-[#0f172a] mb-1">Neutrophils & Lymphocytes</h4>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
                                    <span className="font-semibold text-[#64748b]">Code: 427-8</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Auto-Analyzed</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 sm:ml-auto">
                            <div className="flex flex-col items-end">
                                <span className="text-[18px] font-extrabold text-[#0f172a]">1,020</span>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Orders Today</span>
                            </div>
                            <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                                14 Pending
                            </span>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}