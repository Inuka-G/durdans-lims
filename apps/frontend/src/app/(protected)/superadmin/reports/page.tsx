"use client";

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
    ArrowDownRight,
    ArrowUpRight,
    Banknote,
    Building2,
    CalendarRange,
    CircleUserRound,
    Clock3,
    Droplets,
    FileSpreadsheet,
    FileText,
    FlaskConical,
    Microscope,
    ReceiptText,
    Send,
    ShieldCheck,
    Users,
    type LucideIcon,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { InputField, SelectField } from '@/components/ui/Field';
import SectionCard from '@/components/ui/SectionCard';
import KpiTile from '@/components/ui/KpiTile';
import DemoDataBanner from '@/components/shared/DemoDataBanner';
import { getBranches, getBranchDashboardReport, type BranchReportTestPerformance } from '@/lib/api';


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

// Chart series colours may stay literal; the first series follows the brand token.
const initialPieData = [
    { name: 'Pathology', value: 55, color: 'var(--color-primary)' },
    { name: 'Radiology', value: 25, color: '#a855f7' },
    { name: 'General', value: 20, color: '#f59e0b' },
];

const CHART_TOOLTIP_STYLE: CSSProperties = {
    borderRadius: 6,
    border: '1px solid var(--edge)',
    background: 'var(--surface)',
    color: 'var(--fg)',
    boxShadow: '0 2px 8px rgb(15 23 42 / 0.12)',
    fontSize: 12,
    padding: '6px 10px',
};

type ModuleMetric = { label: string; value: string; delta?: string };
type ModulePanel = { title: string; description: string; icon: LucideIcon; metrics: ModuleMetric[] };

/** Static mock figures for the per-module performance panels (not yet wired to a backend). */
const MODULE_PANELS: ModulePanel[] = [
    {
        title: 'Patient management',
        description: 'Registration, duplicate detection, OTP verification and profiles.',
        icon: CircleUserRound,
        metrics: [
            { label: 'New registrations', value: '1,245', delta: '+12.4%' },
            { label: 'Searches', value: '15,820', delta: '+5.2%' },
            { label: 'OTP sent', value: '8,412' },
            { label: 'Duplicates', value: '34', delta: '-2.1%' },
        ],
    },
    {
        title: 'Test ordering & billing',
        description: 'Lab test orders, bill generation and real-time payment tracking.',
        icon: ReceiptText,
        metrics: [
            { label: 'Orders', value: '8,105', delta: '+8.5%' },
            { label: 'Billed (LKR M)', value: '24.2', delta: '+15.2%' },
            { label: 'Fully paid', value: '92%', delta: '+1.1%' },
            { label: 'Partial', value: '142' },
        ],
    },
    {
        title: 'Sample lifecycle',
        description: 'Tracks the process from sample collection to accessioning.',
        icon: Droplets,
        metrics: [
            { label: 'Collected', value: '12,504', delta: '+6.1%' },
            { label: 'Accessioned', value: '12,480', delta: '+6.4%' },
            { label: 'Rejected', value: '42', delta: '-12%' },
            { label: 'In transit', value: '1,102' },
        ],
    },
    {
        title: 'Laboratory processing',
        description: 'MLT result entry, abnormal flagging and analyser sync.',
        icon: Microscope,
        metrics: [
            { label: 'Results', value: '11,940', delta: '+9.2%' },
            { label: 'Analysed', value: '85%', delta: '+1.5%' },
            { label: 'Abnormal', value: '940' },
            { label: 'Turnaround', value: '4.2h', delta: '-0.5h' },
        ],
    },
    {
        title: 'Verification & authorisation',
        description: 'Technical verification by supervisors and pathologist authorisation.',
        icon: ShieldCheck,
        metrics: [
            { label: 'Verified', value: '11,850', delta: '+8.4%' },
            { label: 'Authorised', value: '11,802', delta: '+8.8%' },
            { label: 'Pending', value: '342', delta: '-4.5%' },
            { label: 'Recalled', value: '12' },
        ],
    },
    {
        title: 'Report dispatch',
        description: 'Distribution of finalised reports via email, SMS and portal.',
        icon: Send,
        metrics: [
            { label: 'Dispatched', value: '11,800', delta: '+9.1%' },
            { label: 'Email sent', value: '9,450' },
            { label: 'SMS alerts', value: '11,500' },
            { label: 'Failures', value: '24', delta: '-12%' },
        ],
    },
];

/**
 * Branch filter options. `value` is the stored filter key (also feeds the demo
 * noise maths) and must not change; `label` is the sentence-case display copy.
 */


