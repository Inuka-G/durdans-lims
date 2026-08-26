"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    ClipboardCheck,
    Flag,
    Inbox,
    RefreshCw,
    Search,
    Stethoscope,
    X,
} from "lucide-react";
import { getPendingClinicalResults, TestResultSummary } from "@/lib/api";
import { displayResultNo } from "@/lib/result-display";
import {
    FLAG_FILTER_OPTIONS,
    PRIORITY_FILTER_OPTIONS,
    countFilterOptions,
    isCritical,
    isFlagged,
    matchesFlagFilter,
    matchesPriorityFilter,
    matchesSearchQuery,
    pageCount,
    type FlagFilter,
    type PriorityFilter,
} from "@/lib/review-worklist";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import KpiTile from "@/components/ui/KpiTile";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import StatusChip, { humanizeStatus } from "@/components/ui/StatusChip";
import { InputField, SelectField } from "@/components/ui/Field";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

const PAGE_SIZE = 10;
/** Server page size used to load the whole worklist; search and counts cover every page. */
const FETCH_PAGE_SIZE = 100;
const SKELETON_ROWS = 6;

/** Full, unambiguous timestamp for tooltips. */
const formatTimestamp = (value?: string | null) => {
    if (!value) {
        return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString("en-GB", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
};

const getClinicalStatusBadge = (status?: string | null) => {
    if (status === "TECHNICALLY_VERIFIED") {
        return (
            <StatusChip tone="info" dot>
                Pending review
            </StatusChip>
        );
    }

    return <StatusChip tone="neutral">{status ? humanizeStatus(status) : "Unknown"}</StatusChip>;
};

type StatusFilter = "ALL" | "PENDING";

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
    { value: "ALL", label: "All statuses" },
    { value: "PENDING", label: "Pending review" },
];

const matchesStatus = (result: TestResultSummary, filter: StatusFilter) =>
    filter === "ALL" || result.status === "TECHNICALLY_VERIFIED";

interface FilterCriteria {
    search: string;
    status: StatusFilter;
    priority: PriorityFilter;
    flag: FlagFilter;
}

const filterResults = (results: TestResultSummary[], criteria: FilterCriteria) =>
    results.filter(
        (result) =>
            matchesSearchQuery(result, criteria.search) &&
            matchesStatus(result, criteria.status) &&
            matchesPriorityFilter(result, criteria.priority) &&
            matchesFlagFilter(result, criteria.flag)
    );

export default function ClinicalWorklistPage() {
    const router = useRouter();
    const [results, setResults] = useState<TestResultSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [flagFilter, setFlagFilter] = useState<FlagFilter>("ALL");
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let active = true;

        // The worklist is loaded whole (every server page) so the search, the
        // filter counts and the KPI cards cover every waiting case, not one page.
        const loadPendingClinicalResults = async () => {
            try {
                setLoading(true);
                setError(null);

                const firstPage = await getPendingClinicalResults(0, FETCH_PAGE_SIZE);

                if (firstPage.totalPages <= 1) {
                    if (active) {
                        setResults(firstPage.content ?? []);
                    }
                    return;
                }

                const remainingPages = await Promise.all(
                    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
                        getPendingClinicalResults(index + 1, FETCH_PAGE_SIZE)
                    )
                );

                if (active) {
                    setResults([
                        ...(firstPage.content ?? []),
                        ...remainingPages.flatMap((resultPage) => resultPage.content ?? []),
                    ]);
                }
            } catch (loadError) {
                console.error("Failed to load pending clinical results", loadError);
                if (active) {
                    setError("Couldn't load pending clinical results. Check your connection and retry.");
                    setResults([]);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void loadPendingClinicalResults();

        return () => {
            active = false;
        };
    }, [reloadKey]);

    const retry = useCallback(() => setReloadKey((key) => key + 1), []);

    const pendingCount = results.filter((result) => result.status === "TECHNICALLY_VERIFIED").length;
    const flaggedCount = results.filter((result) => isFlagged(result)).length;
    const criticalCount = results.filter((result) => isCritical(result)).length;

    const criteria = useMemo<FilterCriteria>(
        () => ({
            search: search.trim().toLowerCase(),
            status: statusFilter,
            priority: priorityFilter,
            flag: flagFilter,
        }),
        [search, statusFilter, priorityFilter, flagFilter]
    );

    const filteredResults = useMemo(() => filterResults(results, criteria), [results, criteria]);

    // Each dropdown counts the rows left by the search and the other two dropdowns,
    // so a number always previews how many rows picking that option would show.
    const statusOptions = useMemo(
        () => countFilterOptions(filterResults(results, { ...criteria, status: "ALL" }), STATUS_OPTIONS, matchesStatus),
        [results, criteria]
    );

    const priorityOptions = useMemo(
        () =>
            countFilterOptions(
                filterResults(results, { ...criteria, priority: "ALL" }),
                PRIORITY_FILTER_OPTIONS,
                matchesPriorityFilter
            ),
        [results, criteria]
    );

    const flagOptions = useMemo(
        () =>
            countFilterOptions(
                filterResults(results, { ...criteria, flag: "ALL" }),
                FLAG_FILTER_OPTIONS,
                matchesFlagFilter
            ),
        [results, criteria]
    );

    const totalPages = pageCount(filteredResults.length, PAGE_SIZE);
    const paginatedResults = useMemo(() => {
        const startIndex = page * PAGE_SIZE;
        return filteredResults.slice(startIndex, startIndex + PAGE_SIZE);
    }, [filteredResults, page]);

    useEffect(() => {
        setPage(0);
    }, [flagFilter, priorityFilter, search, statusFilter]);

    useEffect(() => {
        if (page > totalPages - 1) {
            setPage(Math.max(0, totalPages - 1));
        }
    }, [page, totalPages]);

    const handleReview = (result: TestResultSummary) => {
        router.push(`/clinical/review/${result.resultId}`);
    };

    const hasFilters =
        statusFilter !== "ALL" ||
        priorityFilter !== "ALL" ||
        flagFilter !== "ALL" ||
        search.trim().length > 0;

    const clearFilters = () => {
        setStatusFilter("ALL");
        setPriorityFilter("ALL");
        setFlagFilter("ALL");
        setSearch("");
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Clinical worklist"
                crumbs={[{ label: "Clinical approval" }, { label: "Worklist" }]}
                meta={
                    <>
                        <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Clinical authorization</span>
                    </>
                }
                actions={
                    <Button icon={RefreshCw} onClick={retry} loading={loading}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for load/error transitions only — match counts and
                paging are already conveyed by the visible SectionCard count and Pagination */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading clinical worklist"
                    : error
                      ? "Clinical worklist failed to load"
                      : "Clinical worklist loaded"}
            </p>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile
                    label="Pending review"
                    value={pendingCount}
                    icon={ClipboardCheck}
                    note="Awaiting pathologist authorization"
                    loading={loading}
                />
                <KpiTile
                    label="Flagged results"
                    value={flaggedCount}
                    icon={Flag}
                    tone="warning"
                    note="Outside reference range"
                    loading={loading}
                />
                <KpiTile
                    label="Critical cases"
                    value={criticalCount}
                    icon={AlertTriangle}
                    tone="danger"
                    note="Panic findings needing immediate attention"
                    loading={loading}
                />
            </div>

            <SectionCard title="Results" count={loading ? undefined : filteredResults.length} flush>
                {/* Filter toolbar — status, priority and flag dropdowns preview their counts */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <SelectField
                        label="Filter by status"
                        hideLabel
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                        className="w-full sm:w-48"
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label} ({option.count})
                            </option>
                        ))}
                    </SelectField>
                    <SelectField
                        label="Filter by priority"
                        hideLabel
                        value={priorityFilter}
                        onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                        className="w-full sm:w-44"
                    >
                        {priorityOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label} ({option.count})
                            </option>
                        ))}
                    </SelectField>
                    <SelectField
                        label="Filter by flag state"
                        hideLabel
                        value={flagFilter}
                        onChange={(event) => setFlagFilter(event.target.value as FlagFilter)}
                        className="w-full sm:w-44"
                    >
                        {flagOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label} ({option.count})
                            </option>
                        ))}
                    </SelectField>
                    <InputField
                        label="Search worklist"
                        hideLabel
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search result ID, patient, patient code, test group or verifier"
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
                        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                            <li key={index} className="flex items-center gap-3 px-4 py-3">
                                <span className="h-4 w-28 shrink-0 rounded bg-skeleton" />
                                <span className="h-3 w-32 rounded bg-skeleton" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                <span className="h-4 w-14 rounded-full bg-skeleton" />
                                <span className="hidden h-4 w-20 rounded bg-skeleton sm:block" />
                                <span className="ml-auto h-7 w-16 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Worklist unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={retry}>
                                Retry
                            </Button>
                        }
                    />
                ) : filteredResults.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No results match"
                            description="Try a different status, priority, flag or search term."
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
                            description="Results technically verified by the lab will appear here for review."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[940px] table-fixed text-left text-sm">
                            <caption className="sr-only">Results awaiting clinical review</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-[16%] py-2 pl-4 pr-3 font-semibold">
                                        Result ID
                                    </th>
                                    <th scope="col" className="w-[19%] px-3 py-2 font-semibold">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-[18%] px-3 py-2 font-semibold">
                                        Test group
                                    </th>
                                    <th scope="col" className="w-[15%] px-3 py-2 font-semibold">
                                        Verified by
                                    </th>
                                    <th scope="col" className="w-[9%] px-3 py-2 font-semibold">
                                        Priority
                                    </th>
                                    <th scope="col" className="w-[13%] px-3 py-2 font-semibold">
                                        Status
                                    </th>
                                    <th scope="col" className="w-[10%] py-2 pl-3 pr-4 text-right font-semibold">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginatedResults.map((result) => {
                                    const displayId = displayResultNo(result.resultNo, result.resultId);
                                    const updatedAt = result.updatedAt ?? result.createdAt;
                                    // Critical results stay tinted so the row still reads as
                                    // urgent without a flag column.
                                    const critical = isCritical(result);
                                    const verifiedBy = result.technicianName || result.mltName;
                                    return (
                                        <tr
                                            key={result.resultId}
                                            className={cn(
                                                "transition-colors",
                                                critical
                                                    ? "bg-status-danger-bg hover:bg-status-danger-edge/60"
                                                    : "hover:bg-surface-hover"
                                            )}
                                        >
                                            <td className="py-2 pl-4 pr-3">
                                                <div
                                                    className="flex items-center gap-1.5 truncate font-mono text-xs font-medium text-fg"
                                                    title={result.resultId}
                                                >
                                                    {critical && (
                                                        <>
                                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-danger-fg" aria-hidden="true" />
                                                            <span className="sr-only">Critical: </span>
                                                        </>
                                                    )}
                                                    <span className="truncate">{displayId}</span>
                                                </div>
                                                <div className="mt-0.5 text-xs text-fg-muted">
                                                    {updatedAt ? (
                                                        <>
                                                            Updated{" "}
                                                            <time dateTime={updatedAt} title={formatTimestamp(updatedAt)}>
                                                                {formatAuditTime(updatedAt)}
                                                            </time>
                                                        </>
                                                    ) : (
                                                        <span className="text-fg-faint">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Name over patient code — the code is searchable, so it
                                                stays visible for the operator to match against. */}
                                            <td className="px-3 py-2">
                                                <p className="truncate font-semibold text-fg" title={result.patientName || undefined}>
                                                    {result.patientName || "Unknown patient"}
                                                </p>
                                                {result.patientCode && (
                                                    <p className="truncate font-mono text-xs text-fg-muted" title={result.patientCode}>
                                                        {result.patientCode}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg-secondary" title={result.testType || undefined}>
                                                {result.testType || "Unknown test group"}
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg-secondary" title={verifiedBy || undefined}>
                                                {verifiedBy || <span className="text-fg-faint">—</span>}
                                            </td>
                                            <td className="px-3 py-2">
                                                <PriorityBadge priority={result.priorityLevel ?? ""} />
                                            </td>
                                            <td className="px-3 py-2">{getClinicalStatusBadge(result.status)}</td>
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() => handleReview(result)}
                                                    aria-label={`Review result ${displayId}`}
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

                {!loading && !error && filteredResults.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 pt-2 text-xs text-fg-muted">
                        <p className="tabular-nums">
                            Page {page + 1} of {totalPages}
                            <span aria-hidden="true"> · </span>
                            {filteredResults.length.toLocaleString()} matching
                            {hasFilters && ` of ${results.length.toLocaleString()}`}
                        </p>
                        <Pagination
                            currentPage={page + 1}
                            totalPages={totalPages}
                            totalItems={filteredResults.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={(nextPage) => setPage(nextPage - 1)}
                            itemLabel="results"
                            className="w-full border-t-0 px-0 pt-0 sm:w-auto"
                        />
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
