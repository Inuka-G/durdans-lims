"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
    Building2,
    ChartColumn,
    ChevronRight,
    CircleAlert,
    Download,
    Droplet,
    FileClock,
    FlaskConical,
    Package,
    ShieldCheck,
    UserPlus,
    Users,
    Wallet,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMetadata } from "@/providers/MetadataProvider";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import KpiTile from "@/components/ui/KpiTile";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusChip, { type ChipTone } from "@/components/ui/StatusChip";
import DemoDataBanner from "@/components/shared/DemoDataBanner";

/* ------------------------------------------------------------------ */
/*  Demo data (placeholder until the branch endpoints exist)           */
/* ------------------------------------------------------------------ */

const data = [
    { name: "Mon", revenue: 4000 },
    { name: "Tue", revenue: 8000 },
    { name: "Wed", revenue: 5000 },
    { name: "Thu", revenue: 7000 },
    { name: "Fri", revenue: 15000 },
    { name: "Sat", revenue: 22000 },
    { name: "Sun", revenue: 19000 },
];

const TEST_VOLUME: { label: string; percent: number }[] = [
    { label: "Blood", percent: 60 },
    { label: "Urine", percent: 35 },
    { label: "Biopsy", percent: 75 },
    { label: "PCR", percent: 45 },
];

type Alert = {
    id: string;
    icon: LucideIcon;
    tone: ChipTone;
    title: string;
    body: string;
    action?: string;
};

const ALERTS: Alert[] = [
    {
        id: "verification",
        icon: ShieldCheck,
        tone: "pending",
        title: "Pending verification",
        body: "5 blood reports require senior pathologist verification for Colombo-03.",
        action: "Resolve now",
    },
    {
        id: "delivery",
        icon: CircleAlert,
        tone: "danger",
        title: "Failed delivery",
        body: "System failed to email results for order #ORD-8821 due to an invalid email.",
        action: "Edit email",
    },
    {
        id: "stock",
        icon: Package,
        tone: "info",
        title: "Stock alert",
        body: "Reagent level for HbA1c testing is below the 15% threshold.",
    },
];

const ALERT_ICON_TONE: Record<ChipTone, string> = {
    neutral: "text-fg-muted",
    pending: "text-status-pending-fg",
    success: "text-status-verified-fg",
    danger: "text-status-danger-fg",
    info: "text-primary-strong",
};

type HaematologyTest = {
    abbr: string;
    name: string;
    code: string;
    mode: string;
    modeTone: ChipTone;
    ordersToday: string;
    status: string;
    statusTone: ChipTone;
};

const HAEMATOLOGY_TESTS: HaematologyTest[] = [
    { abbr: "FBC", name: "Full blood count (FBC)", code: "420-1", mode: "Auto-analyzed", modeTone: "success", ordersToday: "1,245", status: "42 pending", statusTone: "pending" },
    { abbr: "ESR", name: "Erythrocyte sedimentation rate", code: "421-2", mode: "Manual entry needed", modeTone: "pending", ordersToday: "452", status: "8 processing", statusTone: "info" },
    { abbr: "WBC", name: "White blood cells count", code: "422-3", mode: "Auto-analyzed", modeTone: "success", ordersToday: "890", status: "All clear", statusTone: "success" },
    { abbr: "RBC", name: "Red blood cells count", code: "423-4", mode: "Auto-analyzed", modeTone: "success", ordersToday: "850", status: "12 pending", statusTone: "pending" },
    { abbr: "Hb", name: "Haemoglobin", code: "424-5", mode: "Auto-analyzed", modeTone: "success", ordersToday: "1,102", status: "5 abnormal", statusTone: "danger" },
    { abbr: "PLT", name: "Platelet count", code: "425-6", mode: "Auto-analyzed", modeTone: "success", ordersToday: "940", status: "All clear", statusTone: "success" },
    { abbr: "Hct", name: "Hematocrit", code: "426-7", mode: "Supervisor review needed", modeTone: "pending", ordersToday: "650", status: "4 quality check", statusTone: "info" },
    { abbr: "N/L", name: "Neutrophils & lymphocytes", code: "427-8", mode: "Auto-analyzed", modeTone: "success", ordersToday: "1,020", status: "14 pending", statusTone: "pending" },
];

const QUICK_LINKS: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Add user", href: "/branch/users", icon: UserPlus },
    { label: "Pull report", href: "/branch/reports", icon: ChartColumn },
];

const formatLkr = (value: number) => `LKR ${value.toLocaleString("en-US")}`;

