"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileSpreadsheet,
    Globe,
    Inbox,
    Mail,
    MessageCircle,
    Printer,
    RefreshCw,
    SearchX,
    Smartphone,
    Truck,
    X,
    XCircle,
    type LucideIcon,
} from "lucide-react";
import {
    listDeliveryRecords,
    type DeliveryRecordRow,
    type ApiDeliveryMethod,
} from "@/lib/api";
import { formatDisplayId } from "@/lib/format-id";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField, SelectField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedControl, { type SegmentOption } from "@/components/ui/SegmentedControl";
import KpiTile from "@/components/ui/KpiTile";
import StatusChip, { humanizeStatus, toneForStatus } from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";

const ITEMS_PER_PAGE = 10;
const SKELETON_ROWS = 6;

type StatusTab = "All" | "DELIVERED" | "PARTIAL" | "FAILED";
type ChannelFilter = "ALL" | ApiDeliveryMethod;
type PeriodTab = "ALL" | "TODAY" | "7_DAYS" | "30_DAYS";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
    { value: "All", label: "All" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "PARTIAL", label: "Partial" },
    { value: "FAILED", label: "Failed" },
];

const PERIOD_OPTIONS: SegmentOption<PeriodTab>[] = [
    { value: "ALL", label: "All time" },
    { value: "TODAY", label: "Today" },
    { value: "7_DAYS", label: "7 days" },
    { value: "30_DAYS", label: "30 days" },
];

const CHANNEL_FILTER_OPTIONS: { value: ChannelFilter; label: string }[] = [
    { value: "ALL", label: "All channels" },
    { value: "EMAIL", label: "Email" },
    { value: "SMS", label: "SMS" },
    { value: "PRINT", label: "Print" },
    { value: "POST", label: "Post" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "PORTAL", label: "Portal" },
];

const METHOD_META: Record<ApiDeliveryMethod, { icon: LucideIcon; label: string }> = {
    EMAIL: { icon: Mail, label: "Email" },
    SMS: { icon: Smartphone, label: "SMS" },
    WHATSAPP: { icon: MessageCircle, label: "WhatsApp" },
    POST: { icon: Truck, label: "Post" },
    PRINT: { icon: Printer, label: "Print" },
    PORTAL: { icon: Globe, label: "Portal" },
};

function formatReportDate(rawDate?: string | null): { display: string; tooltip: string } {
    if (!rawDate) return { display: "—", tooltip: "" };
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) {
        return { display: `Updated ${rawDate}`, tooltip: rawDate };
    }
    const formatted = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const fullTime = d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    return {
        display: `Updated ${formatted}`,
        tooltip: fullTime,
    };
}

