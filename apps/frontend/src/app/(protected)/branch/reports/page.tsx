"use client";

import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from "@/hooks/useAuth";
import { getBranches, getBranchDashboardReport } from "@/lib/api";

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
        const targetCode = branchCode || "Col-1";
        getBranches().then((data) => {
            const branch = data.find((b) => b.code.toUpperCase() === targetCode.toUpperCase());
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

    const getFormattedDate = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [startDate, setStartDate] = useState(getFormattedDate(thirtyDaysAgo));
    const [endDate, setEndDate] = useState(getFormattedDate(today));

    const [barData, setBarData] = useState(initialBarData);
    const [pieData, setPieData] = useState(initialPieData);
    const [topTests, setTopTests] = useState<{testName: string, orderCount: number, revenue: number}[]>([]);
    const [leastTests, setLeastTests] = useState<{testName: string, orderCount: number, revenue: number}[]>([]);
    const [kpis, setKpis] = useState({
        patients: '1,248', pChange: 12,
        orders: '3,120', oChange: 8.4,
        revenue: '4.2', rChange: 15.2,
        pending: 42, peChange: -5
    });

    const reportRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Fetch actual data from backend
    useEffect(() => {
        if (startDate && endDate) {
            const targetCode = branchCode || "Col-1";
            getBranchDashboardReport(targetCode, startDate, endDate)
                .then((report) => {
                    setKpis({
                        patients: report.kpis.totalPatients,
                        pChange: report.kpis.patientsChange,
                        orders: report.kpis.totalOrders,
                        oChange: report.kpis.ordersChange,
                        revenue: report.kpis.totalRevenue,
                        rChange: report.kpis.revenueChange,
                        pending: parseInt(report.kpis.pendingReports, 10),
                        peChange: report.kpis.pendingReportsChange
                    });

                    if (report.revenueTrend && report.revenueTrend.length > 0) {
                        // Map 'date' to 'name' for the Recharts XAxis
                        const mappedBarData = report.revenueTrend.map(item => ({
                            name: item.date,
                            revenue: item.revenue
                        }));
                        setBarData(mappedBarData);
                    } else {
                        setBarData([]);
                    }

                    if (report.revenueByCategory && report.revenueByCategory.length > 0) {
                        setPieData(report.revenueByCategory);
                    } else {
                        setPieData([]);
                    }

                    if (report.topPerformingTests) {
                        setTopTests(report.topPerformingTests);
                    } else {
                        setTopTests([]);
                    }

                    if (report.leastPerformingTests) {
                        setLeastTests(report.leastPerformingTests);
                    } else {
                        setLeastTests([]);
                    }
                })
                .catch((err) => {
                    console.error("Failed to load dashboard report", err);
                });
        }
    }, [branchCode, startDate, endDate]);

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
        csvRows.push(["Revenue (LKR K)", kpis.revenue, kpis.rChange]);
        csvRows.push(["Pending Reports", kpis.pending, kpis.peChange]);
        csvRows.push([]);



        // 4. Revenue Trend (Bar Data)
        csvRows.push(["Revenue Trend"]);
        csvRows.push(["Date", "Revenue"]);
        barData.forEach(item => {
            // Keep actual label if exists, else estimate day progression or just leave empty depending on need
            // For this mock, we'll just dump whatever is in the 'name' column plus the raw revenue
            csvRows.push([item.name || "N/A", item.revenue]);
        });
        csvRows.push([]);

        // 5. Top 5 Performing Tests
        csvRows.push(["Top 5 Performing Tests"]);
        csvRows.push(["Test Name", "Order Count", "Revenue"]);
        topTests.forEach(item => {
            csvRows.push([item.testName, item.orderCount, item.revenue]);
        });
        csvRows.push([]);

        // 6. Bottom 5 Least Performing Tests
        csvRows.push(["Bottom 5 Least Performing Tests"]);
        csvRows.push(["Test Name", "Order Count", "Revenue"]);
        leastTests.forEach(item => {
            csvRows.push([item.testName, item.orderCount, item.revenue]);
        });
        csvRows.push([]);

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
                <div className="flex flex-col items-stretch gap-2 self-end xl:self-center mt-4 xl:mt-0 xl:pt-5" data-html2canvas-ignore="true">
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
                            <span className="text-[28px] font-extrabold text-[#0f172a] leading-none tracking-tight">LKR {kpis.revenue}K</span>
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
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm h-[400px] flex flex-col data-html2canvas-ignore">
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

            {/* Test Performance Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Top 5 Tests */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col">
                    <h2 className="text-[15px] font-extrabold text-[#0f172a] mb-4">Top 5 Performing Tests</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-[#ecf0f6]">
                                    <th className="pb-3 text-[#64748b] font-bold">Test Name</th>
                                    <th className="pb-3 text-[#64748b] font-bold text-right">Orders</th>
                                    <th className="pb-3 text-[#64748b] font-bold text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topTests.length > 0 ? topTests.map((test, idx) => (
                                    <tr key={idx} className="border-b border-[#f1f5f9] last:border-0">
                                        <td className="py-3 font-semibold text-[#0f172a]">{test.testName}</td>
                                        <td className="py-3 font-bold text-[#38bdf8] text-right">{test.orderCount}</td>
                                        <td className="py-3 font-bold text-[#10b981] text-right">Rs. {test.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="py-4 text-center text-[#94a3b8] text-xs">No data available</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Least 5 Tests */}
                <div className="bg-white rounded-2xl p-6 border border-[#ecf0f6] shadow-sm flex flex-col">
                    <h2 className="text-[15px] font-extrabold text-[#0f172a] mb-4">Least Performing Tests</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-[#ecf0f6]">
                                    <th className="pb-3 text-[#64748b] font-bold">Test Name</th>
                                    <th className="pb-3 text-[#64748b] font-bold text-right">Orders</th>
                                    <th className="pb-3 text-[#64748b] font-bold text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leastTests.length > 0 ? leastTests.map((test, idx) => (
                                    <tr key={idx} className="border-b border-[#f1f5f9] last:border-0">
                                        <td className="py-3 font-semibold text-[#0f172a]">{test.testName}</td>
                                        <td className="py-3 font-bold text-[#f43f5e] text-right">{test.orderCount}</td>
                                        <td className="py-3 font-bold text-[#f59e0b] text-right">Rs. {test.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="py-4 text-center text-[#94a3b8] text-xs">No data available</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    );
}