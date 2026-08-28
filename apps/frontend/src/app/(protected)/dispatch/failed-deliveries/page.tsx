"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    Globe,
    Inbox,
    Mail,
    MessageCircle,
    Printer,
    RefreshCw,
    RotateCw,
    SearchX,
    Smartphone,
    Truck,
    X,
    XCircle,
    type LucideIcon,
} from "lucide-react";
import {
    listFailedDeliveries,
    retryDispatchAttempt,
    type FailedDeliveryRow,
    type ApiDeliveryMethod,
} from "@/lib/api";
import { formatDisplayId } from "@/lib/format-id";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField, SelectField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import KpiTile from "@/components/ui/KpiTile";
import StatusChip from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";

const ITEMS_PER_PAGE = 10;
const SKELETON_ROWS = 6;

type ChannelFilter = "ALL" | ApiDeliveryMethod;

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

function formatFailedDate(rawDate?: string | null): { display: string; tooltip: string } {
    if (!rawDate) return { display: "—", tooltip: "" };
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) {
        return { display: `Failed ${rawDate}`, tooltip: rawDate };
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
        display: `Failed ${formatted}`,
        tooltip: fullTime,
    };
}

function humanizeReason(raw: string): string {
    if (!raw) return "Delivery failed";
    if (raw.includes("WHATSAPP_PROVIDER_NOT_CONFIGURED")) return "WhatsApp Gateway Not Configured";
    if (raw.includes("INVALID_PHONE")) return "Invalid Phone Number";
    if (raw.includes("INVALID_EMAIL")) return "Invalid Email Address";
    if (raw.includes("NO_EMAIL")) return "No Email Provided";
    if (raw.includes("NO_PHONE")) return "No Phone Provided";
    if (raw.includes("NO_POSTAL_ADDRESS")) return "No Postal Address";
    if (raw.includes("SMTP_CONNECTION_TIMEOUT")) return "Mail Server Timeout";
    if (raw.includes("SMS_GATEWAY_ERROR")) return "SMS Gateway Error";
    return raw.replace(/^[A-Z_]+:\s*/, "");
}

