"use client";

import {
    AlertTriangle,
    Building2,
    ClipboardCheck,
    ShieldAlert,
    UserCheck,
    Users,
    Wallet,
    WifiOff,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
} from "recharts";
import DemoDataBanner from "@/components/shared/DemoDataBanner";
import PageHeader from "@/components/ui/PageHeader";
import KpiTile from "@/components/ui/KpiTile";
import SectionCard from "@/components/ui/SectionCard";
import StatusChip, { type ChipTone } from "@/components/ui/StatusChip";
import { cn } from "@/lib/utils";

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

const liveStatus: { label: string; state: string; tone: ChipTone }[] = [
    { label: "Reporting engine", state: "Online", tone: "success" },
    { label: "SMS / email gateway", state: "Active", tone: "success" },
    { label: "Backup process", state: "Pending", tone: "pending" },
];

const CHART_TOOLTIP_STYLE = {
    borderRadius: 6,
    border: "1px solid var(--edge)",
    background: "var(--surface)",
    color: "var(--fg)",
    boxShadow: "0 2px 8px rgb(15 23 42 / 0.12)",
    fontSize: 12,
    padding: "6px 10px",
};

const CHART_TICK = { fontSize: 11, fill: "var(--fg-muted)" };

function Meter({
    label,
    display,
    percent,
    tone = "primary",
}: {
    label: string;
    display: string;
    percent: number;
    tone?: "primary" | "success";
}) {
    const clamped = Math.max(0, Math.min(100, percent));
    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-fg-secondary">{label}</span>
                <span className="tabular-nums font-semibold text-fg">{display}</span>
            </div>
            <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clamped}
                aria-valuetext={display}
                className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
            >
                <div
                    className={cn("h-full rounded-full", tone === "success" ? "bg-status-verified" : "bg-primary")}
                    style={{ width: `${clamped}%` }}
                />
            </div>
        </div>
    );
}

export default function SuperAdminDashboardPage() {
    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <PageHeader
                title="Global dashboard"
                meta={
                    <>
                        <span>All branches</span>
                        <span aria-hidden="true">·</span>
                        <span>System 4.2.0-GA</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-verified" />
                            Cluster ap-south-1
                        </span>
                    </>
                }
            />

            <DemoDataBanner />

            {/* ── KPI row ── */}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <KpiTile label="Total branches" value="14" icon={Building2} />
                <KpiTile label="Total patients" value="12,842" icon={Users} />
                <KpiTile label="Total revenue" value="84.2M" icon={Wallet} note="LKR, all branches" />
                <KpiTile label="Active users" value="158" icon={UserCheck} />
                <KpiTile label="Pending verifications" value="24" icon={ClipboardCheck} tone="warning" />
                <KpiTile label="Failed deliveries" value="12" icon={AlertTriangle} tone="danger" />
            </div>

            {/* ── Main grid: charts first; health + alerts beside them on wide screens ── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Revenue by branch */}
                    <SectionCard title="Revenue by branch" bodyClassName="px-2 pb-2 pt-3">
                        <figure className="m-0">
                            <figcaption className="px-2 pb-2 text-xs text-fg-muted">Performance comparison across regions</figcaption>
                            <div className="h-64" aria-hidden="true">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={revenueByBranchData} barSize={28} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_TICK} interval={0} />
                                        <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} width={40} />
                                        <Tooltip
                                            cursor={{ fill: "var(--primary-soft)" }}
                                            contentStyle={CHART_TOOLTIP_STYLE}
                                            itemStyle={{ color: "var(--fg)" }}
                                            labelStyle={{ color: "var(--fg-muted)" }}
                                            formatter={(value) => [value, "Revenue"]}
                                        />
                                        <Bar dataKey="value" name="Revenue" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </figure>
                    </SectionCard>

                    {/* Global revenue trend */}
                    <SectionCard
                        title="Global revenue trend"
                        bodyClassName="px-2 pb-2 pt-3"
                        actions={
                            <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
                                Current
                            </span>
                        }
                    >
                        <figure className="m-0">
                            <figcaption className="px-2 pb-2 text-xs text-fg-muted">6-month growth</figcaption>
                            <div className="h-64" aria-hidden="true">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={globalRevenueTrendData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={CHART_TICK} interval={0} />
                                        <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} width={40} />
                                        <Tooltip
                                            contentStyle={CHART_TOOLTIP_STYLE}
                                            itemStyle={{ color: "var(--fg)" }}
                                            labelStyle={{ color: "var(--fg-muted)" }}
                                            formatter={(value) => [value, "Revenue"]}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            name="Revenue"
                                            stroke="var(--color-primary)"
                                            strokeWidth={2}
                                            dot={{ r: 3, fill: "var(--color-primary)", stroke: "var(--surface)", strokeWidth: 2 }}
                                            activeDot={{ r: 5, fill: "var(--color-primary)", stroke: "var(--surface)", strokeWidth: 2 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </figure>
                    </SectionCard>
                </div>

                {/* Side column */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
                    {/* System health */}
                    <SectionCard
                        title="System health"
                        actions={
                            <StatusChip tone="success" dot>
                                Healthy
                            </StatusChip>
                        }
                    >
                        <div className="space-y-4">
                            <Meter label="Global server load" display="34%" percent={34} />
                            <Meter label="API response time" display="124 ms" percent={40} tone="success" />
                        </div>

                        <div className="mt-4 border-t border-edge pt-3">
                            <p className="mb-2 text-xs font-medium text-fg-muted">Live status</p>
                            <ul className="divide-y divide-edge">
                                {liveStatus.map((s) => (
                                    <li key={s.label} className="flex items-center justify-between gap-2 py-1.5 text-[13px] text-fg">
                                        <span className="min-w-0 truncate">{s.label}</span>
                                        <StatusChip tone={s.tone} dot size="sm">
                                            {s.state}
                                        </StatusChip>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </SectionCard>

                    {/* Critical alerts */}
                    <SectionCard title="Critical alerts" count={2}>
                        <ul aria-label="Critical alerts" className="space-y-3">
                            <li className="rounded-md border border-status-danger-edge bg-status-danger-bg p-3 text-status-danger-fg">
                                <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                                    <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    Branch offline
                                </p>
                                <p className="text-xs leading-relaxed">Jaffna Regional Hub connection lost at 08:42.</p>
                            </li>
                            <li className="rounded-md border border-status-pending-edge bg-status-pending-bg p-3 text-status-pending-fg">
                                <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                                    <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    Security alert
                                </p>
                                <p className="text-xs leading-relaxed">Multiple failed login attempts detected from IP 192.168.1.1.</p>
                            </li>
                        </ul>
                    </SectionCard>
                </div>
            </div>

            {/* Footer */}
            <footer className="mt-6 flex flex-col gap-2 border-t border-edge pt-4 text-xs text-fg-muted sm:flex-row sm:items-center sm:justify-between">
                <span>&copy; 2023 Laboratory Management ERP. Global edition</span>
                <span className="tabular-nums">System 4.2.0-GA</span>
            </footer>
        </div>
    );
}
