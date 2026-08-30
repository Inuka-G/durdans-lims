"use client";

import type { LucideIcon } from "lucide-react";
import {
    AlertTriangle,
    Cpu,
    FileText,
    HardDrive,
    History,
    MemoryStick,
    Server,
    ShieldAlert,
    Terminal,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import DemoDataBanner from "@/components/shared/DemoDataBanner";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusChip, { type ChipTone } from "@/components/ui/StatusChip";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

// Mock Data
const kafkaStreamData = [
    { time: "T-60s", value: 400 },
    { time: "T-55s", value: 650 },
    { time: "T-50s", value: 300 },
    { time: "T-45s", value: 900 },
    { time: "T-40s", value: 500 },
    { time: "T-35s", value: 850 },
    { time: "T-30s", value: 450 },
    { time: "T-25s", value: 1200 },
    { time: "T-20s", value: 1482 },
    { time: "T-15s", value: 900 },
    { time: "T-10s", value: 650 },
    { time: "T-5s", value: 1000 },
    { time: "Now", value: 850 },
];

const services: { name: string; state: string; tone: ChipTone }[] = [
    { name: "API backend", state: "Online", tone: "success" },
    { name: "Auth server", state: "Online", tone: "success" },
    { name: "Kafka broker", state: "Online", tone: "success" },
    { name: "Notification hub", state: "Degraded", tone: "danger" },
    { name: "ELK stack", state: "Online", tone: "success" },
];

const CHART_TICK = { fontSize: 11, fill: "var(--fg-muted)" };

/**
 * MeterTile — KpiTile anatomy (icon + label → value → context) with a
 * utilisation bar between value and context. KpiTile has no meter slot, so
 * this is composed locally from the same token classes.
 */
function MeterTile({
    label,
    value,
    icon: Icon,
    percent,
    tone = "neutral",
    detail,
}: {
    label: string;
    value: string;
    icon: LucideIcon;
    percent: number;
    tone?: "neutral" | "warning" | "danger";
    detail: string;
}) {
    const clamped = Math.max(0, Math.min(100, percent));
    const bar = tone === "danger" ? "bg-status-danger" : tone === "warning" ? "bg-status-pending" : "bg-primary";
    return (
        <div className="rounded-lg border border-edge bg-surface px-4 py-3.5">
            <span className="flex items-center gap-2 text-xs font-medium text-fg-muted">
                <Icon className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                <span className="truncate">{label}</span>
            </span>
            <span className="mt-1.5 block text-[26px] font-semibold leading-none tabular-nums text-fg">{value}</span>
            <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clamped}
                aria-valuetext={value}
                className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
            >
                <div className={cn("h-full rounded-full", bar)} style={{ width: `${clamped}%` }} />
            </div>
            <span className="mt-2 block text-xs leading-4 tabular-nums text-fg-muted">{detail}</span>
        </div>
    );
}

