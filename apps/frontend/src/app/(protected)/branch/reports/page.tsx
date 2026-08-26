"use client";

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, FlaskConical, Banknote, Clock, FileText, FileSpreadsheet } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import KpiTile from '@/components/ui/KpiTile';
import SectionCard from '@/components/ui/SectionCard';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { InputField, SelectField } from '@/components/ui/Field';
import DemoDataBanner from '@/components/shared/DemoDataBanner';

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

// Chart series colours (literal by design; Pathology follows the brand token).
const SERIES_PATHOLOGY = 'var(--color-primary)';
const SERIES_RADIOLOGY = '#a855f7';
const SERIES_GENERAL = '#f59e0b';

const initialPieData = [
    { name: 'Pathology', value: 45, color: SERIES_PATHOLOGY },
    { name: 'Radiology', value: 28, color: SERIES_RADIOLOGY },
    { name: 'General', value: 27, color: SERIES_GENERAL },
];

type Period = '7d' | '30d' | '90d' | 'custom';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom' },
];

const PERIOD_DAYS: Record<Exclude<Period, 'custom'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

const AXIS_TICK = { fontSize: 11, fill: 'var(--fg-muted)' };
const TOOLTIP_STYLE = {
    borderRadius: 6,
    border: '1px solid var(--edge)',
    background: 'var(--surface)',
    color: 'var(--fg)',
    boxShadow: '0 2px 8px rgb(15 23 42 / 0.12)',
    fontSize: 12,
    padding: '6px 10px',
};