const LINK_CLASS =
    "inline-flex items-center gap-0.5 rounded text-xs font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function BranchDashboard() {
    const { metadata, loading: metadataLoading } = useMetadata();
    const branchName = metadata?.currentBranchName;

    const todayLabel = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Branch overview"
                meta={
                    <>
                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{branchName ?? (metadataLoading ? "Loading branch…" : "No branch")}</span>
                        <span aria-hidden="true">·</span>
                        <span className="whitespace-nowrap">{todayLabel}</span>
                    </>
                }
            />

            <DemoDataBanner />

            {/* ── KPI row ── */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile label="Total patients" value="2,482" icon={Users} delta={{ value: 12, unit: "%", label: "vs last month" }} />
                <KpiTile label="Test orders" value="842" icon={FlaskConical} delta={{ value: 5.4, unit: "%", label: "vs last month" }} />
                <KpiTile label="Revenue" value="LKR 1.2M" icon={Wallet} delta={{ value: -2.1, unit: "%", label: "vs last month" }} />
                <KpiTile label="Pending reports" value="47" icon={FileClock} tone="warning" note="Awaiting verification" />
            </div>

            {/* ── Charts + alerts / quick links ── */}
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">
                    {/* Revenue trend */}
                    <SectionCard
                        title="Revenue trend"
                        actions={
                            <Button variant="ghost" size="sm" icon={Download}>
                                Download CSV
                            </Button>
                        }
                        bodyClassName="p-3"
                    >
                        <figure aria-label="Revenue over the last 7 days" className="m-0">
                            <figcaption className="sr-only">Daily revenue for the last 7 days in Sri Lankan rupees.</figcaption>
                            <div className="h-[220px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="branchRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--edge)" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
                                            dy={8}
                                        />
                                        <YAxis hide={true} />
                                        <Tooltip
                                            cursor={{ stroke: "var(--edge-strong)" }}
                                            contentStyle={{
                                                borderRadius: 6,
                                                border: "1px solid var(--edge)",
                                                background: "var(--surface)",
                                                color: "var(--fg)",
                                                boxShadow: "0 2px 8px rgb(15 23 42 / 0.12)",
                                                fontSize: 12,
                                                padding: "6px 10px",
                                            }}
                                            itemStyle={{ color: "var(--fg)" }}
                                            labelStyle={{ color: "var(--fg-muted)" }}
                                            formatter={(value) => [formatLkr(Number(value)), "Revenue"]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            name="Revenue"
                                            stroke="var(--color-primary)"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#branchRevenueFill)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </figure>
                    </SectionCard>

                    {/* Test volume by category */}
                    <SectionCard title="Test volume by category" actions={<StatusChip size="sm">Monthly</StatusChip>} bodyClassName="p-4">
                        <ul aria-label="Test volume by category, this month" className="flex h-[220px] items-end justify-between gap-3">
                            {TEST_VOLUME.map((item) => (
                                <li key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                                    <div className="relative flex h-full w-full max-w-[48px] items-end overflow-hidden rounded-t bg-surface-muted">
                                        <div
                                            aria-hidden="true"
                                            className="w-full rounded-t bg-primary transition-[height] duration-300"
                                            style={{ height: `${item.percent}%` }}
                                        />
                                    </div>
                                    <span className="text-[12px] font-medium text-fg-muted">
                                        {item.label}
                                        <span className="sr-only">: {item.percent}% of capacity</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </SectionCard>
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-4">
                    <SectionCard title="Alerts and notifications" count={ALERTS.length} flush>
                        <ul className="divide-y divide-edge">
                            {ALERTS.map((alert) => {
                                const Icon = alert.icon;
                                return (
                                    <li key={alert.id} className="flex gap-3 px-4 py-3">
                                        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ALERT_ICON_TONE[alert.tone])} aria-hidden="true" />
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-fg">{alert.title}</h3>
                                            <p className="mt-0.5 text-xs leading-snug text-fg-muted">{alert.body}</p>
                                            {alert.action && (
                                                <button type="button" className={cn(LINK_CLASS, "mt-1.5")}>
                                                    {alert.action}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="border-t border-edge p-2">
                            <Link
                                href="/branch/activity-logs"
                                className={cn(
                                    "flex h-8 w-full items-center justify-center gap-1 rounded-md text-xs font-medium text-fg-secondary",
                                    "hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                )}
                            >
                                View all notifications
                                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        </div>
                    </SectionCard>

                    <SectionCard title="Quick links">
                        <ul className="grid grid-cols-2 gap-3">
                            {QUICK_LINKS.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-2 rounded-lg border border-edge bg-surface-muted px-3 py-4 text-xs font-medium text-fg-secondary transition-colors",
                                                "hover:border-edge-strong hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                            )}
                                        >
                                            <Icon className="h-5 w-5 text-fg-muted" aria-hidden="true" />
                                            {link.label}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </SectionCard>
                </div>
            </div>

            {/* ── Haematology test details ── */}
            <SectionCard
                title="Haematology test details"
                count={HAEMATOLOGY_TESTS.length}
                flush
                actions={
                    <Button size="sm" icon={Download}>
                        Export data
                    </Button>
                }
            >
                <p className="flex items-center gap-2 border-b border-edge px-4 py-2 text-xs text-fg-muted">
                    <Droplet className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                    Live monitoring of blood and bone marrow tests processing across this branch.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] table-fixed text-left text-sm">
                        <colgroup>
                            <col className="w-[36%]" />
                            <col className="w-[14%]" />
                            <col className="w-[22%]" />
                            <col className="w-[14%]" />
                            <col className="w-[14%]" />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-edge text-xs font-semibold text-fg-muted">
                                <th scope="col" className="py-2 pl-4 pr-3 font-semibold">Test</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Code</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Mode</th>
                                <th scope="col" className="px-3 py-2 text-right font-semibold">Orders today</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge whitespace-nowrap">
                            {HAEMATOLOGY_TESTS.map((test) => (
                                <tr key={test.code} className="hover:bg-surface-hover">
                                    <td className="py-2 pl-4 pr-3">
                                        <div className="flex items-center gap-3">
                                            <span
                                                aria-hidden="true"
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[12px] font-semibold text-fg-secondary"
                                            >
                                                {test.abbr}
                                            </span>
                                            <span className="truncate font-medium text-fg" title={test.name}>
                                                {test.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 tabular-nums text-fg-secondary">{test.code}</td>
                                    <td className="px-3 py-2">
                                        <StatusChip tone={test.modeTone} dot size="sm" title={test.mode}>
                                            {test.mode}
                                        </StatusChip>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-fg">{test.ordersToday}</td>
                                    <td className="px-3 py-2">
                                        <StatusChip tone={test.statusTone} size="sm" title={test.status}>
                                            {test.status}
                                        </StatusChip>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>
        </div>
    );
}