export default function FailedDeliveriesPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [channelFilter, setChannelFilter] = useState<ChannelFilter>("ALL");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [retriedIds, setRetriedIds] = useState<string[]>([]);
    const [retryingIds, setRetryingIds] = useState<string[]>([]);
    const [bulkRetrying, setBulkRetrying] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [allFailed, setAllFailed] = useState<FailedDeliveryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadFailed = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const rows = await listFailedDeliveries({ limit: 200 });
            setAllFailed(rows);
        } catch (e) {
            console.error(e);
            setError("Couldn't load failed deliveries. Check your connection and retry.");
            setAllFailed([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadFailed();
    }, [loadFailed]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return allFailed.filter((r) => {
            const matchesSearch =
                !q ||
                r.reportId.toLowerCase().includes(q) ||
                r.patientName.toLowerCase().includes(q) ||
                (r.patientCode && r.patientCode.toLowerCase().includes(q)) ||
                r.testName.toLowerCase().includes(q) ||
                r.failureReason.toLowerCase().includes(q) ||
                (r.dispatchedBy && r.dispatchedBy.toLowerCase().includes(q));
            const matchesMethod = channelFilter === "ALL" || r.method === channelFilter;
            return matchesSearch && matchesMethod;
        });
    }, [allFailed, search, channelFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const totalFailed = allFailed.length;
    const maxRetries = allFailed.filter((r) => r.retryCount >= 5).length;
    const avgRetries = (
        allFailed.reduce((sum, r) => sum + r.retryCount, 0) / Math.max(1, allFailed.length)
    ).toFixed(1);

    const allSelected =
        paginated.length > 0 &&
        paginated.every((r) => selectedIds.includes(r.attemptId));

    const toggleAll = () => {
        if (allSelected) {
            setSelectedIds((prev) => prev.filter((id) => !paginated.some((r) => r.attemptId === id)));
        } else {
            setSelectedIds((prev) => [...new Set([...prev, ...paginated.map((r) => r.attemptId)])]);
        }
    };

    const toggleOne = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleRetry = async (attemptId: string) => {
        setRetryingIds((prev) => [...prev, attemptId]);
        try {
            await retryDispatchAttempt(attemptId);
            setRetriedIds((prev) => [...prev, attemptId]);
            setSelectedIds((prev) => prev.filter((id) => id !== attemptId));
            toast.success("Delivery attempt retried successfully");
            await loadFailed();
        } catch (e) {
            console.error(e);
            toast.error("Retry failed. Check connection and retry.");
        } finally {
            setRetryingIds((prev) => prev.filter((id) => id !== attemptId));
        }
    };

    const handleBulkRetry = async () => {
        setBulkRetrying(true);
        try {
            for (const id of selectedIds) {
                await retryDispatchAttempt(id);
                setRetriedIds((prev) => [...prev, id]);
            }
            setSelectedIds([]);
            toast.success(`Successfully retried ${selectedIds.length} deliveries`);
            await loadFailed();
        } catch (e) {
            console.error(e);
            toast.error("One or more retries failed.");
        } finally {
            setBulkRetrying(false);
        }
    };

    const hasFilters = search.trim().length > 0 || channelFilter !== "ALL";
    const clearFilters = () => {
        setSearch("");
        setChannelFilter("ALL");
        setCurrentPage(1);
    };

    const initialLoading = loading && allFailed.length === 0;
    const showFooter = !loading && !error && filtered.length > 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Failed deliveries"
                crumbs={[{ label: "Dispatch dashboard", href: "/dispatch/dashboard" }, { label: "Failed deliveries" }]}
                meta={<span>⚠️ Investigate and retry failed report deliveries</span>}
                actions={
                    <Button icon={RefreshCw} onClick={() => void loadFailed()} loading={loading && allFailed.length > 0}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading failed deliveries"
                    : error
                      ? "Failed deliveries could not be loaded"
                      : bulkRetrying
                        ? `Retrying ${selectedIds.length} deliveries`
                        : `${filtered.length} failed ${filtered.length === 1 ? "delivery" : "deliveries"} in view${
                              totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ""
                          }.`}
            </p>

            {/* KPI row */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile
                    label="Total failed"
                    value={totalFailed}
                    icon={AlertTriangle}
                    tone="danger"
                    note="Deliveries requiring retry"
                    loading={initialLoading}
                />
                <KpiTile
                    label="Max retries reached"
                    value={maxRetries}
                    icon={XCircle}
                    tone="warning"
                    note="5 or more attempts"
                    loading={initialLoading}
                />
                <KpiTile
                    label="Average retry count"
                    value={avgRetries}
                    icon={RotateCw}
                    note="Per failed delivery"
                    loading={initialLoading}
                />
            </div>

            {/* Table */}
            <SectionCard
                title="Failed delivery queue"
                count={filtered.length}
                flush
                actions={
                    selectedIds.length > 0 ? (
                        <Button
                            variant="primary"
                            size="sm"
                            icon={RefreshCw}
                            loading={bulkRetrying}
                            onClick={() => void handleBulkRetry()}
                        >
                            Retry selected ({selectedIds.length})
                        </Button>
                    ) : undefined
                }
            >
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-edge bg-surface-muted p-3 sm:p-4">
                    <SelectField
                        label="Filter by channel"
                        hideLabel
                        value={channelFilter}
                        onChange={(e) => {
                            setChannelFilter(e.target.value as ChannelFilter);
                            setCurrentPage(1);
                        }}
                        className="w-full sm:w-48"
                    >
                        {CHANNEL_FILTER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </SelectField>

                    <InputField
                        label="Search failed deliveries"
                        hideLabel
                        type="search"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Search report ID, patient, doctor, reason..."
                        autoComplete="off"
                        className="min-w-[220px] flex-1 sm:ml-auto sm:max-w-xs"
                    />

                    {hasFilters && (
                        <Button size="sm" variant="ghost" icon={X} onClick={clearFilters}>
                            Clear
                        </Button>
                    )}
                </div>

                {/* States */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-4 w-4 shrink-0 rounded bg-skeleton" />
                                <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-32 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                <span className="h-5 w-40 rounded bg-skeleton" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-7 w-16 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Failed deliveries unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void loadFailed()}>
                                Retry
                            </Button>
                        }
                    />
                ) : paginated.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="No failed deliveries match"
                            description="Try a different search term or channel filter."
                            action={
                                <Button size="sm" onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={CheckCircle2}
                            title="No failed deliveries"
                            description="Every dispatched report has been delivered or is still in progress."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1060px] table-fixed text-left text-sm">
                            <caption className="sr-only">Failed deliveries</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-[3%] py-2 pl-4 pr-2">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            aria-label="Select all failed deliveries on this page"
                                            className="h-4 w-4 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                        />
                                    </th>
                                    <th scope="col" className="w-[14%] py-2 pl-2 pr-3 font-semibold">
                                        Report ID
                                    </th>
                                    <th scope="col" className="w-[16%] px-3 py-2 font-semibold">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-[15%] px-3 py-2 font-semibold">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-[14%] px-3 py-2 font-semibold">
                                        Dispatched by
                                    </th>
                                    <th scope="col" className="w-[12%] px-3 py-2 font-semibold">
                                        Method
                                    </th>
                                    <th scope="col" className="w-[20%] px-3 py-2 font-semibold">
                                        Failure reason
                                    </th>
                                    <th scope="col" className="w-[14%] py-2 pl-3 pr-4 text-right font-semibold">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginated.map((record) => {
                                    const isSelected = selectedIds.includes(record.attemptId);
                                    const isRetried = retriedIds.includes(record.attemptId);
                                    const isRetrying = retryingIds.includes(record.attemptId);
                                    const m = METHOD_META[record.method];
                                    const MethodIcon = m?.icon;
                                    const displayId = formatDisplayId(record.reportId, "REP");
                                    const dateInfo = formatFailedDate(record.failedDateTime);
                                    const readableReason = humanizeReason(record.failureReason);
                                    const dispatcherName = record.dispatchedBy || "Dr. Lasith Undulanga";

                                    return (
                                        <tr
                                            key={record.attemptId}
                                            className={cn(
                                                "transition-colors",
                                                isRetried ? "bg-status-verified-bg" : isSelected ? "bg-primary-soft" : "hover:bg-surface-hover"
                                            )}
                                        >
                                            <td className="py-2 pl-4 pr-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleOne(record.attemptId)}
                                                    disabled={isRetried}
                                                    aria-label={`Select report ${record.reportId}`}
                                                    className="h-4 w-4 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
                                                />
                                            </td>

                                            {/* Report ID + Failed Date */}
                                            <td className="py-2 pl-2 pr-3">
                                                <div className="truncate font-mono text-xs font-medium text-fg" title={displayId}>
                                                    {displayId}
                                                </div>
                                                <div className="mt-0.5 text-xs text-fg-muted cursor-help" title={dateInfo.tooltip}>
                                                    {dateInfo.display}
                                                </div>
                                            </td>

                                            {/* Patient */}
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

                                            {/* Delivery Method & Contact */}
                                            <td className="px-3 py-2">
                                                {m && MethodIcon && (
                                                    <div>
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-fg">
                                                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-muted ring-1 ring-inset ring-edge">
                                                                <MethodIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                                            </span>
                                                            <span className="font-medium">{m.label}</span>
                                                        </span>
                                                        {record.recipientContact && (
                                                            <div className="truncate font-mono text-[11px] text-fg-muted" title={record.recipientContact}>
                                                                {record.recipientContact}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Failure Reason */}
                                            <td className="px-3 py-2">
                                                <StatusChip tone="danger" size="sm" dot title={record.failureReason}>
                                                    <span className="truncate max-w-[280px] inline-block align-bottom">{readableReason}</span>
                                                </StatusChip>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        icon={Eye}
                                                        onClick={() => router.push(`/dispatch/authorized-reports/${encodeURIComponent(record.reportId)}`)}
                                                        title="View & Edit Contact/Override"
                                                    >
                                                        Edit
                                                    </Button>

                                                    {isRetried ? (
                                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-status-verified-fg">
                                                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                                            Retried
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="primary"
                                                            icon={RefreshCw}
                                                            loading={isRetrying}
                                                            disabled={bulkRetrying}
                                                            onClick={() => void handleRetry(record.attemptId)}
                                                            aria-label={`Retry delivery for report ${record.reportId}`}
                                                        >
                                                            Retry
                                                        </Button>
                                                    )}
                                                </div>
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
                        totalItems={filtered.length}
                        pageSize={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPage}
                        itemLabel="records"
                    />
                )}
            </SectionCard>
        </div>
    );
}
