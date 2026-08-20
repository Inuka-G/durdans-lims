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
import {
    getPendingClinicalResults,
    TestResultSummary,
} from "@/lib/api";
import { formatDisplayId } from "@/lib/format-id";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import KpiTile from "@/components/ui/KpiTile";
import SectionCard from "@/components/ui/SectionCard";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import StatusChip, { humanizeStatus } from "@/components/ui/StatusChip";
import { InputField } from "@/components/ui/Field";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

const PAGE_SIZE = 10;
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

const isFlaggedResult = (flag?: string | null): flag is string =>
    Boolean(flag) && flag !== "NORMAL";

const isCriticalFlag = (flag?: string | null) =>
    flag === "CRITICAL_HIGH" || flag === "CRITICAL_LOW";

const getFlagBadge = (flag?: string | null) => {
    if (!isFlaggedResult(flag)) {
        return (
            <StatusChip tone="success" dot>
                Normal
            </StatusChip>
        );
    }

    if (isCriticalFlag(flag)) {
        return (
            <StatusChip tone="danger" dot>
                {flag === "CRITICAL_HIGH" ? "Critical high" : "Critical low"}
            </StatusChip>
        );
    }

    return (
        <StatusChip tone="pending" dot>
            {humanizeStatus(flag)}
        </StatusChip>
    );
};

/* ------------------------------------------------------------------ */
/*  Filtering — three independent dimensions plus free-text search      */
/* ------------------------------------------------------------------ */

type FlagFilter = "ALL" | "FLAGGED" | "CRITICAL" | "HIGH" | "LOW" | "NORMAL";
type PriorityFilter = "ALL" | "STAT" | "URGENT" | "NORMAL";
type StatusFilter = "ALL" | "PENDING";

type FilterOption<TValue extends string> = {
    value: TValue;
    label: string;
};

const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: "ALL", label: "All statuses" },
    { value: "PENDING", label: "Pending review" },
];

const PRIORITY_OPTIONS: readonly FilterOption<PriorityFilter>[] = [
    { value: "ALL", label: "All priorities" },
    { value: "STAT", label: "STAT" },
    { value: "URGENT", label: "Urgent" },
    { value: "NORMAL", label: "Normal" },
];

const FLAG_OPTIONS: readonly FilterOption<FlagFilter>[] = [
    { value: "ALL", label: "All flags" },
    { value: "FLAGGED", label: "Flagged" },
    { value: "CRITICAL", label: "Critical" },
    { value: "HIGH", label: "High" },
    { value: "LOW", label: "Low" },
    { value: "NORMAL", label: "Normal" },
];

const matchesStatus = (result: TestResultSummary, filter: StatusFilter) =>
    filter === "ALL" || result.status === "TECHNICALLY_VERIFIED";

const matchesPriority = (result: TestResultSummary, filter: PriorityFilter) =>
    filter === "ALL" || result.priorityLevel === filter;

const matchesFlag = (result: TestResultSummary, filter: FlagFilter) => {
    const resultFlag = result.flag ?? "NORMAL";

    return (
        filter === "ALL" ||
        (filter === "NORMAL" && resultFlag === "NORMAL") ||
        (filter === "FLAGGED" && isFlaggedResult(resultFlag)) ||
        (filter === "CRITICAL" && isCriticalFlag(resultFlag)) ||
        (filter === "HIGH" && (resultFlag === "HIGH" || resultFlag === "CRITICAL_HIGH")) ||
        (filter === "LOW" && (resultFlag === "LOW" || resultFlag === "CRITICAL_LOW"))
    );
};

const matchesSearch = (result: TestResultSummary, query: string) => {
    if (query.length === 0) {
        return true;
    }

    const displayResultId = formatDisplayId(result.resultId, "RES").toLowerCase();

    return (
        result.resultId.toLowerCase().includes(query) ||
        displayResultId.includes(query) ||
        (result.patientName ?? "").toLowerCase().includes(query) ||
        (result.patientCode ?? "").toLowerCase().includes(query) ||
        (result.testType ?? "").toLowerCase().includes(query) ||
        (result.technicianName ?? "").toLowerCase().includes(query) ||
        (result.priorityLevel ?? "").toLowerCase().includes(query)
    );
};

