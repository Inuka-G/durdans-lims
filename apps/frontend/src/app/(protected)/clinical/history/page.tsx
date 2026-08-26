"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, History, Info, RefreshCw, Search, X } from "lucide-react";
import {
    HISTORY_DATE_RANGES,
    resolveFromTimestamp,
    type HistoryDateRange,
} from "@/lib/history-date-range";
import { downloadCsv } from "@/lib/export-csv";
import { displayResultNo } from "@/lib/result-display";
import { formatStatusLabel } from "@/constants/sample-lifecycle";
import {
    getClinicalHistory,
    HistoryQueryParams,
    VerificationHistoryItem,
} from "@/lib/api";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusChip, { type ChipTone } from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { InputField, SelectField } from "@/components/ui/Field";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

const PAGE_SIZE = 10;
const SKELETON_ROWS = 8;

// The export walks the whole filtered result set in chunks rather than asking for it in
// one call: a year of clinical history in a single request is a heavy query and a heavy
// response. EXPORT_MAX_PAGES is the safety valve for a request so wide that even chunked
// paging would hammer the server; when it trips, the user is told the file is partial.
const EXPORT_PAGE_SIZE = 1000;
const EXPORT_MAX_PAGES = 20;

const ACTION_LABELS: Record<string, string> = {
    CLINICAL_AUTHORIZED: "Authorized by pathologist",
    VERIFICATION_RETURNED_FROM_CLINICAL: "Returned to supervisor",
};

const ACTION_TONES: Record<string, ChipTone> = {
    CLINICAL_AUTHORIZED: "success",
    VERIFICATION_RETURNED_FROM_CLINICAL: "pending",
};

/** Export banners reuse the status tokens: a truncated export is a warning, a failed one is an error. */
const EXPORT_NOTICE_STYLES: Record<"error" | "warning", string> = {
    error: "border-status-danger-edge bg-status-danger-bg text-status-danger-fg",
    warning: "border-status-pending-edge bg-status-pending-bg text-status-pending-fg",
};

// The clinical audit offers Today / 7 days / 30 days / All time; the year-long
// window belongs to the supervisor's regulatory history, not here.
const DATE_RANGE_OPTIONS = HISTORY_DATE_RANGES.filter((range) => range.key !== "LAST_365_DAYS").map((range) => ({
    value: range.key,
    // Library labels are Title Case ("Last 7 Days"); the design system is sentence case.
    label: range.label.charAt(0).toUpperCase() + range.label.slice(1).toLowerCase(),
}));

const resolveActionType = (item: VerificationHistoryItem) => {
    if (item.actionType) {
        return item.actionType;
    }

    if (item.actionSummary === "Authorized by Pathologist") {
        return "CLINICAL_AUTHORIZED";
    }

    if (item.actionSummary === "Returned to Supervisor") {
        return "VERIFICATION_RETURNED_FROM_CLINICAL";
    }

    return "";
};

