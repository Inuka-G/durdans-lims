"use client";

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const initialBarData = [
    { name: '01 OCT', revenue: 14000 },
    { name: '', revenue: 16500 },
    { name: '', revenue: 18800 },
    { name: '07 OCT', revenue: 17400 },
    { name: '', revenue: 21500 },
    { name: '', revenue: 19600 },
    { name: '14 OCT', revenue: 25200 },
    { name: '', revenue: 26600 },
    { name: '', revenue: 24800 },
    { name: '21 OCT', revenue: 29400 },
    { name: '', revenue: 26100 },
    { name: '31 OCT', revenue: 31800 },
];

const initialPieData = [
    { name: 'Pathology', value: 55, color: '#1277E1' },
    { name: 'Radiology', value: 25, color: '#a855f7' },
    { name: 'General', value: 20, color: '#f59e0b' },
];

export default function SuperadminReportsPage() {
    const [startDate, setStartDate] = useState("2023-10-01");
    const [endDate, setEndDate] = useState("2023-10-31");
    const [selectedBranch, setSelectedBranch] = useState("All Branches");

    const [barData, setBarData] = useState(initialBarData);
    const [pieData, setPieData] = useState(initialPieData);
    const [kpis, setKpis] = useState({
        patients: '8,452', pChange: 14.5,
        orders: '21,120', oChange: 11.4,
        revenue: '24.2', rChange: 18.2,
        pending: 342, peChange: -12
    });

    const reportRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Simulate fetching new dynamic data when date range or branch changes
    useEffect(() => {
        if (startDate && endDate) {
            const sTime = new Date(startDate).getTime();
            const eTime = new Date(endDate).getTime();

            // Pseudo-random noise factor based on date diff and branch selection
            const diffDays = Math.abs((eTime - sTime) / (1000 * 60 * 60 * 24));
            const branchNoise = selectedBranch === "All Branches" ? 1.0 : (selectedBranch.length % 5) * 0.2 + 0.3;
            const noise = ((diffDays % 30) / 30) * branchNoise;

            if (isNaN(noise)) return;

            setKpis({
                patients: Math.floor((5000 * branchNoise) + noise * 6000).toLocaleString(),
                pChange: Number((8 + noise * 10).toFixed(1)),
                orders: Math.floor((12000 * branchNoise) + noise * 14000).toLocaleString(),
                oChange: Number((-1 + noise * 15).toFixed(1)),
                revenue: (15 * branchNoise + noise * 20).toFixed(1),
                rChange: Number((12 + noise * 10).toFixed(1)),
                pending: Math.floor((200 * branchNoise) + noise * 400),
                peChange: Number((-15 + noise * 25).toFixed(1))
            });

            setBarData(initialBarData.map(d => ({
                ...d,
                revenue: Math.floor(d.revenue * branchNoise * (0.8 + noise * 0.5))
            })));

            setPieData([
                { name: 'Pathology', value: Math.floor(45 + noise * 20), color: '#1277E1' },
                { name: 'Radiology', value: Math.floor(25 + noise * 10), color: '#a855f7' },
                { name: 'General', value: Math.floor(15 + noise * 15), color: '#f59e0b' },
            ]);
        }
    }, [startDate, endDate, selectedBranch]);

    // Export PDF function - Native Browser Print
    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);
        try {
            const reportHtml = reportRef.current.innerHTML;

            const printWindow = window.open('', '_blank', 'width=1000,height=800');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>System_Report_${startDate}_to_${endDate}</title>
                            <script src="https://cdn.tailwindcss.com"></script>
                            <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
                            <style>
                                @media print {
                                    @page { size: A4 landscape; margin: 10mm; }
                                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; background: #f8fafc; }
                                    /* Hide interactive elements in print */
                                    select, input, button, .data-html2canvas-ignore { display: none !important; }
                                }
                                body { background: #f8fafc; padding: 20px; }
                                svg { max-width: 100%; height: auto; }
                            </style>
                        </head>
                        <body>
                            <div class="max-w-6xl mx-auto flex flex-col gap-6">
                                ${reportHtml}
                            </div>
                        </body>
                    </html>
                `);

                printWindow.document.close();
                printWindow.focus();

                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 1000);
            } else {
                toast.error("Please allow pop-ups to generate PDF reports.");
            }
        } catch (error) {
            console.error("Error generating PDF via print:", error);
            toast.error("Failed to generate PDF report.");
        } finally {
            setIsExporting(false);
        }
    };

    // Export CSV function
    const handleExportCSV = () => {
        const csvRows = [];

        // 1. Headers
        csvRows.push(["System Report", "Cross-Branch Performance"]);
        csvRows.push(["Branch Filter", selectedBranch]);
        csvRows.push(["Date Range", `${startDate} to ${endDate}`]);
        csvRows.push([]);

        // 2. KPIs
        csvRows.push(["Key Performance Indicators"]);
        csvRows.push(["Metric", "Value", "Change %"]);
        csvRows.push(["Total Patients", kpis.patients.replace(/,/g, ''), kpis.pChange]);
        csvRows.push(["Test Orders", kpis.orders.replace(/,/g, ''), kpis.oChange]);
        csvRows.push(["Revenue (LKR M)", kpis.revenue, kpis.rChange]);
        csvRows.push(["Pending Reports", kpis.pending, kpis.peChange]);
        csvRows.push([]);

        // 3. Category Breakdown (Pie Data)
        csvRows.push(["Revenue by Category"]);
        csvRows.push(["Category", "Percentage (%)"]);
        pieData.forEach(item => {
            csvRows.push([item.name, item.value]);
        });
        csvRows.push([]);

        // 4. Revenue Trend (Bar Data)
        csvRows.push(["Revenue Trend"]);
        csvRows.push(["Date", "Revenue"]);
        barData.forEach(item => {
            csvRows.push([item.name || "N/A", item.revenue]);
        });

        const csvContent = csvRows.map(row => row.join(",")).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Cross_Branch_Report_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-76px)] p-8 font-sans" ref={reportRef}>

            {/* Breadcrumb & Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                    <span className="hover:text-[#0f172a] cursor-pointer transition-colors">Home</span>
                    <span className="text-[10px] opacity-50">/</span>
                    <span className="hover:text-[#0f172a] cursor-pointer transition-colors">Reports</span>
                    <span className="text-[10px] opacity-50">/</span>
                    <span className="text-[#0f172a] font-bold">System-wide</span>
                </div>
                <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Cross-Branch Reports</h1>
                <p className="text-[13px] font-medium text-[#64748b] mt-1">Aggregated performance and transactional data across all operating branches.</p>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border text-sm border-[#ecf0f6] shadow-sm rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">

                <div className="flex flex-col md:flex-row items-center gap-4 flex-1 flex-wrap">

                    {/* Branch Filter */}
                    <div className="flex flex-col gap-1.5 w-full md:w-[260px]">
                        <label className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-widest pl-1">BRANCH</label>
                        <div className="relative">
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="w-full appearance-none bg-[#f8fafc] border border-[transparent] hover:border-[#ecf0f6] text-[#0f172a] font-bold py-3 pl-4 pr-10 rounded-xl focus:outline-none transition-all cursor-pointer text-[13px]"
                            >
                                <option value="All Branches">All Branches</option>
                                <option value="Colombo Main">Colombo Main Branch</option>
                                <option value="Kandy Regional">Kandy Regional Center</option>
                                <option value="Galle Outpost">Galle Outpost</option>
                            </select>
                            <span className="material-icons absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 w-full md:w-[320px]">
                        <label className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-widest pl-1">DATE RANGE</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-1/2 bg-[#f8fafc] border border-[transparent] hover:border-[#ecf0f6] text-[#0f172a] font-bold py-2.5 px-3 rounded-xl focus:outline-none transition-all cursor-pointer text-[12px]"
                            />
                            <span className="text-[#94a3b8] font-bold">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-1/2 bg-[#f8fafc] border border-[transparent] hover:border-[#ecf0f6] text-[#0f172a] font-bold py-2.5 px-3 rounded-xl focus:outline-none transition-all cursor-pointer text-[12px]"
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div className="flex flex-col gap-1.5 w-full md:w-[220px]">
                        <label className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-widest pl-1">CATEGORY</label>
                        <div className="relative">
                            <select className="w-full appearance-none bg-[#f8fafc] border border-[transparent] hover:border-[#ecf0f6] text-[#0f172a] font-bold py-3 pl-4 pr-10 rounded-xl focus:outline-none transition-all cursor-pointer text-[13px]">
                                <option>All Categories</option>
                                <option>Pathology</option>
                                <option>Radiology</option>
                            </select>
                            <span className="material-icons absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    {/* Payment Status */}
                    <div className="flex flex-col gap-1.5 w-full md:w-[220px]">
                        <label className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-widest pl-1">PAYMENT STATUS</label>
                        <div className="relative">
                            <select className="w-full appearance-none bg-[#f8fafc] border border-[transparent] hover:border-[#ecf0f6] text-[#0f172a] font-bold py-3 pl-4 pr-10 rounded-xl focus:outline-none transition-all cursor-pointer text-[13px]">
                                <option>All Statuses</option>
                                <option>Paid</option>
                                <option>Pending</option>
                            </select>
                            <span className="material-icons absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>
                </div>

                {/* Export Buttons */}
                <div className="flex items-center gap-3 self-end xl:self-center mt-4 xl:mt-0 xl:pt-5" data-html2canvas-ignore="true">
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className={`flex items-center justify-center gap-2 bg-white border border-[#ecf0f6] text-[#0f172a] px-5 py-2.5 rounded-xl font-bold shadow-sm text-[13px] ${isExporting ? 'opacity-50 cursor-wait' : 'hover:bg-[#f8fafc] transition-colors'}`}
                    >
                        {isExporting ? (
                            <span className="material-icons text-[#94a3b8] text-[18px] animate-spin">sync</span>
                        ) : (
                            <span className="material-icons text-[#ef4444] text-[18px]">picture_as_pdf</span>
                        )}
                        {isExporting ? 'Generating...' : 'PDF'}
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center justify-center gap-2 bg-white border border-[#ecf0f6] hover:bg-[#f8fafc] text-[#0f172a] px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm text-[13px]"
                    >
                        <span className="material-icons text-[#22c55e] text-[18px]">table_chart</span>
                        CSV
                    </button>
                </div>
            </div>

            {/* KPIs Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">

                {/* Total Patients */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-6">
                        <span className="text-[13px] font-extrabold text-[#64748b]">Total Patients</span>
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                            <span className="material-icons text-[16px]">people</span>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-end gap-2 mb-1">
                            <span className="text-[28px] font-extrabold text-[#0f172a] leading-none">{kpis.patients}</span>
                            <span className={`text-[12px] font-bold mb-1 ${kpis.pChange >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                                {kpis.pChange >= 0 ? '+' : ''}{kpis.pChange}%
                            </span>
                        </div>
                        <span className="text-[11px] font-medium text-[#94a3b8]">vs. previous period</span>
                    </div>
                </div>

                {/* Test Orders */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-6">
                        <span className="text-[13px] font-extrabold text-[#64748b]">Test Orders</span>
                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                            <span className="material-icons text-[16px]">biotech</span>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-end gap-2 mb-1">
                            <span className="text-[28px] font-extrabold text-[#0f172a] leading-none">{kpis.orders}</span>
                            <span className={`text-[12px] font-bold mb-1 ${kpis.oChange >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                                {kpis.oChange >= 0 ? '+' : ''}{kpis.oChange}%
                            </span>
                        </div>
                        <span className="text-[11px] font-medium text-[#94a3b8]">Total tests performed</span>
                    </div>
                </div>

                {/* Revenue */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-6">
                        <span className="text-[13px] font-extrabold text-[#64748b]">Revenue</span>
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                            <span className="material-icons text-[16px]">payments</span>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-end gap-2 mb-1">
                            <span className="text-[28px] font-extrabold text-[#0f172a] leading-none tracking-tight">LKR {kpis.revenue}M</span>
                            <span className={`text-[12px] font-bold mb-1 ${kpis.rChange >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                                {kpis.rChange >= 0 ? '+' : ''}{kpis.rChange}%
                            </span>
                        </div>
                        <span className="text-[11px] font-medium text-[#94a3b8]">Net collection</span>
                    </div>
                </div>

                {/* Pending Reports */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-6">
                        <span className="text-[13px] font-extrabold text-[#64748b]">Pending Reports</span>
                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                            <span className="material-icons text-[16px]">timer</span>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-end gap-2 mb-1">
                            <span className="text-[28px] font-extrabold text-[#0f172a] leading-none">{kpis.pending}</span>
                            <span className={`text-[12px] font-bold mb-1 ${kpis.peChange >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                                {kpis.peChange >= 0 ? '+' : ''}{kpis.peChange}%
                            </span>
                        </div>
                        <span className="text-[11px] font-medium text-[#94a3b8]">Awaiting verification</span>
                    </div>
                </div>

            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Revenue Trend (Bar Chart) - takes 66% */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-[15px] font-extrabold text-[#0f172a]">Revenue Trend</h2>
                        <span className="text-[11px] font-bold bg-[#f1f5f9] text-[#64748b] px-3 py-1.5 rounded-lg border border-[#e2e8f0]">Last 30 Days</span>
                    </div>
                    <div className="flex-1 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} barSize={42}>
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
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                                    {barData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.revenue < 10000 ? '#bae6fd' : entry.revenue < 20000 ? '#7dd3fc' : '#38bdf8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revenue by Category (Donut Chart) - takes 33% */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm h-[400px] flex flex-col">
                    <h2 className="text-[15px] font-extrabold text-[#0f172a] mb-4">Revenue by Category</h2>

                    <div className="flex-1 relative flex items-center justify-center min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[22px] font-extrabold text-[#0f172a]">
                                {pieData.reduce((acc, curr) => acc + curr.value, 0)}%
                            </span>
                            <span className="text-[9px] font-extrabold text-[#94a3b8] uppercase tracking-widest mt-1">LAB TESTS</span>
                        </div>
                    </div>

                    {/* Custom Legend */}
                    <div className="mt-6 flex flex-col gap-3">
                        {pieData.map((item) => (
                            <div key={item.name} className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                                    <span className="text-[13px] font-semibold text-[#64748b]">{item.name}</span>
                                </div>
                                <span className="text-[13px] font-extrabold text-[#0f172a]">{item.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* System Module Performance Details */}
            <div className="mt-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-[18px] font-extrabold text-[#0f172a] tracking-tight">System Module Performance Details</h2>
                        <p className="text-[13px] font-medium text-[#64748b] mt-0.5">Comprehensive tracking across the complete laboratory execution lifecycle.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                    {/* 1. Patient Management */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col overflow-hidden">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6] bg-blue-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                                    <span className="material-icons">account_circle</span>
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-extrabold text-[#0f172a] uppercase tracking-wider">Patient Management</h3>
                                    <p className="text-[11px] font-medium text-[#64748b] mt-0.5 leading-snug">Handles registration, duplicate detection, OTP verification, and profiles.</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-x divide-[#ecf0f6]">
                            <div className="flex flex-col gap-1 pl-2">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">New Reg.</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">1,245</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+12.4%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Searches</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">15,820</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+5.2%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">OTP Sent</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">8,412</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Duplicates</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">34</span>
                                <span className="text-[10px] font-bold text-[#dc2626]">-2.1%</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Test Ordering and Billing */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col overflow-hidden">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6] bg-emerald-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                                    <span className="material-icons">receipt_long</span>
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-extrabold text-[#0f172a] uppercase tracking-wider">Test Ordering & Billing</h3>
                                    <p className="text-[11px] font-medium text-[#64748b] mt-0.5 leading-snug">Lab test orders, bill generation, and real-time payment tracking.</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-x divide-[#ecf0f6]">
                            <div className="flex flex-col gap-1 pl-2">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Orders</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">8,105</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+8.5%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Billed (M)</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">24.2</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+15.2%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Fully Paid</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">92%</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+1.1%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Partial</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">142</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Sample Lifecycle Management */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col overflow-hidden">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6] bg-orange-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-sm">
                                    <span className="material-icons">bloodtype</span>
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-extrabold text-[#0f172a] uppercase tracking-wider">Sample Lifecycle Mgt.</h3>
                                    <p className="text-[11px] font-medium text-[#64748b] mt-0.5 leading-snug">Tracks process from Sample Collection to Accessioning.</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-x divide-[#ecf0f6]">
                            <div className="flex flex-col gap-1 pl-2">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Collected</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">12,504</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+6.1%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Accessioned</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">12,480</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+6.4%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Rejected</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">42</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">-12%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">In-Transit</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">1,102</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Laboratory Processing (MLT Testing) */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col overflow-hidden">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6] bg-purple-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                                    <span className="material-icons">science</span>
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-extrabold text-[#0f172a] uppercase tracking-wider">Laboratory Processing</h3>
                                    <p className="text-[11px] font-medium text-[#64748b] mt-0.5 leading-snug">MLT Result Entry, Abnormal Flagging, and Analyzer Sync.</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-x divide-[#ecf0f6]">
                            <div className="flex flex-col gap-1 pl-2">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Results</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">11,940</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+9.2%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Analyzed</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">85%</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+1.5%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Abnormal</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">940</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Time (h)</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">4.2h</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">-0.5h</span>
                            </div>
                        </div>
                    </div>

                    {/* 5. Verification and Authorization */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col overflow-hidden">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6] bg-indigo-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                                    <span className="material-icons">verified_user</span>
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-extrabold text-[#0f172a] uppercase tracking-wider">Verification & Auth.</h3>
                                    <p className="text-[11px] font-medium text-[#64748b] mt-0.5 leading-snug">Technical Verification by Supervisors and Pathologist Auth.</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-x divide-[#ecf0f6]">
                            <div className="flex flex-col gap-1 pl-2">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Verified</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">11,850</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+8.4%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Authd.</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">11,802</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+8.8%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Pending</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">342</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">-4.5%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Recalled</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">12</span>
                            </div>
                        </div>
                    </div>

                    {/* 6. Report Dispatch and Delivery */}
                    <div className="bg-white rounded-2xl border border-[#ecf0f6] shadow-sm flex flex-col overflow-hidden">
                        <div className="p-5 flex justify-between items-center border-b border-[#ecf0f6] bg-teal-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shadow-sm">
                                    <span className="material-icons">send</span>
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-extrabold text-[#0f172a] uppercase tracking-wider">Report Dispatch</h3>
                                    <p className="text-[11px] font-medium text-[#64748b] mt-0.5 leading-snug">Distribution of finalized reports via Email, SMS, & Portal.</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-x divide-[#ecf0f6]">
                            <div className="flex flex-col gap-1 pl-2">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Dispatched</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">11,800</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">+9.1%</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Email Sent</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">9,450</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">SMS Alerts</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">11,500</span>
                            </div>
                            <div className="flex flex-col gap-1 pl-4">
                                <span className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Failures</span>
                                <span className="text-[18px] font-extrabold text-[#0f172a]">24</span>
                                <span className="text-[10px] font-bold text-[#16a34a]">-12%</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
