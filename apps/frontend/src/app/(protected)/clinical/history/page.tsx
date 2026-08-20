"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, History, RefreshCw, Search, X } from "lucide-react";
import {
    HISTORY_DATE_RANGES,
    resolveFromTimestamp,
    type HistoryDateRange,
} from "@/lib/history-date-range";
import {
    getClinicalHistory,
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
import { InputField, SelectField } from "@/components/ui/Field";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

const PAGE_SIZE = 10;
const SKELETON_ROWS = 8;

const ACTION_LABELS: Record<string, string> = {
    CLINICAL_AUTHORIZED: "Authorized by pathologist",
    VERIFICATION_RETURNED_FROM_CLINICAL: "Returned to supervisor",
};

const ACTION_TONES: Record<string, ChipTone> = {
    CLINICAL_AUTHORIZED: "success",
    VERIFICATION_RETURNED_FROM_CLINICAL: "pending",
};

const DATE_RANGE_OPTIONS = HISTORY_DATE_RANGES.map((range) => ({
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

/** Full, unambiguous timestamp for the cell tooltip. */
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

    useEffect(() => {
        setPage(0);
    }, [search, statusFilter, dateRange]);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                setLoading(true);
                setError(null);

                const historyPage = await getClinicalHistory(page, PAGE_SIZE, {
                    actionType: statusFilter === "ALL" ? undefined : statusFilter,
                    search: search.trim() || undefined,
                    fromTimestamp: resolveFromTimestamp(dateRange),
                });

                setHistoryItems(historyPage.content);
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
                        <span>Pathologist authorizations and cases returned to the lab supervisor</span>
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
                    <Button icon={RefreshCw} onClick={retry} loading={loading}>
                        Refresh
                    </Button>
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

            <SectionCard title="Entries" count={!loading && !error ? totalElements.toLocaleString() : undefined} flush>
                {/* Filter toolbar */}
                <div className="flex flex-col gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <InputField
                            label="Search clinical history"
                            hideLabel
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search patient, code, result ID, test group or pathologist"
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
                        <span className="text-xs font-medium text-fg-muted">Period</span>
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
                                <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                <span className="h-4 w-36 rounded bg-skeleton" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-3 w-1/5 rounded bg-skeleton" />
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
                        {/* table-fixed budget: fixed cols sum to 640 (base) / 784 (md) / 912 (lg).
                            min-w must stay >= sum + 160 so the auto Notes column keeps a readable
                            floor; the card's overflow-x-auto scrolls below that. */}
                        <table className="w-full min-w-[960px] table-fixed text-left text-[13px] lg:min-w-[1080px]">
                            <caption className="sr-only">Clinical history entries</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-36 py-2 pl-4 pr-3 font-medium">
                                        Time
                                    </th>
                                    <th scope="col" className="w-44 px-3 py-2 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-32 px-3 py-2 font-medium">
                                        Result ID
                                    </th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-medium md:table-cell">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-48 px-3 py-2 font-medium">
                                        Action
                                    </th>
                                    <th scope="col" className="hidden w-32 px-3 py-2 font-medium lg:table-cell">
                                        Performed by
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium">
                                        Notes
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {historyItems.map((item) => {
                                    const actionType = resolveActionType(item);
                                    const timestamp = item.actionAt ?? item.updatedAt;
                                    const actionLabel =
                                        ACTION_LABELS[actionType] || item.actionSummary || "Workflow updated";

                                    return (
                                        <tr
                                            key={`${item.resultId}-${item.actionAt ?? item.updatedAt ?? actionType ?? "event"}`}
                                            className="transition-colors hover:bg-surface-hover"
                                        >
                                            {/* Time */}
                                            <td className="py-2 pl-4 pr-3 tabular-nums text-fg-secondary">
                                                {timestamp ? (
                                                    <time dateTime={timestamp} title={formatFullTimestamp(timestamp)}>
                                                        {formatAuditTime(timestamp)}
                                                    </time>
                                                ) : (
                                                    <span className="text-fg-faint">—</span>
                                                )}
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
                                            {/* Result ID */}
                                            <td className="truncate px-3 py-2 font-mono text-xs text-fg-secondary" title={item.resultId}>
                                                {item.resultId}
                                            </td>
                                            {/* Test group */}
                                            <td
                                                className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell"
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
                                                className="hidden truncate px-3 py-2 text-fg-secondary lg:table-cell"
                                                title={item.performedBy || undefined}
                                            >
                                                {item.performedBy || <span className="text-fg-faint">—</span>}
                                            </td>
                                            {/* Notes — one line only: a long note must never set the row
                                                height. Open the full text in a dialog instead. */}
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
