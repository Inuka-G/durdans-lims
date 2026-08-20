"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Clock,
    Globe,
    Inbox,
    Mail,
    MessageCircle,
    Printer,
    RefreshCw,
    Search,
    Send,
    Smartphone,
    Truck,
    X,
    XCircle,
    type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
    listDispatchReports,
    type ApiDeliveryMethod,
    type ApiDispatchItemStatus,
    type DispatchDashboardItem,
} from "@/lib/api";
import { formatDisplayId } from "@/lib/format-id";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import KpiTile from "@/components/ui/KpiTile";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusChip, { humanizeStatus, toneForStatus } from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";
import { InputField } from "@/components/ui/Field";
import { formatRegistered } from "@/components/patient-dashboard/dashboard-data";

const ITEMS_PER_PAGE = 10;
const SKELETON_ROWS = 6;

const DELIVERY_METHODS: Record<ApiDeliveryMethod, { icon: LucideIcon; label: string }> = {
    EMAIL: { icon: Mail, label: "Email" },
    SMS: { icon: Smartphone, label: "SMS" },
    WHATSAPP: { icon: MessageCircle, label: "WhatsApp" },
    POST: { icon: Truck, label: "Post" },
    PRINT: { icon: Printer, label: "Print" },
    PORTAL: { icon: Globe, label: "Portal" },
};

type StatusFilter = "All" | ApiDispatchItemStatus;

const statusOptions: StatusFilter[] = ["All", "PENDING", "DELIVERED", "FAILED", "PARTIAL"];

