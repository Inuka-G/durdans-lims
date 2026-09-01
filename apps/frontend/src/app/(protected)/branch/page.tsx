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
            </div>



        </div>
    );
}