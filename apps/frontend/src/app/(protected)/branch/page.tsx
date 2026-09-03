"use client";

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getBranchDashboardReport, BranchDashboardReport } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function BranchDashboard() {
    const { branchCode } = useAuth();
    const [data, setData] = useState<BranchDashboardReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Date Range State
    const [dateRange, setDateRange] = useState<string>("7");
    const [customDays, setCustomDays] = useState<string>("14");

    useEffect(() => {
        if (!branchCode) {
            // No branch code assigned to user yet, or still loading Auth context.
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                let days = 7;
                if (dateRange === "7") {
                    days = 7;
                } else if (dateRange === "30") {
                    days = 30;
                } else if (dateRange === "custom") {
                    days = parseInt(customDays, 10);
                }

                if (isNaN(days) || days <= 0) {
                    setLoading(false);
                    return;
                }

                const d = new Date();
                d.setDate(d.getDate() - days);
                const start = d.toISOString().split('T')[0];
                const end = new Date().toISOString().split('T')[0];

                const report = await getBranchDashboardReport(branchCode, start, end);
                setData(report);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch dashboard data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [branchCode, dateRange, customDays]);

    if (loading) {
        return (
            <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-76px)] p-6 font-sans flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-[#94a3b8]">
                    <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-semibold">Loading dashboard data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-76px)] p-6 font-sans flex items-center justify-center">
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm font-medium">
                    {error}
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-76px)] p-6 font-sans flex items-center justify-center">
                <div className="text-[#94a3b8] text-sm font-medium">No dashboard data available for this branch.</div>
            </div>
        );
    }

    const { kpis, revenueTrend, revenueByCategory } = data;

    // Calculate maximum value for the bar chart proportional heights
    const maxCategoryValue = revenueByCategory?.length > 0 
        ? Math.max(...revenueByCategory.map(c => c.value)) 
        : 1;

    return (
        <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-76px)] p-6 font-sans">
            {/* Dashboard Header & Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-xl font-extrabold text-[#0f172a]">Dashboard Overview</h1>
                <div className="flex items-center gap-3">
                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                min="1"
                                value={customDays} 
                                onChange={e => setCustomDays(e.target.value)} 
                                placeholder="Days"
                                className="text-[12px] border border-[#ecf0f6] rounded-md px-3 py-1.5 w-20 text-fg outline-none focus:border-primary bg-white" 
                            />
                            <span className="text-xs font-semibold text-[#64748b]">days</span>
                        </div>
                    )}
                    <select 
                        value={dateRange} 
                        onChange={(e) => setDateRange(e.target.value)}
                        className="text-[12px] font-bold border border-[#ecf0f6] rounded-md px-3 py-1.5 bg-white text-[#0f172a] outline-none focus:border-primary cursor-pointer"
                    >
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
            </div>

            {/* Top KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {/* Total Patients */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                            <span className="material-icons text-[20px]">group</span>
                        </div>
                        {kpis?.patientsChange !== 0 && kpis?.patientsChange !== undefined && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${kpis.patientsChange > 0 ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                                <span className="material-icons text-[12px]">{kpis.patientsChange > 0 ? 'trending_up' : 'trending_down'}</span> {Math.abs(kpis.patientsChange)}%
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest mb-1.5">TOTAL PATIENTS</h3>
                        <p className="text-3xl font-extrabold text-[#0f172a] tracking-tight">{kpis?.totalPatients ?? "0"}</p>
                    </div>
                </div>

                {/* Test Orders */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
                            <span className="material-icons text-[20px]">science</span>
                        </div>
                        {kpis?.ordersChange !== 0 && kpis?.ordersChange !== undefined && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${kpis.ordersChange > 0 ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                                <span className="material-icons text-[12px]">{kpis.ordersChange > 0 ? 'trending_up' : 'trending_down'}</span> {Math.abs(kpis.ordersChange)}%
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest mb-1.5">TEST ORDERS</h3>
                        <p className="text-3xl font-extrabold text-[#0f172a] tracking-tight">{kpis?.totalOrders ?? "0"}</p>
                    </div>
                </div>

                {/* Revenue */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                            <span className="material-icons text-[20px]">payments</span>
                        </div>
                        {kpis?.revenueChange !== 0 && kpis?.revenueChange !== undefined && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${kpis.revenueChange > 0 ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                                <span className="material-icons text-[12px]">{kpis.revenueChange > 0 ? 'trending_up' : 'trending_down'}</span> {Math.abs(kpis.revenueChange)}%
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest mb-1.5">REVENUE</h3>
                        <p className="text-3xl font-extrabold text-[#0f172a] tracking-tight">{kpis?.totalRevenue ?? "LKR 0"}</p>
                    </div>
                </div>

                {/* Pending Reports */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                            <span className="material-icons text-[20px]">assignment_late</span>
                        </div>
                        {kpis?.pendingReportsChange !== 0 && kpis?.pendingReportsChange !== undefined && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${kpis.pendingReportsChange > 0 ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                                <span className="material-icons text-[12px]">{kpis.pendingReportsChange > 0 ? 'trending_up' : 'trending_down'}</span> {Math.abs(kpis.pendingReportsChange)}%
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 className="text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest mb-1.5">PENDING REPORTS</h3>
                        <p className="text-3xl font-extrabold text-[#0f172a] tracking-tight">{kpis?.pendingReports ?? "0"}</p>
                    </div>
                </div>
            </div>

            {/* Middle Row (Charts) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Revenue Trend Chart */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col w-full h-[320px]">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6] flex-wrap gap-2">
                            <h2 className="text-[14px] font-extrabold text-[#0f172a]">
                                Revenue Trend {dateRange === '7' ? '(Last 7 Days)' : dateRange === '30' ? '(Last 30 Days)' : `(Last ${customDays || 0} Days)`}
                            </h2>
                        </div>
                        <div className="flex-1 p-4">
                            {revenueTrend && revenueTrend.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueTrend}>
                                        <defs>
                                            <linearGradient id="colorReveu" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#1277E1" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#1277E1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
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
                            ) : (
                                <div className="h-full flex items-center justify-center text-sm font-medium text-fg-muted">No trend data available</div>
                            )}
                        </div>
                    </div>

                    {/* Test Volume Chart */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col w-full h-[320px]">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6]">
                            <h2 className="text-[14px] font-extrabold text-[#0f172a]">Test Volume by Category</h2>
                            <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#64748b] px-2 py-1 rounded-md uppercase tracking-wider">MONTHLY</span>
                        </div>
                        <div className="flex-1 p-5 flex items-end justify-between gap-2 pb-8 overflow-x-auto">
                            {revenueByCategory && revenueByCategory.length > 0 ? (
                                revenueByCategory.map((category, index) => {
                                    const heightPercentage = Math.max((category.value / maxCategoryValue) * 100, 10);
                                    return (
                                        <div key={index} className="group flex flex-col items-center gap-2 flex-1 pt-6 h-full justify-end cursor-pointer">
                                            <div 
                                                className="w-full bg-[#1277E1] max-w-[50px] rounded-t-lg transition-all duration-300 group-hover:bg-blue-600 relative"
                                                style={{ height: `${heightPercentage}%` }}
                                            >
                                                <div className="absolute -top-4 left-0 right-0 h-4 bg-[#e2e8f0] rounded-t-lg opacity-50 flex items-center justify-center">
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-extrabold text-[#64748b] text-center truncate w-full" title={category.name}>
                                                {category.name}
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-sm font-medium text-fg-muted">No category data available</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}