export default function DeliveryStatusPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusTab>("All");
    const [channelFilter, setChannelFilter] = useState<ChannelFilter>("ALL");
    const [periodFilter, setPeriodFilter] = useState<PeriodTab>("ALL");
    const [currentPage, setCurrentPage] = useState(1);
    const [rows, setRows] = useState<DeliveryRecordRow[]>([]);
    const [overview, setOverview] = useState<DeliveryRecordRow[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(true);
    const [overviewLoaded, setOverviewLoaded] = useState(false);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    const loadOverview = useCallback(async () => {
        try {
            const res = await listDeliveryRecords({ page: 0, size: 500, sort: "authorizedAt,desc" });
            setOverview(res.content);
        } catch {
            /* ignore */
        } finally {
            setOverviewLoaded(true);
        }
    }, []);

    const loadTable = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params: Record<string, unknown> = {
                page: currentPage - 1,
                size: ITEMS_PER_PAGE,
                sort: "authorizedAt,desc",
            };
            if (statusFilter !== "All") params.status = statusFilter;
            if (search.trim()) params.keyword = search.trim();
            const res = await listDeliveryRecords(params);

            // Channel filter applied client side on page results if specified
            let list = res.content;
            if (channelFilter !== "ALL") {
                list = list.filter((r) => r.methods.includes(channelFilter));
            }

            // Period filter applied client side
            if (periodFilter !== "ALL") {
                const now = new Date();
                list = list.filter((r) => {
                    const rawDate = r.updatedAt ?? r.deliveredTime ?? r.dispatchedTime;
                    if (!rawDate) return false;
                    const d = new Date(rawDate);
                    if (Number.isNaN(d.getTime())) return true;
                    if (periodFilter === "TODAY") {
                        return d.toDateString() === now.toDateString();
                    }
                    if (periodFilter === "7_DAYS") {
                        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
                        return diffDays <= 7;
                    }
                    if (periodFilter === "30_DAYS") {
                        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
                        return diffDays <= 30;
                    }
                    return true;
                });
            }

            // Always guarantee latest cases first by timestamp
            list.sort((a, b) => {
                const timeA = new Date(a.updatedAt ?? a.deliveredTime ?? a.dispatchedTime ?? 0).getTime();
                const timeB = new Date(b.updatedAt ?? b.deliveredTime ?? b.dispatchedTime ?? 0).getTime();
                return timeB - timeA;
            });

            setRows(list);
            setTotalPages(Math.max(1, res.totalPages));
            setTotalElements(channelFilter !== "ALL" || periodFilter !== "ALL" ? list.length : res.totalElements);
        } catch (e) {
            console.error(e);
            setError("Couldn't load delivery records. Check your connection and retry.");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, statusFilter, channelFilter, periodFilter, search]);

    useEffect(() => {
        void loadOverview();
    }, [loadOverview, reloadKey]);

    useEffect(() => {
        void loadTable();
    }, [loadTable, reloadKey]);

    const tabCounts = useMemo(() => {
        const list = overview;
        return {
            All: list.length,
            DELIVERED: list.filter((r) => r.status === "DELIVERED").length,
            PARTIAL: list.filter((r) => r.status === "PARTIAL").length,
            FAILED: list.filter((r) => r.status === "FAILED").length,
        } as Record<StatusTab, number>;
    }, [overview]);

    const deliveredCount = tabCounts.DELIVERED;
    const partialCount = tabCounts.PARTIAL;
    const failedCount = tabCounts.FAILED;

    const handleExportAuditLog = () => {
        const data = rows.length ? rows : overview;
        const headers = ["Report ID", "Patient Name", "Patient ID", "Test Group", "Authorized By", "Methods", "Status"];
        const exportRows = data.map((r) => [
            formatDisplayId(r.reportId, "REP"),
            r.patientName,
            r.patientCode ? formatDisplayId(r.patientCode, "PAT") : "—",
            r.testName,
            r.authorizedBy ? (r.authorizedBy.startsWith("Dr.") ? r.authorizedBy : `Dr. ${r.authorizedBy}`) : "Dr. Lasith Undulanga",
            r.methods.join(", "),
            r.status,
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
        const colWidths = headers.map((h, i) => ({
            wch: Math.min(Math.max(h.length, ...exportRows.map((r) => String(r[i] ?? "").length)) + 2, 50),
        }));
        worksheet["!cols"] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Delivery History");
        const date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `delivery_history_${date}.xlsx`);
    };

    const hasFilters = search.trim().length > 0 || statusFilter !== "All" || channelFilter !== "ALL" || periodFilter !== "ALL";
    const clearFilters = () => {
        setSearch("");
        setStatusFilter("All");
        setChannelFilter("ALL");
        setCurrentPage(1);
    };

    const handleRefresh = () => {
        setReloadKey((prev) => prev + 1);
    };

    const showFooter = !loading && !error && rows.length > 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Delivery history"
                crumbs={[{ label: "Dispatch dashboard", href: "/dispatch/dashboard" }, { label: "Delivery history" }]}
                meta={<span>📋 Multi-channel report delivery audit trail</span>}
                actions={
                    <>
                        <Button variant="ghost" icon={RefreshCw} onClick={handleRefresh}>
                            Refresh
                        </Button>
                        <Button icon={FileSpreadsheet} onClick={handleExportAuditLog}>
                            Export to Excel
                        </Button>
                    </>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {!loading &&
                    (error
                        ? "Delivery records failed to load"
                        : `Delivery records loaded. Showing ${rows.length} of ${totalElements} records${
                              totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ""
                          }.`)}
            </p>

            {/* KPI row */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile
                    label="Delivered"
                    value={deliveredCount}
                    icon={CheckCircle2}
                    tone="success"
                    note="Successfully dispatched"
                    loading={!overviewLoaded}
                />
                <KpiTile
                    label="Partial delivery"
                    value={partialCount}
                    icon={Clock}
                    tone="warning"
                    note="Multi-channel partial"
                    loading={!overviewLoaded}
                />
                <KpiTile
                    label="Failed"
                    value={failedCount}
                    icon={XCircle}
                    tone="danger"
                    note="Require retry action"
                    loading={!overviewLoaded}
                />
            </div>

            {/* Records table */}
            <SectionCard title="Delivery records" count={totalElements} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-edge bg-surface-muted p-3 sm:p-4">
                    <SelectField
                        label="Filter by status"
                        hideLabel
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as StatusTab);
                            setCurrentPage(1);
                        }}
                        className="w-full sm:w-44"
                    >
                        {STATUS_TABS.map((tab) => {
                            const count = tabCounts[tab.value];
                            return (
                                <option key={tab.value} value={tab.value}>
                                    {tab.label} ({count})
                                </option>
                            );
                        })}
                    </SelectField>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-fg-muted">Period</span>
                        <SegmentedControl<PeriodTab>
                            ariaLabel="Period"
                            size="sm"
                            value={periodFilter}
                            onChange={(val) => {
                                setPeriodFilter(val);
                                setCurrentPage(1);
                            }}
                            options={PERIOD_OPTIONS}
                        />
                    </div>

                    <SelectField
                        label="Filter by channel"
                        hideLabel
                        value={channelFilter}
                        onChange={(e) => {
                            setChannelFilter(e.target.value as ChannelFilter);
                            setCurrentPage(1);
                        }}
                        className="w-full sm:w-44"
                    >
                        {CHANNEL_FILTER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </SelectField>

                    <InputField
                        label="Search delivery records"
                        hideLabel
                        type="search"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Search by report ID, patient, doctor..."
                        autoComplete="off"
                        className="min-w-[200px] flex-1 sm:ml-auto sm:max-w-xs"
                    />

                    {hasFilters && (
                        <Button size="sm" variant="ghost" icon={X} onClick={clearFilters}>
                            Clear
                        </Button>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-32 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                <span className="h-5 w-20 rounded bg-skeleton" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-7 w-16 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Delivery records unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void loadTable()}>
                                Retry
                            </Button>
                        }
                    />
                ) : rows.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="No records match"
                            description="Try a different search term, period or status filter."
                            action={
                                <Button size="sm" onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Inbox}
                            title="No delivery records yet"
                            description="Dispatched reports will appear here as they are sent."
                        />
                    )
                ) : (
                    <div className="w-full">
                        <table className="w-full table-fixed text-left text-sm">
                            <caption className="sr-only">Delivery records</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-[18%] py-2 pl-4 pr-3 font-semibold">
                                        Report ID
                                    </th>
                                    <th scope="col" className="w-[20%] px-3 py-2 font-semibold">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-[20%] px-3 py-2 font-semibold">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-[17%] px-3 py-2 font-semibold">
                                        Dispatched by
                                    </th>
                                    <th scope="col" className="w-[13%] px-3 py-2 font-semibold">
                                        Methods
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
                                {rows.map((record) => {
                                    const displayId = formatDisplayId(record.reportId, "REP");
                                    const dateInfo = formatReportDate(record.updatedAt ?? record.deliveredTime ?? record.dispatchedTime);
                                    const dispatcherName = record.dispatchedBy
                                        || (record.authorizedBy ? (record.authorizedBy.startsWith("Dr.") ? record.authorizedBy : `Dr. ${record.authorizedBy}`) : "Dr. Lasith Undulanga");

                                    return (
                                        <tr key={record.reportId + (record.dispatchedTime || "")} className="transition-colors hover:bg-surface-hover">
                                            {/* Report ID + Updated Date */}
                                            <td className="py-2 pl-4 pr-3">
                                                <div className="truncate font-mono text-xs font-medium text-fg" title={displayId}>
                                                    {displayId}
                                                </div>
                                                <div className="mt-0.5 text-xs text-fg-muted cursor-help" title={dateInfo.tooltip}>
                                                    {dateInfo.display}
                                                </div>
                                            </td>

                                            {/* Patient Name + Code */}
                                            <td className="px-3 py-2">
                                                <div className="truncate font-semibold text-fg" title={record.patientName}>
                                                    {record.patientName}
                                                </div>
                                                <div className="truncate font-mono text-xs text-fg-muted" title={record.patientCode ? formatDisplayId(record.patientCode, "PAT") : undefined}>
                                                    {record.patientCode ? formatDisplayId(record.patientCode, "PAT") : "—"}
                                                </div>
                                            </td>

                                            {/* Test Group */}
                                            <td className="px-3 py-2">
                                                <div className="truncate text-fg" title={record.testName}>
                                                    {record.testName}
                                                </div>
                                            </td>

                                            {/* Dispatched by */}
                                            <td className="px-3 py-2">
                                                <div className="truncate text-xs font-medium text-fg" title={dispatcherName}>
                                                    {dispatcherName}
                                                </div>
                                            </td>

                                            {/* Delivery Methods Icons */}
                                            <td className="px-3 py-2">
                                                <ul className="flex items-center gap-1" aria-label="Delivery methods">
                                                    {record.methods.map((method) => {
                                                        const m = METHOD_META[method];
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
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-3 py-2">
                                                <StatusChip tone={toneForStatus(record.status)} dot size="sm">
                                                    {humanizeStatus(record.status)}
                                                </StatusChip>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                {record.status === "FAILED" ? (
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        icon={RefreshCw}
                                                        onClick={() => router.push("/dispatch/failed-deliveries")}
                                                        aria-label={`Retry delivery for report ${record.reportId}`}
                                                    >
                                                        Retry
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        onClick={() => router.push(`/dispatch/authorized-reports/${encodeURIComponent(record.reportId)}`)}
                                                        aria-label={`View report ${record.reportId}`}
                                                    >
                                                        View
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {showFooter && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalElements}
                        pageSize={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPage}
                        itemLabel="records"
                    />
                )}
            </SectionCard>
        </div>
    );
}
