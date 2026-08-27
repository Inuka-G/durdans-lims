"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
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
import StatusChip, { humanizeStatus, toneForStatus } from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";
import { InputField, SelectField } from "@/components/ui/Field";
import PriorityBadge from "@/components/shared/PriorityBadge";

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

type StatusFilter = "ALL" | ApiDispatchItemStatus;
type MethodFilter = "ALL" | ApiDeliveryMethod;

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
    { value: "ALL", label: "All" },
    { value: "PENDING", label: "Pending" },
    { value: "FAILED", label: "Failed" },
    { value: "PARTIAL", label: "Partial" },
];

const METHOD_OPTIONS: ReadonlyArray<{ value: MethodFilter; label: string }> = [
    { value: "ALL", label: "All channels" },
    { value: "EMAIL", label: "Email" },
    { value: "SMS", label: "SMS" },
    { value: "PRINT", label: "Print" },
    { value: "POST", label: "Post" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "PORTAL", label: "Portal" },
];

/**
 * Format updated timestamp matching the previous modules (e.g. "Updated 24 Aug 2026").
 */
function formatReportDate(dateValue: string, timeValue: string): string {
    const parsed = new Date(`${dateValue} ${timeValue}`);
    if (Number.isNaN(parsed.getTime())) {
        return dateValue ? `Updated ${dateValue}` : "—";
    }
    const formatted = parsed.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    return `Updated ${formatted}`;
}

