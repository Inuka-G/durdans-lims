'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PRIORITY_COLORS, QC_STATUS_CONFIG, formatStatusLabel } from '@/constants/sample-lifecycle';
import { getPendingVerificationResults, type TestResultSummary } from '@/lib/api';
import { formatDisplayId } from '@/lib/format-id';

const PAGE_SIZE = 10;

/** Any non-normal analyte flag needs supervisor attention. */
const hasCriticalTriage = (result: TestResultSummary) => {
    if (result.hasCriticalFinding === true) {
        return true;
    }
    const flag = result.flag?.toUpperCase();
    return Boolean(flag && flag !== 'NORMAL');
};

/** Panic-range findings only, so "Critical" stays a strict subset of "Flagged". */
const hasCriticalRange = (result: TestResultSummary) => {
    if (result.hasCriticalFinding === true) {
        return true;
    }
    const flag = result.flag?.toUpperCase();
    return flag === 'CRITICAL_HIGH' || flag === 'CRITICAL_LOW';
};

type StatusFilter = 'ALL' | 'PENDING' | 'RETURNED_TO_SUPERVISOR';
type PriorityFilter = 'ALL' | 'STAT' | 'URGENT' | 'NORMAL';
type FlagFilter = 'ALL' | 'CRITICAL' | 'FLAGGED' | 'NORMAL';

interface FilterCriteria {
    search: string;
    status: StatusFilter;
    priority: PriorityFilter;
    flag: FlagFilter;
}

const matchesSearchQuery = (result: TestResultSummary, query: string) => {
    if (query.length === 0) {
        return true;
    }

    const displayResultId = formatDisplayId(result.resultId, 'RES').toLowerCase();

    return (
        result.resultId.toLowerCase().includes(query) ||
        displayResultId.includes(query) ||
        (result.patientCode ?? '').toLowerCase().includes(query) ||
        (result.patientName ?? '').toLowerCase().includes(query) ||
        (result.testType ?? '').toLowerCase().includes(query) ||
        (result.mltName ?? result.technicianName ?? '').toLowerCase().includes(query) ||
        (result.priorityLevel ?? '').toLowerCase().includes(query) ||
        (result.flag ?? '').toLowerCase().includes(query)
    );
};

const matchesStatusFilter = (result: TestResultSummary, status: StatusFilter) => {
    if (status === 'ALL') {
        return true;
    }

    if (status === 'PENDING') {
        return result.status === 'ENTERED';
    }

    return result.status === 'RETURNED_FOR_RECHECK';
};

const matchesPriorityFilter = (result: TestResultSummary, priority: PriorityFilter) =>
    priority === 'ALL' || (result.priorityLevel ?? '').toUpperCase() === priority;

const matchesFlagFilter = (result: TestResultSummary, flag: FlagFilter) => {
    if (flag === 'ALL') {
        return true;
    }

    if (flag === 'CRITICAL') {
        return hasCriticalRange(result);
    }

    if (flag === 'FLAGGED') {
        return hasCriticalTriage(result);
    }

    return !hasCriticalTriage(result);
};

const filterResults = (results: TestResultSummary[], criteria: FilterCriteria) =>
    results.filter(
        (result) =>
            matchesSearchQuery(result, criteria.search) &&
            matchesStatusFilter(result, criteria.status) &&
            matchesPriorityFilter(result, criteria.priority) &&
            matchesFlagFilter(result, criteria.flag)
    );

const buildFilterOptions = <T extends string>(
    scope: TestResultSummary[],
    options: ReadonlyArray<{ value: T; label: string }>,
    matches: (result: TestResultSummary, value: T) => boolean
) =>
    options.map((option) => ({
        value: option.value,
        label: `${option.label} (${scope.filter((result) => matches(result, option.value)).length})`
    }));

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'PENDING', label: 'Pending Verification' },
    { value: 'RETURNED_TO_SUPERVISOR', label: 'Returned to Supervisor' }
];

const PRIORITY_FILTER_OPTIONS: ReadonlyArray<{ value: PriorityFilter; label: string }> = [
    { value: 'ALL', label: 'All Priorities' },
    { value: 'STAT', label: 'STAT' },
    { value: 'URGENT', label: 'Urgent' },
    { value: 'NORMAL', label: 'Normal' }
];

const FLAG_FILTER_OPTIONS: ReadonlyArray<{ value: FlagFilter; label: string }> = [
    { value: 'ALL', label: 'All Flags' },
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'FLAGGED', label: 'Flagged' },
    { value: 'NORMAL', label: 'Normal' }
];