/** Parse a yyyy-mm-dd input value as a local date (avoids UTC day shifts). */
function parseInputDate(value: string): Date | null {
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

/** Date-only label for a report period — never a relative "Today HH:MM" timestamp. */
function formatDay(d: Date | null): string {
    return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function MetricDelta({ delta }: { delta: string }) {
    const up = !delta.startsWith('-');
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    return (
        <span className="inline-flex items-center gap-0.5 text-[12px] text-fg-secondary tabular-nums">
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">{up ? 'Up' : 'Down'} </span>
            {delta.replace(/^[+-]/, '')}
        </span>
    );
}

export default function SuperadminReportsPage() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [selectedBranch, setSelectedBranch] = useState("ALL");
    const [branches, setBranches] = useState<{value: string, label: string}[]>([{ value: "ALL", label: "All branches" }]);


    useEffect(() => {
        getBranches().then(res => {
            const mapped = res.map(b => ({ value: b.code, label: b.name }));
            setBranches([{ value: "ALL", label: "All branches" }, ...mapped]);
        }).catch(err => console.error("Failed to load branches", err));
    }, []);

    const [barData, setBarData] = useState(initialBarData);
    const [pieData, setPieData] = useState(initialPieData);
    const [topTests, setTopTests] = useState<BranchReportTestPerformance[]>([]);
    const [leastTests, setLeastTests] = useState<BranchReportTestPerformance[]>([]);
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
            const backendBranch = selectedBranch;

            getBranchDashboardReport(backendBranch, startDate, endDate)
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
                        const mappedBarData = report.revenueTrend.map((item: any) => ({
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
                            <script>
                                /* Light-theme values for the semantic colour classes used by the report markup */
                                tailwind.config = { theme: { extend: { colors: {
                                    canvas: '#f6f7f8',
                                    surface: { DEFAULT: '#ffffff', muted: '#f8fafc', hover: '#f1f5f9' },
                                    skeleton: '#f1f5f9',
                                    edge: { DEFAULT: '#e2e8f0', strong: '#cbd5e1' },
                                    fg: { DEFAULT: '#0f172a', secondary: '#334155', muted: '#64748b', faint: '#94a3b8' },
                                    primary: { DEFAULT: '#137fec', strong: '#0b5fc2', soft: 'rgba(19, 127, 236, 0.08)' },
                                    status: {
                                        pending: { DEFAULT: '#f59e0b', bg: '#fffbeb', fg: '#b45309', edge: '#fde68a' },
                                        verified: { DEFAULT: '#10b981', bg: '#ecfdf5', fg: '#047857', edge: '#a7f3d0' },
                                        danger: { DEFAULT: '#ef4444', bg: '#fef2f2', fg: '#b91c1c', edge: '#fecaca' },
                                    },
                                } } } };
                            </script>
                            <style>
                                /* Light-theme values for the design tokens the charts reference */
                                :root {
                                    --color-primary: #137fec; --primary-soft: rgba(19, 127, 236, 0.08);
                                    --surface: #ffffff; --edge: #e2e8f0; --edge-strong: #cbd5e1;
                                    --fg: #0f172a; --fg-secondary: #334155; --fg-muted: #64748b; --fg-faint: #94a3b8;
                                }
                                @media print {
                                    @page { size: A4 landscape; margin: 10mm; }
                                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; background: #f8fafc; }
                                    /* Hide interactive elements in print */
                                    select, input, button, [data-print-hide], .data-html2canvas-ignore { display: none !important; }
                                }
                                body { background: #f8fafc; padding: 20px; color: #0f172a; }
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

    // Export Excel function
    const handleExportExcel = () => {
        // Sheet 1: KPIs
        const kpiSheet = XLSX.utils.aoa_to_sheet([
            ["System Report", "Cross-Branch Performance"],
            ["Branch Filter", selectedBranch],
            ["Date Range", `${startDate} to ${endDate}`],
            [],
            ["Key Performance Indicators"],
            ["Metric", "Value", "Change %"],
            ["Total Patients", kpis.patients.replace(/,/g, ''), kpis.pChange],
            ["Test Orders", kpis.orders.replace(/,/g, ''), kpis.oChange],
            ["Revenue (LKR K)", kpis.revenue, kpis.rChange],
            ["Pending Reports", kpis.pending, kpis.peChange],
        ]);

        // Sheet 2: Category Breakdown
        const catSheet = XLSX.utils.aoa_to_sheet([
            ["Revenue by Category"],
            ["Category", "Percentage (%)"],
            ...pieData.map((item) => [item.name, item.value]),
        ]);

        // Sheet 3: Revenue Trend
        const trendSheet = XLSX.utils.aoa_to_sheet([
            ["Revenue Trend"],
            ["Date", "Revenue"],
            ...barData.map((item) => [item.name || "N/A", item.revenue]),
        ]);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, kpiSheet, "KPIs");
        XLSX.utils.book_append_sheet(workbook, catSheet, "Revenue by Category");
        XLSX.utils.book_append_sheet(workbook, trendSheet, "Revenue Trend");
        XLSX.writeFile(workbook, `Cross_Branch_Report_${startDate}_to_${endDate}.xlsx`);
    };

    const periodLabel = `${formatDay(parseInputDate(startDate))} – ${formatDay(parseInputDate(endDate))}`;
    const branchLabel = branches.find((b) => b.value === selectedBranch)?.label ?? selectedBranch;
    const pieTotal = pieData.reduce((acc, curr) => acc + curr.value, 0);
    const barTotal = barData.length > 0 ? barData.reduce((acc, curr) => acc + (curr.revenue || 0), 0) : 0;
    const barPeak = barData.length > 0 ? barData.reduce((best, curr) => ((curr.revenue || 0) > (best.revenue || 0) ? curr : best), barData[0]) : null;

    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <div ref={reportRef}>
                {/* Inside reportRef so the exported PDF carries the disclaimer too. */}


                <PageHeader
                    title="Cross-branch reports"
                    crumbs={[{ label: "Super admin", href: "/superadmin" }, { label: "Cross-branch reports" }]}
                    meta={
                        <>
                            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{branchLabel}</span>
                            <span aria-hidden="true">·</span>
                            <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{periodLabel}</span>
                        </>
                    }
                    actions={
                        <div className="flex flex-wrap items-center gap-2" data-print-hide="true" data-html2canvas-ignore="true">
                            <Button icon={FileText} onClick={handleExportPDF} loading={isExporting}>
                                {isExporting ? 'Generating…' : 'Export PDF'}
                            </Button>
                            <Button icon={FileSpreadsheet} onClick={handleExportExcel}>
                                Export Excel
                            </Button>
                        </div>
                    }
                />

                {/* Screen-reader status for filter changes */}
                <p role="status" aria-live="polite" className="sr-only">
                    {isExporting ? 'Generating PDF report' : `Showing ${branchLabel}, ${periodLabel}.`}
                </p>

                {/* Filter toolbar */}
                <div
                    data-print-hide="true"
                    className="mb-5 flex flex-wrap items-end gap-2 rounded-lg border border-edge bg-surface-muted px-3 py-2"
                >
                    <SelectField
                        label="Branch"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full sm:w-52"
                    >
                        {branches.map((b) => (
                            <option key={b.value} value={b.value}>
                                {b.label}
                            </option>
                        ))}
                    </SelectField>
                    <InputField
                        label="From"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full sm:w-40"
                    />
                    <InputField
                        label="To"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full sm:w-40"
                    />
                    <SelectField label="Category" className="w-full sm:w-44">
                        <option>All categories</option>
                        <option>Pathology</option>
                        <option>Radiology</option>
                    </SelectField>
                    <SelectField label="Payment status" className="w-full sm:w-44">
                        <option>All statuses</option>
                        <option>Paid</option>
                        <option>Pending</option>
                    </SelectField>
                </div>

                {/* KPIs */}
                <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiTile
                        label="Total patients"
                        value={kpis.patients}
                        icon={Users}
                        delta={{ value: kpis.pChange, label: 'vs previous period' }}
                    />
                    <KpiTile
                        label="Test orders"
                        value={kpis.orders}
                        icon={FlaskConical}
                        delta={{ value: kpis.oChange, label: 'vs previous period · tests performed' }}
                    />
                    <KpiTile
                        label="Revenue"
                        value={`LKR ${Number(kpis.revenue).toLocaleString()}`}
                        icon={Banknote}
                        delta={{ value: kpis.rChange, label: 'vs previous period · net collection' }}
                    />
                    <KpiTile
                        label="Pending reports"
                        value={kpis.pending}
                        icon={Clock3}
                        tone="warning"
                        delta={{ value: kpis.peChange, label: 'vs previous period · awaiting verification' }}
                    />
                </div>

                {/* Charts */}
                <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <SectionCard
                        title="Revenue trend"
                        className="lg:col-span-2"
                        actions={<span className="text-xs text-fg-muted">Last 30 days</span>}
                        bodyClassName="px-2 pb-2 pt-3"
                    >
                        <figure className="m-0">
                            <figcaption className="sr-only">
                                {`Revenue trend for ${branchLabel}, ${periodLabel}: LKR ${barTotal.toLocaleString()} in total, peak ${
                                    barPeak?.name || 'mid-period'
                                } with LKR ${barPeak?.revenue?.toLocaleString() || '0'}.`}
                            </figcaption>
                            <div className="h-72" aria-hidden="true">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={barData}
                                        margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                                        accessibilityLayer={false}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--edge)" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'var(--fg-muted)', fontSize: 11 }}
                                            dy={10}
                                        />
                                        <YAxis hide={true} />
                                        <Tooltip
                                            cursor={{ fill: 'var(--primary-soft)' }}
                                            contentStyle={CHART_TOOLTIP_STYLE}
                                            itemStyle={{ color: 'var(--fg)' }}
                                            labelStyle={{ color: 'var(--fg-muted)' }}
                                            formatter={(value) => [`LKR ${Number(value).toLocaleString()}`, 'Revenue']}
                                        />
                                        <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={42} name="Revenue">
                                            {barData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill="var(--color-primary)"
                                                    fillOpacity={entry.revenue < 10000 ? 0.45 : entry.revenue < 20000 ? 0.7 : 1}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </figure>
                    </SectionCard>

                    <SectionCard title="Revenue by category" bodyClassName="flex flex-col">
                        <figure className="m-0 flex flex-1 flex-col">
                            <figcaption className="sr-only">
                                {`Revenue by category: ${pieData.map((p) => `${p.name} ${p.value}%`).join(', ')}.`}
                            </figcaption>
                            <div className="relative h-56" aria-hidden="true">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart accessibilityLayer={false}>
                                        <Pie
                                            data={pieData}
                                            innerRadius="62%"
                                            outerRadius="85%"
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="var(--surface)"
                                            rootTabIndex={-1}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={CHART_TOOLTIP_STYLE}
                                            itemStyle={{ color: 'var(--fg)' }}
                                            formatter={(value, name) => [`${value}%`, name]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-[22px] font-semibold leading-none tabular-nums text-fg">{pieTotal}%</span>
                                    <span className="mt-1 text-[12px] text-fg-muted">Lab tests</span>
                                </div>
                            </div>
                            <ul className="mt-4 flex flex-col gap-2">
                                {pieData.map((item) => (
                                    <li key={item.name} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="flex min-w-0 items-center gap-2 text-fg-secondary">
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                                aria-hidden="true"
                                            />
                                            <span className="truncate">{item.name}</span>
                                        </span>
                                        <span className="font-semibold tabular-nums text-fg">{item.value}%</span>
                                    </li>
                                ))}
                            </ul>
                        </figure>
                    </SectionCard>
                </div>

                {/* Module performance */}
                <section aria-labelledby="module-performance-heading">
                    <div className="mb-3">
                        <h2 id="module-performance-heading" className="text-base font-semibold tracking-tight text-fg">
                            Test performance
                        </h2>
                        <p className="mt-0.5 text-xs text-fg-muted">Most and least frequently ordered lab tests across selected branches.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <SectionCard title="Top 5 Performing Tests">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-edge">
                                            <th className="pb-3 text-fg-muted font-bold">Test Name</th>
                                            <th className="pb-3 text-fg-muted font-bold text-right">Orders</th>
                                            <th className="pb-3 text-fg-muted font-bold text-right">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topTests.length > 0 ? topTests.map((test, idx) => (
                                            <tr key={idx} className="border-b border-edge last:border-0">
                                                <td className="py-3 font-medium text-fg">{test.testName}</td>
                                                <td className="py-3 font-bold text-primary text-right">{test.orderCount}</td>
                                                <td className="py-3 font-bold text-status-verified-fg text-right">Rs. {test.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={3} className="py-4 text-center text-fg-faint text-xs">No data available</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>

                        <SectionCard title="Least Performing Tests">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-edge">
                                            <th className="pb-3 text-fg-muted font-bold">Test Name</th>
                                            <th className="pb-3 text-fg-muted font-bold text-right">Orders</th>
                                            <th className="pb-3 text-fg-muted font-bold text-right">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leastTests.length > 0 ? leastTests.map((test, idx) => (
                                            <tr key={idx} className="border-b border-edge last:border-0">
                                                <td className="py-3 font-medium text-fg">{test.testName}</td>
                                                <td className="py-3 font-bold text-status-danger-fg text-right">{test.orderCount}</td>
                                                <td className="py-3 font-bold text-status-pending-fg text-right">Rs. {test.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={3} className="py-4 text-center text-fg-faint text-xs">No data available</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    </div>
                </section>
            </div>
        </div>
    );
}