const getHourKey = (dateValue: string, timeValue: string) => {
    const parsed = new Date(`${dateValue} ${timeValue}`);
    if (!Number.isNaN(parsed.getTime())) {
        return `${String(parsed.getHours()).padStart(2, "0")}:00`;
    }

    const match = timeValue.match(/(\d{1,2}):\d{2}\s*(AM|PM)?/i);
    if (!match) return "Other";
    let hour = Number(match[1]);
    const meridian = match[2]?.toUpperCase();
    if (meridian === "PM" && hour < 12) hour += 12;
    if (meridian === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:00`;
};

/**
 * The API ships authorizedDate / authorizedTime as display strings. When they
 * parse we render "Today 09:12" / "12 Aug 2026" + time; otherwise fall back to
 * the raw strings so nothing is lost.
 */
function formatAuthorized(dateValue: string, timeValue: string): { primary: string; secondary?: string } {
    const parsed = new Date(`${dateValue} ${timeValue}`);
    if (Number.isNaN(parsed.getTime())) {
        return { primary: dateValue || "—", secondary: timeValue || undefined };
    }
    const label = formatRegistered(parsed);
    if (label.startsWith("Today") || label.startsWith("Yesterday")) return { primary: label };
    return {
        primary: label,
        secondary: parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }),
    };
}

export default function DispatchDashboardPage() {
    const router = useRouter();
    const [reports, setReports] = useState<DispatchDashboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
    const [currentPage, setCurrentPage] = useState(1);

    const loadReports = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await listDispatchReports({
                page: 0,
                size: 200,
                sort: "authorizedAt,desc",
            });
            setReports(response.content ?? []);
        } catch (loadError) {
            console.error("Failed to load dispatch reports", loadError);
            setError("Couldn't load dispatch reports. Check your connection and retry.");
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadReports();
    }, [loadReports]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return reports.filter((r) => {
            const displayReportId = formatDisplayId(r.reportId, "REP").toLowerCase();
            const matchesSearch =
                r.reportId.toLowerCase().includes(q) ||
                displayReportId.includes(q) ||
                r.patientName.toLowerCase().includes(q) ||
                r.testName.toLowerCase().includes(q);
            const matchesStatus =
                statusFilter === "All" || r.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [reports, search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    // Clamp so a refresh that shrinks the list never leaves us on an empty page.
    const page = Math.min(currentPage, totalPages);
    const paginated = filtered.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    const totalReports = reports.length;
    const deliveredCount = reports.filter((r) => r.status === "DELIVERED").length;
    const failedCount = reports.filter((r) => r.status === "FAILED").length;
    const pendingCount = reports.filter((r) => r.status === "PENDING" || r.status === "PARTIAL").length;

    const dispatchVolumeData = useMemo(() => {
        const counts = new Map<string, number>();
        reports.forEach((report) => {
            const key = getHourKey(report.authorizedDate, report.authorizedTime);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });

        const rows = Array.from(counts.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([time, dispatched]) => ({ time, dispatched }));

        return rows.length > 0 ? rows : [{ time: "Now", dispatched: 0 }];
    }, [reports]);

    const chartTotal = dispatchVolumeData.reduce((n, d) => n + d.dispatched, 0);
    const chartPeak = dispatchVolumeData.reduce(
        (best, d) => (d.dispatched > best.dispatched ? d : best),
        dispatchVolumeData[0] ?? { time: "", dispatched: 0 }
    );

    const hasFilters = search !== "" || statusFilter !== "All";
    const clearFilters = () => {
        setSearch("");
        setStatusFilter("All");
        setCurrentPage(1);
    };

    const statusFilterOptions = statusOptions.map((status) => ({
        value: status,
        label: status === "All" ? "All" : humanizeStatus(status),
        count: status === "All" ? reports.length : reports.filter((r) => r.status === status).length,
    }));

    const showTable = !loading && !error && paginated.length > 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Dispatch dashboard"
                meta={
                    <>
                        <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Authorized report deliveries</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {totalReports} {totalReports === 1 ? "report" : "reports"} loaded
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button icon={RefreshCw} onClick={() => void loadReports()} loading={loading}>
                        Refresh
                    </Button>
                }
            />

            {error && (
                <div
                    role="alert"
                    className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-danger-edge bg-status-danger-bg px-4 py-2.5 text-sm text-status-danger-fg"
                >
                    <span className="inline-flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {error}
                    </span>
                    <button
                        type="button"
                        onClick={() => void loadReports()}
                        className="rounded border border-status-danger-edge bg-surface px-2.5 py-1 text-xs font-medium text-status-danger-fg hover:bg-status-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading dispatch reports"
                    : error
                      ? "Dispatch reports failed to load"
                      : `Dispatch reports loaded. Showing ${paginated.length} of ${filtered.length} reports${
                            totalPages > 1 ? `, page ${page} of ${totalPages}` : ""
                        }.`}
            </p>

            {/* KPI row */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile label="Total reports" value={totalReports} icon={Send} loading={loading} note="Today" />
                <KpiTile
                    label="Delivered"
                    value={deliveredCount}
                    icon={CheckCircle2}
                    tone={deliveredCount > 0 ? "success" : "neutral"}
                    loading={loading}
                    note="Successfully sent"
                />
                <KpiTile
                    label="Pending"
                    value={pendingCount}
                    icon={Clock}
                    tone={pendingCount > 0 ? "warning" : "neutral"}
                    loading={loading}
                    note="Awaiting dispatch"
                />
                <KpiTile
                    label="Failed"
                    value={failedCount}
                    icon={XCircle}
                    tone={failedCount > 0 ? "danger" : "neutral"}
                    loading={loading}
                    note="Require attention"
                />
            </div>

            {/* Chart + delivery methods */}
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
                <SectionCard title="Dispatch volume today" bodyClassName="px-2 pb-2 pt-3">
                    <figure className="m-0">
                        <figcaption className="sr-only">
                            {loading
                                ? "Loading dispatch volume chart"
                                : `${chartTotal} reports dispatched today by hour${
                                      chartTotal > 0 ? `, peak ${chartPeak.time} with ${chartPeak.dispatched}` : ""
                                  }.`}
                        </figcaption>
                        <div className="h-48" aria-hidden="true">
                            {loading ? (
                                <div className="flex h-full items-end gap-2 px-4 pb-6">
                                    {[40, 65, 30, 80, 55, 45, 70, 50].map((h, i) => (
                                        <span key={i} className="flex-1 rounded-t bg-skeleton" style={{ height: `${h}%` }} />
                                    ))}
                                </div>
                            ) : reports.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dispatchVolumeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={22}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                                        <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: "var(--fg-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                                        <Tooltip
                                            cursor={{ fill: "var(--primary-soft)" }}
                                            contentStyle={{
                                                borderRadius: 6,
                                                border: "1px solid var(--edge)",
                                                background: "var(--surface)",
                                                color: "var(--fg)",
                                                fontSize: 12,
                                                padding: "6px 10px",
                                            }}
                                            itemStyle={{ color: "var(--fg)" }}
                                            labelStyle={{ color: "var(--fg-muted)" }}
                                            formatter={(value) => [`${value} reports`, "Dispatched"]}
                                        />
                                        <Bar dataKey="dispatched" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Dispatched" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState
                                    icon={BarChart3}
                                    title="No dispatches yet today"
                                    description="Reports appear here as they are authorized."
                                    compact
                                    className="h-full"
                                />
                            )}
                        </div>
                        {!loading && reports.length > 0 && (
                            <p className="px-2 pt-1 text-[11px] text-fg-muted">Reports dispatched per hour.</p>
                        )}
                    </figure>
                </SectionCard>

                <SectionCard title="Delivery methods" flush>
                    <ul className="divide-y divide-edge">
                        {(Object.keys(DELIVERY_METHODS) as ApiDeliveryMethod[]).map((method) => {
                            const m = DELIVERY_METHODS[method];
                            const Icon = m.icon;
                            const count = reports.filter((r) => r.deliveryMethods.includes(method)).length;
                            return (
                                <li key={method} className="flex items-center gap-2.5 px-4 py-2 text-[13px]">
                                    <Icon className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                    <span className="text-fg-secondary">{m.label}</span>
                                    {loading ? (
                                        <span className="ml-auto h-3 w-6 rounded bg-skeleton" aria-hidden="true" />
                                    ) : (
                                        <span className="ml-auto font-medium tabular-nums text-fg">{count}</span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </SectionCard>
            </div>

            {/* Reports table */}
            <SectionCard title="Reports" count={loading || error ? undefined : filtered.length} flush>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge px-3 py-2">
                    <SegmentedControl<StatusFilter>
                        ariaLabel="Filter by status"
                        size="sm"
                        value={statusFilter}
                        onChange={(next) => {
                            setStatusFilter(next);
                            setCurrentPage(1);
                        }}
                        options={statusFilterOptions}
                    />
                    <InputField
                        label="Search reports"
                        hideLabel
                        type="search"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Report ID, patient or test"
                        autoComplete="off"
                        className="w-full sm:ml-auto sm:w-64"
                    />
                    {hasFilters && (
                        <Button variant="ghost" size="sm" icon={X} onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-36 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-32 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-4 w-16 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Reports unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void loadReports()}>
                                Retry
                            </Button>
                        }
                    />
                ) : paginated.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No reports match"
                            description="Try a different report ID, patient, test or status."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Inbox}
                            title="No reports to dispatch"
                            description="Authorized reports will appear here ready for delivery."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/*
                          * table-fixed budget: the percentage columns and the fixed 112px Actions
                          * column must together fit inside the table's own width, or every column
                          * gets scaled down. md+ shows all seven: 13+20+18+12+12+12 = 87%, so
                          * 0.87 * 920 + 112 = 912.4 <= the 920px md floor. Below md the Test column
                          * is hidden, leaving 69% + 112px inside the 760px floor.
                          */}
                        <table className="w-full min-w-[760px] table-fixed text-left text-[13px] md:min-w-[920px]">
                            <caption className="sr-only">Authorized reports awaiting dispatch</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-[13%] py-2 pl-4 pr-3 font-medium">
                                        Report ID
                                    </th>
                                    <th scope="col" className="w-[20%] px-3 py-2 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="hidden w-[18%] px-3 py-2 font-medium md:table-cell">
                                        Test
                                    </th>
                                    <th scope="col" className="w-[12%] px-3 py-2 font-medium">
                                        Authorized
                                    </th>
                                    <th scope="col" className="w-[12%] px-3 py-2 font-medium">
                                        Methods
                                    </th>
                                    <th scope="col" className="w-[12%] px-3 py-2 font-medium">
                                        Status
                                    </th>
                                    <th scope="col" className="w-28 py-2 pl-2 pr-4 text-right font-medium">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginated.map((report) => {
                                    const displayId = formatDisplayId(report.reportId, "REP");
                                    const authorized = formatAuthorized(report.authorizedDate, report.authorizedTime);
                                    return (
                                        <tr key={report.id} className="transition-colors hover:bg-surface-hover">
                                            {/* Report ID */}
                                            <td className="truncate py-2 pl-4 pr-3 font-mono text-xs font-medium text-fg" title={report.reportId}>
                                                {displayId}
                                            </td>

                                            {/* Patient */}
                                            <td className="px-3 py-2">
                                                <div className="truncate font-medium text-fg" title={report.patientName}>
                                                    {report.patientName || "—"}
                                                </div>
                                                <div className="truncate font-mono text-[11px] text-fg-muted" title={report.patientId || undefined}>
                                                    {report.patientId || "—"}
                                                </div>
                                            </td>

                                            {/* Test */}
                                            <td className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell" title={report.testName}>
                                                {report.testName || "—"}
                                            </td>

                                            {/* Authorized */}
                                            <td className="px-3 py-2 tabular-nums" title={`${report.authorizedDate} ${report.authorizedTime}`.trim()}>
                                                <div className="truncate text-fg-secondary">{authorized.primary}</div>
                                                {authorized.secondary && (
                                                    <div className="truncate text-[11px] text-fg-muted">{authorized.secondary}</div>
                                                )}
                                            </td>

                                            {/* Delivery methods */}
                                            <td className="px-3 py-2">
                                                {report.deliveryMethods.length === 0 ? (
                                                    <span className="text-fg-faint">—</span>
                                                ) : (
                                                    <ul className="flex flex-wrap items-center gap-1" aria-label={`Delivery methods for ${displayId}`}>
                                                        {report.deliveryMethods.map((method) => {
                                                            const m = DELIVERY_METHODS[method];
                                                            if (!m) return null;
                                                            const Icon = m.icon;
                                                            return (
                                                                <li
                                                                    key={method}
                                                                    title={m.label}
                                                                    className="inline-flex h-6 w-6 items-center justify-center rounded bg-surface-muted text-fg-secondary ring-1 ring-inset ring-edge"
                                                                >
                                                                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                                                    <span className="sr-only">{m.label}</span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-3 py-2">
                                                <StatusChip tone={toneForStatus(report.status)} dot size="sm" title={humanizeStatus(report.status)}>
                                                    {humanizeStatus(report.status)}
                                                </StatusChip>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2 pl-2 pr-4 text-right">
                                                <Button
                                                    size="sm"
                                                    onClick={() => router.push(`/dispatch/authorized-reports/${encodeURIComponent(report.reportId)}`)}
                                                    aria-label={`View report ${displayId}`}
                                                >
                                                    View report
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer: paging */}
                {showTable && (
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={filtered.length}
                        pageSize={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPage}
                        itemLabel="reports"
                    />
                )}
            </SectionCard>
        </div>
    );
}
