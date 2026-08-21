"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, History, Info, RefreshCw, Search, X } from "lucide-react";
import {
    getVerificationHistory,
    VerificationHistoryItem,
} from "@/lib/api";
import { formatStatusLabel } from "@/constants/sample-lifecycle";
import { downloadCsv } from "@/lib/export-csv";
import { displayResultNo } from "@/lib/result-display";
import {
    HISTORY_DATE_RANGES,
    resolveFromTimestamp,
    type HistoryDateRange,
} from "@/lib/history-date-range";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField, SelectField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusChip, { type ChipTone } from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { formatAuditTime, startOfLocalDay } from "@/components/patient-dashboard/dashboard-data";

const PAGE_SIZE = 10;
const SKELETON_ROWS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

// The export walks the whole filtered result set in chunks rather than asking for
// it in one call: a year of history in a single request is a heavy query and a
// heavy response. EXPORT_MAX_PAGES is the safety valve for a request so wide that
// even chunked paging would hammer the server.
const EXPORT_PAGE_SIZE = 1000;
const EXPORT_MAX_PAGES = 20;

const ACTION_LABELS: Record<string, string> = {
    VERIFICATION_APPROVED: "Approved by Supervisor",
    VERIFICATION_RETURNED_TO_MLT: "Returned to MLT",
    VERIFICATION_RETURNED_FROM_CLINICAL: "Returned to Supervisor from Clinical",
};

/** Colour = meaning: approved is done, returned to MLT is a rejection, clinical return is pending work. */
const ACTION_TONES: Record<string, ChipTone> = {
    VERIFICATION_APPROVED: "success",
    VERIFICATION_RETURNED_TO_MLT: "danger",
    VERIFICATION_RETURNED_FROM_CLINICAL: "pending",
};

/** Period pills come from a shared lib in Title Case; the UI is sentence case. */
const PERIOD_OPTIONS = HISTORY_DATE_RANGES.map((range) => ({
    value: range.key,
    label: range.label.charAt(0).toUpperCase() + range.label.slice(1).toLowerCase(),
}));

/** Export banners reuse the status tokens: a truncated export is a warning, a failed one is an error. */
const EXPORT_NOTICE_STYLES: Record<"error" | "warning", string> = {
    error: "border-status-danger-edge bg-status-danger-bg text-status-danger-fg",
    warning: "border-status-pending-edge bg-status-pending-bg text-status-pending-fg",
};

const resolveActionType = (item: VerificationHistoryItem) => {
    if (item.actionType) {
        return item.actionType;
    }

    if (item.actionSummary === "Approved by Supervisor") {
        return "VERIFICATION_APPROVED";
    }

    if (item.actionSummary === "Returned to MLT") {
        return "VERIFICATION_RETURNED_TO_MLT";
    }

    if (item.actionSummary === "Returned to Supervisor from Clinical") {
        return "VERIFICATION_RETURNED_FROM_CLINICAL";
    }

    return "";
};

/** Full, unambiguous timestamp for tooltips and for the CSV export. */
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

/**
 * `formatAuditTime` falls through to a date-only string for anything older than
 * yesterday, which drops the time an approval or return actually happened — the
 * one thing this audit column exists to show. Keep the relative wording for
 * today and yesterday, and spell out the full timestamp for older entries.
 */
const formatHistoryTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return formatAuditTime(value);
    }

    const now = new Date();
    if (startOfLocalDay(parsed).getTime() >= startOfLocalDay(now).getTime() - DAY_MS) {
        return formatAuditTime(value, now);
    }

    return formatFullTimestamp(value);
};

