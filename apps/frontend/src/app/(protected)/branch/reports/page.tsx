"use client";

import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from "@/hooks/useAuth";
import { getBranchesPage, getBranches } from "@/lib/api";

const initialBarData = [
    { name: '01 OCT', revenue: 2000 },
    { name: '', revenue: 2500 },
    { name: '', revenue: 3800 },
    { name: '07 OCT', revenue: 2400 },
    { name: '', revenue: 4500 },
    { name: '', revenue: 3600 },
    { name: '14 OCT', revenue: 5200 },
    { name: '', revenue: 5600 },
    { name: '', revenue: 4800 },
    { name: '21 OCT', revenue: 6400 },
    { name: '', revenue: 3100 },
    { name: '31 OCT', revenue: 7800 },
];

const initialPieData = [
    { name: 'Pathology', value: 45, color: '#1277E1' },
    { name: 'Radiology', value: 28, color: '#a855f7' },
    { name: 'General', value: 27, color: '#f59e0b' },
];

export default function BranchReportsPage() {
    const { branchCode } = useAuth();
    const [branchName, setBranchName] = useState("Loading...");

    useEffect(() => {
        const targetCode = branchCode || "b6030d28-10ef-4165-9554-8887fabfddb8";
        getBranches().then((data) => {
            const branch = data.find((b) => b.id === targetCode || b.code.toUpperCase() === targetCode.toUpperCase());
            if (branch) {
                setBranchName(branch.name);
            } else {
                setBranchName(targetCode);
            }
        }).catch(err => {
            console.error("Failed to fetch branch details", err);
            setBranchName(targetCode);
        });
    }, [branchCode]);

    const [startDate, setStartDate] = useState("2023-10-01");
    const [endDate, setEndDate] = useState("2023-10-31");

    const [barData, setBarData] = useState(initialBarData);
    const [pieData, setPieData] = useState(initialPieData);
    const [kpis, setKpis] = useState({
        patients: '1,248', pChange: 12,
        orders: '3,120', oChange: 8.4,
        revenue: '4.2', rChange: 15.2,
        pending: 42, peChange: -5
    });

    const reportRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Simulate fetching new dynamic data when date range changes
    useEffect(() => {
        if (startDate && endDate) {
            const sTime = new Date(startDate).getTime();
            const eTime = new Date(endDate).getTime();

            // Generate a simple pseudo-random noise factor based on the date difference
            // to make the charts look realistically "dynamic"
            const diffDays = Math.abs((eTime - sTime) / (1000 * 60 * 60 * 24));
            const noise = (diffDays % 30) / 30; // 0 to 1 based on month day modulo

            if (isNaN(noise)) return;

            setKpis({
                patients: Math.floor(1000 + noise * 1500).toLocaleString(),
                pChange: Number((5 + noise * 15).toFixed(1)),
                orders: Math.floor(2500 + noise * 2500).toLocaleString(),
                oChange: Number((-2 + noise * 15).toFixed(1)),
                revenue: (3 + noise * 5).toFixed(1),
                rChange: Number((10 + noise * 12).toFixed(1)),
                pending: Math.floor(20 + noise * 60),
                peChange: Number((-10 + noise * 20).toFixed(1))
            });

            setBarData(initialBarData.map(d => ({
                ...d,
                revenue: Math.floor(d.revenue * (0.6 + noise * 0.8))
            })));

            setPieData([
                { name: 'Pathology', value: Math.floor(40 + noise * 15), color: '#1277E1' },
                { name: 'Radiology', value: Math.floor(20 + noise * 20), color: '#a855f7' },
                { name: 'General', value: Math.floor(20 + noise * 10), color: '#f59e0b' },
            ]);
        }
    }, [startDate, endDate]);

    // Export PDF function - Native Browser Print
    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);
        try {
            // Get the HTML content of the report container
            const reportHtml = reportRef.current.innerHTML;

            // Open a new window for printing
            const printWindow = window.open('', '_blank', 'width=1000,height=800');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>Branch_Report_${startDate}_to_${endDate}</title>
                            <script src="https://cdn.tailwindcss.com"></script>
                            <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
                            <style>
                                @media print {
                                    @page { size: A4 landscape; margin: 10mm; }
                                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; background: #f8fafc; }
                                    /* Hide interactive elements in print */
                                    select, input[type="date"], button, .data-html2canvas-ignore { display: none !important; }
                                    .print-border { border: 1px solid #e2e8f0 !important; }
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

                // Wait a moment for styles and fonts to load before triggering print dialog
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 1000);
            } else {
                alert("Please allow pop-ups to generate PDF reports.");
            }
        } catch (error) {
            console.error("Error generating PDF via print:", error);
            alert("Failed to generate PDF report.");
        } finally {
            setIsExporting(false);
        }
    };

    // Export CSV function
    const handleExportCSV = () => {
        // Prepare data structure
        const csvRows = [];

        // 1. Headers
        csvRows.push(["Branch Report", branchName]);
        csvRows.push(["Date Range", `${startDate} to ${endDate}`]);
        csvRows.push([]); // empty line

        // 2. KPIs
        csvRows.push(["Key Performance Indicators"]);
        csvRows.push(["Metric", "Value", "Change %"]);
        csvRows.push(["Total Patients", kpis.patients.replace(',', ''), kpis.pChange]);
        csvRows.push(["Test Orders", kpis.orders.replace(',', ''), kpis.oChange]);
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
            // Keep actual label if exists, else estimate day progression or just leave empty depending on need
            // For this mock, we'll just dump whatever is in the 'name' column plus the raw revenue
            csvRows.push([item.name || "N/A", item.revenue]);
        });

        // Convert array of arrays to CSV string
        const csvContent = csvRows.map(row => row.join(",")).join("\n");

        // Create Blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Branch_Report_Data_${startDate}_to_${endDate}.csv`);
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
                    <span className="text-[#0f172a] font-bold">{branchName}</span>
                </div>
                <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Branch Reports – {branchName}</h1>
                <p className="text-[13px] font-medium text-[#64748b] mt-1">Performance metrics and transactional data for the selected period.</p>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border text-sm border-[#ecf0f6] shadow-sm rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">

                <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
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
                    <div className="flex flex-col gap-1.5 w-full md:w-[260px]">
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
                    <div className="flex flex-col gap-1.5 w-full md:w-[260px]">
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
                            <span className="material-icons text-[16px]">person</span>
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
                                        <Cell key={`cell-${index}`} fill={entry.revenue < 3000 ? '#bae6fd' : entry.revenue < 5000 ? '#7dd3fc' : '#38bdf8'} />
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
        </div>
    );
}