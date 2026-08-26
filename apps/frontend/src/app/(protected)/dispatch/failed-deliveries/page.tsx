"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
    AlertTriangle,
    CheckCircle2,
    Globe,
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
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import KpiTile from "@/components/ui/KpiTile";
import StatusChip from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";

const ITEMS_PER_PAGE = 10;
const SKELETON_ROWS = 6;

const METHOD_META: Record<ApiDeliveryMethod, { icon: LucideIcon; label: string }> = {
    EMAIL: { icon: Mail, label: "Email" },
    SMS: { icon: Smartphone, label: "SMS" },
    WHATSAPP: { icon: MessageCircle, label: "WhatsApp" },
    POST: { icon: Truck, label: "Post" },
    PRINT: { icon: Printer, label: "Print" },
    PORTAL: { icon: Globe, label: "Portal" },
};

export default function FailedDeliveriesPage() {
    const [search, setSearch] = useState("");
    const [methodFilter, setMethodFilter] = useState("All");
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

    useEffect(() => { void loadFailed(); }, [loadFailed]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return allFailed.filter((r) => {
            const matchesSearch =
                r.reportId.toLowerCase().includes(q) ||
                r.patientName.toLowerCase().includes(q) ||
                r.testName.toLowerCase().includes(q) ||
                r.failureReason.toLowerCase().includes(q);
            const matchesMethod = methodFilter === "All" || r.method === methodFilter;
            return matchesSearch && matchesMethod;
        });
    }, [allFailed, search, methodFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const totalFailed = filtered.length;
    const maxRetries = filtered.filter((r) => r.retryCount >= 5).length;
    const avgRetries = (
        filtered.reduce((sum, r) => sum + r.retryCount, 0) / Math.max(1, filtered.length)
    ).toFixed(1);
    const failureReasons = useMemo(() => {
        const counts = filtered.reduce<Record<string, number>>((acc, row) => {
            const key = row.failureReason || "Unknown reason";
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});
        const max = Math.max(1, ...Object.values(counts));

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([reason, count]) => ({
                reason,
                count,
                width: `${Math.max(8, Math.round((count / max) * 100))}%`,
            }));
    }, [filtered]);

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
            await loadFailed();
        } catch (e) {
            console.error(e);
            toast.error("Retry failed. Check console for details.");
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
            await loadFailed();
        } catch (e) {
            console.error(e);
            toast.error("One or more retries failed.");
        } finally {
            setBulkRetrying(false);
        }
    };

    const hasFilters = search.trim().length > 0 || methodFilter !== "All";
    const clearFilters = () => {
        setSearch("");
        setMethodFilter("All");
        setCurrentPage(1);
    };

    const methodBreakdown = (Object.keys(METHOD_META) as ApiDeliveryMethod[])
        .map((method) => ({ method, count: filtered.filter((r) => r.method === method).length }))
        .filter((m) => m.count > 0);

    // Skeleton the KPI tiles only on the very first load; refreshes after a retry keep the numbers visible.
    const initialLoading = loading && allFailed.length === 0;
    const showFooter = !loading && !error && filtered.length > 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Failed deliveries"
                crumbs={[{ label: "Dispatch", href: "/dispatch/dashboard" }, { label: "Failed deliveries" }]}
                meta={<span>Investigate and retry failed report deliveries.</span>}
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
                <KpiTile label="Total failed" value={totalFailed} icon={AlertTriangle} tone="danger" note="Deliveries in view" loading={initialLoading} />
                <KpiTile label="Max retries reached" value={maxRetries} icon={XCircle} tone="warning" note="5 or more attempts" loading={initialLoading} />
                <KpiTile label="Average retry count" value={avgRetries} icon={RotateCw} note="Per failed delivery" loading={initialLoading} />
            </div>

            {/* Overview panels */}
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <SectionCard title="Failure overview">
                    <p className="mb-3 text-xs text-fg-muted">Most common reasons reported by the core service.</p>
                    {loading ? (
                        <ul aria-hidden="true" className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <li key={i}>
                                    <span className="mb-1.5 block h-3 w-40 rounded bg-skeleton" />
                                    <span className="block h-2 w-full rounded-full bg-skeleton" />
                                </li>
                            ))}
                        </ul>
                    ) : failureReasons.length === 0 ? (
                        <EmptyState compact icon={CheckCircle2} title="No failures in view" description="Nothing to break down for the current filters." />
                    ) : (
                        <ul className="space-y-3">
                            {failureReasons.map((item) => (
                                <li key={item.reason}>
                                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                                        <span className="truncate font-medium text-fg-secondary" title={item.reason}>{item.reason}</span>
                                        <span className="shrink-0 tabular-nums text-fg">{item.count}</span>
                                    </div>
                                    <div
                                        role="meter"
                                        aria-label={`${item.reason}: ${item.count}`}
                                        aria-valuemin={0}
                                        aria-valuemax={totalFailed}
                                        aria-valuenow={item.count}
                                        className="h-2 overflow-hidden rounded-full bg-surface-hover"
                                    >
                                        <div className="h-full rounded-full bg-status-danger" style={{ width: item.width }} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>

                <SectionCard
                    title="Failed by method"
                    actions={
                        methodFilter !== "All" ? (
                            <Button size="sm" variant="ghost" icon={X} onClick={() => { setMethodFilter("All"); setCurrentPage(1); }}>
                                Clear filter
                            </Button>
                        ) : undefined
                    }
                >
                    {loading ? (
                        <ul aria-hidden="true" className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <li key={i} className="h-10 rounded-md bg-skeleton" />
                            ))}
                        </ul>
                    ) : methodBreakdown.length === 0 ? (
                        <EmptyState compact icon={CheckCircle2} title="No failures by method" />
                    ) : (
                        <ul className="space-y-2" aria-label="Filter by delivery method">
                            {methodBreakdown.map(({ method, count }) => {
                                const m = METHOD_META[method];
                                const Icon = m.icon;
                                const active = methodFilter === method;
                                return (
                                    <li key={method}>
                                        <button
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => { setMethodFilter(method); setCurrentPage(1); }}
                                            className={cn(
                                                "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                                                active ? "border-primary bg-primary-soft" : "border-edge hover:bg-surface-hover"
                                            )}
                                        >
                                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-muted text-fg-secondary ring-1 ring-inset ring-edge">
                                                <Icon className="h-4 w-4" aria-hidden="true" />
                                            </span>
                                            <span className="flex-1 truncate text-sm font-medium text-fg">{m.label}</span>
                                            <span className="text-sm font-semibold tabular-nums text-status-danger-fg">{count}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </SectionCard>
            </div>

            {/* Table */}
            <SectionCard
                title="Failed deliveries"
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
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search failed deliveries"
                        hideLabel
                        type="search"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        placeholder="Search report ID, patient, test or reason"
                        autoComplete="off"
                        className="min-w-[200px] flex-1 sm:max-w-sm"
                    />
                    {hasFilters && (
                        <Button variant="ghost" icon={X} onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
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
                            description="Try a different search term or delivery method."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
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
                        {/*
                          table-fixed: the auto-width "Failure reason" column gets whatever the
                          fixed columns leave behind, so min-w must clear the sum in EVERY band.
                          fixed sums — base 648 (40+128+160+128+80+112), md +160 = 808 (Test),
                          lg +144 = 952 (Failed at). Reason is free text, so it needs a >=160px
                          floor: base 960-648=312, md 970-808=162, lg 1120-952=168.
                        */}
                        <table className="w-full min-w-[960px] table-fixed text-left text-sm md:min-w-[970px] lg:min-w-[1120px]">
                            <caption className="sr-only">Failed deliveries</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-10 py-2 pl-4 pr-2">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            aria-label="Select all failed deliveries on this page"
                                            className="h-4 w-4 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                        />
                                    </th>
                                    <th scope="col" className="w-32 px-3 py-2 font-semibold">Report ID</th>
                                    <th scope="col" className="w-40 px-3 py-2 font-semibold">Patient</th>
                                    <th scope="col" className="hidden w-40 px-3 py-2 font-semibold md:table-cell">Test</th>
                                    <th scope="col" className="w-32 px-3 py-2 font-semibold">Method</th>
                                    <th scope="col" className="px-3 py-2 font-semibold">Failure reason</th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-semibold lg:table-cell">Failed at</th>
                                    <th scope="col" className="w-20 px-3 py-2 font-semibold">Retries</th>
                                    <th scope="col" className="w-28 py-2 pl-3 pr-4 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginated.map((record) => {
                                    const isSelected = selectedIds.includes(record.attemptId);
                                    const isRetried = retriedIds.includes(record.attemptId);
                                    const isRetrying = retryingIds.includes(record.attemptId);
                                    const m = METHOD_META[record.method];
                                    const MethodIcon = m?.icon;

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
                                            <td className="truncate px-3 py-2 font-mono text-xs font-medium text-fg" title={record.reportId}>
                                                {record.reportId}
                                            </td>
                                            <td className="truncate px-3 py-2 font-medium text-fg" title={record.patientName}>
                                                {record.patientName}
                                            </td>
                                            <td className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell" title={record.testName}>
                                                {record.testName}
                                            </td>
                                            <td className="px-3 py-2">
                                                {m && MethodIcon && (
                                                    <span className="inline-flex items-center gap-2 text-xs text-fg-secondary">
                                                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-muted ring-1 ring-inset ring-edge">
                                                            <MethodIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                                        </span>
                                                        {m.label}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusChip tone="danger" size="sm" dot title={record.failureReason}>
                                                    {record.failureReason}
                                                </StatusChip>
                                            </td>
                                            <td className="hidden truncate px-3 py-2 text-xs tabular-nums text-fg-secondary lg:table-cell">
                                                {record.failedDateTime}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusChip tone={record.retryCount >= 5 ? "danger" : "neutral"} size="sm" title={`${record.retryCount} retries`}>
                                                    <span className="tabular-nums">{record.retryCount}×</span>
                                                </StatusChip>
                                            </td>
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                {isRetried ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-verified-fg">
                                                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                                        Retried
                                                    </span>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        icon={RefreshCw}
                                                        loading={isRetrying}
                                                        disabled={bulkRetrying}
                                                        onClick={() => void handleRetry(record.attemptId)}
                                                        aria-label={`Retry delivery for report ${record.reportId}`}
                                                    >
                                                        Retry
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