export default function VerificationHistoryPage() {
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
    const [exportNotice, setExportNotice] = useState<{
        tone: "error" | "warning";
        message: string;
    } | null>(null);

    useEffect(() => {
        setPage(0);
        setExportNotice(null);
    }, [search, statusFilter, dateRange]);

    // The search, action and period filters are applied by the server, over the
    // whole audit trail. Loading one window of recent rows and filtering it in the
    // browser would quietly hide every older match, and this is the record staff
    // consult during an incident investigation.
    useEffect(() => {
        let cancelled = false;

        const loadHistory = async () => {
            try {
                setLoading(true);
                setError(null);

                const historyPage = await getVerificationHistory(page, PAGE_SIZE, {
                    actionType: statusFilter === "ALL" ? undefined : statusFilter,
                    search: search.trim() || undefined,
                    fromTimestamp: resolveFromTimestamp(dateRange),
                });

                if (cancelled) {
                    return;
                }

                setHistoryItems(historyPage.content ?? []);
                setTotalPages(Math.max(1, historyPage.totalPages));
                setTotalElements(historyPage.totalElements);
            } catch (loadError) {
                if (cancelled) {
                    return;
                }

                console.error("Failed to load verification history", loadError);
                setError("Couldn't load verification history. Check your connection and retry.");
                setHistoryItems([]);
                setTotalPages(1);
                setTotalElements(0);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadHistory();

        // A filter change queues a fresh request while the previous one may still be
        // in flight; without this the older response can land last and paint rows
        // that no longer match the filters shown on screen.
        return () => {
            cancelled = true;
        };
    }, [page, search, statusFilter, dateRange, reloadKey]);

    const hasActiveFilters =
        search.trim().length > 0 || statusFilter !== "ALL" || dateRange !== "ALL";

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("ALL");
        setDateRange("ALL");
    };

    const retry = () => setReloadKey((key) => key + 1);

    const openCase = (resultId?: string | null) => {
        if (resultId) {
            router.push(`/verification/review/${resultId}`);
        }
    };

    // Exports every entry matching the active filters, not just the visible page:
    // an auditor asking for a period needs the whole period, and the table only
    // ever holds PAGE_SIZE rows.
    const handleExportCsv = async () => {
        setIsExporting(true);
        setExportNotice(null);

        try {
            const exportItems: VerificationHistoryItem[] = [];
            let matchingCount = 0;
            let exportPage = 0;
            let hasMore = true;

            while (hasMore && exportPage < EXPORT_MAX_PAGES) {
                const historyPage = await getVerificationHistory(exportPage, EXPORT_PAGE_SIZE, {
                    actionType: statusFilter === "ALL" ? undefined : statusFilter,
                    search: search.trim() || undefined,
                    fromTimestamp: resolveFromTimestamp(dateRange),
                });

                exportItems.push(...(historyPage.content ?? []));
                matchingCount = historyPage.totalElements;
                exportPage += 1;
                hasMore = exportPage < historyPage.totalPages;
            }

            if (exportItems.length === 0) {
                return;
            }

            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

            downloadCsv(
                `verification-history-${timestamp}`,
                [
                    "Timestamp",
                    "Priority",
                    "Patient",
                    "Patient Code",
                    "Result ID",
                    "Test Group",
                    "Action",
                    "Performed By",
                    "Notes",
                ],
                exportItems.map((item) => {
                    const actionType = resolveActionType(item);

                    return [
                        formatFullTimestamp(item.actionAt ?? item.updatedAt),
                        item.specimenPriority ? formatStatusLabel(item.specimenPriority) : "",
                        item.patientName || "Unknown patient",
                        item.patientCode || "",
                        displayResultNo(item.resultNo, item.resultId),
                        item.testName || "Unknown Test Group",
                        item.actionSummary || ACTION_LABELS[actionType] || "Workflow Updated",
                        item.performedBy || "",
                        item.notes || "",
                    ];
                })
            );

            // A CSV that is silently short of the matching set is worse than no CSV
            // at all when it is filed as the evidence for a period.
            if (exportItems.length < matchingCount) {
                setExportNotice({
                    tone: "warning",
                    message: `Exported the ${exportItems.length.toLocaleString()} most recent of ${matchingCount.toLocaleString()} matching entries. Narrow the period or filters to export the rest.`,
                });
            }
        } catch (exportError) {
            console.error("Failed to export verification history", exportError);
            setExportNotice({
                tone: "error",
                message: "Failed to export verification history. Please try again.",
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Verification history"
                crumbs={[{ label: "Verification", href: "/verification/pending" }, { label: "Verification history" }]}
                meta={
                    <>
                        <History className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Supervisor approvals, returns to MLT and cases returned from clinical review</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {totalElements.toLocaleString()} {totalElements === 1 ? "entry" : "entries"}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <>
                        {/* Exports the whole filtered set, so it is enabled from any page of the table. */}
                        <Button
                            icon={Download}
                            loading={isExporting}
                            disabled={totalElements === 0}
                            onClick={() => void handleExportCsv()}
                            title="Exports every history entry matching the current search, action and period filters."
                        >
                            {isExporting ? "Exporting…" : "Export CSV"}
                        </Button>
                        <Button icon={RefreshCw} onClick={retry} loading={loading}>
                            Refresh
                        </Button>
                    </>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading verification history"
                    : error
                      ? "Verification history failed to load"
                      : `Verification history loaded. Showing ${historyItems.length} of ${totalElements} entries, page ${page + 1} of ${totalPages}.`}
            </p>

            {exportNotice && (
                <div
                    role="status"
                    className={`mb-4 flex items-start gap-2 rounded-md border px-4 py-2.5 text-[13px] ${EXPORT_NOTICE_STYLES[exportNotice.tone]}`}
                >
                    {exportNotice.tone === "error" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 break-words">{exportNotice.message}</span>
                    <Button
                        size="sm"
                        variant="ghost"
                        icon={X}
                        onClick={() => setExportNotice(null)}
                        aria-label="Dismiss export message"
                        className="-my-0.5 -mr-1.5 shrink-0"
                    />
                </div>
            )}

            <SectionCard title="Entries" count={!loading && !error ? totalElements.toLocaleString() : undefined} flush>
                {/* Filter toolbar */}
                <div className="flex flex-col gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <InputField
                            label="Search verification history"
                            hideLabel
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search patient, patient code, result ID, test group, performer, notes or action"
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
                            <option value="VERIFICATION_APPROVED">Approved by supervisor</option>
                            <option value="VERIFICATION_RETURNED_FROM_CLINICAL">Returned to supervisor</option>
                            <option value="VERIFICATION_RETURNED_TO_MLT">Returned to MLT</option>
                        </SelectField>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-fg-muted">Period</span>
                        <SegmentedControl<HistoryDateRange>
                            ariaLabel="Period"
                            size="sm"
                            value={dateRange}
                            onChange={setDateRange}
                            options={PERIOD_OPTIONS}
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
                                <span className="hidden h-4 w-14 shrink-0 rounded bg-skeleton md:block" />
                                <span className="h-3 w-32 rounded bg-skeleton" />
                                <span className="h-3 w-24 rounded bg-skeleton" />
                                <span className="hidden h-4 w-28 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-3 w-1/5 rounded bg-skeleton" />
                                <span className="h-7 w-24 shrink-0 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Verification history unavailable"
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
                            title="No verification history yet"
                            description="Supervisor approvals and returns will be recorded here."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px] table-fixed text-left text-[13px] md:min-w-[1060px] lg:min-w-[1200px] xl:min-w-[1400px]">
                            <caption className="sr-only">Verification history entries</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-44 py-2 pl-4 pr-3 font-medium">
                                        Result ID
                                    </th>
                                    <th scope="col" className="w-44 px-3 py-2 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-44 px-3 py-2 font-medium">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-44 px-3 py-2 font-medium">
                                        Action
                                    </th>
                                    <th scope="col" className="hidden w-24 px-3 py-2 font-medium md:table-cell">
                                        Priority
                                    </th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-medium lg:table-cell">
                                        Performed by
                                    </th>
                                    <th scope="col" className="hidden w-56 px-3 py-2 font-medium xl:table-cell">
                                        Notes
                                    </th>
                                    <th scope="col" className="w-32 py-2 pl-3 pr-4 text-right font-medium">
                                        Case
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {historyItems.map((item: VerificationHistoryItem) => {
                                    const actionType = resolveActionType(item);
                                    const timestamp = item.actionAt ?? item.updatedAt;
                                    const displayId = displayResultNo(item.resultNo, item.resultId);

                                    return (
                                        <tr
                                            key={`${item.resultId}-${item.actionAt ?? item.updatedAt ?? actionType ?? "event"}`}
                                            className="transition-colors hover:bg-surface-hover"
                                        >
                                            {/* Result ID with the action time beneath — the raw id stays on the
                                                element so a pasted UUID is still findable. */}
                                            <td className="py-2 pl-4 pr-3">
                                                <span
                                                    className="block max-w-full truncate font-mono text-xs font-medium text-fg"
                                                    title={item.resultId}
                                                >
                                                    {displayId}
                                                </span>
                                                <span className="mt-0.5 block text-xs tabular-nums text-fg-muted">
                                                    {timestamp ? (
                                                        <time dateTime={timestamp} title={formatFullTimestamp(timestamp)}>
                                                            {formatHistoryTime(timestamp)}
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
                                                    <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">
                                                        {item.patientCode}
                                                    </p>
                                                )}
                                            </td>
                                            {/* Test group */}
                                            <td className="truncate px-3 py-2 text-fg-secondary" title={item.testName || undefined}>
                                                {item.testName || "Unknown test group"}
                                            </td>
                                            {/* Action */}
                                            <td className="px-3 py-2">
                                                <StatusChip tone={ACTION_TONES[actionType] ?? "neutral"} dot>
                                                    {item.actionSummary || ACTION_LABELS[actionType] || "Workflow updated"}
                                                </StatusChip>
                                            </td>
                                            {/* Priority — sits after the action, as the audit layout specifies */}
                                            <td className="hidden px-3 py-2 md:table-cell">
                                                {item.specimenPriority ? (
                                                    <PriorityBadge priority={item.specimenPriority} />
                                                ) : (
                                                    <span className="text-fg-faint">—</span>
                                                )}
                                            </td>
                                            {/* Performed by */}
                                            <td
                                                className="hidden truncate px-3 py-2 text-fg-secondary lg:table-cell"
                                                title={item.performedBy || undefined}
                                            >
                                                {item.performedBy || <span className="text-fg-faint">—</span>}
                                            </td>
                                            {/* Notes — truncated to one line; the full text opens in a dialog. */}
                                            <td className="hidden px-3 py-2 text-fg-muted xl:table-cell">
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
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() => openCase(item.resultId)}
                                                    aria-label={`Review case ${displayId}`}
                                                >
                                                    Review case
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && !error && historyItems.length > 0 && (
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