const buildFilterOptions = <TValue extends string>(
    rows: TestResultSummary[],
    options: readonly FilterOption<TValue>[],
    matches: (result: TestResultSummary, value: TValue) => boolean
) =>
    options.map((option) => ({
        ...option,
        count: rows.filter((row) => matches(row, option.value)).length,
    }));

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

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
    const flaggedCount = results.filter((result) => isFlaggedResult(result.flag)).length;
    const criticalCount = results.filter((result) => isCriticalFlag(result.flag)).length;

    const searchedResults = useMemo(() => {
        const query = search.trim().toLowerCase();

        return results.filter((result) => matchesSearch(result, query));
    }, [results, search]);

    // Each control counts the rows left by the other two controls, so a number
    // always previews how many rows picking that option would actually show.
    const statusOptions = useMemo(
        () =>
            buildFilterOptions(
                searchedResults.filter(
                    (result) =>
                        matchesPriority(result, priorityFilter) && matchesFlag(result, flagFilter)
                ),
                STATUS_OPTIONS,
                matchesStatus
            ),
        [flagFilter, priorityFilter, searchedResults]
    );

    const priorityOptions = useMemo(
        () =>
            buildFilterOptions(
                searchedResults.filter(
                    (result) =>
                        matchesStatus(result, statusFilter) && matchesFlag(result, flagFilter)
                ),
                PRIORITY_OPTIONS,
                matchesPriority
            ),
        [flagFilter, searchedResults, statusFilter]
    );

    const flagOptions = useMemo(
        () =>
            buildFilterOptions(
                searchedResults.filter(
                    (result) =>
                        matchesStatus(result, statusFilter) &&
                        matchesPriority(result, priorityFilter)
                ),
                FLAG_OPTIONS,
                matchesFlag
            ),
        [priorityFilter, searchedResults, statusFilter]
    );

    const filteredResults = useMemo(
        () =>
            searchedResults.filter(
                (result) =>
                    matchesStatus(result, statusFilter) &&
                    matchesPriority(result, priorityFilter) &&
                    matchesFlag(result, flagFilter)
            ),
        [flagFilter, priorityFilter, searchedResults, statusFilter]
    );

    const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
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
                        <span>Technically verified results awaiting pathologist review</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {results.length.toLocaleString()} {results.length === 1 ? "result" : "results"}
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
                    note="Technically verified"
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
                    note="Critical high or low"
                    loading={loading}
                />
            </div>

            <SectionCard title="Results" count={loading ? undefined : filteredResults.length} flush>
                {/* Filter toolbar — status, priority and flag are independent dimensions.
                    Each control's counts are computed against the other two, so a number
                    previews how many rows that option would leave. */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <SegmentedControl<StatusFilter>
                        ariaLabel="Filter by status"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={statusOptions}
                    />
                    <SegmentedControl<PriorityFilter>
                        ariaLabel="Filter by priority"
                        value={priorityFilter}
                        onChange={setPriorityFilter}
                        options={priorityOptions}
                    />
                    <SegmentedControl<FlagFilter>
                        ariaLabel="Filter by flag state"
                        value={flagFilter}
                        onChange={setFlagFilter}
                        options={flagOptions}
                    />
                    <InputField
                        label="Search worklist"
                        hideLabel
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search result ID, patient, code, test group or MLT"
                        autoComplete="off"
                        className="min-w-[200px] flex-1 xl:ml-auto xl:max-w-[360px]"
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
                            description="Results technically verified by the MLT team will appear here for review."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/* table-fixed budget: fixed cols + >=160px for each of the two auto
                            cols (Patient, Test group). base 496+320=816, md 640+320=960,
                            lg 784+320=1104 — min-w keeps them above the floor at every band. */}
                        <table className="w-full min-w-[820px] table-fixed text-left text-[13px] md:min-w-[970px] lg:min-w-[1110px]">
                            <caption className="sr-only">Results awaiting clinical review</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-44 py-2 pl-4 pr-3 font-medium">
                                        Result
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium">
                                        Test group
                                    </th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-medium lg:table-cell">
                                        Verified by
                                    </th>
                                    <th scope="col" className="w-24 px-3 py-2 font-medium">
                                        Priority
                                    </th>
                                    <th scope="col" className="w-32 px-3 py-2 font-medium">
                                        Flag
                                    </th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-medium md:table-cell">
                                        Status
                                    </th>
                                    <th scope="col" className="w-24 py-2 pl-3 pr-4 text-right font-medium">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginatedResults.map((result) => {
                                    const displayId = formatDisplayId(result.resultId, "RES");
                                    const updatedAt = result.updatedAt ?? result.createdAt;
                                    // Critical results stay tinted so the row still reads as
                                    // urgent once the eye leaves the flag column.
                                    const critical = isCriticalFlag(result.flag);
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
                                                <div className="truncate font-mono text-xs font-medium text-fg" title={displayId}>
                                                    {displayId}
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
                                                <p className="truncate font-medium text-fg" title={result.patientName || undefined}>
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
                                            <td
                                                className="hidden truncate px-3 py-2 text-fg-secondary lg:table-cell"
                                                title={result.technicianName || result.mltName || undefined}
                                            >
                                                {result.technicianName || result.mltName || <span className="text-fg-faint">—</span>}
                                            </td>
                                            <td className="px-3 py-2">
                                                <PriorityBadge priority={result.priorityLevel ?? ""} />
                                            </td>
                                            <td className="px-3 py-2">{getFlagBadge(result.flag)}</td>
                                            <td className="hidden px-3 py-2 md:table-cell">{getClinicalStatusBadge(result.status)}</td>
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                <Button
                                                    size="sm"
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
                    <Pagination
                        currentPage={page + 1}
                        totalPages={totalPages}
                        totalItems={filteredResults.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={(nextPage) => setPage(nextPage - 1)}
                        itemLabel="results"
                    />
                )}
            </SectionCard>
        </div>
    );
}