export default function DispatchDashboardPage() {
    const router = useRouter();
    const [reports, setReports] = useState<DispatchDashboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [methodFilter, setMethodFilter] = useState<MethodFilter>("ALL");
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

    // Actionable worklist: Dispatch officer works on PENDING, FAILED, and PARTIAL deliveries.
    const actionableReports = useMemo(() => {
        return reports.filter((r) => r.status === "PENDING" || r.status === "FAILED" || r.status === "PARTIAL");
    }, [reports]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return actionableReports.filter((r) => {
            const displayReportId = formatDisplayId(r.reportId, "REP").toLowerCase();
            const rawReportId = (r.reportId ?? "").toLowerCase();
            const patientName = (r.patientName ?? "").toLowerCase();
            const patientId = (r.patientId ?? "").toLowerCase();
            const testName = (r.testName ?? "").toLowerCase();
            const doctorName = (r.authorizedBy ?? "").toLowerCase();
            const status = (r.status ?? "").toLowerCase();

            const matchesSearch =
                !q ||
                rawReportId.includes(q) ||
                displayReportId.includes(q) ||
                patientName.includes(q) ||
                patientId.includes(q) ||
                testName.includes(q) ||
                doctorName.includes(q) ||
                status.includes(q);

            const matchesStatus =
                statusFilter === "ALL" ? true : r.status === statusFilter;

            const matchesMethod =
                methodFilter === "ALL" || r.deliveryMethods?.includes(methodFilter);

            return matchesSearch && matchesStatus && matchesMethod;
        });
    }, [actionableReports, search, statusFilter, methodFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const page = Math.min(currentPage, totalPages);
    const paginated = filtered.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    const totalReports = reports.length;
    const deliveredCount = reports.filter((r) => r.status === "DELIVERED").length;
    const failedCount = actionableReports.filter((r) => r.status === "FAILED").length;
    const partialCount = actionableReports.filter((r) => r.status === "PARTIAL").length;
    const pendingCount = actionableReports.filter((r) => r.status === "PENDING").length;

    const hasFilters = search !== "" || statusFilter !== "ALL" || methodFilter !== "ALL";
    const clearFilters = () => {
        setSearch("");
        setStatusFilter("ALL");
        setMethodFilter("ALL");
        setCurrentPage(1);
    };

    const statusFilterOptions = useMemo(() => {
        return STATUS_OPTIONS.map((opt) => {
            let count = 0;
            if (opt.value === "ALL") count = actionableReports.length;
            else count = actionableReports.filter((r) => r.status === opt.value).length;

            return {
                ...opt,
                label: `${opt.label} (${count})`,
            };
        });
    }, [actionableReports]);

    const methodFilterOptions = useMemo(() => {
        return METHOD_OPTIONS.map((opt) => {
            const count = opt.value === "ALL"
                ? actionableReports.length
                : actionableReports.filter((r) => r.deliveryMethods?.includes(opt.value as ApiDeliveryMethod)).length;
            return {
                ...opt,
                label: `${opt.label} (${count})`,
            };
        });
    }, [actionableReports]);

    const showTable = !loading && !error && paginated.length > 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Dispatch worklist"
                meta={
                    <>
                        <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Multi-channel report delivery queue</span>
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
                    label="Failed / Partial"
                    value={failedCount + partialCount}
                    icon={XCircle}
                    tone={failedCount + partialCount > 0 ? "danger" : "neutral"}
                    loading={loading}
                    note="Require attention"
                />
            </div>

            {/* Delivery methods summary */}
            <div className="mb-4">
                <SectionCard title="Delivery methods" flush>
                    <div className="grid grid-cols-2 divide-y divide-edge sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 sm:divide-x">
                        {(Object.keys(DELIVERY_METHODS) as ApiDeliveryMethod[]).map((method) => {
                            const m = DELIVERY_METHODS[method];
                            const Icon = m.icon;
                            const count = reports.filter((r) => r.deliveryMethods?.includes(method)).length;
                            return (
                                <div key={method} className="flex items-center gap-3 p-3 sm:flex-col sm:items-center sm:text-center sm:py-3.5">
                                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted ring-1 ring-inset ring-edge">
                                        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium text-fg-secondary">{m.label}</div>
                                        <div className="text-base font-semibold tabular-nums text-fg">{loading ? "—" : count}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>
            </div>

            {/* Reports table */}
            <SectionCard title="Reports" count={loading || error ? undefined : filtered.length} flush>
                {/* Unified Toolbar Filter Row */}
                <div className="flex flex-wrap items-center gap-3 border-b border-edge p-3 sm:p-4">
                    <SelectField
                        label="Filter by status"
                        hideLabel
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as StatusFilter);
                            setCurrentPage(1);
                        }}
                        className="w-full sm:w-48"
                    >
                        {statusFilterOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </SelectField>

                    <SelectField
                        label="Filter by channel"
                        hideLabel
                        value={methodFilter}
                        onChange={(e) => {
                            setMethodFilter(e.target.value as MethodFilter);
                            setCurrentPage(1);
                        }}
                        className="w-full sm:w-44"
                    >
                        {methodFilterOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </SelectField>

                    <InputField
                        label="Search reports"
                        hideLabel
                        type="search"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Search report ID, patient, patient code, test group or doctor"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />

                    {hasFilters && (
                        <Button variant="ghost" icon={X} onClick={clearFilters}>
                            Clear all
                        </Button>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-3">
                                <span className="h-4 w-28 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-36 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-32 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                <span className="h-4 w-16 rounded bg-skeleton" />
                                <span className="h-4 w-14 rounded bg-skeleton" />
                                <span className="h-4 w-20 rounded bg-skeleton" />
                                <span className="ml-auto h-7 w-20 rounded bg-skeleton" />
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
                            description="Try a different report ID, patient, test group or status."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear all
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Inbox}
                            title="Worklist is clear"
                            description="All authorized reports have been successfully dispatched."
                        />
                    )
                ) : (
                    <div className="w-full">
                        <table className="w-full table-fixed text-left text-sm">
                            <caption className="sr-only">Authorized reports awaiting dispatch</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-[15%] py-2 pl-4 pr-3 font-semibold">
                                        Report ID
                                    </th>
                                    <th scope="col" className="w-[17%] px-3 py-2 font-semibold">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-[17%] px-3 py-2 font-semibold">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-[15%] px-3 py-2 font-semibold">
                                        Authorized by
                                    </th>
                                    <th scope="col" className="w-[11%] px-3 py-2 font-semibold">
                                        Methods
                                    </th>
                                    <th scope="col" className="w-[8%] px-3 py-2 font-semibold">
                                        Priority
                                    </th>
                                    <th scope="col" className="w-[12%] px-3 py-2 font-semibold">
                                        Status
                                    </th>
                                    <th scope="col" className="w-[10%] py-2 pl-3 pr-4 text-right font-semibold">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginated.map((report) => {
                                    const displayId = formatDisplayId(report.reportId, "REP");
                                    const updatedText = formatReportDate(report.authorizedDate, report.authorizedTime);
                                    const exactTimeTooltip = report.authorizedDate && report.authorizedTime
                                        ? `${report.authorizedDate}, ${report.authorizedTime}`
                                        : report.authorizedDate || undefined;
                                    const doctorName = report.authorizedBy || "Dr. Lasith Undulanga";
                                    return (
                                        <tr key={report.id} className="transition-colors hover:bg-surface-hover">
                                            {/* Report ID */}
                                            <td className="py-2 pl-4 pr-3">
                                                <div className="truncate font-mono text-xs font-medium text-fg" title={displayId}>
                                                    {displayId}
                                                </div>
                                                <div className="mt-0.5 text-xs text-fg-muted cursor-help" title={exactTimeTooltip}>
                                                    {updatedText}
                                                </div>
                                            </td>

                                            {/* Patient */}
                                            <td className="px-3 py-2">
                                                <div className="truncate font-semibold text-fg" title={report.patientName}>
                                                    {report.patientName || "Unknown patient"}
                                                </div>
                                                <div className="truncate font-mono text-xs text-fg-muted" title={report.patientId ? formatDisplayId(report.patientId, "PAT") : undefined}>
                                                    {report.patientId ? formatDisplayId(report.patientId, "PAT") : "—"}
                                                </div>
                                            </td>

                                            {/* Test group */}
                                            <td className="truncate px-3 py-2 text-fg-secondary" title={report.testName}>
                                                {report.testName || "Unknown test group"}
                                            </td>

                                            {/* Authorized by */}
                                            <td className="truncate px-3 py-2 text-fg-secondary" title={doctorName}>
                                                {doctorName}
                                            </td>

                                            {/* Delivery methods */}
                                            <td className="px-3 py-2">
                                                {!report.deliveryMethods || report.deliveryMethods.length === 0 ? (
                                                    <span className="text-fg-faint">—</span>
                                                ) : (
                                                    <ul className="flex flex-wrap items-center gap-1.5" aria-label={`Delivery methods for ${displayId}`}>
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

                                            {/* Priority */}
                                            <td className="px-3 py-2">
                                                <PriorityBadge priority={report.priorityLevel ?? "NORMAL"} />
                                            </td>

                                            {/* Status */}
                                            <td className="px-3 py-2">
                                                <StatusChip tone={toneForStatus(report.status)} dot size="sm" title={humanizeStatus(report.status)}>
                                                    {humanizeStatus(report.status)}
                                                </StatusChip>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => router.push(`/dispatch/authorized-reports/${encodeURIComponent(report.reportId)}`)}
                                                    aria-label={`Dispatch report ${displayId}`}
                                                >
                                                    Dispatch
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
