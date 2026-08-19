"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    getPendingClinicalResults,
    TestResultSummary,
} from "@/lib/api";
import { PRIORITY_COLORS, formatStatusLabel } from "@/constants/sample-lifecycle";
import { formatDisplayId } from "@/lib/format-id";

const PAGE_SIZE = 10;
const FETCH_PAGE_SIZE = 100;

const formatTimestamp = (value?: string | null) => {
    if (!value) {
        return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString("en-LK", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getClinicalStatusBadge = (status?: string | null) => {
    if (status === "TECHNICALLY_VERIFIED") {
        return (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                Pending Review
            </span>
        );
    }

    return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {status ?? "Unknown"}
        </span>
    );
};

const isFlaggedResult = (flag?: string | null): flag is string =>
    Boolean(flag) && flag !== "NORMAL";

const getFlagBadge = (flag?: string | null) => {
    if (!isFlaggedResult(flag)) {
        return (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                Normal
            </span>
        );
    }

    if (flag === "CRITICAL_HIGH" || flag === "CRITICAL_LOW") {
        return (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                {flag === "CRITICAL_HIGH" ? "Critical High" : "Critical Low"}
            </span>
        );
    }

    return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            {flag.replaceAll("_", " ")}
        </span>
    );
};

const getPriorityBadge = (priority?: string | null) => {
    if (!priority) {
        return (
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                -
            </span>
        );
    }

    const key = priority.toUpperCase() as keyof typeof PRIORITY_COLORS;

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_COLORS[key] ?? "bg-slate-100 text-slate-600"}`}
        >
            {formatStatusLabel(priority)}
        </span>
    );
};

type FlagFilter = "ALL" | "FLAGGED" | "CRITICAL" | "HIGH" | "LOW" | "NORMAL";
type PriorityFilter = "ALL" | "STAT" | "URGENT" | "NORMAL";
type StatusFilter = "ALL" | "PENDING";

type FilterOption<TValue extends string> = {
    value: TValue;
    label: string;
};

const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: "ALL", label: "All Statuses" },
    { value: "PENDING", label: "Pending Review" },
];

const PRIORITY_OPTIONS: readonly FilterOption<PriorityFilter>[] = [
    { value: "ALL", label: "All Priorities" },
    { value: "STAT", label: "STAT" },
    { value: "URGENT", label: "Urgent" },
    { value: "NORMAL", label: "Normal" },
];

const FLAG_OPTIONS: readonly FilterOption<FlagFilter>[] = [
    { value: "ALL", label: "All Flags" },
    { value: "FLAGGED", label: "Flagged" },
    { value: "CRITICAL", label: "Critical" },
    { value: "HIGH", label: "High" },
    { value: "LOW", label: "Low" },
    { value: "NORMAL", label: "Normal" },
];

const FILTER_SELECT_CLASS =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20";

const isCriticalFlag = (flag?: string | null) =>
    flag === "CRITICAL_HIGH" || flag === "CRITICAL_LOW";

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

    useEffect(() => {
        const loadPendingClinicalResults = async () => {
            try {
                setLoading(true);
                setError(null);

                const firstPage = await getPendingClinicalResults(0, FETCH_PAGE_SIZE);

                if (firstPage.totalPages <= 1) {
                    setResults(firstPage.content ?? []);
                    return;
                }

                const remainingPages = await Promise.all(
                    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
                        getPendingClinicalResults(index + 1, FETCH_PAGE_SIZE)
                    )
                );

                setResults([
                    ...(firstPage.content ?? []),
                    ...remainingPages.flatMap((resultPage) => resultPage.content ?? []),
                ]);
            } catch (loadError) {
                console.error("Failed to load pending clinical results", loadError);
                setError("Failed to load pending clinical results. Please try again.");
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        void loadPendingClinicalResults();
    }, []);

    const pendingCount = results.filter((result) => result.status === "TECHNICALLY_VERIFIED").length;
    const flaggedCount = results.filter((result) => isFlaggedResult(result.flag)).length;
    const criticalCount = results.filter((result) => isCriticalFlag(result.flag)).length;

    const searchedResults = useMemo(() => {
        const query = search.trim().toLowerCase();

        return results.filter((result) => matchesSearch(result, query));
    }, [results, search]);

    // Each dropdown counts the rows left by the other two dropdowns, so a number
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

    const isFiltering =
        statusFilter !== "ALL" ||
        priorityFilter !== "ALL" ||
        flagFilter !== "ALL" ||
        search.trim().length > 0;

    const handleClearFilters = () => {
        setStatusFilter("ALL");
        setPriorityFilter("ALL");
        setFlagFilter("ALL");
        setSearch("");
    };

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

    return (
        <div className="max-w-[1400px] mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                        Clinical Approval
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        Clinical Worklist
                    </h1>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <span className="material-icons text-blue-600">medical_services</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{pendingCount}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">Pending Review</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <span className="material-icons text-amber-600">flag</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{flaggedCount}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">Flagged Results</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                            <span className="material-icons text-red-600">warning</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{criticalCount}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">Critical Cases</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 mb-6">
                <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            aria-label="Filter by status"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                            className={FILTER_SELECT_CLASS}
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label} ({option.count})
                                </option>
                            ))}
                        </select>

                        <select
                            aria-label="Filter by priority"
                            value={priorityFilter}
                            onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                            className={FILTER_SELECT_CLASS}
                        >
                            {priorityOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label} ({option.count})
                                </option>
                            ))}
                        </select>

                        <select
                            aria-label="Filter by flag state"
                            value={flagFilter}
                            onChange={(event) => setFlagFilter(event.target.value as FlagFilter)}
                            className={FILTER_SELECT_CLASS}
                        >
                            {flagOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label} ({option.count})
                                </option>
                            ))}
                        </select>

                        {isFiltering && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    <div className="relative xl:ml-auto flex-1 xl:max-w-[420px]">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Search by result ID, patient, test group, or MLT..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/50 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-6 py-4 border-b border-slate-100">Result ID</th>
                                <th className="px-4 py-4 border-b border-slate-100">Patient</th>
                                <th className="px-4 py-4 border-b border-slate-100">Test Group</th>
                                <th className="px-4 py-4 border-b border-slate-100">Verified By</th>
                                <th className="px-4 py-4 border-b border-slate-100">Priority</th>
                                <th className="px-4 py-4 border-b border-slate-100">Status</th>
                                <th className="px-6 py-4 border-b border-slate-100 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400 text-sm">
                                        Loading clinical worklist...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="text-sm text-slate-500">{error}</span>
                                            <button
                                                type="button"
                                                onClick={() => window.location.reload()}
                                                className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredResults.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400 text-sm">
                                        No clinical cases found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                paginatedResults.map((result) => (
                                    <tr
                                        key={result.resultId}
                                        className={`border-b border-slate-50 last:border-0 transition-colors ${isCriticalFlag(result.flag)
                                            ? "bg-rose-50/40 hover:bg-rose-100/50"
                                            : "hover:bg-slate-50/50"
                                            }`}
                                    >
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-mono text-[13px] font-bold text-slate-700 break-all">
                                                    {formatDisplayId(result.resultId, "RES")}
                                                </div>
                                                <div className="mt-1 text-xs font-medium text-slate-400">
                                                    Updated {formatTimestamp(result.updatedAt ?? result.createdAt)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm font-bold text-slate-800">
                                                {result.patientName || "Unknown patient"}
                                            </div>
                                            {result.patientCode && (
                                                <div className="mt-0.5 font-mono text-xs text-slate-500">
                                                    {result.patientCode}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-sm font-semibold text-slate-700">
                                                {result.testType || "Unknown Test Group"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-sm font-semibold text-slate-700">
                                                {result.technicianName || result.mltName || "-"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            {getPriorityBadge(result.priorityLevel)}
                                        </td>
                                        <td className="px-4 py-4">
                                            {getClinicalStatusBadge(result.status)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleReview(result)}
                                                className="px-4 py-2 text-xs font-bold rounded-lg transition-colors text-white bg-primary hover:bg-primary/90 shadow-sm shadow-primary/30"
                                            >
                                                Review
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && !error && totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 text-sm font-medium text-slate-500">
                        <span>
                            Page {page + 1} of {totalPages} •{" "}
                            <span className="text-slate-400">
                                {filteredResults.length.toLocaleString()} matching
                            </span>
                        </span>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setPage((previous) => Math.max(0, previous - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((previous) => Math.min(totalPages - 1, previous + 1))}
                                disabled={page >= totalPages - 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