/** yyyy-mm-dd in local time (matches what <input type="date"> expects). */
function toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** "01 Oct 2023" for a yyyy-mm-dd string; "—" when empty/invalid. */
function formatDay(iso: string): string {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "01 OCT" → "01 Oct" for axis ticks and tooltip labels (data itself stays unchanged for export). */
function tickLabel(value: unknown): string {
    const s = String(value ?? '');
    return s.replace(/([A-Z])([A-Z]+)/g, (_m, a: string, b: string) => a + b.toLowerCase());
}

export default function BranchReportsPage() {
    const [startDate, setStartDate] = useState("2023-10-01");
    const [endDate, setEndDate] = useState("2023-10-31");
    const [period, setPeriod] = useState<Period>('custom');

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
                { name: 'Pathology', value: Math.floor(40 + noise * 15), color: SERIES_PATHOLOGY },
                { name: 'Radiology', value: Math.floor(20 + noise * 20), color: SERIES_RADIOLOGY },
                { name: 'General', value: Math.floor(20 + noise * 10), color: SERIES_GENERAL },
            ]);
        }
    }, [startDate, endDate]);

    // Period presets set the same start/end dates the date inputs control.
    const handlePeriodChange = (next: Period) => {
        setPeriod(next);
        if (next === 'custom') return;
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - PERIOD_DAYS[next]);
        setStartDate(toIsoDate(start));
        setEndDate(toIsoDate(end));
    };

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
                            <script>tailwind.config={theme:{extend:{colors:{canvas:'var(--canvas)',surface:'var(--surface)','surface-muted':'var(--surface-muted)','surface-hover':'var(--surface-hover)',edge:'var(--edge)','edge-strong':'var(--edge-strong)',fg:'var(--fg)','fg-secondary':'var(--fg-secondary)','fg-muted':'var(--fg-muted)','fg-faint':'var(--fg-faint)','status-pending':'#f59e0b','status-pending-fg':'var(--status-pending-fg)'}}}}</script>
                            <style>
                                /* The print window has no app stylesheet: define the chart/text tokens it references. */
                                :root {
                                    --color-primary: #137fec;
                                    --primary-soft: rgba(19, 127, 236, 0.08);
                                    --canvas: #f6f7f8;
                                    --surface: #ffffff;
                                    --surface-muted: #f8fafc;
                                    --surface-hover: #f1f5f9;
                                    --edge: #e2e8f0;
                                    --edge-strong: #cbd5e1;
                                    --fg: #0f172a;
                                    --fg-secondary: #334155;
                                    --fg-muted: #64748b;
                                    --fg-faint: #94a3b8;
                                    --status-pending-fg: #b45309;
                                }
                                @media print {
                                    @page { size: A4 landscape; margin: 10mm; }
                                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif; background: #f8fafc; }
                                    /* Hide interactive elements in print */
                                    select, input[type="date"], button, [role="radiogroup"], [data-html2canvas-ignore] { display: none !important; }
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
            ["Branch Report", "Colombo Branch"],
            ["Date Range", `${startDate} to ${endDate}`],
            [],
            ["Key Performance Indicators"],
            ["Metric", "Value", "Change %"],
            ["Total Patients", kpis.patients.replace(',', ''), kpis.pChange],
            ["Test Orders", kpis.orders.replace(',', ''), kpis.oChange],
            ["Revenue (LKR M)", kpis.revenue, kpis.rChange],
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
        XLSX.writeFile(workbook, `Branch_Report_Data_${startDate}_to_${endDate}.xlsx`);
    };

    const pieTotal = pieData.reduce((acc, curr) => acc + curr.value, 0);
    const peakRevenue = barData.reduce((max, d) => Math.max(max, d.revenue), 0);
    const rangeLabel = `${formatDay(startDate)} – ${formatDay(endDate)}`;

    return (
        <div className="mx-auto max-w-[1400px]">
            <DemoDataBanner note="Demo data — branch reports are not yet connected to a live backend; figures recalculate from the selected dates but are placeholders." />

            <div ref={reportRef}>
                <p className="hidden print:block text-xs text-fg-muted">
                    Demo data — figures are placeholders, not live branch results.
                </p>

                <PageHeader
                    crumbs={[{ label: 'Home' }, { label: 'Reports' }, { label: 'Colombo branch' }]}
                    title="Branch reports"
                    meta={
                        <>
                            <span>Colombo branch</span>
                            <span aria-hidden="true">·</span>
                            <span>{rangeLabel}</span>
                        </>
                    }
                    actions={
                        <>
                            <SegmentedControl
                                ariaLabel="Report period"
                                value={period}
                                onChange={handlePeriodChange}
                                options={PERIOD_OPTIONS}
                            />
                            <div className="flex items-center gap-2" data-html2canvas-ignore="true">
                                <Button icon={FileText} loading={isExporting} onClick={handleExportPDF}>
                                    {isExporting ? 'Generating…' : 'Export PDF'}
                                </Button>
                                <Button icon={FileSpreadsheet} onClick={handleExportExcel}>
                                    Export Excel
                                </Button>
                            </div>
                        </>
                    }
                />

                {/* Filters */}
                <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-edge bg-surface p-4 sm:grid-cols-2 xl:grid-cols-4">
                    <InputField
                        label="Start date"
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                            setStartDate(e.target.value);
                            setPeriod('custom');
                        }}
                    />
                    <InputField
                        label="End date"
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                            setEndDate(e.target.value);
                            setPeriod('custom');
                        }}
                    />
                    <SelectField label="Category" defaultValue="all">
                        <option value="all">All categories</option>
                        <option value="pathology">Pathology</option>
                        <option value="radiology">Radiology</option>
                    </SelectField>
                    <SelectField label="Payment status" defaultValue="all">
                        <option value="all">All statuses</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
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
                        delta={{ value: kpis.oChange, label: 'vs previous period' }}
                    />
                    <KpiTile
                        label="Revenue (net collection)"
                        value={`LKR ${kpis.revenue}M`}
                        icon={Banknote}
                        delta={{ value: kpis.rChange, label: 'vs previous period' }}
                    />
                    <KpiTile
                        label="Pending reports"
                        value={kpis.pending}
                        icon={Clock}
                        tone="warning"
                        delta={{ value: kpis.peChange, label: 'vs previous period' }}
                    />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <SectionCard
                        title="Revenue trend"
                        className="lg:col-span-2"
                        actions={<span className="text-xs text-fg-muted">{rangeLabel}</span>}
                    >
                        <p className="sr-only">
                            Daily revenue for {rangeLabel}. Peak LKR {peakRevenue.toLocaleString()}.
                        </p>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} barSize={28} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={AXIS_TICK}
                                        tickFormatter={tickLabel}
                                        interval={0}
                                        dy={6}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={AXIS_TICK}
                                        width={48}
                                        tickFormatter={(v) => Number(v).toLocaleString()}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'var(--primary-soft)' }}
                                        contentStyle={TOOLTIP_STYLE}
                                        itemStyle={{ color: 'var(--fg)' }}
                                        labelStyle={{ color: 'var(--fg-muted)' }}
                                        labelFormatter={(label) => tickLabel(label) || 'Revenue'}
                                        formatter={(value) => [`LKR ${Number(value).toLocaleString()}`, 'Revenue']}
                                    />
                                    <Bar dataKey="revenue" name="Revenue" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>

                    <SectionCard title="Revenue by category" flush>
                        <div className="relative h-[220px] w-full px-4 pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={62}
                                        outerRadius={86}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="var(--surface)"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={TOOLTIP_STYLE}
                                        itemStyle={{ color: 'var(--fg)' }}
                                        formatter={(value, name) => [`${value}%`, name]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4" aria-hidden="true">
                                <span className="text-[22px] font-semibold leading-none tabular-nums text-fg">{pieTotal}%</span>
                                <span className="mt-1 text-[12px] text-fg-muted">Lab tests</span>
                            </div>
                        </div>

                        <div className="mt-3 overflow-x-auto">
                            <table className="w-full table-fixed text-left text-sm">
                                <caption className="sr-only">Revenue share by category</caption>
                                <thead>
                                    <tr className="border-b border-edge text-xs font-semibold text-fg-muted">
                                        <th scope="col" className="px-3 py-2 pl-4 font-semibold">Category</th>
                                        <th scope="col" className="w-24 px-3 py-2 pr-4 text-right font-semibold">Share</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {pieData.map((item) => (
                                        <tr key={item.name} className="hover:bg-surface-hover">
                                            <td className="px-3 py-2 pl-4">
                                                <span className="inline-flex items-center gap-2">
                                                    <span
                                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                        style={{ backgroundColor: item.color }}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="text-fg-secondary">{item.name}</span>
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 pr-4 text-right font-medium tabular-nums text-fg">{item.value}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t border-edge bg-surface-muted text-xs">
                                        <th scope="row" className="px-3 py-2 pl-4 text-left font-medium text-fg-muted">Total</th>
                                        <td className="px-3 py-2 pr-4 text-right font-semibold tabular-nums text-fg">{pieTotal}%</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