/** Full, unambiguous timestamp — cell tooltip on screen, timestamp column in the export. */
const formatFullTimestamp = (value?: string | null) => {
    if (!value) {
        return "—";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
};

export default function ClinicalHistoryPage() {
    const router = useRouter();
    const [historyItems, setHistoryItems] = useState<VerificationHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [dateRange, setDateRange] = useState<HistoryDateRange>("ALL");
    const [search, setSearch] = useState("");
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);
    /* Full text of the note the user clicked, shown in a dialog. */
    const [selectedNote, setSelectedNote] = useState<VerificationHistoryItem | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    // Kept apart from `error`: that state swaps the table body for an error panel, so a
    // failed export would blank the history the user is still reading. The same state
    // carries the "export was cut short" warning, which is not an error but must not be
    // silent either — a partial audit export that looks complete is a safety problem.
    const [exportNotice, setExportNotice] = useState<{
        tone: "error" | "warning";
        message: string;
    } | null>(null);

    useEffect(() => {
        setPage(0);
        setExportNotice(null);
    }, [search, statusFilter, dateRange]);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                setLoading(true);
                setError(null);

                // Filtering stays on the server: the client only ever holds the page it is
                // showing, so the row count, the paging controls and the export all agree
                // with the full audit trail instead of a truncated first slice of it.
                const historyPage = await getClinicalHistory(page, PAGE_SIZE, {
                    actionType: statusFilter === "ALL" ? undefined : statusFilter,
                    search: search.trim() || undefined,
                    fromTimestamp: resolveFromTimestamp(dateRange),
                });

                setHistoryItems(historyPage.content ?? []);
                setTotalPages(Math.max(1, historyPage.totalPages));
                setTotalElements(historyPage.totalElements);
            } catch (loadError) {
                console.error("Failed to load clinical history", loadError);
                setError("Couldn't load clinical history. Retry or try again later.");
                setHistoryItems([]);
                setTotalPages(1);
                setTotalElements(0);
            } finally {
                setLoading(false);
            }
        };

        void loadHistory();
    }, [page, search, statusFilter, dateRange, reloadKey]);

    const hasActiveFilters =
        search.trim().length > 0 || statusFilter !== "ALL" || dateRange !== "ALL";

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("ALL");
        setDateRange("ALL");
    };

    const retry = () => setReloadKey((previous) => previous + 1);

    const showPagination = !loading && !error && historyItems.length > 0;

    // Exports every entry matching the active filters, not just the visible page: an
    // auditor asking for a period needs the whole period, and the table only ever holds
    // PAGE_SIZE rows.
    const handleExportCsv = async () => {
        setIsExporting(true);
        setExportNotice(null);

        try {
            const exportFilters: HistoryQueryParams = {
                actionType: statusFilter === "ALL" ? undefined : statusFilter,
                search: search.trim() || undefined,
                fromTimestamp: resolveFromTimestamp(dateRange),
            };

            const firstPage = await getClinicalHistory(0, EXPORT_PAGE_SIZE, exportFilters);
            const exportItems = [...(firstPage.content ?? [])];
            const matchingCount = firstPage.totalElements;

            // The export covers the whole filtered set, not the ten rows on screen, so walk
            // the remaining pages. The first response's page count bounds the loop, capped
            // by EXPORT_MAX_PAGES.
            const pagesToWalk = Math.min(firstPage.totalPages, EXPORT_MAX_PAGES);
            for (let nextPage = 1; nextPage < pagesToWalk; nextPage += 1) {
                const followingPage = await getClinicalHistory(
                    nextPage,
                    EXPORT_PAGE_SIZE,
                    exportFilters
                );
                exportItems.push(...(followingPage.content ?? []));
            }

            if (exportItems.length === 0) {
                return;
            }

            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

            downloadCsv(
                `clinical-history-${stamp}`,
                [
                    "Timestamp",
                    "Patient",
                    "Patient Code",
                    "Result ID",
                    "Test Group",
                    "Action",
                    "Priority",
                    "Performed By",
                    "Notes",
                ],
                exportItems.map((item) => {
                    const actionType = resolveActionType(item);
                    const timestamp = item.actionAt ?? item.updatedAt;

                    return [
                        timestamp ? formatFullTimestamp(timestamp) : "",
                        item.patientName || "Unknown patient",
                        item.patientCode || "",
                        displayResultNo(item.resultNo, item.resultId),
                        item.testName || "Unknown test group",
                        ACTION_LABELS[actionType] || item.actionSummary || "Workflow updated",
                        item.specimenPriority ? formatStatusLabel(item.specimenPriority) : "",
                        item.performedBy || "",
                        item.notes || "",
                    ];
                })
            );

            // A CSV that is silently short of the matching set is worse than no CSV at all
            // when it is filed as the evidence for a period.
            if (exportItems.length < matchingCount) {
                setExportNotice({
                    tone: "warning",
                    message: `Exported the ${exportItems.length.toLocaleString()} most recent of ${matchingCount.toLocaleString()} matching entries. Narrow the period or filters to export the rest.`,
                });
            }
        } catch (exportFailure) {
            console.error("Failed to export clinical history", exportFailure);
            setExportNotice({
                tone: "error",
                message:
                    "Could not export the clinical history. Check your connection, then try the export again.",
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Clinical history"
                crumbs={[
                    { label: "Clinical worklist", href: "/clinical/worklist" },
                    { label: "Clinical history" },
                ]}
                meta={
                    <>
                        <History className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Clinical authorization audit trail</span>
                    </>
                }
                actions={
                    <>
                        <Button
                            icon={Download}
                            onClick={() => void handleExportCsv()}
                            loading={isExporting}
                            disabled={totalElements === 0}
                            title="Exports every history entry matching the current search, action and period filters, not just this page. Very wide filters are capped, and the export says so when it is cut short."
                        >
                            {isExporting ? "Exporting…" : "Export CSV"}
                        </Button>
                        <Button icon={RefreshCw} onClick={retry} loading={loading}>
                            Refresh
                        </Button>
                    </>
                }
            />

            {/* Screen-reader status for async changes; silent while loading so
                un-debounced search keystrokes don't spam announcements */}
            <p role="status" aria-live="polite" className="sr-only">
                {!loading &&
                    (error
                        ? "Clinical history failed to load"
                        : `Clinical history loaded. Showing ${historyItems.length} of ${totalElements} entries${
                              totalPages > 1 ? `, page ${page + 1} of ${totalPages}` : ""
                          }.`)}
            </p>

            {/* Export failures and truncated exports keep the table on screen — this
                banner is the only signal either one happened. */}
            {exportNotice && (
                <div
                    role={exportNotice.tone === "error" ? "alert" : "status"}
                    className={`mb-4 flex items-start gap-2 rounded-md border px-4 py-2.5 text-sm ${EXPORT_NOTICE_STYLES[exportNotice.tone]}`}
                >
                    <span className="min-w-0 flex-1 break-words">{exportNotice.message}</span>
                    <button
                        type="button"
                        onClick={() => setExportNotice(null)}
                        aria-label="Dismiss message"
                        className="text-fg-muted hover:text-fg"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            )}

            <SectionCard title="History entries" count={loading ? undefined : totalElements} flush>
                {/* Filter toolbar */}
                <div className="flex flex-col gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <InputField
                            label="Search clinical history"
                            hideLabel
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search patient, patient code, result ID or test group…"
                            autoComplete="off"
                            className="min-w-[200px] flex-1"
                        />
                        <SelectField
                            label="Action"
                            hideLabel
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="w-full sm:w-56"
                        >
                            <option value="ALL">All actions</option>
                            <option value="CLINICAL_AUTHORIZED">Authorized by pathologist</option>
                            <option value="VERIFICATION_RETURNED_FROM_CLINICAL">Returned to supervisor</option>
                        </SelectField>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-fg-muted">Period</span>
                        <SegmentedControl
                            ariaLabel="Period"
                            size="sm"
                            value={dateRange}
                            onChange={setDateRange}
                            options={DATE_RANGE_OPTIONS}
                        />
                        {hasActiveFilters && (
                            <Button size="sm" variant="ghost" icon={X} onClick={clearFilters} className="ml-auto">
                                Clear filters
                            </Button>
                        )}
                    </div>
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                            <li key={index} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-20 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-32 shrink-0 rounded bg-skeleton" />
                                <span className="h-3 w-24 rounded bg-skeleton" />
                                <span className="h-4 w-36 rounded bg-skeleton" />
                                <span className="hidden h-4 w-16 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-3 w-1/5 rounded bg-skeleton" />
                                <span className="h-7 w-24 shrink-0 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Clinical history unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={retry}>
                                Retry
                            </Button>
                        }
                    />
                ) : historyItems.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No entries match"
                            description="Try a different search term, action or period."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={History}
                            title="No clinical history yet"
                            description="Pathologist authorizations and returned cases will be recorded here."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed text-left text-sm">
                            <caption className="sr-only">Clinical history entries</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-[15%] py-2 pl-4 pr-3 font-semibold">
                                        Result ID
                                    </th>
                                    <th scope="col" className="w-[18%] px-3 py-2 font-semibold">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-[15%] px-3 py-2 font-semibold">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-[16%] px-3 py-2 font-semibold">
                                        Action
                                    </th>
                                    <th scope="col" className="w-[14%] px-3 py-2 font-semibold">
                                        Performed by
                                    </th>
                                    <th scope="col" className="w-[14%] px-3 py-2 font-semibold">
                                        Notes
                                    </th>
                                    <th scope="col" className="w-[8%] py-2 pl-2 pr-4 text-right font-semibold">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {historyItems.map((item) => {
                                    const actionType = resolveActionType(item);
                                    const timestamp = item.actionAt ?? item.updatedAt;
                                    const actionLabel =
                                        ACTION_LABELS[actionType] || item.actionSummary || "Workflow updated";
                                    const displayResultId = displayResultNo(item.resultNo, item.resultId);

                                    return (
                                        <tr
                                            key={`${item.resultId}-${item.actionAt ?? item.updatedAt ?? actionType ?? "event"}`}
                                            className="transition-colors hover:bg-surface-hover"
                                        >
                                            {/* Result ID */}
                                            <td className="py-2 pl-4 pr-3">
                                                <span className="block truncate font-mono text-xs font-medium text-fg" title={item.resultId}>
                                                    {displayResultId}
                                                </span>
                                                <span className="mt-0.5 block text-xs tabular-nums text-fg-muted">
                                                    {timestamp ? (
                                                        <time dateTime={timestamp} title={formatFullTimestamp(timestamp)}>
                                                            {formatAuditTime(timestamp)}
                                                        </time>
                                                    ) : (
                                                        <span className="text-fg-faint">—</span>
                                                    )}
                                                </span>
                                            </td>
                                            {/* Patient */}
                                            <td className="px-3 py-2">
                                                <p className="truncate font-medium text-fg" title={item.patientName || undefined}>
                                                    {item.patientName || "Unknown patient"}
                                                </p>
                                                {item.patientCode && (
                                                    <p className="truncate font-mono text-xs text-fg-muted">
                                                        {item.patientCode}
                                                    </p>
                                                )}
                                            </td>
                                            {/* Test group */}
                                            <td
                                                className="truncate px-3 py-2 text-fg-secondary"
                                                title={item.testName || undefined}
                                            >
                                                {item.testName || "Unknown test group"}
                                            </td>
                                            {/* Action */}
                                            <td className="px-3 py-2">
                                                <StatusChip tone={ACTION_TONES[actionType] ?? "neutral"} dot title={actionLabel}>
                                                    {actionLabel}
                                                </StatusChip>
                                            </td>
                                            {/* Performed by */}
                                            <td
                                                className="truncate px-3 py-2 text-fg-secondary"
                                                title={item.performedBy || undefined}
                                            >
                                                {item.performedBy || <span className="text-fg-faint">—</span>}
                                            </td>
                                            {/* Notes */}
                                            <td className="px-3 py-2 text-fg-muted">
                                                {item.notes ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedNote(item)}
                                                        title={item.notes}
                                                        className="block w-full truncate rounded text-left hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                    >
                                                        {item.notes}
                                                    </button>
                                                ) : (
                                                    <span className="text-fg-faint">—</span>
                                                )}
                                            </td>
                                            {/* Case */}
                                            <td className="py-2 pl-2 pr-4 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() => {
                                                        if (!item.resultId) {
                                                             return;
                                                        }
                                                        router.push(`/clinical/review/${item.resultId}`);
                                                    }}
                                                    disabled={!item.resultId}
                                                    aria-label={`Review case ${displayResultId}`}
                                                >
                                                    Review
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {showPagination && (
                    <Pagination
                        currentPage={page + 1}
                        totalPages={totalPages}
                        totalItems={totalElements}
                        pageSize={PAGE_SIZE}
                        onPageChange={(nextPage) => setPage(nextPage - 1)}
                        itemLabel="entries"
                    />
                )}
            </SectionCard>

            <Modal
                open={selectedNote !== null}
                onClose={() => setSelectedNote(null)}
                title="Note"
                description={
                    selectedNote ? (
                        /* Ids and names are unbreakable tokens — wrap rather than widen the panel. */
                        <span className="block break-words">
                            {selectedNote.patientName || "Unknown patient"} · {selectedNote.testName || "—"}
                        </span>
                    ) : undefined
                }
                size="md"
                footer={
                    <Button variant="primary" onClick={() => setSelectedNote(null)}>
                        Close
                    </Button>
                }
            >
                {/* Free text typed by staff: keep real newlines, still wrap a long unbroken token. */}
                <p className="whitespace-pre-wrap break-words text-sm text-fg-secondary">
                    {selectedNote?.notes}
                </p>
            </Modal>

        </div>
    );
}