export default function SystemMonitoringPage() {
    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: "Super admin", href: "/superadmin" }, { label: "System monitoring" }]}
                title="System monitoring"
                meta={
                    <>
                        <Server className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Server health status</span>
                        <span aria-hidden="true">·</span>
                        <span>Updated just now</span>
                    </>
                }
            />



            {/* ── Utilisation row ── */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MeterTile label="CPU usage" value="42.8%" icon={Cpu} percent={42.8} detail="Core 01: 38% · Core 02: 48%" />
                <MeterTile
                    label="Memory utilisation"
                    value="12.4 GB"
                    icon={MemoryStick}
                    percent={75}
                    tone="warning"
                    detail="Used 12.4 GB · Free 4.2 GB"
                />
                <MeterTile label="Disk I/O" value="125 MB/s" icon={HardDrive} percent={40} detail="Reads 85 MB/s · Writes 40 MB/s" />
            </div>

            {/* ── Main grid: stream + services first; alerts + quick links beside them on wide screens ── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {/* Kafka event stream */}
                        <SectionCard
                            title="Kafka event stream"
                            className="lg:col-span-2"
                            bodyClassName="px-2 pb-2 pt-3"
                            actions={
                                <StatusChip tone="success" dot>
                                    Live
                                </StatusChip>
                            }
                        >
                            <figure className="m-0">
                                <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 pb-2 text-xs text-fg-muted">
                                    <span>Throughput, messages per second</span>
                                    <span className="inline-flex flex-wrap gap-x-3 tabular-nums">
                                        <span>
                                            Current <span className="font-semibold text-fg">1,482 msg/s</span>
                                        </span>
                                        <span>
                                            Peak <span className="font-semibold text-fg">2,180 msg/s</span>
                                        </span>
                                    </span>
                                </figcaption>
                                <div className="h-64" aria-hidden="true">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={kafkaStreamData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="kafkaStreamFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                                            <XAxis
                                                dataKey="time"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={CHART_TICK}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={CHART_TICK} width={40} />
                                            <Tooltip
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
                                                formatter={(value) => [`${value} msg/s`, "Throughput"]}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                name="Throughput"
                                                stroke="var(--color-primary)"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#kafkaStreamFill)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </figure>
                        </SectionCard>

                        {/* Core microservices */}
                        <SectionCard title="Core microservices" count={services.length} flush>
                            <ul className="divide-y divide-edge">
                                {services.map((s) => (
                                    <li key={s.name} className="flex items-center justify-between gap-2 px-4 py-2 text-[13px] text-fg hover:bg-surface-hover">
                                        <span className="min-w-0 truncate font-medium">{s.name}</span>
                                        <StatusChip tone={s.tone} dot size="sm">
                                            {s.state}
                                        </StatusChip>
                                    </li>
                                ))}
                            </ul>
                        </SectionCard>
                    </div>

                    {/* Live authentication logs */}
                    <SectionCard
                        title="Live authentication logs"
                        flush
                        actions={
                            <>
                                <span className="text-xs text-fg-muted">Autoscroll on</span>
                                <StatusChip tone="danger" dot>
                                    Live
                                </StatusChip>
                            </>
                        }
                    >
                        <EmptyState
                            icon={FileText}
                            title="No log stream connected"
                            description="Authentication events will stream here once the backend is wired."
                            compact
                        />
                    </SectionCard>
                </div>

                {/* Side column */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
                    {/* Critical alerts */}
                    <SectionCard title="Critical alerts" count={2}>
                        <ul aria-label="Critical alerts" className="space-y-3">
                            <li className="rounded-md border border-status-danger-edge bg-status-danger-bg p-3 text-status-danger-fg">
                                <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    High latency
                                </p>
                                <p className="text-xs leading-relaxed">Cluster-B responding with avg. 1250 ms delay. DB sync lag detected.</p>
                                <Button size="sm" className="mt-2.5">
                                    Trace route
                                </Button>
                            </li>
                            <li className="rounded-md border border-status-pending-edge bg-status-pending-bg p-3 text-status-pending-fg">
                                <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                                    <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    Brute force attempt
                                </p>
                                <p className="text-xs leading-relaxed">Multiple failed login attempts from IP 45.22.10.12 (user admin_remote_92).</p>
                                <Button size="sm" className="mt-2.5">
                                    Ban IP range
                                </Button>
                            </li>
                        </ul>
                        <Button variant="ghost" size="sm" className="mt-3 w-full">
                            Clear all logs
                        </Button>
                    </SectionCard>

                    {/* Admin quick links */}
                    <SectionCard title="Admin quick links">
                        <div className="flex flex-col gap-2">
                            <Button icon={Terminal} className="w-full justify-start">
                                Access console
                            </Button>
                            <Button icon={History} className="w-full justify-start">
                                Rollback cluster
                            </Button>
                            <Button icon={FileText} className="w-full justify-start">
                                System config
                            </Button>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
