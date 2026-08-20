"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    ExternalLink,
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
    XCircle,
    type LucideIcon,
} from "lucide-react";
import {
    listDeliveryRecords,
    type DeliveryRecordRow,
    type ApiDeliveryMethod,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedControl, { type SegmentOption } from "@/components/ui/SegmentedControl";
import KpiTile from "@/components/ui/KpiTile";
import StatusChip, { humanizeStatus, toneForStatus } from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";

const ITEMS_PER_PAGE = 10;
const SKELETON_ROWS = 6;

type StatusTab = "All" | "DELIVERED" | "PENDING" | "FAILED";

const STATUS_TABS: { value: StatusTab; label: string }[] = [
    { value: "All", label: "All" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "PENDING", label: "Pending" },
    { value: "FAILED", label: "Failed" },
];

const METHOD_META: Record<ApiDeliveryMethod, { icon: LucideIcon; label: string }> = {
    EMAIL: { icon: Mail, label: "Email" },
    SMS: { icon: Smartphone, label: "SMS" },
    WHATSAPP: { icon: MessageCircle, label: "WhatsApp" },
    POST: { icon: Truck, label: "Post" },
    PRINT: { icon: Printer, label: "Print" },
    PORTAL: { icon: Globe, label: "Portal" },
};

const deliveryBuckets = [
    { label: "12A", start: 0, end: 4 },
    { label: "4A", start: 4, end: 8 },
    { label: "8A", start: 8, end: 12 },
    { label: "12P", start: 12, end: 16 },
    { label: "4P", start: 16, end: 20 },
    { label: "8P", start: 20, end: 24 },
];

const parseHourFromDisplayTime = (value?: string | null) => {
    if (!value) return null;
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const period = match[3].toUpperCase();
    if (period === "PM" && hour < 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    return Number.isFinite(hour) ? hour : null;
};

export default function DeliveryStatusPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusTab>("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [rows, setRows] = useState<DeliveryRecordRow[]>([]);
    const [overview, setOverview] = useState<DeliveryRecordRow[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(true);
    const [overviewLoaded, setOverviewLoaded] = useState(false);
    const [error, setError] = useState("");

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
            setRows(res.content);
            setTotalPages(Math.max(1, res.totalPages));
            setTotalElements(res.totalElements);
        } catch (e) {
            console.error(e);
            setError("Couldn't load delivery records. Check your connection and retry.");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, statusFilter, search]);

    useEffect(() => { void loadOverview(); }, [loadOverview]);
    useEffect(() => { void loadTable(); }, [loadTable]);

    const tabCounts = useMemo(() => {
        const list = overview;
        return {
            All: list.length,
            DELIVERED: list.filter((r) => r.status === "DELIVERED").length,
            PENDING: list.filter((r) => r.status === "PENDING" || r.status === "PARTIAL").length,
            FAILED: list.filter((r) => r.status === "FAILED").length,
        } as Record<StatusTab, number>;
    }, [overview]);

    const deliveredCount = tabCounts.DELIVERED;
    const pendingCount = tabCounts.PENDING;
    const failedCount = tabCounts.FAILED;
    const deliveryTrend = useMemo(() => {
        const counts = deliveryBuckets.map((bucket) => ({
            ...bucket,
            count: overview.filter((record) => {
                const hour = parseHourFromDisplayTime(record.dispatchedTime);
                return hour != null && hour >= bucket.start && hour < bucket.end;
            }).length,
        }));
        const max = Math.max(1, ...counts.map((bucket) => bucket.count));
        return counts.map((bucket) => ({
            ...bucket,
            height: `${Math.max(8, Math.round((bucket.count / max) * 100))}%`,
        }));
    }, [overview]);

    const handleExportAuditLog = () => {
        const data = rows.length ? rows : overview;
        const headers = ["Report ID", "Patient", "Test", "Methods", "Status", "Dispatched", "Delivered", "Tracking"];
        const exportRows = data.map((r) => [
            r.reportId,
            r.patientName,
            r.testName,
            r.methods.join(", "),
            r.status,
            r.dispatchedTime,
            r.deliveredTime ?? "—",
            r.trackingNumber ?? "",
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
        const colWidths = headers.map((h, i) => ({
            wch: Math.min(Math.max(h.length, ...exportRows.map((r) => String(r[i] ?? "").length)) + 2, 50),
        }));
        worksheet["!cols"] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Delivery Audit Log");
        const date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `delivery_audit_log_${date}.xlsx`);
    };

    const tabOptions: SegmentOption<StatusTab>[] = STATUS_TABS.map((tab) => ({
        value: tab.value,
        label: tab.label,
        count: tabCounts[tab.value],
    }));

    const hasFilters = statusFilter !== "All" || search.trim().length > 0;
    const clearFilters = () => {
        setSearch("");
        setStatusFilter("All");
        setCurrentPage(1);
    };

    const trendSummary = deliveryTrend.map((b) => `${b.label}: ${b.count}`).join(", ");
    const showFooter = !loading && !error && rows.length > 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Delivery status"
                crumbs={[{ label: "Dispatch", href: "/dispatch/dashboard" }, { label: "Delivery status" }]}
                meta={<span>Track and monitor report delivery across all channels.</span>}
                actions={
                    <Button icon={FileSpreadsheet} onClick={handleExportAuditLog}>
                        Export to Excel
                    </Button>
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
                <KpiTile label="Delivered" value={deliveredCount} icon={CheckCircle2} tone="success" note="Successfully sent" loading={!overviewLoaded} />
                <KpiTile label="Pending / partial" value={pendingCount} icon={Clock} tone="warning" note="Awaiting delivery" loading={!overviewLoaded} />
                <KpiTile label="Failed" value={failedCount} icon={XCircle} tone="danger" note="Require attention" loading={!overviewLoaded} />
            </div>

            {/* Delivery trend */}
            <SectionCard title="Delivery trend today" className="mb-4">
                <p className="mb-3 text-xs text-fg-muted">Grouped from real dispatch records, by time of dispatch.</p>
                <div
                    role="img"
                    aria-label={`Delivery records by time of day. ${trendSummary}`}
                    className="grid h-36 grid-cols-6 items-end gap-3 rounded-md border border-edge bg-surface-muted px-4 py-3"
                >
                    {deliveryTrend.map((bucket) => (
                        <div key={bucket.label} className="flex h-full flex-col justify-end gap-2">
                            <div className="flex flex-1 items-end justify-center">
                                <div
                                    className="w-full max-w-8 rounded-t bg-primary"
                                    style={{ height: bucket.height }}
                                    title={`${bucket.count} delivery record(s)`}
                                />
                            </div>
                            <div className="text-center text-[11px] font-medium tabular-nums text-fg-muted">{bucket.label}</div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Records table */}
            <SectionCard title="Delivery records" count={totalElements} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <SegmentedControl<StatusTab>
                        ariaLabel="Filter by delivery status"
                        value={statusFilter}
                        onChange={(next) => { setStatusFilter(next); setCurrentPage(1); }}
                        options={tabOptions}
                    />
                    <InputField
                        label="Search delivery records"
                        hideLabel
                        type="search"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        placeholder="Search report ID or patient"
                        autoComplete="off"
                        className="min-w-[200px] flex-1 sm:ml-auto sm:max-w-xs"
                    />
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
                            description="Try a different search term or status."
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
                    <div className="overflow-x-auto">
                        {/* Fixed-width columns: 864px base, +144px Tracking at lg = 1008px.
                            min-w must leave >= 160px for the auto-width Test column in each band. */}
                        <table className="w-full min-w-[900px] table-fixed text-left text-[13px] md:min-w-[1030px] lg:min-w-[1180px]">
                            <caption className="sr-only">Delivery records</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-32 py-2 pl-4 pr-3 font-medium">Report ID</th>
                                    <th scope="col" className="w-40 px-3 py-2 font-medium">Patient</th>
                                    <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Test</th>
                                    <th scope="col" className="w-36 px-3 py-2 font-medium">Methods</th>
                                    <th scope="col" className="w-28 px-3 py-2 font-medium">Status</th>
                                    <th scope="col" className="w-28 px-3 py-2 font-medium">Dispatched</th>
                                    <th scope="col" className="w-28 px-3 py-2 font-medium">Delivered</th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-medium lg:table-cell">Tracking</th>
                                    <th scope="col" className="w-24 py-2 pl-3 pr-4 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {rows.map((record) => (
                                    <tr key={record.reportId + record.dispatchedTime} className="transition-colors hover:bg-surface-hover">
                                        <td className="truncate py-2 pl-4 pr-3 font-mono text-xs font-medium text-fg" title={record.reportId}>
                                            {record.reportId}
                                        </td>
                                        <td className="truncate px-3 py-2 font-medium text-fg" title={record.patientName}>
                                            {record.patientName}
                                        </td>
                                        <td className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell" title={record.testName}>
                                            {record.testName}
                                        </td>
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
                                        <td className="px-3 py-2">
                                            <StatusChip tone={toneForStatus(record.status)} dot size="sm">
                                                {humanizeStatus(record.status)}
                                            </StatusChip>
                                        </td>
                                        <td className="truncate px-3 py-2 text-xs tabular-nums text-fg-secondary" title={record.dispatchedTime}>{record.dispatchedTime}</td>
                                        <td
                                            className={cn("truncate px-3 py-2 text-xs tabular-nums", record.deliveredTime ? "text-fg-secondary" : "text-fg-faint")}
                                            title={record.deliveredTime ?? undefined}
                                        >
                                            {record.deliveredTime ?? "—"}
                                        </td>
                                        <td className="hidden truncate px-3 py-2 text-xs lg:table-cell">
                                            {record.trackingNumber ? (
                                                record.trackingUrl ? (
                                                    <a
                                                        href={record.trackingUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex max-w-full items-center gap-1 rounded font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                    >
                                                        <span className="truncate" title={record.trackingNumber}>{record.trackingNumber}</span>
                                                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                        <span className="sr-only">(opens in a new tab)</span>
                                                    </a>
                                                ) : (
                                                    <span className="block truncate text-fg-secondary" title={record.trackingNumber}>{record.trackingNumber}</span>
                                                )
                                            ) : (
                                                <span className="text-fg-faint">—</span>
                                            )}
                                        </td>
                                        <td className="py-2 pl-3 pr-4 text-right">
                                            {record.status === "FAILED" ? (
                                                <Button
                                                    size="sm"
                                                    icon={RefreshCw}
                                                    onClick={() => router.push("/dispatch/failed-deliveries")}
                                                    aria-label={`Retry delivery for report ${record.reportId}`}
                                                >
                                                    Retry
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => router.push(`/dispatch/authorized-reports/${encodeURIComponent(record.reportId)}`)}
                                                    aria-label={`View report ${record.reportId}`}
                                                >
                                                    View
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
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