const FILTER_SELECT_CLASS =
    'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20';

const RESULT_FLAG_CONFIG: Record<string, { label: string; className: string }> = {
    NORMAL: { label: 'NORMAL', className: 'bg-slate-100 text-slate-600' },
    LOW: { label: 'LOW', className: 'bg-amber-100 text-amber-700' },
    HIGH: { label: 'HIGH', className: 'bg-amber-100 text-amber-700' },
    CRITICAL_LOW: { label: 'CRITICAL LOW', className: 'bg-red-100 text-red-700' },
    CRITICAL_HIGH: { label: 'CRITICAL HIGH', className: 'bg-red-100 text-red-700' }
};

const getResultFlagBadge = (flag?: string | null, hasCriticalFinding?: boolean | null) => {
    if (hasCriticalFinding && (!flag || flag.toUpperCase() === 'NORMAL')) {
        return RESULT_FLAG_CONFIG.CRITICAL_HIGH;
    }

    if (!flag) {
        return { label: '-', className: 'bg-slate-100 text-slate-600' };
    }

    return RESULT_FLAG_CONFIG[flag.toUpperCase()] ?? {
        label: formatStatusLabel(flag),
        className: 'bg-slate-100 text-slate-600'
    };
};

const formatTimestamp = (value?: string | null) => {
    if (!value) {
        return '—';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString('en-LK', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getVerificationLabel = (status?: string | null) => {
    if (status === 'RETURNED_FOR_RECHECK') {
        return 'Returned to Supervisor';
    }

    return 'Pending Verification';
};

const getStatusBadgeClassName = (status?: string | null) => {
    if (status === 'RETURNED_FOR_RECHECK') {
        return 'bg-orange-100 text-orange-700';
    }

    return 'bg-sky-100 text-sky-700';
};

const getQcStatusConfig = (qcStatus?: string | null) => {
    if (!qcStatus) {
        return { label: '?', className: 'bg-slate-100 text-slate-700' };
    }

    const normalizedStatus = qcStatus.toUpperCase();

    if (normalizedStatus in QC_STATUS_CONFIG) {
        const config = QC_STATUS_CONFIG[normalizedStatus as keyof typeof QC_STATUS_CONFIG];
        return { label: config.label, className: config.className };
    }

    return { label: qcStatus, className: 'bg-slate-100 text-slate-700' };
};

const getSpecimenPriorityBadge = (priorityLevel?: string | null) => {
    if (!priorityLevel) {
        return { label: '—', className: 'bg-slate-100 text-slate-600' };
    }

    const key = priorityLevel.toUpperCase() as keyof typeof PRIORITY_COLORS;

    return {
        label: formatStatusLabel(priorityLevel),
        className: PRIORITY_COLORS[key] ?? 'bg-slate-100 text-slate-600'
    };
};

export default function PendingVerificationPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [results, setResults] = useState<TestResultSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
    const [flagFilter, setFlagFilter] = useState<FlagFilter>('ALL');
    const [expandedReason, setExpandedReason] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPendingResults = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await getPendingVerificationResults(0, 1000);

            setResults(response.content || []);
            setExpandedReason(null);
        } catch (loadError) {
            console.error('Failed to load pending verification results', loadError);
            setError('Failed to load pending verification results. Please try again.');
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPendingResults();
    }, [loadPendingResults, pathname]);

    const criteria = useMemo<FilterCriteria>(
        () => ({
            search: searchQuery.trim().toLowerCase(),
            status: statusFilter,
            priority: priorityFilter,
            flag: flagFilter
        }),
        [searchQuery, statusFilter, priorityFilter, flagFilter]
    );

    const filteredResults = useMemo(() => filterResults(results, criteria), [results, criteria]);

    // Reset to page 1 whenever search or any filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, priorityFilter, flagFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(Math.max(1, totalPages));
        }
    }, [currentPage, totalPages]);

    const paginatedResults = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return filteredResults.slice(startIndex, startIndex + PAGE_SIZE);
    }, [filteredResults, currentPage]);

    // Dropdowns count against the full dataset
    const statusOptions = useMemo(
        () =>
            buildFilterOptions(
                filterResults(results, { ...criteria, status: 'ALL' }),
                STATUS_FILTER_OPTIONS,
                matchesStatusFilter
            ),
        [results, criteria]
    );

    const priorityOptions = useMemo(
        () =>
            buildFilterOptions(
                filterResults(results, { ...criteria, priority: 'ALL' }),
                PRIORITY_FILTER_OPTIONS,
                matchesPriorityFilter
            ),
        [results, criteria]
    );

    const flagOptions = useMemo(
        () =>
            buildFilterOptions(
                filterResults(results, { ...criteria, flag: 'ALL' }),
                FLAG_FILTER_OPTIONS,
                matchesFlagFilter
            ),
        [results, criteria]
    );

    const totalPending = results.filter((result) => result.status === 'ENTERED').length;
    const returnedToSupervisorCount = results.filter(
        (result) => result.status === 'RETURNED_FOR_RECHECK'
    ).length;
    const criticalPending = results.filter((result) => hasCriticalRange(result)).length;
    const isFiltering =
        searchQuery.trim().length > 0 ||
        statusFilter !== 'ALL' ||
        priorityFilter !== 'ALL' ||
        flagFilter !== 'ALL';

    const handleClearFilters = () => {
        setSearchQuery('');
        setStatusFilter('ALL');
        setPriorityFilter('ALL');
        setFlagFilter('ALL');
    };

    const handleReview = (resultId: string) => {
        router.push(`/verification/review/${resultId}`);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                            Technical Verification
                        </p>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                            Verification Dashboard
                        </h1>
                    </div>
                </div>

                <div className="mb-8 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Pending Verification</p>
                                <p className="mt-3 text-3xl font-bold text-slate-900">{totalPending}</p>
                            </div>
                            <DashboardCardIcon tone="sky">
                                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                                    <path d="M9 3h6" strokeLinecap="round" />
                                    <path d="M12 8v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="12" cy="13" r="8" />
                                </svg>
                            </DashboardCardIcon>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Returned to Supervisor</p>
                                <p className="mt-3 text-3xl font-bold text-slate-900">{returnedToSupervisorCount}</p>
                            </div>
                            <DashboardCardIcon tone="amber">
                                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                                    <path d="M10 8 6 12l4 4" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M6 12h8a4 4 0 1 1 0 8h-1" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M14 4a4 4 0 0 1 4 4v1" strokeLinecap="round" />
                                </svg>
                            </DashboardCardIcon>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Critical Cases</p>
                                <p className="mt-3 text-3xl font-bold text-slate-900">{criticalPending}</p>
                            </div>
                            <DashboardCardIcon tone="rose">
                                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                                    <path d="M12 4 4 18h16L12 4Z" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M12 9v4" strokeLinecap="round" />
                                    <circle cx="12" cy="16" r=".8" fill="currentColor" stroke="none" />
                                </svg>
                            </DashboardCardIcon>
                        </div>
                    </div>
                </div>

                <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                            aria-label="Filter by verification status"
                            className={FILTER_SELECT_CLASS}
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={priorityFilter}
                            onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                            aria-label="Filter by priority"
                            className={FILTER_SELECT_CLASS}
                        >
                            {priorityOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={flagFilter}
                            onChange={(event) => setFlagFilter(event.target.value as FlagFilter)}
                            aria-label="Filter by result flag"
                            className={FILTER_SELECT_CLASS}
                        >
                            {flagOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        {isFiltering && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="w-full max-w-md">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search by patient name, patient code, test, result ID, or technician"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                        />
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Result ID
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Patient
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Test Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        MLT Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        QC Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Priority Level
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100 bg-white">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-14 text-center">
                                            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
                                                <p className="text-sm font-medium text-slate-700">
                                                    Loading pending verification results...
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-14 text-center">
                                            <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
                                                <p className="text-base font-semibold text-slate-900">{error}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void loadPendingResults();
                                                    }}
                                                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredResults.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-14 text-center">
                                            <div className="mx-auto max-w-md">
                                                <p className="text-base font-semibold text-slate-900">
                                                    {isFiltering
                                                        ? 'No cases match the current search or filter'
                                                        : 'No cases are currently waiting for supervisor review'}
                                                </p>
                                                <p className="mt-2 text-sm text-slate-500">
                                                    {isFiltering
                                                        ? 'Try changing the search term or filter to see more results.'
                                                        : 'Newly entered, returned, or critical cases will appear here automatically.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedResults.map((result) => {
                                        const isReturned = result.status === 'RETURNED_FOR_RECHECK';
                                        const isExpanded = expandedReason === result.resultId;
                                        const hasCritical = hasCriticalRange(result);
                                        const returnReasonId = `return-reason-${result.resultId}`;

                                        return (
                                            <React.Fragment key={result.resultId}>
                                                <tr
                                                    className={`cursor-pointer transition ${hasCritical ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}
                                                    onClick={(event) => {
                                                        const target = event.target as HTMLElement;
                                                        if (target.closest('button, a')) {
                                                            return;
                                                        }
                                                        handleReview(result.resultId);
                                                    }}
                                                >
                                                    <td className="px-4 py-4 align-top">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReview(result.resultId)}
                                                            className="text-left text-sm font-semibold text-slate-900 transition hover:text-sky-700"
                                                            title={result.resultId}
                                                        >
                                                            {formatDisplayId(result.resultId, 'RES')}
                                                        </button>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            Updated {formatTimestamp(result.updatedAt)}
                                                        </p>
                                                    </td>

                                                    <td className="px-4 py-4 align-top">
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {result.patientName || 'Unknown patient'}
                                                        </p>
                                                        {result.patientCode && (
                                                            <p className="mt-0.5 font-mono text-xs text-slate-500">
                                                                {result.patientCode}
                                                            </p>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-4 align-top">
                                                        <p className="text-sm font-medium text-slate-700">
                                                            {result.testType || '-'}
                                                        </p>
                                                    </td>

                                                    <td className="px-4 py-4 align-top">
                                                        <p className="text-sm text-slate-700">
                                                            {result.mltName || result.technicianName || '-'}
                                                        </p>
                                                    </td>

                                                    <td className="px-4 py-4 align-top">
                                                        {(() => {
                                                            const qcStatus = getQcStatusConfig(result.qcStatus);
                                                            return (
                                                                <span
                                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${qcStatus.className}`}
                                                                >
                                                                    {qcStatus.label}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>

                                                    <td className="px-4 py-4 align-top">
                                                        {(() => {
                                                            const priority = getSpecimenPriorityBadge(result.priorityLevel);
                                                            return (
                                                                <span
                                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priority.className}`}
                                                                >
                                                                    {priority.label}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>

                                                    <td className="px-4 py-4 align-top">
                                                        <span
                                                             className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(result.status)}`}
                                                        >
                                                            {getVerificationLabel(result.status)}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-4 align-top text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {isReturned && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setExpandedReason((previous) =>
                                                                            previous === result.resultId
                                                                                ? null
                                                                                : result.resultId
                                                                        )
                                                                    }
                                                                    aria-expanded={isExpanded}
                                                                    aria-controls={returnReasonId}
                                                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                                                >
                                                                    {isExpanded ? 'Hide Info' : 'View Info'}
                                                                </button>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() => handleReview(result.resultId)}
                                                                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
                                                            >
                                                                Review
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {isReturned && isExpanded && (
                                                    <tr id={returnReasonId} className="bg-amber-50/60">
                                                        <td colSpan={8} className="px-6 py-4">
                                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                                                <p className="text-sm font-semibold text-amber-900">
                                                                    {getVerificationLabel(result.status)}
                                                                </p>
                                                                {result.pathologistName && (
                                                                    <p className="mt-1 text-xs font-medium text-amber-700">
                                                                        Returned by: {result.pathologistName}
                                                                    </p>
                                                                )}
                                                                <p className="mt-1 text-sm text-amber-800">
                                                                    {result.returnReason || 'No return reason provided.'}
                                                                </p>
                                                                <p className="mt-2 text-xs text-amber-700">
                                                                    Last updated: {formatTimestamp(result.updatedAt)}
                                                                </p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-500">
                            Showing {filteredResults.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{' '}
                            {Math.min(currentPage * PAGE_SIZE, filteredResults.length)} of {filteredResults.length} results
                        </p>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((previous) => Math.max(previous - 1, 1))}
                                disabled={currentPage === 1 || loading}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="px-2 text-sm font-medium text-slate-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setCurrentPage((previous) =>
                                        previous < totalPages ? previous + 1 : previous
                                    )
                                }
                                disabled={loading || currentPage >= totalPages}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const DashboardCardIcon = ({
    tone,
    children
}: {
    tone: 'sky' | 'amber' | 'rose';
    children: React.ReactNode;
}) => {
    const toneClasses = {
        sky: 'bg-sky-100 text-sky-700',
        amber: 'bg-amber-100 text-amber-700',
        rose: 'bg-rose-100 text-rose-700'
    };

    return (
        <span
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[tone]}`}
        >
            {children}
        </span>
    );
};
